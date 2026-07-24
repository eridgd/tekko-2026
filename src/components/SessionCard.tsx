import { memo, useState } from 'react';
import type { Session } from '../types';
import { useStore } from '../store';
import { formatDuration, formatMinutes } from '../lib/time';
import { isLive, isPast } from '../lib/filters';
import { IconAlert, IconChevronRight, IconPin, IconStar } from './Icons';

interface Props {
  session: Session;
  /** Hide the time (the surrounding slot header already shows it). */
  hideTime?: boolean;
  showDay?: boolean;
  conflicted?: boolean;
  /** Extra query appended to the detail link so Back returns here. */
  backTo?: string;
}

/** "9:00 PM – 10:30 PM · 1h 30m" — duration right after the range, like the old preview. */
function timeLabel(s: Session): string {
  const start = formatMinutes(s.startMin);
  const range = s.hideEnd || s.durMin <= 0 ? start : `${start} – ${formatMinutes(s.startMin + s.durMin)}`;
  return s.durMin > 0 ? `${range} · ${formatDuration(s.durMin)}` : range;
}

export const SessionCard = memo(function SessionCard({
  session,
  hideTime,
  showDay,
  conflicted,
  backTo,
}: Props) {
  const { isSaved, toggleSaved, clock, data } = useStore();
  const [expanded, setExpanded] = useState(false);
  const saved = isSaved(session.id);
  const ctx = { nowDay: clock.day, nowMinutes: clock.minutes };
  const live = isLive(session, ctx);
  const past = isPast(session, ctx);
  const category = data.categoryById.get(session.cat);
  const canExpand = Boolean(session.desc);

  const href = `#/event/${session.id}${backTo ? `?back=${encodeURIComponent(backTo)}` : ''}`;
  const descId = `desc-${session.id}`;

  return (
    <div
      className={[
        'card',
        saved && 'card--saved',
        live && 'card--live',
        past && !live && 'card--past',
        expanded && 'card--expanded',
      ]
        .filter(Boolean)
        .join(' ')}
      // Lets the schedule's scroll memory re-find this card after a remount
      // (scroll is restored by anchoring to a card, not to a pixel offset).
      data-sid={session.id}
    >
      <div className="card__main">
        {/* Left gutter: expand the description inline (only when there is one). */}
        <button
          className="card__expand"
          disabled={!canExpand}
          aria-expanded={canExpand ? expanded : undefined}
          aria-controls={canExpand ? descId : undefined}
          aria-label={expanded ? 'Hide description' : 'Show description'}
          onClick={() => setExpanded((v) => !v)}
        >
          {canExpand && (
            <IconChevronRight
              size={18}
              className={`card__chev${expanded ? ' card__chev--open' : ''}`}
            />
          )}
        </button>

        <a className="card__link" href={href}>
          <span className="card__time">
            {live && <span className="livedot" aria-hidden="true" />}
            {live && <span className="sr-only">Happening now. </span>}
            {!hideTime && <span>{timeLabel(session)}</span>}
            {hideTime && session.durMin > 0 && (
              <span className="card__dur">{formatDuration(session.durMin)}</span>
            )}
            {showDay && <span className="card__day">{session.day.slice(5).replace('-', '/')}</span>}
            {session.dropIn && <span className="card__tagline">drop-in</span>}
            {conflicted && (
              <span className="card__clash">
                <IconAlert size={13} /> clash
              </span>
            )}
          </span>

          <span className="card__title">{session.title}</span>

          <span className="card__meta">
            {category && (
              <span className="chip chip--cat chip--sm">
                <span className="chip__dot" style={{ background: category.color }} />
                {category.label}
              </span>
            )}
            <span className="card__loc">
              <IconPin size={13} />
              {session.loc}
            </span>
            {session.flags.includes('adult') && <span className="chip chip--flag chip--adult chip--sm">18+</span>}
            {session.flags.includes('featured') && (
              <span className="chip chip--flag chip--featured chip--sm">Guest</span>
            )}
          </span>
        </a>

        <button
          className="card__save"
          aria-pressed={saved}
          aria-label={saved ? `Remove ${session.title} from My Schedule` : `Save ${session.title} to My Schedule`}
          onClick={() => toggleSaved(session.id)}
        >
          <IconStar size={21} filled={saved} />
        </button>
      </div>

      {expanded && session.desc && (
        <div className="card__desc" id={descId}>
          {session.desc}
          <a className="card__descmore" href={href}>
            Full details →
          </a>
        </div>
      )}
    </div>
  );
});
