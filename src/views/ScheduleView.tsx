import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { replaceRoute, type Route } from '../hooks/useRoute';
import { getScheduleMemory, setScheduleMemory } from '../lib/scheduleMemory';
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
    // On a bare "/schedule" (tab tap / fresh load) resolve the remembered view's
    // params up front, so we paint the right day on the FIRST frame instead of
    // painting "today" and then visibly switching to the remembered day when the
    // restore redirect lands.
    let params = route.params;
    if (route.raw === '/schedule') {
      const mem = getScheduleMemory();
      const q = mem && mem.hash.includes('?') ? mem.hash.slice(mem.hash.indexOf('?') + 1) : '';
      if (q) params = new URLSearchParams(q);
    }
    const parsed = filtersFromParams(params);
    // Default to today if the con is running, otherwise day one.
    if (!parsed.day) {
      parsed.day = days.some((d) => d.key === clock.day) ? clock.day : days[0]?.key ?? null;
    }
    // hidePast is a preference, but the URL wins when explicitly present.
    if (!params.has('future')) parsed.hidePast = prefs.hidePast;
    return parsed;
  }, [route.raw, route.params, days, clock.day, prefs.hidePast]);

  /**
   * The search box is local state, synced to the URL on a debounce.
   *
   * Driving a controlled input straight from the URL means every keystroke does
   * a full hash round trip before the character appears — which drops
   * characters under a fast typist or a mobile IME. Filtering still runs
   * immediately on each keystroke (943 sessions is cheap); only the URL waits.
   */
  const [queryDraft, setQueryDraft] = useState(filters.query);
  const lastPushedQuery = useRef(filters.query);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Back button, or a link carrying ?q=, should refill the box.
  useEffect(() => {
    if (filters.query !== lastPushedQuery.current) {
      lastPushedQuery.current = filters.query;
      setQueryDraft(filters.query);
    }
  }, [filters.query]);

  useEffect(() => {
    if (queryDraft === lastPushedQuery.current) return;
    const id = setTimeout(() => {
      lastPushedQuery.current = queryDraft;
      replaceRoute(
        `/schedule?${filtersToParams({ ...filtersRef.current, query: queryDraft })}`
      );
    }, 300);
    return () => clearTimeout(id);
  }, [queryDraft]);

  const effective = useMemo<Filters>(
    () => ({ ...filters, query: queryDraft }),
    [filters, queryDraft]
  );

  const setFilters = (patch: Partial<Filters>) => {
    if (patch.query !== undefined) {
      setQueryDraft(patch.query);
      if (Object.keys(patch).length === 1) return;
    }
    // Base off `effective` so changing a filter mid-typing keeps what's typed.
    const next = { ...effective, ...patch };
    lastPushedQuery.current = next.query;
    if (patch.hidePast !== undefined) setPrefs({ hidePast: patch.hidePast });
    replaceRoute(`/schedule?${filtersToParams(next)}`);
  };

  const visible = useMemo(
    () =>
      applyFilters(data.schedule.sessions, effective, {
        data,
        savedIds,
        nowDay: clock.day,
        nowMinutes: clock.minutes,
      }),
    [data, effective, savedIds, clock.day, clock.minutes]
  );

  /**
   * Restore where you left off.
   *
   *  - Tapping the Schedule tab (a bare "/schedule") returns you to the day and
   *    filters you last had, rather than snapping back to today.
   *  - Backing out of an event detail lands at the scroll position you left.
   *
   * A fresh visit (empty sessionStorage) has no memory, so it falls through to
   * the current-con-day default in the `filters` memo above.
   */
  const hashRef = useRef(route.raw);
  hashRef.current = route.raw;
  const phase = useRef<'init' | 'live'>('init');

  useLayoutEffect(() => {
    const mem = getScheduleMemory();
    if (phase.current === 'init') {
      if (route.raw === '/schedule' && mem && mem.hash !== '/schedule') {
        replaceRoute(mem.hash); // re-renders; this effect runs again on the restored hash
        return;
      }
      phase.current = 'live';
      if (mem && mem.hash === route.raw && mem.scrollY > 0) {
        // Re-apply for a short window in case layout settles (fonts, wrapping)
        // after mount. Without content-visibility the page is full height right
        // away, so this normally sticks on the first frame; the retries just
        // guard against late reflow. Give up once it holds or the window ends.
        const y = mem.scrollY;
        let tries = 0;
        const tick = () => {
          window.scrollTo(0, y);
          if (++tries < 20 && Math.abs(window.scrollY - y) > 2) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
      return;
    }
    // A day or filter change within the schedule: fresh result set, start at top.
    window.scrollTo(0, 0);
    setScheduleMemory({ hash: route.raw, scrollY: 0 });
  }, [route.raw]);

  useEffect(() => {
    // Persist on scroll-IDLE, never per-frame: sessionStorage writes are
    // synchronous and doing one every animation frame is what made scrolling
    // jerky. A debounced write after scrolling settles is invisible to the user
    // and still captures where they ended up.
    let idle = 0;
    const flush = () => {
      if (phase.current === 'live') {
        setScheduleMemory({ hash: hashRef.current, scrollY: window.scrollY });
      }
    };
    const onScroll = () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(flush, 160);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(idle);
      flush(); // final capture before unmount (e.g. opening an event)
    };
  }, []);

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

  const activeCount = activeFilterCount(effective);
  const day = days.find((d) => d.key === effective.day);

  return (
    <>
      <StickyHeader innerRef={headerRef}>
        <div className="hdr__bar">
          <div className="search">
            <IconSearch />
            <input
              type="search"
              value={queryDraft}
              onChange={(e) => setFilters({ query: e.target.value })}
              placeholder={`Search ${data.schedule.sessions.length} events…`}
              aria-label="Search events"
              enterKeyHint="search"
            />
            {queryDraft && (
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
              aria-pressed={d.key === effective.day}
              onClick={() => setFilters({ day: d.key })}
            >
              <strong>{d.short}</strong>
              <span>{d.date}</span>
            </button>
          ))}
        </div>
      </StickyHeader>

      <div className={prefs.view === 'grid' ? 'gridwrap' : 'page'}>
        <div className={prefs.view === 'grid' ? 'gridwrap__head' : undefined}>
          <ActiveFilters filters={effective} setFilters={setFilters} count={visible.length} />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="Nothing matches"
            body={
              activeCount || effective.query
                ? 'Try clearing a filter or searching for something else.'
                : `No events are listed for ${day?.weekday ?? 'this day'}.`
            }
            action={
              activeCount || effective.query
                ? {
                    label: 'Clear all filters',
                    onClick: () =>
                      setFilters({ cats: [], tracks: [], flags: [], query: '', savedOnly: false }),
                  }
                : undefined
            }
          />
        ) : prefs.view === 'grid' ? (
          <ScheduleGrid sessions={visible} filters={effective} />
        ) : (
          <Agenda sessions={visible} filters={effective} />
        )}
      </div>

      {filterOpen && (
        <FilterSheet
          filters={effective}
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
