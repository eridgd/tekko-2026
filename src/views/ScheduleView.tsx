import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { replaceRoute, type Route } from '../hooks/useRoute';
import {
  getScheduleMemory,
  setScheduleMemory,
  type ScheduleMemory,
} from '../lib/scheduleMemory';
import {
  applyFilters,
  activeFilterCount,
  filtersFromParams,
  filtersToParams,
  type Filters,
} from '../lib/filters';
import { formatMinutes, relativeLabel, slotKey } from '../lib/time';
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
  const phase = useRef<'init' | 'live'>('init');
  // Canonical serialization of what's actually on screen. Memory stores THIS
  // rather than the raw hash so it compares equal to the ?back= links cards
  // carry, even while the address bar still shows a bare "/schedule" (fresh
  // visit) or lags the search-box debounce.
  const canonicalHash = `/schedule?${filtersToParams(effective)}`;
  const canonicalRef = useRef(canonicalHash);
  canonicalRef.current = canonicalHash;
  // Last hash this effect handled. StrictMode's dev-only effect replay keeps
  // refs, so without this guard the replay would see phase === 'live' and fall
  // into the "route changed" branch below — scrolling to the top and wiping
  // the memory it had just restored (which made this bug invisible in dev).
  const lastRaw = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (lastRaw.current === route.raw) return;
    lastRaw.current = route.raw;
    const mem = getScheduleMemory();
    if (phase.current === 'init') {
      if (route.raw === '/schedule' && mem && mem.hash !== '/schedule') {
        replaceRoute(mem.hash); // re-renders; this effect runs again on the restored hash
        return;
      }
      phase.current = 'live';
      if (mem && mem.hash === canonicalHash && mem.scrollY > 0) {
        restoreScroll(mem); // agenda; the grid restores its own inner scroller
      }
      return;
    }
    // A day or filter change within the schedule: fresh result set, start at top.
    window.scrollTo(0, 0);
    setScheduleMemory({ hash: canonicalHash, scrollY: 0 });
  }, [route.raw]); // eslint-disable-line react-hooks/exhaustive-deps -- navigation only

  useEffect(() => {
    // Persist on scroll-IDLE, never per-frame: sessionStorage writes are
    // synchronous and doing one every animation frame is what made scrolling
    // jerky. A debounced write after scrolling settles is invisible to the user
    // and still captures where they ended up. Capture phase because the grid
    // view scrolls inside its own element and scroll events don't bubble.
    let idle = 0;
    const flush = () => {
      if (phase.current !== 'live') return;
      // By the time React runs the unmount cleanup below, the schedule DOM has
      // already been swapped for the (much shorter) event detail and the
      // browser has clamped window.scrollY to THAT page's height — capturing
      // it then is what used to truncate deep positions to a few hundred px.
      // Only capture while our DOM is still the one on screen; the idle flush
      // has always run by the time a card gets tapped.
      if (!headerRef.current?.isConnected) return;
      const memory: ScheduleMemory = { hash: canonicalRef.current, scrollY: window.scrollY };
      const grid = document.querySelector<HTMLElement>('.gridwrap .grid');
      if (grid) {
        // Grid view: the .grid element scrolls on both axes; the window stays put.
        memory.gridLeft = grid.scrollLeft;
        memory.gridTop = grid.scrollTop;
      } else {
        // Agenda: remember WHICH card sits at the top of the viewport, not just
        // the pixel offset. content-visibility gives offscreen cards placeholder
        // heights on a fresh mount, so a bare offset lands on different content;
        // "this card, this many px from the top" survives the remount exactly.
        const cards = document.querySelectorAll<HTMLElement>('.cardlist [data-sid]');
        for (const el of cards) {
          const rect = el.getBoundingClientRect();
          if (rect.bottom > 0) {
            memory.anchorId = el.dataset.sid;
            memory.anchorTop = rect.top;
            break;
          }
        }
      }
      setScheduleMemory(memory);
    };
    const onScroll = () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(flush, 160);
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.clearTimeout(idle);
      flush(); // final capture (no-ops once the view is already gone)
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

/**
 * Put the agenda back where it was. Cards use `content-visibility: auto`, so on
 * a fresh mount every offscreen card is placeholder-height: an absolute pixel
 * offset doesn't map to the content it was saved against, and the layout keeps
 * shifting for several frames while cards near the viewport get measured for
 * real. So instead of trusting pixels, scroll the REMEMBERED CARD back to the
 * exact viewport offset it had, re-applying each frame until it holds still
 * for two consecutive frames (or the time budget runs out). Falls back to the
 * raw offset only when the card is gone by the time we return (e.g. it slid
 * into the past and "Upcoming only" now hides it).
 */
function restoreScroll(mem: ScheduleMemory): void {
  const { scrollY, anchorId, anchorTop } = mem;
  const deadline = performance.now() + 600;
  let settled = 0;
  const tick = () => {
    const anchor =
      anchorId !== undefined
        ? document.querySelector(`.cardlist [data-sid="${CSS.escape(anchorId)}"]`)
        : null;
    if (anchor && anchorTop !== undefined) {
      const delta = anchor.getBoundingClientRect().top - anchorTop;
      if (Math.abs(delta) > 1) {
        settled = 0;
        window.scrollTo(0, window.scrollY + delta);
      } else {
        settled += 1;
      }
    } else {
      window.scrollTo(0, scrollY);
      settled = Math.abs(window.scrollY - scrollY) <= 2 ? settled + 1 : 0;
    }
    if (settled < 2 && performance.now() < deadline) requestAnimationFrame(tick);
  };
  tick(); // first application runs synchronously, before the mount paints
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
  const { data, clock } = useStore();
  const pills: { key: string; label: string; clear: () => void }[] = [];

  // How long ago the schedule snapshot was fetched from Eventeny (refreshed
  // automatically every 30 min during the con).
  const fetchedEpoch = Math.floor(new Date(data.schedule.fetchedAt).getTime() / 1000);
  const updated = Number.isFinite(fetchedEpoch)
    ? relativeLabel((fetchedEpoch - clock.epoch) / 60)
    : null;

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
        {updated && <span className="count__updated"> · updated {updated}</span>}
      </p>
    </>
  );
}
