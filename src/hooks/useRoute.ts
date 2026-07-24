import { useCallback, useEffect, useState } from 'react';

/**
 * Hash routing.
 *
 * Deliberately hash-based rather than History API: this is a static site on
 * Netlify wrapped in a service worker, and `#/map/floor?pin=88654` needs to
 * work identically on first load, on reload, from a home-screen shortcut and
 * fully offline. Hashes never touch the server, so there's nothing to
 * misconfigure.
 */

export interface Route {
  /** Path segments, e.g. ['map', 'floor']. */
  segments: string[];
  params: URLSearchParams;
  /** Full hash path without the leading '#', e.g. "/map/floor?pin=1". */
  raw: string;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/now';
  const [path = '', search = ''] = raw.split('?');
  return {
    segments: path.split('/').filter(Boolean),
    params: new URLSearchParams(search),
    raw,
  };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

/** Push a new route (adds a history entry — back returns to where you were). */
export function navigate(to: string): void {
  window.location.hash = to.startsWith('/') ? to : `/${to}`;
}

/**
 * Replace the current route without adding a history entry. Used for filter
 * changes so the back button doesn't have to walk through every keystroke.
 */
export function replaceRoute(to: string): void {
  const path = to.startsWith('/') ? to : `/${to}`;
  window.history.replaceState(null, '', `#${path}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useNavigate() {
  return useCallback(navigate, []);
}

/** Scrolls to top whenever the path (not the query) changes. */
export function useScrollReset(key: string): void {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
}
