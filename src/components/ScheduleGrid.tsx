import { useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { formatMinutes } from '../lib/time';
import { filtersToParams, isLive, type Filters } from '../lib/filters';
import type { Session } from '../types';

/**
 * The classic convention grid: one row per room, time running left to right.
 * Rooms stay pinned on the left while the time axis scrolls horizontally.
 */

const PX_PER_MIN = 2.6;
const ROW_H = 56;
const LABEL_W = 132;

export function ScheduleGrid({ sessions, filters }: { sessions: Session[]; filters: Filters }) {
  const { data, clock, isSaved } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Open the grid at "now" rather than at 8am when you're mid-con.
  useEffect(() => {
    if (nowOffset != null && scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, nowOffset - 120);
    }
    // Only on first render for a given day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.day]);

  const backTo = `/schedule?${filtersToParams(filters)}`;

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
          {/* Opaque corner where the frozen ruler meets the frozen label column. */}
          <span className="grid__corner" style={{ width: LABEL_W }} aria-hidden="true" />
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
            <div className="grid__label" style={{ width: LABEL_W }}>
              <span className="grid__labeltext">{track?.title ?? 'Unknown room'}</span>
              {track?.floor != null && <span className="grid__floor">Floor {track.floor}</span>}
            </div>
            <div className="grid__lane" style={{ width }}>
              {Array.from({ length: hours }, (_, i) => (
                <span
                  key={i}
                  className="grid__gridline"
                  style={{ left: i * 60 * PX_PER_MIN }}
                  aria-hidden="true"
                />
              ))}
              {items.map((s) => {
                const live = isLive(s, { nowDay: clock.day, nowMinutes: clock.minutes });
                const cat = data.categoryById.get(s.cat);
                return (
                  <a
                    key={s.id}
                    className={`grid__item${isSaved(s.id) ? ' grid__item--saved' : ''}${
                      live ? ' grid__item--live' : ''
                    }`}
                    href={`#/event/${s.id}?back=${encodeURIComponent(backTo)}`}
                    style={{
                      left: (s.startMin - startMin) * PX_PER_MIN,
                      width: Math.max(Math.max(s.durMin, 20) * PX_PER_MIN - 3, 34),
                      borderLeftColor: cat?.color ?? 'var(--border-strong)',
                    }}
                    title={`${s.title} — ${formatMinutes(s.startMin)}`}
                  >
                    <span className="grid__itemtitle">{s.title}</span>
                    <span className="grid__itemtime">{formatMinutes(s.startMin)}</span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
