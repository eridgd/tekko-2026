import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Because the app is offline-first (the service worker serves everything from
 * cache), a copy that's already open won't notice a fresh deploy on its own —
 * which matters here, since the schedule is auto-refreshed every 30 min during
 * the con. So we check for a new version periodically (and whenever the tab is
 * refocused) and, when one is ready, show a tap-to-refresh banner rather than
 * yanking the page out from under someone mid-scroll.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => registration.update().catch(() => {});
      // Every few minutes, plus whenever the user returns to the tab.
      setInterval(check, 3 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="updatetoast" role="status" aria-live="polite">
      <span className="updatetoast__text">Updated schedule available</span>
      <button
        className="updatetoast__btn"
        onClick={() => updateServiceWorker(true)}
      >
        Refresh
      </button>
      <button
        className="updatetoast__dismiss"
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
