import type { AppData, Session } from '../types';

export interface Filters {
  day: string | null;
  cats: string[];
  tracks: number[];
  flags: string[];
  query: string;
  savedOnly: boolean;
  hidePast: boolean;
}

export const EMPTY_FILTERS: Filters = {
  day: null,
  cats: [],
  tracks: [],
  flags: [],
  query: '',
  savedOnly: false,
  hidePast: false,
};

export function activeFilterCount(f: Filters): number {
  return f.cats.length + f.tracks.length + f.flags.length + (f.savedOnly ? 1 : 0);
}

/**
 * Searchable text per session, built lazily and memoized on first search.
 * Precomputing all 943 up front costs ~15ms of startup we don't need to spend
 * if you never open the search box.
 */
const haystacks = new WeakMap<Session, string>();

function haystack(s: Session, data: AppData): string {
  let cached = haystacks.get(s);
  if (cached === undefined) {
    const guestNames = s.guests
      .map((id) => data.guestById.get(id)?.name ?? '')
      .filter(Boolean)
      .join(' ');
    cached = [s.title, s.desc ?? '', s.loc, s.track, (s.presenters ?? []).join(' '), guestNames]
      .join(' ')
      .toLowerCase();
    haystacks.set(s, cached);
  }
  return cached;
}

/**
 * All terms must match somewhere (AND). Matching whole terms rather than the
 * raw string means "cosplay repair" finds "Repair Your Cosplay".
 */
export function matchesQuery(s: Session, terms: string[], data: AppData): boolean {
  if (!terms.length) return true;
  const hay = haystack(s, data);
  return terms.every((t) => hay.includes(t));
}

export function parseQuery(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export interface ApplyContext {
  data: AppData;
  savedIds: Set<string>;
  /** Con-day key + minutes, for "hide past". */
  nowDay: string;
  nowMinutes: number;
}

export function applyFilters(sessions: Session[], f: Filters, ctx: ApplyContext): Session[] {
  const terms = parseQuery(f.query);
  const cats = new Set(f.cats);
  const tracks = new Set(f.tracks);
  const flags = f.flags;

  return sessions.filter((s) => {
    if (f.day && s.day !== f.day) return false;
    if (cats.size && !cats.has(s.cat)) return false;
    if (tracks.size && !tracks.has(s.trackId)) return false;
    // Flags are AND-ed: "18+ and Featured" means both.
    if (flags.length && !flags.every((flag) => s.flags.includes(flag as never))) return false;
    if (f.savedOnly && !ctx.savedIds.has(s.id)) return false;
    if (f.hidePast && isPast(s, ctx)) return false;
    if (!matchesQuery(s, terms, ctx.data)) return false;
    return true;
  });
}

/** Past = finished. A drop-in room that's still open is not past. */
export function isPast(s: Session, ctx: Pick<ApplyContext, 'nowDay' | 'nowMinutes'>): boolean {
  if (s.day !== ctx.nowDay) return s.day < ctx.nowDay;
  return s.startMin + Math.max(s.durMin, 0) <= ctx.nowMinutes;
}

export function isLive(s: Session, ctx: Pick<ApplyContext, 'nowDay' | 'nowMinutes'>): boolean {
  if (s.day !== ctx.nowDay) return false;
  const end = s.startMin + Math.max(s.durMin, 0);
  return s.startMin <= ctx.nowMinutes && ctx.nowMinutes < end;
}

/* ------------------------------------------------------------------ *
 * URL hash serialization — a filtered view should survive a reload
 * and be shareable.
 * ------------------------------------------------------------------ */

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.day) p.set('day', f.day);
  if (f.cats.length) p.set('cat', f.cats.join(','));
  if (f.tracks.length) p.set('track', f.tracks.join(','));
  if (f.flags.length) p.set('flag', f.flags.join(','));
  if (f.query) p.set('q', f.query);
  if (f.savedOnly) p.set('saved', '1');
  if (f.hidePast) p.set('future', '1');
  return p;
}

export function filtersFromParams(p: URLSearchParams): Filters {
  const list = (key: string) => (p.get(key) ?? '').split(',').filter(Boolean);
  return {
    day: p.get('day'),
    cats: list('cat'),
    tracks: list('track').map(Number).filter(Number.isFinite),
    flags: list('flag'),
    query: p.get('q') ?? '',
    savedOnly: p.get('saved') === '1',
    hidePast: p.get('future') === '1',
  };
}
