import { StrictMode, useEffect, useState } from 'react';
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
