import { useEffect } from 'react';
import { useRoute } from './hooks/useRoute';
import { TabBar } from './components/TabBar';
import { NowView } from './views/NowView';
import { ScheduleView } from './views/ScheduleView';
import { SessionDetail } from './views/SessionDetail';
import { SavedView } from './views/SavedView';
import { MapView } from './views/MapView';
import { GuestsView } from './views/GuestsView';
import { SettingsView } from './views/SettingsView';

/** Which bottom tab lights up for a given route root. */
const TAB_FOR: Record<string, string> = {
  now: 'now',
  schedule: 'schedule',
  event: 'schedule',
  saved: 'saved',
  map: 'map',
  guests: 'guests',
  guest: 'guests',
  settings: 'now',
};

export function App() {
  const route = useRoute();
  const root = route.segments[0] ?? 'now';

  // Detail views push a new history entry, so start each at the top.
  useEffect(() => {
    if (root === 'event' || root === 'guest' || root === 'settings') window.scrollTo(0, 0);
  }, [root, route.segments[1]]);

  let view;
  switch (root) {
    case 'schedule':
      view = <ScheduleView route={route} />;
      break;
    case 'event':
      view = <SessionDetail id={route.segments[1] ?? ''} route={route} />;
      break;
    case 'saved':
      view = <SavedView />;
      break;
    case 'map':
      view = <MapView route={route} />;
      break;
    case 'guests':
      view = <GuestsView />;
      break;
    case 'guest':
      view = <GuestsView guestId={Number(route.segments[1])} />;
      break;
    case 'settings':
      view = <SettingsView />;
      break;
    case 'now':
    default:
      view = <NowView />;
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TabBar active={TAB_FOR[root] ?? 'now'} />
      {/* The map owns its own full-height layout and reserves its own space for
          the tab bar, so the usual bottom padding would double-count it. */}
      <main className={`app__main${root === 'map' ? ' app__main--flush' : ''}`} id="main">
        {view}
      </main>
    </div>
  );
}
