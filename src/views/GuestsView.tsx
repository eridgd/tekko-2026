import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { StickyHeader } from '../components/StickyHeader';
import { SessionCard } from '../components/SessionCard';
import { EmptyState } from '../components/EmptyState';
import { navigate } from '../hooks/useRoute';
import { weekdayOf } from '../lib/time';
import {
  IconChevronLeft,
  IconClose,
  IconExternal,
  IconSearch,
} from '../components/Icons';
import type { Guest } from '../types';

export function GuestsView({ guestId }: { guestId?: number }) {
  const { data } = useStore();
  const [query, setQuery] = useState('');

  const guest = guestId ? data.guestById.get(guestId) : undefined;
  if (guestId) return <GuestDetail guest={guest} />;

  const q = query.trim().toLowerCase();
  const filtered = data.guests.filter((g) => !q || g.name.toLowerCase().includes(q));

  return (
    <>
      <StickyHeader>
        <div className="hdr__bar">
          <div className="hdr__title">
            Guests
            <span className="hdr__sub">{data.guests.length} at Tekko 2026</span>
          </div>
        </div>
        <div className="hdr__bar hdr__bar--tight">
          <div className="search">
            <IconSearch />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guests…"
              aria-label="Search guests"
            />
            {query && (
              <button className="search__clear" onClick={() => setQuery('')} aria-label="Clear">
                <IconClose size={18} />
              </button>
            )}
          </div>
        </div>
      </StickyHeader>

      <div className="page">
        {filtered.length === 0 ? (
          <EmptyState icon="🔍" title="No guests match" body={`Nothing found for "${query}".`} />
        ) : (
          <div className="guestgrid">
            {filtered.map((g) => (
              <a key={g.id} className="guestcard" href={`#/guest/${g.id}`}>
                {g.photo ? (
                  <img src={g.photo} alt="" loading="lazy" width={132} height={132} />
                ) : (
                  <span className="guestcard__initials" aria-hidden="true">
                    {g.name.slice(0, 1)}
                  </span>
                )}
                <span className="guestcard__name">{g.name}</span>
                {g.category && <span className="guestcard__cat">{g.category}</span>}
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function GuestDetail({ guest }: { guest: Guest | undefined }) {
  const { data } = useStore();

  const sessions = useMemo(
    () =>
      guest
        ? data.schedule.sessions.filter((s) => s.guests.includes(guest.id))
        : [],
    [guest, data]
  );

  const byDay = useMemo(() => {
    const groups = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const list = groups.get(s.day);
      if (list) list.push(s);
      else groups.set(s.day, [s]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sessions]);

  const links = guest
    ? ([
        ['Website', guest.website],
        ['Instagram', guest.instagram],
        ['YouTube', guest.youtube],
        ['Twitch', guest.twitch],
        ['X', guest.x],
      ].filter(([, url]) => Boolean(url)) as [string, string][])
    : [];

  return (
    <>
      <StickyHeader>
        <div className="hdr__bar">
          <button
            className="iconbtn"
            aria-label="Back to guests"
            onClick={() => navigate('/guests')}
          >
            <IconChevronLeft />
          </button>
          <span className="hdr__title hdr__title--sm">Guest</span>
        </div>
      </StickyHeader>

      <div className="page">
        {!guest ? (
          <EmptyState
            icon="🤷"
            title="Guest not found"
            body="This guest isn't in the current data."
            action={{ label: 'All guests', href: '#/guests' }}
          />
        ) : (
          <>
            <div className="guesthero">
              {guest.photo ? (
                <img src={guest.photo} alt="" width={104} height={104} />
              ) : (
                <span className="guesthero__initials" aria-hidden="true">
                  {guest.name.slice(0, 1)}
                </span>
              )}
              <div>
                <h1 className="guesthero__name">{guest.name}</h1>
                {guest.pronouns && <p className="guesthero__pronouns">{guest.pronouns}</p>}
                {guest.category && <span className="chip">{guest.category}</span>}
              </div>
            </div>

            {links.length > 0 && (
              <div className="linkrow">
                {links.map(([label, url]) => (
                  <a
                    key={label}
                    className="btn btn--sm"
                    href={url.startsWith('http') ? url : `https://${url}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {label}
                    <IconExternal size={14} />
                  </a>
                ))}
              </div>
            )}

            {sessions.length === 0 ? (
              <p className="muted">
                No sessions in the schedule list this guest. They may be appearing at autographs or
                the Expo Hall instead.
              </p>
            ) : (
              byDay.map(([day, items]) => (
                <section key={day}>
                  <h2 className="sectiontitle">
                    {weekdayOf(day)} <span className="sectiontitle__count">{items.length}</span>
                  </h2>
                  <div className="cardlist">
                    {items.map((s) => (
                      <SessionCard key={s.id} session={s} backTo={`/guest/${guest.id}`} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </>
  );
}
