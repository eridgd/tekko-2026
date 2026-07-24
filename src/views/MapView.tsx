import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { navigate, type Route } from '../hooks/useRoute';
import { PanZoom, type PanZoomHandle, type Transform } from '../components/PanZoom';
import { StickyHeader } from '../components/StickyHeader';
import { formatMinutes } from '../lib/time';
import { isLive, isPast } from '../lib/filters';
import {
  IconChevronLeft,
  IconClose,
  IconMinus,
  IconPlus,
  IconTarget,
} from '../components/Icons';
import type { Session } from '../types';

/**
 * Each map remembers its own pan/zoom while you switch between them: zoom into
 * the floor map, glance at Artist Alley (which opens fresh), come back — the
 * floor map is exactly as you left it. Module-level so it survives leaving and
 * returning to the Maps tab within a session; resets on a full reload.
 */
const mapTransforms = new Map<string, Transform>();

/** Collapsible info blurb for the vendor/artist maps — it's tall, and you don't
 *  need it after the first read, so its open/closed state is remembered. */
function VendorMapInfo({ mapKey, description }: { mapKey: string; description?: string }) {
  const { prefs, setPrefs } = useStore();
  const open = prefs.mapInfoOpen;
  const noun = mapKey === 'artistalley' ? 'artist is at each table' : 'vendor is in each booth';

  return (
    <div className="mappanel mapinfo">
      <button
        className="mapinfo__toggle"
        aria-expanded={open}
        onClick={() => setPrefs({ mapInfoOpen: !open })}
      >
        <span>About this map</span>
        <IconChevronLeft size={18} className={`mapinfo__chev${open ? ' mapinfo__chev--open' : ''}`} />
      </button>
      {open && (
        <div className="mapinfo__body">
          {description && <p className="mapcaption">{description}</p>}
          <p className="muted mapcaption__note">
            Tekko doesn't publish which {noun}, so this map shows numbers only — find the number in
            the listing, then locate it here.
          </p>
        </div>
      )}
    </div>
  );
}

export function MapView({ route }: { route: Route }) {
  const { data, clock } = useStore();
  const maps = data.maps;

  const key = route.segments[1] ?? maps[0]?.key ?? 'floor';
  const map = maps.find((m) => m.key === key) ?? maps[0];

  const pinTrack = Number(route.params.get('pin')) || null;
  const fromSession = route.params.get('from');
  const from = fromSession ? data.sessionById.get(fromSession) : undefined;

  const panzoom = useRef<PanZoomHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [selectedTrack, setSelectedTrack] = useState<number | null>(pinTrack);

  // Fly to the requested pin once the map has measured itself.
  useEffect(() => {
    setSelectedTrack(pinTrack);
    if (!pinTrack || !map) return;
    const pin = map.pins?.find((p) => p.trackId === pinTrack);
    if (!pin) return;
    const id = setTimeout(() => panzoom.current?.focus(pin.x, pin.y, 3.2), 90);
    return () => clearTimeout(id);
  }, [pinTrack, map]);

  if (!map) return null;

  const isFloor = map.kind === 'pins';

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

      <div className="mapstage" ref={stageRef}>
        <PanZoom
          // Remount per map so each opens at its own remembered view (or fresh).
          key={map.key}
          ref={panzoom}
          aspect={map.width / map.height}
          maxScale={isFloor ? 9 : 6}
          initial={mapTransforms.get(map.key)}
          onTransformChange={(tr) => mapTransforms.set(map.key, tr)}
          // Keep pins a constant on-screen size instead of ballooning with zoom.
          onScaleChange={(s) =>
            stageRef.current?.style.setProperty('--pin-inv', String(1 / s))
          }
        >
          <img
            className="mapstage__img"
            src={map.image}
            alt={`${map.title} floor plan`}
            width={map.width}
            height={map.height}
            draggable={false}
          />

          {isFloor &&
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

      {isFloor ? (
        <RoomPanel
          trackId={selectedTrack}
          onClose={() => setSelectedTrack(null)}
          nowDay={clock.day}
          nowMinutes={clock.minutes}
          unmappedFrom={!selectedTrack && from && !data.pinByTrack.has(from.trackId) ? from : null}
        />
      ) : (
        <VendorMapInfo mapKey={map.key} description={map.description} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RoomPanel({
  trackId,
  onClose,
  nowDay,
  nowMinutes,
  unmappedFrom,
}: {
  trackId: number | null;
  onClose: () => void;
  nowDay: string;
  nowMinutes: number;
  unmappedFrom?: Session | null;
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
    if (unmappedFrom) {
      const t = data.trackById.get(unmappedFrom.trackId);
      return (
        <div className="mappanel mappanel--hint">
          <p className="notice notice--warn">
            <strong>{unmappedFrom.loc}</strong> isn't marked on the convention floor map
            {t?.unmappedReason ? ` — ${t.unmappedReason.replace(/\.$/, '')}` : ''}. Tap any marker
            to explore other rooms.
          </p>
        </div>
      );
    }
    // Nothing selected: give the whole height to the map, no placeholder panel.
    return null;
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
