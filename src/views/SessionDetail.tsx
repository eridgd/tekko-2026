import { useStore } from '../store';
import { navigate, type Route } from '../hooks/useRoute';
import { formatDuration, formatMinutes, weekdayOf } from '../lib/time';
import { downloadIcs } from '../lib/ics';
import { isLive, isPast } from '../lib/filters';
import { findConflicts, isCommitment } from '../lib/conflicts';
import { StickyHeader } from '../components/StickyHeader';
import { EmptyState } from '../components/EmptyState';
import { SessionCard } from '../components/SessionCard';
import {
  IconAlert,
  IconChevronLeft,
  IconDownload,
  IconMap,
  IconPin,
  IconStar,
} from '../components/Icons';

export function SessionDetail({ id, route }: { id: string; route: Route }) {
  const { data, isSaved, toggleSaved, savedSessions, clock } = useStore();
  const session = data.sessionById.get(id);
  const back = route.params.get('back');

  if (!session) {
    return (
      <>
        <DetailHeader back={back} title="Event" />
        <div className="page">
          <EmptyState
            icon="🤷"
            title="Event not found"
            body="This event isn't in the current schedule. It may have been cancelled or renamed since this app's data was last refreshed."
            action={{ label: 'Browse the schedule', href: '#/schedule' }}
          />
        </div>
      </>
    );
  }

  const saved = isSaved(session.id);
  const track = data.trackById.get(session.trackId);
  const pin = data.pinByTrack.get(session.trackId);
  const category = data.categoryById.get(session.cat);
  const ctx = { nowDay: clock.day, nowMinutes: clock.minutes };
  const live = isLive(session, ctx);
  const past = isPast(session, ctx);

  const guests = session.guests
    .map((gid) => data.guestById.get(gid))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  // Would saving this clash with something already saved?
  const clashes = saved
    ? findConflicts(savedSessions).filter((c) => c.a.id === session.id || c.b.id === session.id)
    : isCommitment(session)
      ? findConflicts([...savedSessions, session]).filter(
          (c) => c.a.id === session.id || c.b.id === session.id
        )
      : [];

  const sameRoomNext = data.schedule.sessions
    .filter(
      (s) =>
        s.trackId === session.trackId &&
        s.day === session.day &&
        s.id !== session.id &&
        s.startMin >= session.startMin
    )
    .slice(0, 3);

  const endMin = session.startMin + session.durMin;
  const mapHref = pin
    ? `/map/floor?pin=${session.trackId}&from=${session.id}`
    : `/map/floor?from=${session.id}`;

  return (
    <>
      <DetailHeader back={back} title={category?.label ?? 'Event'} />

      <article className="page detail">
        <div className="detail__chips">
          {category && (
            <span className="chip chip--cat">
              <span className="chip__dot" style={{ background: category.color }} />
              {category.label}
            </span>
          )}
          {session.flags.map((f) => {
            const flag = data.schedule.flags.find((x) => x.id === f);
            if (!flag) return null;
            return (
              <span key={f} className={`chip chip--flag chip--${f}`}>
                {flag.label}
              </span>
            );
          })}
          {session.dropIn && <span className="chip">Drop in any time</span>}
        </div>

        <h1 className="detail__title">{session.title}</h1>

        <div className="detail__when">
          {live && <span className="livedot" aria-hidden="true" />}
          <div>
            <p className="detail__day">
              {weekdayOf(session.day)}
              {live && <span className="detail__livetag">Happening now</span>}
              {past && !live && <span className="detail__pasttag">Finished</span>}
            </p>
            <p className="detail__time">
              {formatMinutes(session.startMin)}
              {!session.hideEnd && session.durMin > 0 && ` – ${formatMinutes(endMin)}`}
              {session.durMin > 0 && (
                <span className="detail__dur"> · {formatDuration(session.durMin)}</span>
              )}
            </p>
          </div>
        </div>

        {session.issue === 'end-before-start' && (
          <p className="notice notice--warn">
            <IconAlert size={18} />
            <span>
              Tekko's schedule lists an end time <em>before</em> the start time for this event, so
              the finish time here can't be trusted. Check with the room.
            </span>
          </p>
        )}

        <div className="detail__actions">
          <button
            className={`btn ${saved ? '' : 'btn--primary'} btn--block`}
            aria-pressed={saved}
            onClick={() => toggleSaved(session.id)}
          >
            <IconStar size={19} filled={saved} />
            {saved ? 'Saved to My Schedule' : 'Save to My Schedule'}
          </button>
        </div>

        {clashes.length > 0 && (
          <div className="notice notice--warn">
            <IconAlert size={18} />
            <span>
              {saved ? 'This clashes with' : 'Saving this would clash with'}{' '}
              {clashes.map((c, i) => {
                const other = c.a.id === session.id ? c.b : c.a;
                return (
                  <span key={other.id}>
                    {i > 0 && ', '}
                    <a href={`#/event/${other.id}`}>{other.title}</a> ({c.overlapMin} min)
                  </span>
                );
              })}
              .
            </span>
          </div>
        )}

        <button className="detail__location" onClick={() => navigate(mapHref)}>
          <span className="detail__locationicon">
            <IconMap size={22} />
          </span>
          <span className="detail__locationtext">
            <strong>{session.loc}</strong>
            <span>
              {pin
                ? `Floor ${pin.floor}${pin.room ? ` · ${pin.room}` : ''} — tap to see it on the map`
                : track?.unmappedReason
                  ? 'Not marked on the convention floor map'
                  : 'Tap to open the map'}
            </span>
          </span>
          <IconChevronLeft size={20} className="detail__locationchev" />
        </button>

        {session.desc && <p className="detail__desc">{session.desc}</p>}

        {session.presenters && session.presenters.length > 0 && (
          <p className="detail__presenters">
            <span className="detail__key">Presented by</span> {session.presenters.join(', ')}
          </p>
        )}

        {guests.length > 0 && (
          <section>
            <h2 className="sectiontitle">Featured guests</h2>
            <div className="guestrow">
              {guests.map((g) => (
                <a key={g.id} className="guestchip" href={`#/guest/${g.id}`}>
                  {g.photo ? (
                    <img src={g.photo} alt="" loading="lazy" width={44} height={44} />
                  ) : (
                    <span className="guestchip__initials" aria-hidden="true">
                      {g.name.slice(0, 1)}
                    </span>
                  )}
                  <span>
                    <strong>{g.name}</strong>
                    {g.pronouns && <span className="guestchip__pronouns">{g.pronouns}</span>}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {session.topics && session.topics.length > 0 && (
          <div className="detail__chips detail__chips--topics">
            {session.topics.map((t) => (
              <span key={t} className="chip chip--topic">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="detail__secondary">
          <button
            className="btn btn--ghost btn--sm"
            onClick={() =>
              downloadIcs([session], `tekko-${session.id}.ics`, session.title)
            }
          >
            <IconDownload size={17} />
            Add to calendar
          </button>
        </div>

        {sameRoomNext.length > 0 && (
          <section>
            <h2 className="sectiontitle">
              <IconPin size={13} /> Later in {track?.title ?? session.loc}
            </h2>
            <div className="cardlist">
              {sameRoomNext.map((s) => (
                <SessionCard key={s.id} session={s} backTo={route.raw} />
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}

function DetailHeader({ back, title }: { back: string | null; title: string }) {
  return (
    <StickyHeader>
      <div className="hdr__bar">
        <button
          className="iconbtn"
          aria-label="Back"
          onClick={() => {
            // Prefer the explicit return path so filters/scroll context survive;
            // otherwise fall back to real history.
            if (back) navigate(back);
            else if (window.history.length > 1) window.history.back();
            else navigate('/schedule');
          }}
        >
          <IconChevronLeft />
        </button>
        <span className="hdr__title hdr__title--sm">{title}</span>
      </div>
    </StickyHeader>
  );
}
