import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { replaceRoute, type Route } from '../hooks/useRoute';
import {
  applyFilters,
  activeFilterCount,
  filtersFromParams,
  filtersToParams,
  type Filters,
} from '../lib/filters';
import { formatMinutes, slotKey } from '../lib/time';
import { SessionCard } from '../components/SessionCard';
import { FilterSheet } from '../components/FilterSheet';
import { ScheduleGrid } from '../components/ScheduleGrid';
import { StickyHeader } from '../components/StickyHeader';
import { EmptyState } from '../components/EmptyState';
import { IconClose, IconFilter, IconGrid, IconList, IconSearch } from '../components/Icons';
import type { Session } from '../types';

export function ScheduleView({ route }: { route: Route }) {
  const { data, prefs, setPrefs, savedIds, clock } = useStore();
  const { days, categories, flags, tracks } = data.schedule;

  const [filterOpen, setFilterOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  const filters = useMemo<Filters>(() => {
    const parsed = filtersFromParams(route.params);
    // Default to today if the con is running, otherwise day one.
    if (!parsed.day) {
      parsed.day = days.some((d) => d.key === clock.day) ? clock.day : days[0]?.key ?? null;
    }
    // hidePast is a preference, but the URL wins when explicitly present.
    if (!route.params.has('future')) parsed.hidePast = prefs.hidePast;
    return parsed;
  }, [route.params, days, clock.day, prefs.hidePast]);

  const setFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    if (patch.hidePast !== undefined) setPrefs({ hidePast: patch.hidePast });
    replaceRoute(`/schedule?${filtersToParams(next)}`);
  };

  const visible = useMemo(
    () =>
      applyFilters(data.schedule.sessions, filters, {
        data,
        savedIds,
        nowDay: clock.day,
        nowMinutes: clock.minutes,
      }),
    [data, filters, savedIds, clock.day, clock.minutes]
  );

  // Keep sticky slot headers just below the (variable-height) app header.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () =>
      document.documentElement.style.setProperty('--stick-h', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeCount = activeFilterCount(filters);
  const day = days.find((d) => d.key === filters.day);

  return (
    <>
      <StickyHeader innerRef={headerRef}>
        <div className="hdr__bar">
          <div className="search">
            <IconSearch />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => setFilters({ query: e.target.value })}
              placeholder="Search 943 events…"
              aria-label="Search events"
              enterKeyHint="search"
            />
            {filters.query && (
              <button
                className="search__clear"
                onClick={() => setFilters({ query: '' })}
                aria-label="Clear search"
              >
                <IconClose size={18} />
              </button>
            )}
          </div>

          <button
            className="iconbtn iconbtn--badge"
            onClick={() => setFilterOpen(true)}
            aria-label={`Filters${activeCount ? `, ${activeCount} active` : ''}`}
          >
            <IconFilter />
            {activeCount > 0 && <span className="iconbtn__badge">{activeCount}</span>}
          </button>

          <button
            className="iconbtn"
            onClick={() => setPrefs({ view: prefs.view === 'agenda' ? 'grid' : 'agenda' })}
            aria-label={prefs.view === 'agenda' ? 'Switch to grid view' : 'Switch to list view'}
          >
            {prefs.view === 'agenda' ? <IconGrid /> : <IconList />}
          </button>
        </div>

        <div className="daytabs" role="group" aria-label="Convention day">
          {days.map((d) => (
            <button
              key={d.key}
              className={`daytab${d.key === clock.day ? ' daytab--today' : ''}`}
              aria-pressed={d.key === filters.day}
              onClick={() => setFilters({ day: d.key })}
            >
              <strong>{d.short}</strong>
              <span>{d.date}</span>
            </button>
          ))}
        </div>
      </StickyHeader>

      <div className={prefs.view === 'grid' ? 'page page--flush' : 'page'}>
        <ActiveFilters filters={filters} setFilters={setFilters} count={visible.length} />

        {visible.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="Nothing matches"
            body={
              activeCount || filters.query
                ? 'Try clearing a filter or searching for something else.'
                : `No events are listed for ${day?.weekday ?? 'this day'}.`
            }
            action={
              activeCount || filters.query
                ? {
                    label: 'Clear all filters',
                    onClick: () =>
                      setFilters({ cats: [], tracks: [], flags: [], query: '', savedOnly: false }),
                  }
                : undefined
            }
          />
        ) : prefs.view === 'grid' ? (
          <ScheduleGrid sessions={visible} filters={filters} />
        ) : (
          <Agenda sessions={visible} filters={filters} />
        )}
      </div>

      {filterOpen && (
        <FilterSheet
          filters={filters}
          setFilters={setFilters}
          categories={categories}
          flags={flags}
          tracks={tracks}
          resultCount={visible.length}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </>
  );
}

function Agenda({ sessions, filters }: { sessions: Session[]; filters: Filters }) {
  const groups = useMemo(() => {
    const map = new Map<number, Session[]>();
    for (const s of sessions) {
      const key = slotKey(s.startMin);
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [sessions]);

  const backTo = `/schedule?${filtersToParams(filters)}`;

  return (
    <div className="cardlist">
      {groups.map(([slot, items]) => (
        <section key={slot}>
          <h2 className="slot">{formatMinutes(slot)}</h2>
          {items.map((s) => (
            <SessionCard key={s.id} session={s} backTo={backTo} />
          ))}
        </section>
      ))}
    </div>
  );
}

function ActiveFilters({
  filters,
  setFilters,
  count,
}: {
  filters: Filters;
  setFilters: (p: Partial<Filters>) => void;
  count: number;
}) {
  const { data } = useStore();
  const pills: { key: string; label: string; clear: () => void }[] = [];

  for (const id of filters.cats) {
    const cat = data.categoryById.get(id);
    if (cat) {
      pills.push({
        key: `c${id}`,
        label: cat.label,
        clear: () => setFilters({ cats: filters.cats.filter((c) => c !== id) }),
      });
    }
  }
  for (const id of filters.tracks) {
    const track = data.trackById.get(id);
    if (track) {
      pills.push({
        key: `t${id}`,
        label: track.title,
        clear: () => setFilters({ tracks: filters.tracks.filter((t) => t !== id) }),
      });
    }
  }
  for (const id of filters.flags) {
    const flag = data.schedule.flags.find((f) => f.id === id);
    if (flag) {
      pills.push({
        key: `f${id}`,
        label: flag.label,
        clear: () => setFilters({ flags: filters.flags.filter((f) => f !== id) }),
      });
    }
  }
  if (filters.savedOnly) {
    pills.push({ key: 'saved', label: 'Saved only', clear: () => setFilters({ savedOnly: false }) });
  }
  if (filters.hidePast) {
    pills.push({ key: 'past', label: 'Upcoming only', clear: () => setFilters({ hidePast: false }) });
  }

  return (
    <>
      {pills.length > 0 && (
        <div className="scroller activefilters">
          {pills.map((p) => (
            <button key={p.key} className="chip chip--active" onClick={p.clear}>
              {p.label}
              <IconClose size={14} />
            </button>
          ))}
          <button
            className="chip chip--clear"
            onClick={() =>
              setFilters({ cats: [], tracks: [], flags: [], savedOnly: false, hidePast: false })
            }
          >
            Clear all
          </button>
        </div>
      )}
      <p className="count" aria-live="polite">
        {count} event{count === 1 ? '' : 's'}
      </p>
    </>
  );
}
