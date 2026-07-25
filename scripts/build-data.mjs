#!/usr/bin/env node
/**
 * Normalizes data/raw/ into the three JSON files the app actually loads.
 *
 * Everything the UI needs is precomputed here so the client does zero parsing
 * work at startup beyond JSON.parse — it runs on a phone on dead con wifi.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  RAW_DIR, OUT_DIR, IMG_DIR, MAPS, TIMEZONE, CON_DAY_ROLLOVER_HOUR,
} from './lib/constants.mjs';
import { classify, decodeEntities, CATEGORIES, FLAGS } from './lib/categories.mjs';
import { ROOM_PINS, UNMAPPED_TRACKS } from './lib/rooms.mjs';

const exec = promisify(execFile);

/**
 * Sessions at or above this length are open rooms / free play / all-day
 * challenges rather than things you show up to at a specific time. They're
 * excluded from conflict warnings — otherwise "Expo Hall open 10-7" would
 * clash with everything you save.
 */
const DROP_IN_MINUTES = 6 * 60;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Which con day a session belongs to. Eventeny gives us `start_calendar` as a
 * naive local (America/New_York) wall-clock string, which is what we want —
 * a 1am screening is Thursday *night*, not Friday morning, so anything before
 * 4am rolls back to the previous day.
 */
function conDay(startCalendar) {
  const [datePart, timePart] = startCalendar.split('T');
  const hour = Number(timePart.slice(0, 2));
  if (hour >= CON_DAY_ROLLOVER_HOUR) return datePart;
  const [y, m, d] = datePart.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

/** Minutes since midnight of the con day (can exceed 1440 for after-midnight events). */
function minutesIntoConDay(startCalendar, dayKey) {
  const [datePart, timePart] = startCalendar.split('T');
  const [h, min] = timePart.split(':').map(Number);
  const rolled = datePart !== dayKey ? 24 * 60 : 0;
  return rolled + h * 60 + min;
}

function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    key,
    weekday: DAY_NAMES[dt.getUTCDay()],
    short: DAY_NAMES[dt.getUTCDay()].slice(0, 3),
    date: `${MONTHS[m - 1]} ${d}`,
  };
}

/**
 * Image dimensions via ImageMagick, with a fallback to the previously-built
 * value. The map images are static, so a scheduled data-only refresh (which may
 * run somewhere without ImageMagick installed) shouldn't fail just to re-measure
 * a picture that hasn't changed.
 */
async function imageSize(file, fallback) {
  try {
    const { stdout } = await exec('identify', ['-format', '%w %h', file]);
    const [w, h] = stdout.trim().split(/\s+/).map(Number);
    if (w > 0 && h > 0) return { width: w, height: h };
  } catch {
    /* ImageMagick not available — use the fallback below */
  }
  if (fallback?.width > 0 && fallback?.height > 0) return fallback;
  throw new Error(`Cannot determine dimensions for ${file} (no ImageMagick, no prior value)`);
}

function buildSessions(raw, warn) {
  const sessions = [];

  for (const s of Object.values(raw.all_sessions)) {
    const start = Number(s.start_time);
    const end = Number(s.end_time);
    const trackId = Number(s.track_id);
    const trackTitle = decodeEntities(s.track_title);
    const { category, flags, topics, presenters } = classify(s, s.track_title);

    const day = conDay(s.start_calendar);
    let durMin = Math.round((end - start) / 60);
    let issue = null;

    if (durMin < 0) {
      // Real upstream typo (one session: 20:00 -> 12:00). Don't invent an end
      // time; flag it so the UI can say "end time unclear" instead of lying.
      issue = 'end-before-start';
      warn(`end before start: "${decodeEntities(s.title)}" (${s.start_calendar} -> ${s.end_calendar})`);
      durMin = 0;
    }

    sessions.push({
      id: s.id,
      title: decodeEntities(s.title),
      desc: decodeEntities(s.description).trim() || null,
      day,
      start,
      end: durMin === 0 && issue ? start : end,
      startMin: minutesIntoConDay(s.start_calendar, day),
      durMin,
      startLabel: s.start_min,
      endLabel: s.end_min,
      hideEnd: s.hide_end_time === '1',
      dropIn: durMin >= DROP_IN_MINUTES || undefined,
      issue: issue ?? undefined,
      trackId,
      track: trackTitle,
      loc: decodeEntities(s.location).trim() || trackTitle,
      cat: category,
      flags,
      topics: topics.length ? topics : undefined,
      presenters: presenters.length ? presenters : undefined,
      guests: (s.guests ?? []).map((g) => Number(g.id)),
      // Pre-formatted for the .ics exporter so the client never does TZ math.
      calStart: s.start_google_calendar,
      calEnd: s.end_google_calendar,
    });
  }

  // Final tiebreak on id so the output order is fully deterministic regardless
  // of how the upstream API happened to order its JSON this fetch — otherwise a
  // pure reordering upstream would churn the built file for no real change.
  sessions.sort(
    (a, b) => a.start - b.start || a.track.localeCompare(b.track) || a.id.localeCompare(b.id)
  );
  return sessions;
}

