# Tekko 2026 Companion

An unofficial schedule, map and personal planner for [Tekko 2026](https://www.eventeny.com/events/tekko2026-21858/)
(Pittsburgh, July 23–26 2026). Static site, no backend, **works fully offline**.

Built because the official Eventeny listing is hard to use on a phone while you're
actually walking the convention floor.

## What it does

- **Now** — what's running this minute and what starts soon, with a nudge toward your next saved event
- **Schedule** — all 943 events, as an agenda or a classic con grid; filter by category, room and audience; full-text search
- **My Schedule** — save events, get **conflict warnings** for overlaps, export to `.ics`
- **Maps** — the convention floor map with tappable room pins, plus pan/zoom images of the Exhibit Hall and Artist Alley (Tekko only publishes booth numbers, not vendor names, so those two are the printed map, not an overlay)
- **Guests** — the 39 industry guests and every session they're in

Tap the location on any event to jump to its exact spot on the floor map, then jump straight back.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN, for phone testing)
npm run build        # -> dist/
npm test             # unit tests
```

## Refreshing the schedule mid-con

Tekko moves and cancels things during the weekend. Eventeny sends no CORS headers,
so the browser can't call their API directly — the data is snapshotted at build time.
To pick up changes:

```bash
npm run refresh      # re-fetch + rebuild + validate + re-download images
git commit -am "refresh schedule data"
git push             # your host redeploys from the repo
```

`npm run refresh` runs three steps, and any of them will stop the build rather than
ship bad data:

| Step | What it does |
| --- | --- |
| `npm run fetch` | POSTs Eventeny's `SessionRoute.php` and `map-routes.php` into `data/raw/`. Refuses to overwrite a good snapshot with a suspiciously small response. |
| `npm run data` | Normalizes into `public/data/*.json` and runs the validator. |
| `npm run images` | Re-downloads map backgrounds and guest photos, re-encodes to WebP. |

`data/raw/` is committed, so you can `git diff` a refresh to see exactly what the
con changed.

The app shows its own snapshot date under Settings, so stale data is never silently
presented as current.

### If validation fails

`scripts/validate.mjs` is the gate. The two failures you're most likely to hit:

- **`"other" category above 5%`** — Tekko changed their tag vocabulary. Add the new
  tokens to `scripts/lib/categories.mjs`.
- **`track NNN has no map pin`** — Tekko added a room. Add coordinates to
  `scripts/lib/rooms.mjs`, or add it to `UNMAPPED_TRACKS` if it genuinely isn't on
  the floor map.

## How the data works

One POST to Eventeny returns all 943 sessions complete — verified that per-session
detail requests return identical data, so there's no N+1 fetching.

Two things can't be derived from their data and are **hand-curated**:

1. **Categories** (`scripts/lib/categories.mjs`). The raw `tags` field is a
   pipe-delimited string with 261 distinct tokens mixing real categories (`Panel`,
   `18+`) with presenter names (`Zeke Changuris`) and boilerplate (`Tekko`, on 86
   sessions, meaning nothing). These are curated into 16 categories plus audience
   flags, with a track-based fallback. Currently 0.6% land in "Other".

2. **Map pins** (`scripts/lib/rooms.mjs`). Eventeny's convention floor map has *no*
   vector elements — it's a flat 1600×2400 JPEG. Coordinates for all 40 rooms were
   read off a grid overlay and visually verified. Regenerate the audit render with:

   ```bash
   node scripts/dev/pin-audit.mjs --bands
   ```

### Known upstream data problems

These are Tekko's, not the app's. They're handled rather than hidden:

- One session ("Journey through Fire") lists an end time *before* its start. The
  detail view says so explicitly instead of showing a nonsense duration.
- Artist Alley booth "56" is positioned off the edge of the map image in Eventeny's
  own data. Searching for it says "not placed on the map".
- Several all-day entries (open play rooms, badge challenges) run 9–14 hours. These
  are treated as **drop-in** and excluded from conflict warnings, so "Expo Hall open
  10–7" doesn't clash with everything you save.
- Six anime screenings start after midnight. A **4am con-day rollover** groups them
  under the previous night, where you'd actually look for them.

## Offline

No runtime network calls at all. Schedule JSON, all three map images and all 39
guest photos are bundled and precached by the service worker; fonts are the system
stack. Every feature — search, filters, map pan/zoom, saving, conflicts, `.ics`
export — is pure client-side computation over bundled data, so nothing degrades
when the signal dies.

Saved events live in `localStorage` keyed by session id (stable across refreshes).
Nothing leaves the device; there's no account and no analytics.

## Deploying

Build with `npm run build` and serve the `dist/` folder on any static host —
the output is plain files, and hash routing means no server-side rewrite rules
are required.

For a git-connected host, set the build command to `npm run build` and the
publish directory to `dist`. The repo includes a config file that sets those
plus cache headers (so a mid-con data refresh reaches already-installed apps);
it's optional and harmless on hosts that ignore it.

## Not affiliated

Unofficial and not endorsed by Tekko or PittJCS. Schedule content is theirs.
**Trust signage at the room over this app.**
