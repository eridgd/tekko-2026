#!/usr/bin/env node
/**
 * Data integrity gate. Runs after build-data and fails the build on anything
 * that would show up as a broken or lying UI.
 *
 * The app ships a frozen snapshot, so there's no runtime to catch these — if a
 * refresh mid-con introduces a new track or a new tag vocabulary, this is what
 * tells us before it reaches the phone.
 */
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { OUT_DIR, ROOT } from './lib/constants.mjs';
import { CATEGORY_IDS } from './lib/categories.mjs';
import { UNMAPPED_TRACKS } from './lib/rooms.mjs';

const MAX_OTHER_RATIO = 0.05;

const errors = [];
const notes = [];
const fail = (m) => errors.push(m);

const exists = (p) => access(p).then(() => true, () => false);

async function main() {
  const schedule = JSON.parse(await readFile(join(OUT_DIR, 'schedule.json'), 'utf8'));
  const { maps } = JSON.parse(await readFile(join(OUT_DIR, 'maps.json'), 'utf8'));
  const { guests } = JSON.parse(await readFile(join(OUT_DIR, 'guests.json'), 'utf8'));

  const { sessions, tracks, days } = schedule;
  const dayKeys = new Set(days.map((d) => d.key));
  const guestIds = new Set(guests.map((g) => g.id));

  // --- sessions ---
  if (sessions.length < 500) fail(`only ${sessions.length} sessions — snapshot looks truncated`);

  const seen = new Set();
  let other = 0;
  for (const s of sessions) {
    if (seen.has(s.id)) fail(`duplicate session id ${s.id}`);
    seen.add(s.id);

    if (!s.title?.trim()) fail(`session ${s.id} has no title`);
    if (!CATEGORY_IDS.has(s.cat)) fail(`session ${s.id} has unknown category "${s.cat}"`);
    if (s.cat === 'other') other++;
    if (!dayKeys.has(s.day)) fail(`session ${s.id} has day "${s.day}" outside the con`);
    if (!Number.isFinite(s.start) || !Number.isFinite(s.end)) {
      fail(`session ${s.id} has non-numeric times`);
    }
    if (s.durMin < 0) fail(`session ${s.id} has negative duration after normalization`);
    if (!Number.isFinite(s.startMin)) fail(`session ${s.id} has bad startMin`);
    if (!s.calStart || !s.calEnd) fail(`session ${s.id} is missing calendar fields (.ics export)`);
    for (const g of s.guests ?? []) {
      if (!guestIds.has(g)) fail(`session ${s.id} references unknown guest ${g}`);
    }
    // Entity decoding should have run everywhere text is displayed.
    if (/&(amp|quot|#0?39|lt|gt);/.test(`${s.title}${s.desc ?? ''}${s.loc}${s.track}`)) {
      fail(`session ${s.id} still contains HTML entities`);
    }
  }

  const ratio = other / sessions.length;
  if (ratio > MAX_OTHER_RATIO) {
    fail(
      `${other}/${sessions.length} (${(ratio * 100).toFixed(1)}%) sessions fell through to "other" ` +
        `— max ${MAX_OTHER_RATIO * 100}%. Tag vocabulary probably changed; update lib/categories.mjs.`
    );
  } else {
    notes.push(`"other" category: ${other}/${sessions.length} (${(ratio * 100).toFixed(1)}%)`);
  }

  // --- tracks / map pins ---
  for (const t of tracks) {
    if (!t.mapped && !UNMAPPED_TRACKS[t.id]) {
      fail(`track ${t.id} "${t.title}" has no map pin and is not in UNMAPPED_TRACKS`);
    }
    if (t.mapped && (t.floor == null || !t.room)) {
      fail(`track ${t.id} "${t.title}" is pinned but missing floor/room`);
    }
  }
  const trackIds = new Set(tracks.map((t) => t.id));
  for (const s of sessions) {
    if (!trackIds.has(s.trackId)) fail(`session ${s.id} references unknown track ${s.trackId}`);
  }
  notes.push(`${tracks.filter((t) => t.mapped).length}/${tracks.length} tracks pinned on the map`);

  // --- maps ---
  const inUnit = (v) => Number.isFinite(v) && v >= -0.02 && v <= 1.02;
  for (const m of maps) {
    if (!(await exists(join(ROOT, 'public', m.image)))) fail(`map image missing: ${m.image}`);
    if (!m.width || !m.height) fail(`map ${m.key} has no dimensions`);

    for (const p of m.pins ?? []) {
      if (!inUnit(p.x) || !inUnit(p.y)) fail(`map ${m.key} pin for track ${p.trackId} is off-image`);
      if (!trackIds.has(p.trackId)) fail(`map ${m.key} pins unknown track ${p.trackId}`);
    }
    // A handful of off-canvas booths is upstream sloppiness we tolerate and
    // label in the UI; a large jump means the coordinate system changed.
    const off = (m.booths ?? []).filter((b) => !inUnit(b.x) || !inUnit(b.y));
    for (const b of off) {
      if (!b.offMap) fail(`map ${m.key} booth ${b.id} is off-image but not flagged offMap`);
    }
    if (m.booths?.length && off.length / m.booths.length > 0.02) {
      fail(
        `map ${m.key}: ${off.length}/${m.booths.length} booths are off-image — ` +
          `coordinate system likely changed`
      );
    } else if (off.length) {
      notes.push(`map ${m.key}: ${off.length} off-canvas booth(s), flagged for the UI`);
    }
    const count = m.pins?.length ?? m.booths?.length ?? 0;
    if (count === 0) fail(`map ${m.key} has no pins or booths — nothing to interact with`);
    notes.push(`map ${m.key}: ${m.width}x${m.height}, ${count} elements`);
  }

  // --- guests ---
  for (const g of guests) {
    if (!g.name?.trim()) fail(`guest ${g.id} has no name`);
    if (g.photo && !(await exists(join(ROOT, 'public', g.photo)))) {
      fail(`guest photo missing on disk: ${g.photo}`);
    }
  }
  notes.push(`${guests.filter((g) => g.photo).length}/${guests.length} guests have a local photo`);

  // --- report ---
  for (const n of notes) console.log(`  ok  ${n}`);

  if (errors.length) {
    console.error(`\n${errors.length} validation error(s):`);
    for (const e of errors) console.error(`  FAIL  ${e}`);
    process.exit(1);
  }
  console.log('\nAll data validation checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
