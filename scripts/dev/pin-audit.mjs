#!/usr/bin/env node
/**
 * Dev tool: renders ROOM_PINS onto the floor map so you can eyeball whether each
 * pin actually lands on its room. Writes numbered markers + a legend.
 *
 *   node scripts/dev/pin-audit.mjs        -> data/pin-audit.png
 *   node scripts/dev/pin-audit.mjs --bands -> also writes cropped bands
 *
 * Not part of the build. This is how the coordinates in lib/rooms.mjs were verified.
 */
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT, RAW_DIR, IMG_DIR } from '../lib/constants.mjs';
import { ROOM_PINS, UNMAPPED_TRACKS } from '../lib/rooms.mjs';
import { decodeEntities } from '../lib/categories.mjs';

const exec = promisify(execFile);
const W = 1600;
const H = 2400;
const OUT_DIR = join(ROOT, 'data');

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const sessions = JSON.parse(await readFile(join(RAW_DIR, 'sessions.json'), 'utf8'));
  const titles = new Map();
  for (const s of Object.values(sessions.all_sessions)) {
    titles.set(String(s.track_id), decodeEntities(s.track_title));
  }

  const entries = Object.entries(ROOM_PINS);
  const args = [join(IMG_DIR, 'maps', 'floor.webp'), '-resize', `${W}x${H}!`];

  entries.forEach(([trackId, pin], i) => {
    const px = Math.round(pin.x * W);
    const py = Math.round(pin.y * H);
    const n = i + 1;
    args.push(
      '-stroke', 'black', '-strokewidth', '3', '-fill', 'rgba(255,0,255,0.85)',
      '-draw', `circle ${px},${py} ${px + 22},${py}`,
      '-stroke', 'none', '-fill', 'white', '-pointsize', '26',
      '-draw', `text ${px - (n > 9 ? 15 : 8)},${py + 10} "${n}"`
    );
  });

  const out = join(OUT_DIR, 'pin-audit.png');
  await exec('convert', [...args, out]);

  console.log(`${entries.length} pins -> data/pin-audit.png\n`);
  entries.forEach(([trackId, pin], i) => {
    const title = titles.get(trackId) ?? '(no sessions on this track)';
    console.log(
      `${String(i + 1).padStart(2)}. F${pin.floor} ${String(pin.room).padEnd(30)} ${title}`
    );
  });

  const missing = [...titles.keys()].filter(
    (id) => !ROOM_PINS[id] && !UNMAPPED_TRACKS[id]
  );
  if (missing.length) {
    console.log('\nTracks with NO pin and NOT in UNMAPPED_TRACKS:');
    for (const id of missing) console.log(`  ${id}  ${titles.get(id)}`);
  } else {
    console.log('\nEvery track is either pinned or explicitly unmapped.');
  }

  if (process.argv.includes('--bands')) {
    const bands = [[0, 700], [650, 1300], [1250, 1900], [1850, 2400]];
    for (const [i, [y0, y1]] of bands.entries()) {
      await exec('convert', [
        out, '-crop', `${W}x${y1 - y0}+0+${y0}`, '+repage',
        '-resize', '1100x', join(OUT_DIR, `pin-band${i}.png`),
      ]);
    }
    console.log(`\nWrote ${bands.length} band crops.`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
