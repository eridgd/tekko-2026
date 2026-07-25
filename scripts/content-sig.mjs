#!/usr/bin/env node
/**
 * Prints a content signature of the built app data (schedule + maps + guests),
 * ignoring the build timestamps in schedule.json. Used by the auto-refresh cron
 * to push ONLY when the data users actually see has changed — not when the
 * upstream API merely reordered its JSON or the build stamped a new time.
 *
 *   node scripts/content-sig.mjs [dir]   # dir defaults to public/data
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const dir = process.argv[2] || 'public/data';

const schedule = JSON.parse(readFileSync(join(dir, 'schedule.json'), 'utf8'));
delete schedule.generatedAt;
delete schedule.fetchedAt;

const hash = createHash('sha256');
hash.update(JSON.stringify(schedule));
hash.update(readFileSync(join(dir, 'maps.json'), 'utf8'));
hash.update(readFileSync(join(dir, 'guests.json'), 'utf8'));

process.stdout.write(hash.digest('hex'));
