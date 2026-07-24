/**
 * Per-session memory of the Schedule view: which day/filters you were looking
 * at, and how far you'd scrolled.
 *
 * Two things restore from this:
 *   1. Tapping the Schedule tab returns you to the day + filters you left on.
 *   2. Backing out of an event detail lands you at the scroll position you left.
 *
 * sessionStorage, not localStorage, is deliberate: within a visit it remembers
 * where you were; a fresh launch starts clean and the view defaults to the
 * current con day. Coming back to the app hours later, "today" is more useful
 * than a stale scroll offset from this morning.
 */

const KEY = 'tekko.session.schedule';

export interface ScheduleMemory {
  /** Full hash route, e.g. "/schedule?day=2026-07-25&cat=panel". */
  hash: string;
  scrollY: number;
}

export function getScheduleMemory(): ScheduleMemory | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.hash === 'string' && typeof parsed?.scrollY === 'number') {
      return parsed;
    }
  } catch {
    /* private mode / bad JSON — treat as no memory */
  }
  return null;
}

export function setScheduleMemory(memory: ScheduleMemory): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* nothing we can do; restoration just won't happen */
  }
}
