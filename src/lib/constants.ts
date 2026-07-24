/** Must match scripts/lib/constants.mjs — the rollover is applied at build time. */
export const CON_DAY_ROLLOVER_HOUR = 4;

export const STORAGE_KEYS = {
  saved: 'tekko.v1.saved',
  prefs: 'tekko.v1.prefs',
} as const;

/** How long before a saved event we start nudging you on the Now tab. */
export const UPCOMING_WINDOW_MIN = 90;

export const BASE = import.meta.env.BASE_URL;
