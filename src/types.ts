/** Shapes emitted by scripts/build-data.mjs. Keep in sync with that file. */

export interface Session {
  id: string;
  title: string;
  desc: string | null;
  /** Con-day key, e.g. "2026-07-24". After-midnight events roll back a day. */
  day: string;
  /** Unix seconds. */
  start: number;
  end: number;
  /** Minutes from midnight of the con day; >1440 for after-midnight events. */
  startMin: number;
  durMin: number;
  startLabel: string;
  endLabel: string;
  hideEnd: boolean;
  /** Open room / free play / all-day. Excluded from conflict warnings. */
  dropIn?: boolean;
  /** Upstream data problem, e.g. "end-before-start". */
  issue?: string;
  trackId: number;
  track: string;
  loc: string;
  cat: CategoryId;
  flags: FlagId[];
  topics?: string[];
  presenters?: string[];
  guests: number[];
  calStart: string;
  calEnd: string;
}

export type CategoryId = string;
export type FlagId = 'featured' | 'adult' | 'teen' | 'kids' | 'partner';

export interface Category {
  id: CategoryId;
  label: string;
  color: string;
  count: number;
}

export interface Flag {
  id: FlagId;
  label: string;
  short: string;
  count: number;
}

export interface ConDay {
  key: string;
  weekday: string;
  short: string;
  date: string;
  count: number;
}

export interface Track {
  id: number;
  title: string;
  count: number;
  floor: number | null;
  room: string | null;
  mapped: boolean;
  unmappedReason?: string;
}

export interface Schedule {
  generatedAt: string;
  fetchedAt: string;
  timezone: string;
  event: { id: number; name: string; venue: string };
  days: ConDay[];
  tracks: Track[];
  categories: Category[];
  flags: Flag[];
  sessions: Session[];
}

export interface MapPin {
  trackId: number;
  x: number;
  y: number;
  floor: number;
  room: string;
}

export interface Booth {
  id: number;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
  shape?: string;
  color: string;
  /** Dragged off-canvas in Eventeny's editor; can't be shown in place. */
  offMap?: boolean;
}

export interface MapSection {
  id: number;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface MapTextBox {
  text: string;
  x: number;
  y: number;
  size?: number;
  color: string;
}

export interface VenueMap {
  key: string;
  id: number;
  title: string;
  description?: string;
  image: string;
  width: number;
  height: number;
  kind: 'pins' | 'booths';
  pins?: MapPin[];
  booths?: Booth[];
  sections?: MapSection[];
  textBoxes?: MapTextBox[];
}

export interface Guest {
  id: number;
  name: string;
  pronouns?: string;
  category?: string;
  featured?: boolean;
  photo?: string;
  website?: string;
  instagram?: string;
  youtube?: string;
  twitch?: string;
  x?: string;
}

export interface AppData {
  schedule: Schedule;
  maps: VenueMap[];
  guests: Guest[];
  /** Lookups built once at load. */
  sessionById: Map<string, Session>;
  trackById: Map<number, Track>;
  guestById: Map<number, Guest>;
  categoryById: Map<string, Category>;
  pinByTrack: Map<number, MapPin>;
}
