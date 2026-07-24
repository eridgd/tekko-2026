import { CON_DAY_ROLLOVER_HOUR } from './constants';

/**
 * Everything time-related is anchored to America/New_York, because that's where
 * the con is. The device might be in any timezone (or have the wrong clock), so
 * we never rely on the browser's local time for *labels* — those are baked at
 * build time. We only use the device clock to answer "is this happening now?",
 * and even then we convert into con-local time first.
 */

const ET = 'America/New_York';

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: ET,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export interface ConClock {
  /** Con-day key this moment falls in, e.g. "2026-07-25". */
  day: string;
  /** Minutes since midnight of that con day (>1440 after midnight). */
  minutes: number;
  /** Unix seconds. */
  epoch: number;
}

/** Where we are in con-local terms right now (or at a given instant). */
export function conClock(at: Date = new Date()): ConClock {
  const parts = partsFmt.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const year = get('year');
  const month = get('month');
  const dayNum = get('day');
  // Intl renders midnight as "24" in some engines under hour12:false.
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));

  let day = `${year}-${month}-${dayNum}`;
  let minutes = hour * 60 + minute;

  if (hour < CON_DAY_ROLLOVER_HOUR) {
    const prev = new Date(Date.UTC(Number(year), Number(month) - 1, Number(dayNum) - 1));
    day = prev.toISOString().slice(0, 10);
    minutes += 24 * 60;
  }

  return { day, minutes, epoch: Math.floor(at.getTime() / 1000) };
}

/** "2026-07-25" -> "Saturday". Pure string math, no Date parsing pitfalls. */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function weekdayOf(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return WEEKDAYS[dt.getUTCDay()]!;
}

/** Minutes-into-con-day -> "9:30 PM". Handles the >1440 after-midnight range. */
export function formatMinutes(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** Rounds down to the hour, for time-slot grouping headers. */
export function slotKey(startMin: number): number {
  return Math.floor(startMin / 60) * 60;
}

export function formatDuration(min: number): string {
  if (min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** "in 25 min" / "in 2h 10m" / "started 15 min ago". */
export function relativeLabel(deltaMin: number): string {
  const abs = Math.abs(Math.round(deltaMin));
  if (abs < 1) return 'now';
  const text = abs < 60 ? `${abs} min` : formatDuration(abs);
  return deltaMin > 0 ? `in ${text}` : `${text} ago`;
}
