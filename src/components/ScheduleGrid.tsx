import { useMemo, useRef, useLayoutEffect } from 'react';
import { useStore } from '../store';
import { navigate } from '../hooks/useRoute';
import { formatMinutes } from '../lib/time';
import { filtersToParams, isLive, type Filters } from '../lib/filters';
import { getScheduleMemory } from '../lib/scheduleMemory';
import { IconChevronLeft, IconChevronRight, IconPin } from './Icons';
import { useSessionPreview } from './SessionPreview';
import type { Session } from '../types';

/**
 * The classic convention grid: one row per room, time running left to right.
 * Rooms stay pinned on the left while the time axis scrolls horizontally.
 */

const PX_PER_MIN = 2.6;
// Tall enough for a two-line title plus the time without clipping the second
// line — short rows were cutting long titles off mid-line.
const ROW_H = 64;
const LABEL_FULL = 132;
// Collapsed: a thin strip that still hosts the expand button but frees the width.
const LABEL_COLLAPSED = 26;

export function ScheduleGrid({ sessions, filters }: { sessions: Session[]; filters: Filters }) {
  const { data, clock, prefs, setPrefs } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const collapsed = prefs.gridRoomsCollapsed;
  const LABEL_W = collapsed ? LABEL_COLLAPSED : LABEL_FULL;

  const { rows, startMin, endMin } = useMemo(() => {
    const byTrack = new Map<number, Session[]>();
    let min = Infinity;
    let max = -Infinity;

    for (const s of sessions) {
      const list = byTrack.get(s.trackId);
      if (list) list.push(s);
      else byTrack.set(s.trackId, [s]);
      min = Math.min(min, s.startMin);
      max = Math.max(max, s.startMin + Math.max(s.durMin, 30));
    }

    const rows = [...byTrack.entries()]
      .map(([trackId, items]) => ({
        track: data.trackById.get(trackId),
        trackId,
        items: items.sort((a, b) => a.startMin - b.startMin),
      }))
      .sort(
        (a, b) =>
          (a.track?.floor ?? 99) - (b.track?.floor ?? 99) ||
          (a.track?.title ?? '').localeCompare(b.track?.title ?? '')
      );

    // Snap the axis to whole hours so the ruler reads cleanly.
    return {
      rows,
      startMin: Math.floor(min / 60) * 60,
      endMin: Math.ceil(max / 60) * 60,
    };
  }, [sessions, data]);

  const totalMin = Math.max(endMin - startMin, 60);
  const width = totalMin * PX_PER_MIN;
  const hours = Math.ceil(totalMin / 60);
  const nowOffset =
    clock.day === filters.day && clock.minutes >= startMin && clock.minutes <= endMin
      ? (clock.minutes - startMin) * PX_PER_MIN
      : null;

  const backTo = `/schedule?${filtersToParams(filters)}`;

  // Where to open the time axis: back at the exact spot you left (returning
  // from an event detail — restore must win over the now-scroll below),
  // otherwise at "now" rather than at 8am when you're mid-con. Grid geometry
  // is fixed (no content-visibility), so a one-shot restore is exact.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const mem = getScheduleMemory();
    if (mem && mem.hash === backTo && mem.gridLeft !== undefined && mem.gridTop !== undefined) {
      el.scrollLeft = mem.gridLeft;
      el.scrollTop = mem.gridTop;
      return;
    }
    if (nowOffset != null) el.scrollLeft = Math.max(0, nowOffset - 120);
    // Only on first render for a given day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.day]);

  return (
    <div className="grid" ref={scrollRef}>
      <div className="grid__inner" style={{ width: width + LABEL_W }}>
        <div className="grid__ruler">
          {Array.from({ length: hours + 1 }, (_, i) => (
            <span
              key={i}
              className="grid__tick"
              style={{ left: LABEL_W + i * 60 * PX_PER_MIN }}
            >
              {formatMinutes(startMin + i * 60)}
            </span>
          ))}
          {/* Opaque corner where the frozen ruler meets the frozen label column;
              also hosts the collapse/expand toggle for the room column. */}
          <div className="grid__corner" style={{ width: LABEL_W }}>
            <button
              className="grid__collapse"
              onClick={() => setPrefs({ gridRoomsCollapsed: !collapsed })}
              aria-label={collapsed ? 'Show room names' : 'Hide room names for more width'}
              aria-pressed={collapsed}
              title={collapsed ? 'Show rooms' : 'Hide rooms'}
            >
              {collapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
            </button>
          </div>
        </div>

        {nowOffset != null && (
          <div
            className="grid__now"
            style={{ left: LABEL_W + nowOffset }}
            aria-hidden="true"
          />
        )}

        {rows.map(({ track, trackId, items }) => (
          <div className="grid__row" key={trackId} style={{ height: ROW_H }}>
            <button
              className={`grid__label${track?.mapped ? ' grid__label--tomap' : ''}`}
              style={{ width: LABEL_W }}
              disabled={!track?.mapped}
              title={track?.mapped ? `Show ${track.title} on the map` : track?.title}
              onClick={() => track?.mapped && navigate(`/map/floor?pin=${trackId}`)}
            >
              {collapsed ? (
                <span className="grid__labelmini">{track?.floor ?? '·'}</span>
              ) : (
                <>
                  <span className="grid__labeltext">{track?.title ?? 'Unknown room'}</span>
                  <span className="grid__labelmeta">
                    {track?.floor != null && <span className="grid__floor">Floor {track.floor}</span>}
                    {track?.mapped && <IconPin size={11} className="grid__labelpin" />}
                  </span>
                </>
              )}
            </button>
            {/* Hour gridlines are one CSS gradient, not hundreds of spans. */}
            <div
              className="grid__lane"
              style={{ width, ['--hour-w' as string]: `${60 * PX_PER_MIN}px` }}
            >
              {items.map((s) => (
                <GridItem
                  key={s.id}
                  session={s}
                  left={(s.startMin - startMin) * PX_PER_MIN}
                  width={Math.max(Math.max(s.durMin, 20) * PX_PER_MIN - 3, 34)}
                  href={`#/event/${s.id}?back=${encodeURIComponent(backTo)}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GridItem({
  session,
  left,
  width,
  href,
}: {
  session: Session;
  left: number;
  width: number;
  href: string;
}) {
  const { data, clock, isSaved } = useStore();
  const live = isLive(session, { nowDay: clock.day, nowMinutes: clock.minutes });
  const cat = data.categoryById.get(session.cat);
  const { hoverProps, preview } = useSessionPreview(session, href);

  return (
    <>
      {preview}
      <a
        className={`grid__item${isSaved(session.id) ? ' grid__item--saved' : ''}${
          live ? ' grid__item--live' : ''
        }`}
        href={href}
        style={{ left, width, borderLeftColor: cat?.color ?? 'var(--border-strong)' }}
        title={`${session.title} — ${formatMinutes(session.startMin)}`}
        {...hoverProps}
      >
        <span className="grid__itemtitle">{session.title}</span>
        <span className="grid__itemtime">{formatMinutes(session.startMin)}</span>
      </a>
    </>
  );
}
