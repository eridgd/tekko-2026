import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { navigate, type Route } from '../hooks/useRoute';
import { PanZoom, type PanZoomHandle } from '../components/PanZoom';
import { StickyHeader } from '../components/StickyHeader';
import { formatMinutes } from '../lib/time';
import { isLive, isPast } from '../lib/filters';
import {
  IconChevronLeft,
  IconClose,
  IconMinus,
  IconPlus,
  IconSearch,
  IconTarget,
} from '../components/Icons';
import type { Booth, Session } from '../types';

export function MapView({ route }: { route: Route }) {
  const { data, clock } = useStore();
  const maps = data.maps;

  const key = route.segments[1] ?? maps[0]?.key ?? 'floor';
  const map = maps.find((m) => m.key === key) ?? maps[0];

  const pinTrack = Number(route.params.get('pin')) || null;
  const fromSession = route.params.get('from');
  const from = fromSession ? data.sessionById.get(fromSession) : undefined;

  const panzoom = useRef<PanZoomHandle>(null);
  const [selectedTrack, setSelectedTrack] = useState<number | null>(pinTrack);
  const [boothQuery, setBoothQuery] = useState('');
  const [selectedBooth, setSelectedBooth] = useState<number | null>(null);

  // Fly to the requested pin once the map has measured itself.
  useEffect(() => {
    setSelectedTrack(pinTrack);
    setSelectedBooth(null);
    if (!pinTrack || !map) return;
    const pin = map.pins?.find((p) => p.trackId === pinTrack);
    if (!pin) return;
    const id = setTimeout(() => panzoom.current?.focus(pin.x, pin.y, 3.2), 90);
    return () => clearTimeout(id);
  }, [pinTrack, map]);

  if (!map) return null;

  return (
    <div className="mapview">
      <StickyHeader>
        {from && (
          <button className="backbar" onClick={() => navigate(`/event/${from.id}`)}>
            <IconChevronLeft size={19} />
            <span>
              Back to <strong>{from.title}</strong>
            </span>
          </button>
        )}
        <div className="hdr__bar">
          <div className="scroller maptabs">
            {maps.map((m) => (
              <button
                key={m.key}
                className="maptab"
                aria-pressed={m.key === map.key}
                onClick={() =>
                  navigate(`/map/${m.key}${fromSession ? `?from=${fromSession}` : ''}`)
                }
              >
                {m.title}
              </button>
            ))}
          </div>
        </div>
      </StickyHeader>

      {map.kind === 'booths' && (
        <div className="boothsearch">
          <div className="search">
            <IconSearch />
            <input
              type="search"
              value={boothQuery}
              onChange={(e) => setBoothQuery(e.target.value)}
              placeholder={`Find a booth in ${map.title}…`}
              aria-label="Find a booth"
            />
            {boothQuery && (
              <button
                className="search__clear"
                onClick={() => setBoothQuery('')}
                aria-label="Clear"
              >
                <IconClose size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mapstage">
        <PanZoom ref={panzoom} aspect={map.width / map.height} maxScale={map.kind === 'pins' ? 9 : 12}>
          <img
            className="mapstage__img"
            src={map.image}
            alt={`${map.title} floor plan`}
            width={map.width}
            height={map.height}
            draggable={false}
          />

          {map.kind === 'pins' &&
            map.pins?.map((pin) => {
              const track = data.trackById.get(pin.trackId);
              if (!track) return null;
              const active = selectedTrack === pin.trackId;
              return (
                <button
                  key={pin.trackId}
                  data-nodrag
                  className={`mappin${active ? ' mappin--active' : ''}`}
                  style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                  aria-label={`${track.title}, floor ${pin.floor}`}
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedTrack(active ? null : pin.trackId);
                    if (!active) panzoom.current?.focus(pin.x, pin.y, 3.2);
                  }}
                >
                  <span className="mappin__dot" />
                </button>
              );
            })}

          {map.kind === 'booths' && (
            <BoothLayer
              map={map}
              query={boothQuery}
              selected={selectedBooth}
              onSelect={(b) => {
                setSelectedBooth(b.id === selectedBooth ? null : b.id);
                if (b.id !== selectedBooth && !b.offMap) {
                  panzoom.current?.focus(b.x + b.w / 2, b.y + b.h / 2, 5);
                }
              }}
            />
          )}
        </PanZoom>

        <div className="mapctl">
          <button className="mapctl__btn" onClick={() => panzoom.current?.zoomBy(1.6)} aria-label="Zoom in">
            <IconPlus />
          </button>
          <button className="mapctl__btn" onClick={() => panzoom.current?.zoomBy(1 / 1.6)} aria-label="Zoom out">
            <IconMinus />
          </button>
          <button className="mapctl__btn" onClick={() => panzoom.current?.reset()} aria-label="Fit map to screen">
            <IconTarget />
          </button>
        </div>
      </div>

      {map.kind === 'pins' ? (
        <RoomPanel
          trackId={selectedTrack}
          onClose={() => setSelectedTrack(null)}
          nowDay={clock.day}
          nowMinutes={clock.minutes}
        />
      ) : (
        <BoothPanel map={map} query={boothQuery} selected={selectedBooth} onSelect={setSelectedBooth} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BoothLayer({
  map,
  query,
  selected,
  onSelect,
}: {
  map: { booths?: Booth[]; sections?: { id: number; title: string; x: number; y: number; w: number; h: number; color: string }[] };
  query: string;
  selected: number | null;
  onSelect: (b: Booth) => void;
}) {
  const q = query.trim().toLowerCase();
  return (
    <>
      {map.sections?.map((s) => (
        <div
          key={s.id}
          className="mapsection"
          style={{
            left: `${s.x * 100}%`,
            top: `${s.y * 100}%`,
            width: `${s.w * 100}%`,
            height: `${s.h * 100}%`,
            borderColor: s.color,
          }}
          aria-hidden="true"
        />
      ))}
      {map.booths
        ?.filter((b) => !b.offMap)
        .map((b) => {
          const match = q ? b.title.toLowerCase().includes(q) : false;
          return (
            <button
              key={b.id}
              data-nodrag
              className={`booth${selected === b.id ? ' booth--selected' : ''}${
                q ? (match ? ' booth--match' : ' booth--dim') : ''
              }`}
              style={{
                left: `${b.x * 100}%`,
                top: `${b.y * 100}%`,
                width: `${b.w * 100}%`,
                height: `${b.h * 100}%`,
                background: b.color,
                transform: b.rotate ? `rotate(${b.rotate}deg)` : undefined,
                borderRadius: b.shape === 'circle' ? '50%' : undefined,
              }}
              onClick={() => onSelect(b)}
              aria-label={`Booth ${b.title}`}
              aria-pressed={selected === b.id}
            >
              <span className="booth__label">{b.title}</span>
            </button>
          );
        })}
    </>
  );
}

function BoothPanel({
  map,
  query,
  selected,
  onSelect,
}: {
  map: { title: string; booths?: Booth[] };
  query: string;
  selected: number | null;
  onSelect: (id: number | null) => void;
}) {
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? (map.booths ?? []).filter((b) => b.title.toLowerCase().includes(q)) : []),
    [map.booths, q]
  );
  const chosen = map.booths?.find((b) => b.id === selected);

  if (!q && !chosen) {
    return (
      <div className="mappanel mappanel--hint">
        <p>
          {map.booths?.length ?? 0} booths. Search by number above, or tap a booth on the map.
        </p>
        <p className="muted">
          Tekko doesn't publish which vendor is in which booth, so only numbers are available.
        </p>
      </div>
    );
  }

  if (chosen) {
    return (
      <div className="mappanel">
        <div className="mappanel__head">
          <h2>Booth {chosen.title}</h2>
          <button className="iconbtn" onClick={() => onSelect(null)} aria-label="Close">
            <IconClose size={20} />
          </button>
        </div>
        {chosen.offMap && (
          <p className="notice notice--warn">
            This booth isn't placed on the map — Tekko's own map data has it positioned off the
            edge of the image, so we can't show you where it is.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mappanel">
      <p className="count">
        {matches.length} booth{matches.length === 1 ? '' : 's'} matching "{query}"
      </p>
      <div className="boothlist">
        {matches.slice(0, 40).map((b) => (
          <button key={b.id} className="boothlist__item" onClick={() => onSelect(b.id)}>
            {b.title}
            {b.offMap && <span className="boothlist__off">not on map</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function RoomPanel({
  trackId,
  onClose,
  nowDay,
  nowMinutes,
}: {
  trackId: number | null;
  onClose: () => void;
  nowDay: string;
  nowMinutes: number;
}) {
  const { data } = useStore();
  const track = trackId ? data.trackById.get(trackId) : null;
  const pin = trackId ? data.pinByTrack.get(trackId) : null;

  const { live, next } = useMemo(() => {
    if (!trackId) return { live: [] as Session[], next: [] as Session[] };
    const today = data.schedule.sessions.filter(
      (s) => s.trackId === trackId && s.day === nowDay
    );
    const ctx = { nowDay, nowMinutes };
    return {
      live: today.filter((s) => isLive(s, ctx)),
      next: today.filter((s) => !isPast(s, ctx) && !isLive(s, ctx)).slice(0, 3),
    };
  }, [trackId, data, nowDay, nowMinutes]);

  if (!track) {
    return (
      <div className="mappanel mappanel--hint">
        <p>Tap a marker to see what's on in that room.</p>
      </div>
    );
  }

  return (
    <div className="mappanel">
      <div className="mappanel__head">
        <div>
          <h2>{track.title}</h2>
          {pin && (
            <p className="mappanel__sub">
              Floor {pin.floor}
              {pin.room ? ` · ${pin.room}` : ''}
            </p>
          )}
        </div>
        <button className="iconbtn" onClick={onClose} aria-label="Close">
          <IconClose size={20} />
        </button>
      </div>

      {live.length > 0 && (
        <>
          <p className="sectiontitle">On now</p>
          {live.map((s) => (
            <RoomRow key={s.id} session={s} live />
          ))}
        </>
      )}

      {next.length > 0 ? (
        <>
          <p className="sectiontitle">Coming up</p>
          {next.map((s) => (
            <RoomRow key={s.id} session={s} />
          ))}
        </>
      ) : (
        live.length === 0 && <p className="muted">Nothing else scheduled here today.</p>
      )}

      <a className="btn btn--ghost btn--sm btn--block" href={`#/schedule?track=${track.id}`}>
        See all {track.count} events in this room
      </a>
    </div>
  );
}

function RoomRow({ session, live }: { session: Session; live?: boolean }) {
  return (
    <a className="roomrow" href={`#/event/${session.id}`}>
      <span className="roomrow__time">
        {live && <span className="livedot" aria-hidden="true" />}
        {formatMinutes(session.startMin)}
      </span>
      <span className="roomrow__title">{session.title}</span>
    </a>
  );
}
