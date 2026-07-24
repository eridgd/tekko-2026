import { describe, expect, it } from 'vitest';
import { findConflicts, conflictedIds, isCommitment } from './conflicts';
import type { Session } from '../types';

/** Minimal session factory — times in hours from an arbitrary epoch base. */
function session(id: string, startHour: number, durHours: number, extra: Partial<Session> = {}): Session {
  const start = 1_784_800_000 + startHour * 3600;
  return {
    id,
    title: `Session ${id}`,
    desc: null,
    day: '2026-07-24',
    start,
    end: start + durHours * 3600,
    startMin: startHour * 60,
    durMin: durHours * 60,
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

describe('isCommitment', () => {
  it('accepts a normal scheduled event', () => {
    expect(isCommitment(session('a', 10, 1))).toBe(true);
    });

  it('rejects drop-in rooms', () => {
    // "Expo Hall open 10-7" would otherwise clash with everything.
    expect(isCommitment(session('a', 10, 9, { dropIn: true }))).toBe(false);
  });

  it('rejects zero-length marker events', () => {
    // e.g. "Anime LARP Room Closes" — an instant, not a commitment.
    expect(isCommitment(session('a', 23, 0))).toBe(false);
  });

  it('rejects events with broken upstream times', () => {
    expect(isCommitment(session('a', 10, 1, { issue: 'end-before-start' }))).toBe(false);
  });
});

describe('findConflicts', () => {
  it('finds a simple overlap', () => {
    const a = session('a', 10, 2); // 10:00-12:00
    const b = session('b', 11, 2); // 11:00-13:00
    const conflicts = findConflicts([a, b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.overlapMin).toBe(60);
  });

  it('does not flag back-to-back events', () => {
    // Ending exactly when the next starts is not a conflict — you can walk.
    const a = session('a', 10, 1); // 10:00-11:00
    const b = session('b', 11, 1); // 11:00-12:00
    expect(findConflicts([a, b])).toHaveLength(0);
  });

  it('ignores drop-in sessions entirely', () => {
    const expo = session('expo', 10, 9, { dropIn: true });
    const panel = session('panel', 11, 1);
    expect(findConflicts([expo, panel])).toHaveLength(0);
  });

  it('finds every pair in a three-way pile-up', () => {
    const a = session('a', 10, 3);
    const b = session('b', 11, 3);
    const c = session('c', 12, 1);
    const conflicts = findConflicts([a, b, c]);
    expect(conflicts).toHaveLength(3);
  });

  it('reports the exact overlap window', () => {
    const a = session('a', 10, 2);
    const b = session('b', 11, 3);
    const [conflict] = findConflicts([a, b]);
    expect(conflict!.from).toBe(b.start);
    expect(conflict!.to).toBe(a.end);
    expect(conflict!.overlapMin).toBe(60);
  });

  it('handles an unsorted input list', () => {
    const later = session('later', 14, 2);
    const earlier = session('earlier', 13, 2);
    expect(findConflicts([later, earlier])).toHaveLength(1);
  });

  it('returns nothing for a clean schedule', () => {
    const day = [session('a', 9, 1), session('b', 11, 1), session('c', 14, 2)];
    expect(findConflicts(day)).toHaveLength(0);
  });

  it('does not compare events that are far apart', () => {
    const morning = session('m', 9, 1);
    const evening = session('e', 20, 1);
    expect(findConflicts([morning, evening])).toHaveLength(0);
  });
});

describe('conflictedIds', () => {
  it('collects both sides of every clash', () => {
    const a = session('a', 10, 2);
    const b = session('b', 11, 2);
    const c = session('c', 20, 1);
    const ids = conflictedIds(findConflicts([a, b, c]));
    expect(ids).toEqual(new Set(['a', 'b']));
  });
});
