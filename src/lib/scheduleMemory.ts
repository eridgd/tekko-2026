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
  /**
   * Canonical filter serialization, e.g. "/schedule?day=2026-07-25&cat=panel"
   * — always the `filtersToParams` form, so it compares equal to the ?back=
   * links cards carry even when the address bar shows a bare "/schedule".
   */
  hash: string;
  /** Window scroll position (agenda view — the page itself scrolls). */
  scrollY: number;
  /**
   * Agenda: id + viewport offset of the topmost card still in view. Cards use
   * content-visibility, so on a fresh mount offscreen cards have placeholder
   * heights and a bare pixel offset lands on the wrong content; "this card,
   * this many px from the viewport top" is exact. scrollY stays as a fallback
   * for when the card is gone (e.g. filtered out) by the time we return.
   */
  anchorId?: string;
  anchorTop?: number;
  /** Grid view: offsets of the .grid element, which scrolls on both axes. */
  gridLeft?: number;
  gridTop?: number;
}

/** Pure validation half of getScheduleMemory, split out for unit testing. */
export function parseScheduleMemory(raw: string | null): ScheduleMemory | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.hash !== 'string' || typeof parsed?.scrollY !== 'number') {
      return null;
    }
    const memory: ScheduleMemory = { hash: parsed.hash, scrollY: parsed.scrollY };
    if (typeof parsed.anchorId === 'string' && typeof parsed.anchorTop === 'number') {
      memory.anchorId = parsed.anchorId;
      memory.anchorTop = parsed.anchorTop;
    }
    if (typeof parsed.gridLeft === 'number' && typeof parsed.gridTop === 'number') {
      memory.gridLeft = parsed.gridLeft;
      memory.gridTop = parsed.gridTop;
    }
    return memory;
  } catch {
    return null; /* bad JSON — treat as no memory */
  }
}

export function getScheduleMemory(): ScheduleMemory | null {
  try {
    return parseScheduleMemory(sessionStorage.getItem(KEY));
  } catch {
    return null; /* private mode — treat as no memory */
  }
}

export function setScheduleMemory(memory: ScheduleMemory): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* nothing we can do; restoration just won't happen */
  }
}
