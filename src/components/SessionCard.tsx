import { memo } from 'react';
import type { Session } from '../types';
import { useStore } from '../store';
import { formatMinutes } from '../lib/time';
import { isLive, isPast } from '../lib/filters';
import { useSessionPreview } from './SessionPreview';
import { IconAlert, IconPin, IconStar } from './Icons';

interface Props {
  session: Session;
  /** Hide the time (the surrounding slot header already shows it). */
  hideTime?: boolean;
  showDay?: boolean;
  conflicted?: boolean;
  /** Extra query appended to the detail link so Back returns here. */
  backTo?: string;
}

function timeRange(s: Session): string {
  const start = formatMinutes(s.startMin);
  if (s.hideEnd || s.durMin <= 0) return start;
  return `${start} – ${formatMinutes(s.startMin + s.durMin)}`;
}

export const SessionCard = memo(function SessionCard({
  session,
  hideTime,
  showDay,
  conflicted,
  backTo,
}: Props) {
  const { isSaved, toggleSaved, clock, data } = useStore();
  const saved = isSaved(session.id);
  const ctx = { nowDay: clock.day, nowMinutes: clock.minutes };
  const live = isLive(session, ctx);
  const past = isPast(session, ctx);
  const category = data.categoryById.get(session.cat);

  const href = `#/event/${session.id}${backTo ? `?back=${encodeURIComponent(backTo)}` : ''}`;
  const { hoverProps, preview } = useSessionPreview(session, href);

  return (
    <div
      className={[
        'card',
        saved && 'card--saved',
        live && 'card--live',
        past && !live && 'card--past',
      ]
        .filter(Boolean)
        .join(' ')}
      {...hoverProps}
    >
      {preview}
      <a className="card__link" href={href}>
        <span className="card__time">
          {live && <span className="livedot" aria-hidden="true" />}
          {live && <span className="sr-only">Happening now. </span>}
          {!hideTime && <span>{timeRange(session)}</span>}
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
  );
});