function buildTracks(sessions) {
  const byId = new Map();
  for (const s of sessions) {
    if (!byId.has(s.trackId)) {
      const pin = ROOM_PINS[s.trackId];
      byId.set(s.trackId, {
        id: s.trackId,
        title: s.track,
        count: 0,
        floor: pin?.floor ?? null,
        room: pin?.room ?? null,
        mapped: Boolean(pin),
        unmappedReason: UNMAPPED_TRACKS[s.trackId] ?? undefined,
      });
    }
    byId.get(s.trackId).count++;
  }
  // Floor order first, then name — matches how you'd walk the building.
  return [...byId.values()].sort(
    (a, b) => (a.floor ?? 99) - (b.floor ?? 99) || a.title.localeCompare(b.title)
  );
}

function buildGuests(raw) {
  const byId = new Map();
  for (const s of Object.values(raw.all_sessions)) {
    for (const g of s.guests ?? []) {
      const id = Number(g.id);
      if (byId.has(id)) continue;
      byId.set(id, {
        id,
        name: decodeEntities(g.display_name || `${g.first_name} ${g.last_name}`).trim(),
        pronouns: g.pronouns?.trim() || undefined,
        category: decodeEntities(g.categories).trim() || undefined,
        featured: g.is_featured === '1' || undefined,
        photo: g.image ? `img/guests/${id}.webp` : undefined,
        website: g.website?.trim() || undefined,
        instagram: g.instagram?.trim() || undefined,
        youtube: g.youtube?.trim() || undefined,
        twitch: g.twitch?.trim() || undefined,
        x: g.x_twitter?.trim() || undefined,
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function buildMaps(warn) {
  // Dimensions from the last build, used as a fallback when ImageMagick isn't
  // present (e.g. an automated data-only refresh).
  const priorDims = {};
  try {
    const prior = JSON.parse(await readFile(join(OUT_DIR, 'maps.json'), 'utf8'));
    for (const m of prior.maps ?? []) priorDims[m.key] = { width: m.width, height: m.height };
  } catch {
    /* first build — no prior maps.json */
  }

  const maps = [];
  for (const def of MAPS) {
    const raw = JSON.parse(await readFile(join(RAW_DIR, `map-${def.id}.json`), 'utf8'));
    const file = join(IMG_DIR, 'maps', `${def.key}.webp`);
    const { width, height } = await imageSize(file, priorDims[def.key]);

    const map = {
      key: def.key,
      id: def.id,
      title: def.title,
      description: decodeEntities(raw.map_info.description).trim() || undefined,
      image: `img/maps/${def.key}.webp`,
      width,
      height,
      kind: def.kind,
    };

    if (def.kind === 'pins') {
      map.pins = Object.entries(ROOM_PINS).map(([trackId, pin]) => ({
        trackId: Number(trackId),
        x: pin.x,
        y: pin.y,
        floor: pin.floor,
        room: pin.room,
      }));
      if (raw.booths?.length) warn(`map ${def.key} unexpectedly has vector booths now`);
    } else {
      map.booths = (raw.booths ?? []).map((b) => {
        const x = Number(b.pos_x);
        const y = Number(b.pos_y);
        // Eventeny lets organizers drag a booth off the canvas and saves it
        // anyway. Artist Alley booth "56" sits at x=-0.11. Keep it — searching
        // for it should say "not placed on the map", not silently find nothing.
        const offMap = x < 0 || y < 0 || x > 1 || y > 1;
        if (offMap) warn(`map ${def.key}: booth "${decodeEntities(b.title)}" is off-canvas at (${x.toFixed(3)}, ${y.toFixed(3)})`);
        return {
          id: Number(b.id),
          title: decodeEntities(b.title).trim(),
          x,
          y,
          w: Number(b.width),
          h: Number(b.height),
          rotate: Number(b.rotate) || undefined,
          shape: b.shape !== 'rectangle' ? b.shape : undefined,
          color: b.color,
          offMap: offMap || undefined,
        };
      });
      map.booths.sort((a, b) => a.id - b.id); // deterministic regardless of upstream order
      map.sections = (raw.sections ?? []).map((s) => ({
        id: Number(s.id),
        title: decodeEntities(s.title ?? '').trim(),
        x: Number(s.pos_x),
        y: Number(s.pos_y),
        w: Number(s.width),
        h: Number(s.height),
        color: s.color,
      }));
      map.textBoxes = (raw.text_boxes ?? []).map((t) => ({
        text: decodeEntities(t.text ?? t.title ?? '').trim(),
        x: Number(t.pos_x),
        y: Number(t.pos_y),
        size: Number(t.text_size) || undefined,
        color: t.text_color,
      }));
    }

    maps.push(map);
  }
  return maps;
}

async function main() {
  const warnings = [];
  const warn = (m) => warnings.push(m);

  await mkdir(OUT_DIR, { recursive: true });

  const raw = JSON.parse(await readFile(join(RAW_DIR, 'sessions.json'), 'utf8'));
  const meta = JSON.parse(await readFile(join(RAW_DIR, 'meta.json'), 'utf8'));

  const sessions = buildSessions(raw, warn);
  const tracks = buildTracks(sessions);
  const guests = buildGuests(raw);
  const maps = await buildMaps(warn);

  const dayKeys = [...new Set(sessions.map((s) => s.day))].sort();
  const days = dayKeys.map((k) => ({
    ...dayLabel(k),
    count: sessions.filter((s) => s.day === k).length,
  }));

  const countBy = (fn) => {
    const c = {};
    for (const s of sessions) for (const v of [fn(s)].flat()) c[v] = (c[v] ?? 0) + 1;
    return c;
  };
  const catCounts = countBy((s) => s.cat);
  const flagCounts = countBy((s) => s.flags);

  const schedule = {
    generatedAt: new Date().toISOString(),
    fetchedAt: meta.fetchedAt,
    timezone: TIMEZONE,
    event: { id: meta.eventId, name: 'Tekko 2026', venue: 'David L. Lawrence Convention Center' },
    days,
    tracks,
    categories: CATEGORIES.filter((c) => catCounts[c.id]).map((c) => ({
      ...c,
      count: catCounts[c.id],
    })),
    flags: FLAGS.filter((f) => flagCounts[f.id]).map((f) => ({ ...f, count: flagCounts[f.id] })),
    sessions,
  };

  await writeFile(join(OUT_DIR, 'schedule.json'), JSON.stringify(schedule));
  await writeFile(join(OUT_DIR, 'maps.json'), JSON.stringify({ maps }));
  await writeFile(join(OUT_DIR, 'guests.json'), JSON.stringify({ guests }));

  const kb = (o) => (JSON.stringify(o).length / 1024).toFixed(0);
  console.log(`schedule.json  ${kb(schedule)} KB   ${sessions.length} sessions, ${days.length} days, ${tracks.length} tracks`);
  console.log(`maps.json      ${kb({ maps })} KB   ${maps.length} maps`);
  console.log(`guests.json    ${kb({ guests })} KB   ${guests.length} guests`);

  console.log('\nPer day:');
  for (const d of days) console.log(`  ${d.short} ${d.date}  ${d.count}`);
  console.log('\nPer category:');
  for (const c of schedule.categories) console.log(`  ${String(c.count).padStart(4)}  ${c.label}`);
  console.log('\nFlags:');
  for (const f of schedule.flags) console.log(`  ${String(f.count).padStart(4)}  ${f.label}`);

  if (warnings.length) {
    console.log(`\n${warnings.length} data warning(s):`);
    for (const w of warnings) console.log(`  ! ${w}`);
  }
  console.log('\nNext: npm run validate');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
