import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { conClock, type ConClock } from './lib/time';
import {
  loadPrefs,
  loadSaved,
  storePrefs,
  storeSaved,
  type Prefs,
} from './lib/storage';
import type { AppData, Session } from './types';

interface Store {
  data: AppData;
  /** Con-local now, refreshed every 30s. */
  clock: ConClock;
  savedIds: Set<string>;
  savedSessions: Session[];
  /** Saved ids that no longer exist in the current data snapshot. */
  missingSaved: string[];
  toggleSaved: (id: string) => void;
  isSaved: (id: string) => boolean;
  clearMissing: () => void;
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  /** False when localStorage rejected a write (private mode, quota). */
  storageOk: boolean;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ data, children }: { data: AppData; children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(loadSaved()));
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [storageOk, setStorageOk] = useState(true);
  const [clock, setClock] = useState<ConClock>(() => conClock());

  // 30s is fine: the smallest thing that depends on the clock is the "starting
  // in N min" label, and a half-minute of drift there is invisible.
  useEffect(() => {
    const id = setInterval(() => setClock(conClock()), 30_000);
    const onVisible = () => {
      if (!document.hidden) setClock(conClock());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Theme is applied to <html> so the pre-paint script in index.html and React
  // agree on a single source of truth.
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = prefs.theme;
  }, [prefs.theme]);

  // Keep multiple open tabs (or a tab plus the installed PWA) in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'tekko.v1.saved') setSavedIds(new Set(loadSaved()));
      if (e.key === 'tekko.v1.prefs') setPrefsState(loadPrefs());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleSaved = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setStorageOk(storeSaved([...next]));
      return next;
    });
  }, []);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      setStorageOk(storePrefs(next));
      return next;
    });
  }, []);

  // A mid-con data refresh can remove a cancelled event you'd saved. Surface
  // that rather than letting it vanish silently.
  const { savedSessions, missingSaved } = useMemo(() => {
    const found: Session[] = [];
    const missing: string[] = [];
    for (const id of savedIds) {
      const session = data.sessionById.get(id);
      if (session) found.push(session);
      else if (!prefs.dismissedMissing.includes(id)) missing.push(id);
    }
    found.sort((a, b) => a.start - b.start);
    return { savedSessions: found, missingSaved: missing };
  }, [savedIds, data, prefs.dismissedMissing]);

  const clearMissing = useCallback(() => {
    setPrefsState((prev) => {
      const next = {
        ...prev,
        dismissedMissing: [...new Set([...prev.dismissedMissing, ...missingSaved])],
      };
      storePrefs(next);
      return next;
    });
  }, [missingSaved]);

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  const value = useMemo<Store>(
    () => ({
      data,
      clock,
      savedIds,
      savedSessions,
      missingSaved,
      toggleSaved,
      isSaved,
      clearMissing,
      prefs,
      setPrefs,
      storageOk,
    }),
    [
      data, clock, savedIds, savedSessions, missingSaved,
      toggleSaved, isSaved, clearMissing, prefs, setPrefs, storageOk,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
