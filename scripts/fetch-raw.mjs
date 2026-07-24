#!/usr/bin/env node
/**
 * Pulls raw Tekko 2026 data from Eventeny into data/raw/.
 *
 * Eventeny sends no CORS headers, so the browser can never call these endpoints.
 * We snapshot at build time instead. Re-run this (npm run refresh) whenever the
 * con changes the schedule, then commit + push; Netlify redeploys.
 *
 * Raw snapshots are committed so a refresh can be diffed against the last one.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { RAW_DIR, EVENT_ID, BIZ_ID, MAPS, UA } from './lib/constants.mjs';

const ORIGIN = 'https://www.eventeny.com';

async function post(path, fields) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, String(v));

  const res = await fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    body,
    headers: {
      'User-Agent': UA,
      Referer: `${ORIGIN}/events/tekko2026-${EVENT_ID}/`,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);

  const data = await res.json();
  // Eventeny signals failure in-band with 200 + success:false.
  if (data.success === false) throw new Error(`${path} -> ${data.err_msg || 'success:false'}`);
  return data;
}

async function save(name, data) {
  const file = join(RAW_DIR, name);
  await writeFile(file, JSON.stringify(data, null, 1));
  const kb = (JSON.stringify(data).length / 1024).toFixed(0);
  console.log(`  wrote data/raw/${name} (${kb} KB)`);
  return data;
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });

  console.log('Fetching sessions...');
  const sessions = await post('/funcs/dashboard/events/programming/SessionRoute.php', {
    post_type: 'fetch_filtered_list',
    view_group: 'event',
    time_limit_min: '',
    time_limit_max: '',
    event_id: EVENT_ID,
    acct_id: 0,
    search: '',
    visibility_filter: 'public',
    status_filter: '',
    track_filter: '',
    tag_filter: '',
    session_filter: '',
    guest_filter: '',
    agent_filter: '',
    handler_filter: '',
    location_filter: '',
  });

  const count = Object.keys(sessions.all_sessions || {}).length;
  if (count < 100) {
    throw new Error(`Only ${count} sessions returned — refusing to overwrite a good snapshot.`);
  }
  console.log(`  ${count} sessions, timezone ${sessions.timezone}`);
  await save('sessions.json', sessions);

  for (const map of MAPS) {
    console.log(`Fetching map ${map.id} (${map.title})...`);
    const data = await post('/funcs/event/map-routes.php', {
      post_type: 'get_map_assets',
      mid: map.id,
      event_id: EVENT_ID,
      time_slot_id: 0,
    });
    console.log(`  ${data.booths?.length ?? 0} booths, ${data.sections?.length ?? 0} sections`);
    await save(`map-${map.id}.json`, data);
  }

  await save('meta.json', {
    fetchedAt: new Date().toISOString(),
    eventId: EVENT_ID,
    bizId: BIZ_ID,
    sessionCount: count,
  });

  console.log('\nDone. Next: npm run data');
}

main().catch((err) => {
  console.error(`\nFetch failed: ${err.message}`);
  console.error('Existing data/raw/ snapshot left untouched.');
  process.exit(1);
});
