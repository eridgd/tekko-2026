import { BASE } from '../lib/constants';
import type { AppData, Guest, Schedule, VenueMap } from '../types';

/**
 * Loads the three baked JSON files and builds the lookup maps once.
 *
 * These are same-origin static files precached by the service worker, so after
 * the first visit this resolves from cache with no network. There is no API and
 * no fallback path — if these fail, the app has nothing to show, which is what
 * the error state in App.tsx handles.
 */
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}data/${path}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

export async function loadAppData(): Promise<AppData> {
  const [schedule, mapsFile, guestsFile] = await Promise.all([
    getJson<Schedule>('schedule.json'),
    getJson<{ maps: VenueMap[] }>('maps.json'),
    getJson<{ guests: Guest[] }>('guests.json'),
  ]);

  // Asset paths are stored relative so the bundle doesn't hard-code a deploy
  // path; resolve them against the app base once, here, rather than in every
  // <img> that renders one.
  const maps = mapsFile.maps.map((m) => ({ ...m, image: BASE + m.image }));
  const guests = guestsFile.guests.map((g) =>
    g.photo ? { ...g, photo: BASE + g.photo } : g
  );

  const pinByTrack = new Map(
    (maps.find((m) => m.kind === 'pins')?.pins ?? []).map((p) => [p.trackId, p])
  );

  return {
    schedule,
    maps,
    guests,
    sessionById: new Map(schedule.sessions.map((s) => [s.id, s])),
    trackById: new Map(schedule.tracks.map((t) => [t.id, t])),
    guestById: new Map(guests.map((g) => [g.id, g])),
    categoryById: new Map(schedule.categories.map((c) => [c.id, c])),
    pinByTrack,
  };
}
