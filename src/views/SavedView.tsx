import { useMemo } from 'react';
import { useStore } from '../store';
import { StickyHeader } from '../components/StickyHeader';
import { SessionCard } from '../components/SessionCard';
import { EmptyState } from '../components/EmptyState';
import { findConflicts, conflictedIds } from '../lib/conflicts';
import { downloadIcs } from '../lib/ics';
import { formatMinutes, weekdayOf } from '../lib/time';
import { useScrollRestore } from '../hooks/useScrollRestore';
import { IconAlert, IconChevronRight, IconDownload } from '../components/Icons';

export function SavedView() {
  const { savedSessions, missingSaved, clearMissing, storageOk, prefs, setPrefs } = useStore();
  const pageRef = useScrollRestore('saved');
  const conflictsOpen = !prefs.conflictsCollapsed;

  const conflicts = useMemo(() => findConflicts(savedSessions), [savedSessions]);
  const clashing = useMemo(() => conflictedIds(conflicts), [conflicts]);

  const byDay = useMemo(() => {
    const groups = new Map<string, typeof savedSessions>();
    for (const s of savedSessions) {
      const list = groups.get(s.day);
      if (list) list.push(s);
      else groups.set(s.day, [s]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [savedSessions]);

  return (
    <>
      <StickyHeader>
        <div className="hdr__bar">
          <div className="hdr__title">
            My Schedule
            <span className="hdr__sub">
              {savedSessions.length} event{savedSessions.length === 1 ? '' : 's'}
              {conflicts.length > 0 && ` · ${conflicts.length} clash${conflicts.length === 1 ? '' : 'es'}`}
            </span>
          </div>
          {savedSessions.length > 0 && (
            <button
              className="iconbtn"
              aria-label="Export my schedule to calendar"
              onClick={() => downloadIcs(savedSessions, 'tekko-2026-my-schedule.ics', 'Tekko 2026')}
            >
              <IconDownload size={21} />
            </button>
          )}
        </div>
      </StickyHeader>

      <div className="page" ref={pageRef}>
        {!storageOk && (
          <p className="notice notice--warn">
            <IconAlert size={18} />
            <span>
              Your browser is blocking local storage, so saved events won't survive a reload.
              Private browsing mode is the usual cause.
            </span>
          </p>
        )}

        {missingSaved.length > 0 && (
          <div className="notice notice--warn">
            <IconAlert size={18} />
            <span>
              {missingSaved.length} saved event{missingSaved.length === 1 ? ' is' : 's are'} no
              longer in Tekko's schedule — they were probably cancelled or moved.{' '}
              <button className="linkbtn" onClick={clearMissing}>
                Dismiss
              </button>
            </span>
          </div>
        )}

        {savedSessions.length === 0 ? (
          <EmptyState
            icon="⭐"
            title="No saved events yet"
            body="Tap the star on any event to build your own schedule. It's stored on this device — no account needed."
            action={{ label: 'Browse the schedule', href: '#/schedule' }}
          />
        ) : (
          <>
            {conflicts.length > 0 && (
              <section>
                <button
                  className="collapsehead"
                  aria-expanded={conflictsOpen}
                  onClick={() => setPrefs({ conflictsCollapsed: conflictsOpen })}
                >
                  <IconAlert size={14} />
                  <span className="collapsehead__title">
                    Overlapping events
                    <span className="collapsehead__count">{conflicts.length}</span>
                  </span>
                  <IconChevronRight
                    size={18}
                    className={`collapsehead__chev${conflictsOpen ? ' collapsehead__chev--open' : ''}`}
                  />
                </button>
                {conflictsOpen &&
                  conflicts.map((c) => (
                    <div className="clash" key={`${c.a.id}-${c.b.id}`}>
                      <p className="clash__head">
                        {weekdayOf(c.a.day)} ·{' '}
                        {formatMinutes(Math.max(c.a.startMin, c.b.startMin))} — these overlap by{' '}
                        {c.overlapMin} min
                      </p>
                      <div className="clash__pair">
                        <a href={`#/event/${c.a.id}`}>{c.a.title}</a>
                        <span className="clash__vs">vs</span>
                        <a href={`#/event/${c.b.id}`}>{c.b.title}</a>
                      </div>
                    </div>
                  ))}
              </section>
            )}

            {byDay.map(([day, items]) => (
              <section key={day}>
                <h2 className="sectiontitle">
                  {weekdayOf(day)} <span className="sectiontitle__count">{items.length}</span>
                </h2>
                <div className="cardlist">
                  {items.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      backTo="/saved"
                      conflicted={clashing.has(s.id)}
                    />
                  ))}
                </div>
              </section>
            ))}

            <div className="detail__secondary">
              <button
                className="btn btn--ghost btn--sm"
                onClick={() =>
                  downloadIcs(savedSessions, 'tekko-2026-my-schedule.ics', 'Tekko 2026')
                }
              >
                <IconDownload size={17} />
                Export {savedSessions.length} events to calendar
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
