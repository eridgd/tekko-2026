import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  EMPTY_FILTERS,
  filtersFromParams,
  filtersToParams,
  isLive,
  isPast,
  parseQuery,
  activeFilterCount,
} from './filters';
import type { AppData, Session } from '../types';

function session(id: string, extra: Partial<Session> = {}): Session {
  const start = 1_784_800_000;
  return {
    id,
    title: `Session ${id}`,
    desc: null,
    day: '2026-07-24',
    start,
    end: start + 3600,
    startMin: 10 * 60,
    durMin: 60,
    startLabel: '',
    endLabel: '',
    hideEnd: false,
    trackId: 1,
    track: 'Panel 1',
    loc: 'Panel 1',
    cat: 'panel',
    flags: [],
    guests: [],
    calStart: '',
    calEnd: '',
    ...extra,
  };
}

const data = {
  guestById: new Map([[7, { id: 7, name: 'Kaiji Tang' }]]),
} as unknown as AppData;

const ctx = (over: Partial<{ nowDay: string; nowMinutes: number }> = {}) => ({
  data,
  savedIds: new Set<string>(),
  nowDay: '2026-07-24',
  nowMinutes: 12 * 60,
  ...over,
});

describe('parseQuery', () => {
  it('splits into lowercase terms and drops empties', () => {
    expect(parseQuery('  Cosplay   REPAIR ')).toEqual(['cosplay', 'repair']);
    expect(parseQuery('')).toEqual([]);
  });
});

