import { useMemo } from 'react';
import { useStore } from '../store';
import { StickyHeader } from '../components/StickyHeader';
import { SessionCard } from '../components/SessionCard';
import { EmptyState } from '../components/EmptyState';
import { formatMinutes, relativeLabel, weekdayOf } from '../lib/time';
import { isLive } from '../lib/filters';
import { UPCOMING_WINDOW_MIN } from '../lib/constants';
import { useScrollRestore } from '../hooks/useScrollRestore';
import { IconPin, IconSettings } from '../components/Icons';
import type { Session } from '../types';

/**
 * The at-con landing view: what's on right now, what you should be walking to,
 * and what starts soon. Everything here is derived from the device clock
 * converted into con-local time.
 */
export function NowView() {
  const { data, clock, savedSessions } = useStore();
  const { days, sessions } = data.schedule;
  const pageRef = useScrollRestore('now');

  const today = days.find((d) => d.key === clock.day);
  const conStart = days[0]?.key ?? '';
  const conEnd = days[days.length - 1]?.key ?? '';

  const { live, soon, savedSoon } = useMemo(() => {
    const ctx = { nowDay: clock.day, nowMinutes: clock.minutes };
    const todays = sessions.filter((s) => s.day === clock.day);
    const savedIdSet = new Set(savedSessions.map((s) => s.id));

    const live = todays.filter((s) => isLive(s, ctx) && !s.dropIn);
    const soon = todays
      .filter(
        (s) =>
          s.startMin > ctx.nowMinutes && s.startMin - ctx.nowMinutes <= UPCOMING_WINDOW_MIN
      )
      .sort((a, b) => a.startMin - b.startMin);

    const savedSoon = savedSessions
      .filter(
        (s) =>
          s.day === clock.day &&
          s.startMin > ctx.nowMinutes &&
          s.startMin - ctx.nowMinutes <= UPCOMING_WINDOW_MIN
      )
      .sort((a, b) => a.startMin - b.startMin);

    return {
      live: live.sort(
        (a, b) => Number(savedIdSet.has(b.id)) - Number(savedIdSet.has(a.id)) || a.startMin - b.startMin
      ),
      soon,
      savedSoon,
    };
  }, [sessions, clock.day, clock.minutes, savedSessions]);

  const beforeCon = clock.day < conStart;
  const afterCon = clock.day > conEnd;

  return (
    <>
      <StickyHeader>
        <div className="hdr__bar">
          <div className="hdr__title">
            Tekko 2026
            <span className="hdr__sub">
              {today ? `${weekdayOf(clock.day)} · ${formatMinutes(clock.minutes)}` : 'Pittsburgh'}
            </span>
          </div>
          <a className="iconbtn" href="#/settings" aria-label="Settings">
            <IconSettings />
          </a>
        </div>
      </StickyHeader>

      <div className="page" ref={pageRef}>
        {beforeCon && (
          <EmptyState
            icon="🎌"
            title="Tekko hasn't started yet"
            body={`Doors open ${weekdayOf(conStart)}. Browse the schedule and start building your plan.`}
            action={{ label: 'Browse the schedule', href: '#/schedule' }}
          />
        )}

        {afterCon && (
          <EmptyState
            icon="👋"
            title="That's a wrap"
            body="Tekko 2026 has ended. Your saved schedule is still here if you want to look back."
            action={{ label: 'View My Schedule', href: '#/saved' }}
          />
        )}

        {!beforeCon && !afterCon && (
          <>
            {savedSoon.length > 0 && (
              <section className="upnext">
                <p className="upnext__kicker">You should head to</p>
                <a className="upnext__card" href={`#/event/${savedSoon[0]!.id}`}>
                  <span className="upnext__time">
                    {relativeLabel(savedSoon[0]!.startMin - clock.minutes)}
                  </span>
                  <span className="upnext__title">{savedSoon[0]!.title}</span>
                  <span className="upnext__loc">
                    <IconPin size={14} />
                    {savedSoon[0]!.loc} · {formatMinutes(savedSoon[0]!.startMin)}
                  </span>
                </a>
                {savedSoon.length > 1 && (
                  <p className="upnext__more">
                    +{savedSoon.length - 1} more saved event
                    {savedSoon.length > 2 ? 's' : ''} in the next {UPCOMING_WINDOW_MIN} minutes
                  </p>
                )}
              </section>
            )}

            <Section
              title="Happening now"
              sessions={live}
              empty="Nothing is running at this exact minute."
            />

            <Section
              title={`Starting in the next ${UPCOMING_WINDOW_MIN} minutes`}
              sessions={soon}
              empty="Nothing starts in the next hour and a half."
            />

            {live.length === 0 && soon.length === 0 && (
              <EmptyState
                icon="🌙"
                title="Quiet right now"
                body="Nothing is running or starting soon. Check the full schedule for what's on later."
                action={{ label: 'Open the schedule', href: '#/schedule' }}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  sessions,
  empty,
  hideTime,
}: {
  title: string;
  sessions: Session[];
  empty: string;
  hideTime?: boolean;
}) {
  if (sessions.length === 0) {
    return (
      <section>
        <h2 className="sectiontitle">{title}</h2>
        <p className="muted">{empty}</p>
      </section>
    );
  }
  return (
    <section>
      <h2 className="sectiontitle">
        {title} <span className="sectiontitle__count">{sessions.length}</span>
      </h2>
      <div className="cardlist">
        {sessions.slice(0, 25).map((s) => (
          <SessionCard key={s.id} session={s} backTo="/now" hideTime={hideTime} />
        ))}
      </div>
      {sessions.length > 25 && (
        <a className="btn btn--ghost btn--sm btn--block" href="#/schedule?future=1">
          See all {sessions.length}
        </a>
      )}
    </section>
  );
}
