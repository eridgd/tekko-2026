import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadAppData } from './data/load';
import { StoreProvider } from './store';
import { App } from './App';
import type { AppData } from './types';
import './index.css';
import './components.css';

// We manage scroll position ourselves (schedule remembers where you were, detail
// views start at the top). Let the browser stop fighting us over it.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// Register the service worker and keep checking for a newer one. The worker is
// built with skipWaiting + clientsClaim, so a new deploy takes over on its own
// — no banner, no forced reload. New app code applies on the next reload; the
// schedule data is already kept fresh (network-first + the in-app 30-min
// re-fetch), which is the part that actually changes during the con.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        const check = () => reg.update().catch(() => {});
        setInterval(check, 3 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) check();
        });
      })
      .catch(() => {
        /* no SW in dev, or registration blocked — the app still works online */
      });
  });
}

function Root() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadAppData().then(setData, setError);
  }, []);

  // Keep an open app current: re-pull the schedule every 30 min (matching the
  // server-side auto-refresh), and whenever you return to the tab after a
  // while. Data is fetched network-first, so these hit the server when online
  // and no-op offline. Only swaps state when the snapshot actually changed
  // (fetchedAt differs), so it's silent and cheap when nothing's new. Saved
  // events live in localStorage keyed by id, so they're untouched.
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    let cancelled = false;
    let lastAt = Date.now();
    const refetch = () => {
      loadAppData()
        .then((fresh) => {
          if (cancelled) return;
          lastAt = Date.now();
          if (dataRef.current?.schedule.fetchedAt !== fresh.schedule.fetchedAt) {
            setData(fresh);
            setError(null);
          }
        })
        .catch(() => {
          /* offline or a blip — keep what we have, try again next tick */
        });
    };
    const id = window.setInterval(refetch, 30 * 60 * 1000);
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastAt > 15 * 60 * 1000) refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  let content;
  if (error) {
    content = (
      <div className="boot">
        <div className="boot__inner">
          <h1>Couldn't load the schedule</h1>
          <p>
            The app's data files didn't load. If this is your first visit, you'll need to be
            online once so the schedule can be cached for offline use.
          </p>
          <pre>{error.message}</pre>
          <button className="btn btn--primary" onClick={() => location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  } else if (!data) {
    content = (
      <div className="boot">
        <div className="boot__inner">
          <div className="boot__spinner" />
          <p>Loading the Tekko schedule…</p>
        </div>
      </div>
    );
  } else {
    content = (
      <StoreProvider data={data}>
        <App />
      </StoreProvider>
    );
  }

  return content;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