describe('applyFilters', () => {
  it('returns everything when no filters are set', () => {
    const list = [session('a'), session('b')];
    expect(applyFilters(list, EMPTY_FILTERS, ctx())).toHaveLength(2);
  });

  it('filters by day', () => {
    const list = [session('a'), session('b', { day: '2026-07-25' })];
    const out = applyFilters(list, { ...EMPTY_FILTERS, day: '2026-07-25' }, ctx());
    expect(out.map((s) => s.id)).toEqual(['b']);
  });

  it('filters by category', () => {
    const list = [session('a', { cat: 'panel' }), session('b', { cat: 'dance' })];
    const out = applyFilters(list, { ...EMPTY_FILTERS, cats: ['dance'] }, ctx());
    expect(out.map((s) => s.id)).toEqual(['b']);
  });

  it('treats multiple categories as OR', () => {
    const list = [
      session('a', { cat: 'panel' }),
      session('b', { cat: 'dance' }),
      session('c', { cat: 'music' }),
    ];
    const out = applyFilters(list, { ...EMPTY_FILTERS, cats: ['dance', 'music'] }, ctx());
    expect(out.map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('treats multiple audience flags as AND', () => {
    const list = [
      session('a', { flags: ['adult'] }),
      session('b', { flags: ['adult', 'featured'] }),
    ];
    const out = applyFilters(list, { ...EMPTY_FILTERS, flags: ['adult', 'featured'] }, ctx());
    expect(out.map((s) => s.id)).toEqual(['b']);
  });

  it('searches across title, description, location and guest names', () => {
    const list = [
      session('a', { title: 'Voice Acting Q&A', guests: [7] }),
      session('b', { title: 'Knitting', desc: 'Bring yarn' }),
      session('c', { title: 'Elsewhere', loc: 'Stage Uzume' }),
    ];
    expect(applyFilters(list, { ...EMPTY_FILTERS, query: 'kaiji' }, ctx()).map((s) => s.id)).toEqual(['a']);
    expect(applyFilters(list, { ...EMPTY_FILTERS, query: 'yarn' }, ctx()).map((s) => s.id)).toEqual(['b']);
    expect(applyFilters(list, { ...EMPTY_FILTERS, query: 'uzume' }, ctx()).map((s) => s.id)).toEqual(['c']);
  });

  it('requires all search terms to match, in any order', () => {
    const list = [session('a', { title: 'Repair Your Cosplay' })];
    expect(applyFilters(list, { ...EMPTY_FILTERS, query: 'cosplay repair' }, ctx())).toHaveLength(1);
    expect(applyFilters(list, { ...EMPTY_FILTERS, query: 'cosplay banana' }, ctx())).toHaveLength(0);
  });

  it('filters to saved only', () => {
    const list = [session('a'), session('b')];
    expect(applyFilters(list, { ...EMPTY_FILTERS, savedOnly: true }, ctx())).toHaveLength(0);

    const withSaved = { ...ctx(), savedIds: new Set(['b']) };
    expect(applyFilters(list, { ...EMPTY_FILTERS, savedOnly: true }, withSaved).map((s) => s.id)).toEqual(['b']);
  });

  it('hides finished events when asked', () => {
    const list = [
      session('done', { startMin: 9 * 60, durMin: 60 }), // ends 10:00, now is 12:00
      session('live', { startMin: 11 * 60, durMin: 120 }), // 11:00-13:00
      session('later', { startMin: 15 * 60, durMin: 60 }),
    ];
    const out = applyFilters(list, { ...EMPTY_FILTERS, hidePast: true }, ctx());
    expect(out.map((s) => s.id)).toEqual(['live', 'later']);
  });

  it('combines filters conjunctively', () => {
    const list = [
      session('a', { cat: 'panel', flags: ['adult'] }),
      session('b', { cat: 'panel', flags: [] }),
      session('c', { cat: 'dance', flags: ['adult'] }),
    ];
    const out = applyFilters(list, { ...EMPTY_FILTERS, cats: ['panel'], flags: ['adult'] }, ctx());
    expect(out.map((s) => s.id)).toEqual(['a']);
  });
});

describe('isPast / isLive', () => {
  const now = { nowDay: '2026-07-24', nowMinutes: 12 * 60 };

  it('identifies a running event', () => {
    expect(isLive(session('a', { startMin: 11 * 60, durMin: 120 }), now)).toBe(true);
    expect(isPast(session('a', { startMin: 11 * 60, durMin: 120 }), now)).toBe(false);
  });

  it('treats an event ending exactly now as past, not live', () => {
    const s = session('a', { startMin: 11 * 60, durMin: 60 });
    expect(isLive(s, now)).toBe(false);
    expect(isPast(s, now)).toBe(true);
  });

  it('never marks a future day as past', () => {
    expect(isPast(session('a', { day: '2026-07-26', startMin: 9 * 60 }), now)).toBe(false);
  });

  it('marks an earlier con day as past', () => {
    expect(isPast(session('a', { day: '2026-07-23', startMin: 23 * 60 }), now)).toBe(true);
  });

  it('is not live on a different day', () => {
    expect(isLive(session('a', { day: '2026-07-25', startMin: 11 * 60, durMin: 120 }), now)).toBe(false);
  });
});

describe('URL round trip', () => {
  it('survives serialization', () => {
    const filters = {
      day: '2026-07-25',
      cats: ['panel', 'dance'],
      tracks: [87718, 92217],
      flags: ['adult'],
      query: 'cosplay repair',
      savedOnly: true,
      hidePast: true,
    };
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters);
  });

  it('produces empty filters from an empty query string', () => {
    expect(filtersFromParams(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });

  it('omits defaults from the URL to keep it short', () => {
    expect(filtersToParams(EMPTY_FILTERS).toString()).toBe('');
  });

  it('ignores malformed track ids', () => {
    const f = filtersFromParams(new URLSearchParams('track=87718,notanumber'));
    expect(f.tracks).toEqual([87718]);
  });
});

describe('activeFilterCount', () => {
  it('counts filters but not the free-text query or day', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(
      activeFilterCount({ ...EMPTY_FILTERS, cats: ['a', 'b'], flags: ['adult'], savedOnly: true })
    ).toBe(4);
    expect(activeFilterCount({ ...EMPTY_FILTERS, query: 'hello', day: '2026-07-24' })).toBe(0);
  });
});
