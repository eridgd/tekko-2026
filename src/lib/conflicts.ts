import type { Session } from '../types';

export interface Conflict {
  a: Session;
  b: Session;
  /** Unix seconds of the overlapping window. */
  from: number;
  to: number;
  overlapMin: number;
}

/**
 * A session counts as a scheduling commitment (and so can clash) only if it has
 * real duration and isn't a drop-in. "Expo Hall open 10am-7pm" and the
 * zero-length "Anime LARP Room Closes" markers would otherwise clash with
 * everything you save and make the warnings useless.
 */
export function isCommitment(s: Session): boolean {
  return !s.dropIn && s.durMin > 0 && !s.issue;
}

/**
 * All overlapping pairs among the given sessions.
 * O(n log n): sort by start, then only compare against still-open neighbours.
 */
export function findConflicts(sessions: Session[]): Conflict[] {
  const items = sessions.filter(isCommitment).sort((a, b) => a.start - b.start);
  const conflicts: Conflict[] = [];
  const open: Session[] = [];

  for (const s of items) {
    // Drop anything that finished before this one starts.
    for (let i = open.length - 1; i >= 0; i--) {
      if (open[i]!.end <= s.start) open.splice(i, 1);
    }
    for (const other of open) {
      const from = Math.max(other.start, s.start);
      const to = Math.min(other.end, s.end);
      if (to > from) {
        conflicts.push({
          a: other,
          b: s,
          from,
          to,
          overlapMin: Math.round((to - from) / 60),
        });
      }
    }
    open.push(s);
  }

  return conflicts;
}

/** Session ids involved in at least one clash — for flagging cards inline. */
export function conflictedIds(conflicts: Conflict[]): Set<string> {
  const ids = new Set<string>();
  for (const c of conflicts) {
    ids.add(c.a.id);
    ids.add(c.b.id);
  }
  return ids;
}
