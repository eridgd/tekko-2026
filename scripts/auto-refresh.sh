#!/usr/bin/env bash
#
# Hourly schedule auto-refresh for the Tekko 2026 companion.
#
# Pulls the latest data from Eventeny, and ONLY if the actual schedule content
# changed (not just fetch timestamps), rebuilds, validates, commits and pushes —
# which triggers a Netlify redeploy. Designed to run from cron with a bare
# environment, so it sets its own PATH and logs everything to a file.
#
# Install (already done by setup): an hourly cron entry on the con days.
# Watch it:   tail -f ~/tekko-auto-refresh.log
set -uo pipefail

REPO="/media/evan/8TB_WD/Tekko"
LOG="$HOME/tekko-auto-refresh.log"
# cron has almost no PATH; add nvm's node plus the usual dirs.
export PATH="/home/evan/.nvm/versions/node/v22.3.0/bin:/usr/local/bin:/usr/bin:/bin"

ts()  { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*" >>"$LOG"; }
notify() {
  # Best-effort desktop notification; the log + git history are the real record.
  command -v notify-send >/dev/null 2>&1 && DISPLAY=:0 notify-send "Tekko schedule" "$1" 2>/dev/null || true
}

cd "$REPO" || { log "ERROR: cannot cd to $REPO"; exit 1; }
log "──── run start ────"

# Stay in sync with the remote so our push is a fast-forward.
if ! git pull --rebase --autostash origin main >>"$LOG" 2>&1; then
  log "ERROR: git pull failed — skipping this run"
  exit 1
fi

# Pull the latest upstream data. fetch-raw refuses suspiciously small responses
# (returns non-zero), so a transient upstream hiccup won't wipe good data.
if ! npm run fetch >>"$LOG" 2>&1; then
  log "fetch failed (likely a transient upstream error) — skipping this run"
  git checkout -- data/raw/ 2>/dev/null || true
  exit 0
fi

# Session count of what's currently published (before rebuild), for the message.
OLD=$(node -e "try{process.stdout.write(String(require('./public/data/schedule.json').sessions.length))}catch{process.stdout.write('?')}" 2>/dev/null)

# Rebuild + validate. If validation fails, the new upstream data broke an
# invariant (new unmapped room, tag vocabulary drift, etc.) — do NOT publish;
# leave it for a human. (Build is deterministic, so identical upstream content
# produces identical output regardless of how the API ordered its JSON.)
if ! npm run data >>"$LOG" 2>&1; then
  log "VALIDATION FAILED — not pushing. Needs manual attention (see log above)."
  notify "Refresh validation FAILED — manual fix needed"
  git checkout -- data/ public/data/ 2>/dev/null || true
  exit 1
fi

# Compare the built app CONTENT (ignoring timestamps) against what's committed.
# Diffing the raw file would false-trigger when the API just reorders its JSON;
# this only fires on changes users would actually see.
NEWSIG=$(node scripts/content-sig.mjs public/data 2>/dev/null)
OLDDIR=$(mktemp -d)
for f in schedule maps guests; do git show "HEAD:public/data/$f.json" >"$OLDDIR/$f.json" 2>/dev/null; done
OLDSIG=$(node scripts/content-sig.mjs "$OLDDIR" 2>/dev/null)
rm -rf "$OLDDIR"

if [ -n "$NEWSIG" ] && [ "$NEWSIG" = "$OLDSIG" ]; then
  log "no schedule changes"
  git checkout -- data/ public/data/ public/img/ 2>/dev/null || true
  exit 0
fi

log "SCHEDULE CHANGED — validated, publishing"

# Refresh images too (new guest photos, etc.). Best-effort — data is what matters.
npm run images >>"$LOG" 2>&1 || log "images step failed (continuing anyway)"

NEW=$(node -e "process.stdout.write(String(require('./public/data/schedule.json').sessions.length))" 2>/dev/null)

git add data/raw public/data public/img
if ! git commit -m "Auto-refresh schedule data (${OLD} → ${NEW} sessions)" >>"$LOG" 2>&1; then
  log "nothing staged to commit (unexpected) — skipping push"
  exit 0
fi

if git push origin main >>"$LOG" 2>&1; then
  log "PUSHED ✓  sessions ${OLD} → ${NEW}. Netlify will redeploy."
  notify "Schedule updated & pushed (${OLD} → ${NEW} sessions)"
else
  log "PUSH FAILED — change is committed locally; push it manually."
  notify "Refresh committed but PUSH FAILED — push manually"
  exit 1
fi
