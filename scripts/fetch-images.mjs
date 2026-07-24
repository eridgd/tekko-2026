#!/usr/bin/env node
/**
 * Downloads every image the app needs into public/img/ and re-encodes to WebP.
 *
 * The app must work with zero network after first load, so nothing may hot-link
 * eventeny.com. If an asset isn't on disk here, it doesn't exist in the app.
 */
import { readFile, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RAW_DIR, IMG_DIR, MAPS, PIC_BASE, UA } from './lib/constants.mjs';

const exec = promisify(execFile);

/** Eventeny serves this exact byte length as its "missing image" placeholder. */
const PLACEHOLDER_SIZE = 19688;

async function download(filename, dest) {
  const res = await fetch(PIC_BASE + filename, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${filename}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === PLACEHOLDER_SIZE) throw new Error(`placeholder returned for ${filename}`);
  await writeFile(dest, buf);
  return buf.length;
}

/** Re-encode to WebP; falls back to keeping the original if convert fails. */
async function toWebp(src, dest, { width, quality = 82 } = {}) {
  const args = [src];
  if (width) args.push('-resize', `${width}>`);
  args.push('-quality', String(quality), dest);
  await exec('convert', args);
  await unlink(src);
  return (await stat(dest)).size;
}

async function main() {
  await mkdir(join(IMG_DIR, 'maps'), { recursive: true });
  await mkdir(join(IMG_DIR, 'guests'), { recursive: true });

  let totalIn = 0;
  let totalOut = 0;

  console.log('Map backgrounds:');
  for (const map of MAPS) {
    const raw = JSON.parse(await readFile(join(RAW_DIR, `map-${map.id}.json`), 'utf8'));
    const src = raw.map_info.back_2400 || raw.map_info.back_1200;
    if (!src) {
      console.warn(`  ! ${map.key}: no background image`);
      continue;
    }
    const tmp = join(IMG_DIR, 'maps', `${map.key}.orig`);
    const out = join(IMG_DIR, 'maps', `${map.key}.webp`);
    const inSize = await download(src, tmp);
    // The floor map is the one you squint at to read room numbers — keep it sharp.
    const outSize = await toWebp(tmp, out, { quality: map.kind === 'pins' ? 88 : 82 });
    totalIn += inSize;
    totalOut += outSize;
    console.log(`  ${map.key}.webp  ${(inSize / 1024).toFixed(0)}KB -> ${(outSize / 1024).toFixed(0)}KB`);
  }

  const sessions = JSON.parse(await readFile(join(RAW_DIR, 'sessions.json'), 'utf8'));
  const guests = new Map();
  for (const s of Object.values(sessions.all_sessions)) {
    for (const g of s.guests ?? []) if (g.image) guests.set(g.id, g.image);
  }

  console.log(`\nGuest photos (${guests.size}):`);
  let ok = 0;
  let failed = 0;
  for (const [id, image] of guests) {
    const tmp = join(IMG_DIR, 'guests', `${id}.orig`);
    const out = join(IMG_DIR, 'guests', `${id}.webp`);
    try {
      const inSize = await download(image, tmp);
      const outSize = await toWebp(tmp, out, { width: 400, quality: 80 });
      totalIn += inSize;
      totalOut += outSize;
      ok++;
    } catch (err) {
      failed++;
      console.warn(`  ! guest ${id}: ${err.message}`);
      await unlink(tmp).catch(() => {});
    }
  }
  console.log(`  ${ok} downloaded, ${failed} failed`);

  console.log(
    `\nTotal: ${(totalIn / 1024 / 1024).toFixed(1)}MB -> ${(totalOut / 1024 / 1024).toFixed(1)}MB`
  );
}

main().catch((err) => {
  console.error(`\nImage fetch failed: ${err.message}`);
  process.exit(1);
});
