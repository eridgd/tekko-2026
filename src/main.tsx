import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadAppData } from './data/load';
import { StoreProvider } from './store';
import { App } from './App';
import { UpdatePrompt } from './components/UpdatePrompt';
import type { AppData } from './types';
import './index.css';
import './components.css';

// We manage scroll position ourselves (schedule remembers where you were, detail
// views start at the top). Let the browser stop fighting us over it.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

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

  // Rendered on every path so the service worker registers (and starts checking
  // for updates) regardless of whether the data loaded.
  return (
    <>
      {content}
      <UpdatePrompt />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
