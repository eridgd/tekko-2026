import { STORAGE_KEYS } from './constants';

/**
 * localStorage wrapper that never throws. Safari in private mode, a full quota,
 * or a locked-down webview all make writes fail — and losing your saved
 * schedule is bad, but crashing the whole app is worse.
 */

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSaved(): string[] {
  const value = read<unknown>(STORAGE_KEYS.saved, []);
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

export function storeSaved(ids: string[]): boolean {
  return write(STORAGE_KEYS.saved, ids);
}

export type ThemePref = 'system' | 'light' | 'dark';
export type ScheduleViewMode = 'agenda' | 'grid';

export interface Prefs {
  theme: ThemePref;
  view: ScheduleViewMode;
  hidePast: boolean;
  /** Whether the vendor-map info blurb is expanded (remembered across visits). */
  mapInfoOpen: boolean;
  /** Whether the grid view's room-label column is collapsed for more timeline width. */
  gridRoomsCollapsed: boolean;
  /** Ids dismissed from the "these saved events are gone" notice. */
  dismissedMissing: string[];
}

const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  view: 'agenda',
  hidePast: false,
  mapInfoOpen: false,
  gridRoomsCollapsed: false,
  dismissedMissing: [],
};

export function loadPrefs(): Prefs {
  const raw = read<Partial<Prefs>>(STORAGE_KEYS.prefs, {});
  return {
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : DEFAULT_PREFS.theme,
    view: raw.view === 'grid' ? 'grid' : 'agenda',
    hidePast: typeof raw.hidePast === 'boolean' ? raw.hidePast : DEFAULT_PREFS.hidePast,
    mapInfoOpen: typeof raw.mapInfoOpen === 'boolean' ? raw.mapInfoOpen : DEFAULT_PREFS.mapInfoOpen,
    gridRoomsCollapsed:
      typeof raw.gridRoomsCollapsed === 'boolean'
        ? raw.gridRoomsCollapsed
        : DEFAULT_PREFS.gridRoomsCollapsed,
    dismissedMissing: Array.isArray(raw.dismissedMissing)
      ? raw.dismissedMissing.filter((v): v is string => typeof v === 'string')
      : [],
  };
}

export function storePrefs(prefs: Prefs): boolean {
  return write(STORAGE_KEYS.prefs, prefs);
}
