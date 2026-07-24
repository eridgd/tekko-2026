import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RAW_DIR = join(ROOT, 'data', 'raw');
export const OUT_DIR = join(ROOT, 'public', 'data');
export const IMG_DIR = join(ROOT, 'public', 'img');

export const EVENT_ID = 21858;
export const BIZ_ID = 51198;

/** Con runs Thu 2026-07-23 through Sun 2026-07-26, all times America/New_York. */
export const TIMEZONE = 'America/New_York';

/**
 * Sessions starting before this hour belong to the previous con day —
 * Thursday's midnight anime block is "Thursday night", not "Friday morning".
 */
export const CON_DAY_ROLLOVER_HOUR = 4;

export const MAPS = [
  { id: 22626, key: 'floor', title: 'Convention Floor Map', kind: 'pins' },
  { id: 21054, key: 'exhibit', title: 'Exhibit Hall', kind: 'booths' },
  { id: 22364, key: 'artistalley', title: "Artist Alley", kind: 'booths' },
];

export const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Eventeny stores every uploaded asset under this path. */
export const PIC_BASE = 'https://www.eventeny.com/event-pics/';
