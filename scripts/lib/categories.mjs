/**
 * Category curation.
 *
 * Eventeny's `tags` field is a pipe-delimited free-text string with 261 distinct
 * tokens across the 943 sessions. It mixes genuine content categories ("Panel",
 * "Workshop", "18+") with presenter names ("Zeke Changuris", "Ladybeard") and
 * meaningless boilerplate ("Tekko" is on 86 sessions and says nothing).
 *
 * That is unusable as a filter, so we curate. Resolution order per session:
 *   1. explicit tag match against TAG_CATEGORY below
 *   2. fallback inferred from the track/room it happens in (TRACK_CATEGORY)
 *   3. 'other'
 *
 * Any token that isn't in a known vocabulary here is treated as a presenter
 * name and surfaced on the detail view instead of being thrown away.
 */

/** Display order is deliberate: broad programming first, niche last. */
export const CATEGORIES = [
  { id: 'panel', label: 'Panels', color: '#8DC63F' },
  { id: 'screening', label: 'Anime Screenings', color: '#5B8DEF' },
  { id: 'meetup', label: 'Meetups & Photoshoots', color: '#F26522' },
  { id: 'tabletop', label: 'Tabletop & CCG', color: '#C77DFF' },
  { id: 'videogames', label: 'Video Games', color: '#00BFA6' },
  { id: 'larp', label: 'LARP & Roleplay', color: '#B5651D' },
  { id: 'cosplay', label: 'Cosplay', color: '#E8302A' },
  { id: 'contest', label: 'Contests & Gameshows', color: '#FFB000' },
  { id: 'workshop', label: 'Workshops', color: '#4DB6AC' },
  { id: 'music', label: 'Music', color: '#EC407A' },
  { id: 'dance', label: 'Dance', color: '#AB47BC' },
  { id: 'amv', label: 'AMV', color: '#26A69A' },
  { id: 'mainevent', label: 'Main Events', color: '#F5D9A8' },
  { id: 'expo', label: 'Expo & Shopping', color: '#7E9A3E' },
  { id: 'autographs', label: 'Autographs', color: '#FF7043' },
  { id: 'other', label: 'Other', color: '#8A94A6' },
];

export const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

/** Exact tag token -> category id. Tokens are matched case-insensitively. */
const TAG_CATEGORY = {
  // Panels
  'panel': 'panel',
  'gakkou panel': 'panel',
  'bamforth panel': 'panel',
  'entertainment panel': 'panel',
  'educational panel': 'panel',
  'con academy: teaching the stuff (c.a.t.s.)': 'panel',
  "not your grandfather's panelists": 'panel',
  'fujoshi professors': 'panel',
  'consider the nonsense': 'panel',
  'the geek pantheon': 'panel',

  // Screenings
  'video': 'screening',
  'video requests': 'screening',

  // Meetups
  'photo meet-up': 'meetup',
  'meetups': 'meetup',
  'meetup': 'meetup',
  'meet and greet': 'meetup',

  // Tabletop
  'tabletop roleplaying game': 'tabletop',

  // Video games
  'video game(s)': 'videogames',
  'video games': 'videogames',
  'gaming': 'videogames',
  'pokemon': 'tabletop',

  // Cosplay
  'cosplay': 'cosplay',
  'fashion': 'cosplay',
  'armor academy': 'workshop',

  // Contests / gameshows
  'gameshow/game': 'contest',
  'game show': 'contest',
  'competition': 'contest',
  'interactive (non-gameshow)': 'contest',
  'so you think you can fanon': 'contest',
  'awards presentation': 'contest',
  'unlockable content': 'contest',

  // Workshops
  'workshop': 'workshop',
  'drawing': 'workshop',

  // Music
  'music': 'music',
  'karaoke': 'music',
  'kpop': 'music',

  // Dance
  'dance': 'dance',
  'formal dance': 'dance',
  'tekko formal dance team': 'dance',
  'dance/music': 'dance',

  // Main events
  'main event': 'mainevent',
};

/**
 * Track-title substring -> category, applied when tags gave us nothing.
 * Checked in order; first match wins, so put specific entries above general ones.
 */
const TRACK_CATEGORY = [
  ['photospot', 'meetup'],
  ['meet ups', 'meetup'],
  ['amv', 'amv'],
  ['videos', 'screening'],
  ['ccg', 'tabletop'],
  ['pokemon league', 'tabletop'],
  ['board games', 'tabletop'],
  ['rpg', 'tabletop'],
  ['anime rp', 'larp'],
  ['larp', 'larp'],
  ['speedrunning', 'videogames'],
  ['video games', 'videogames'],
  ['gaming hall', 'videogames'],
  ['autographs', 'autographs'],
  ['tekko market', 'expo'],
  ['expo hall', 'expo'],
  ['scale model', 'workshop'],
  ['cosplay panel', 'cosplay'],
  ['tekko formal', 'dance'],
  ['stage uzume', 'music'],
  ['main stage', 'mainevent'],
  ['tekko gakkou', 'panel'],
  ['chibi tekko', 'panel'],
  ['panel', 'panel'],
  ['hall stage', 'panel'],
  ['rooftop terrace', 'other'],
  ['zen zone', 'other'],
];

/** Age / audience flags. Orthogonal to category — a Panel can also be 18+. */
const FLAG_TAGS = {
  '18+': 'adult',
  '16+': 'teen',
  'chibi (12&under)': 'kids',
  'featured panelist(s)': 'featured',
  'industry guests': 'featured',
  'industry guest(s)': 'featured',
  'voice actor guests': 'featured',
  'cosplay guest': 'featured',
  'cosplay guest(s)': 'featured',
  'musical guests': 'featured',
  'musical guest(s)': 'featured',
  'fashion guest(s)': 'featured',
  'guest': 'featured',
  'guests': 'featured',
  'guest(s)': 'featured',
  'various guests': 'featured',
  'visting partner': 'partner', // Eventeny's typo, preserved so the match works
  'visiting partner': 'partner',
};

export const FLAGS = [
  { id: 'featured', label: 'Featured Guest', short: 'Guest' },
  { id: 'adult', label: '18+', short: '18+' },
  { id: 'teen', label: '16+', short: '16+' },
  { id: 'kids', label: 'Kids (12 & under)', short: 'Kids' },
  { id: 'partner', label: 'Visiting Partner', short: 'Partner' },
];

/**
 * Interest tags kept as secondary chips — genuinely useful for finding things,
 * but too sparse to be top-level categories.
 */
const TOPIC_TAGS = new Set([
  'lgbtq+',
  'japanese culture',
  'fanfiction',
  'horror',
  'feminism',
  'ribbons',
  'vtuber',
  'photography',
  'active / athletic',
  'twisted wonderland',
  'theme',
]);

/** Boilerplate that carries no information. */
const NOISE_TAGS = new Set(['tekko', 'other', '']);

const norm = (s) => String(s ?? '').trim().toLowerCase();

/** Eventeny double-encodes HTML entities in tag strings. */
export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Classify one session.
 * @returns {{category: string, flags: string[], topics: string[], presenters: string[], viaTrack: boolean}}
 */
export function classify(session, trackTitle) {
  const tokens = decodeEntities(session.tags)
    .split('|')
    .map((t) => t.trim())
    .filter(Boolean);

  let category = null;
  const flags = new Set();
  const topics = new Set();
  const presenters = [];

  for (const token of tokens) {
    const key = norm(token);
    if (NOISE_TAGS.has(key)) continue;

    if (FLAG_TAGS[key]) {
      flags.add(FLAG_TAGS[key]);
      continue;
    }
    if (TOPIC_TAGS.has(key)) {
      topics.add(token);
      continue;
    }
    if (TAG_CATEGORY[key]) {
      // First category tag wins — TAG_CATEGORY order isn't meaningful, but
      // sessions rarely carry two and the first is reliably the primary one.
      category ??= TAG_CATEGORY[key];
      continue;
    }
    // Unknown token: a human's name (or a group's). Keep it for display.
    presenters.push(token);
  }

  let viaTrack = false;
  if (!category) {
    const track = norm(decodeEntities(trackTitle));
    for (const [needle, cat] of TRACK_CATEGORY) {
      if (track.includes(needle)) {
        category = cat;
        viaTrack = true;
        break;
      }
    }
  }

  // Screening titles encode their rating, e.g. "Akira (Sub) (R)" — a session in
  // the video rooms marked R is 18+ even though it carries no 18+ tag.
  if (/\((R|18\+)\)/i.test(decodeEntities(session.title))) flags.add('adult');

  return {
    category: category ?? 'other',
    flags: [...flags],
    topics: [...topics],
    presenters,
    viaTrack,
  };
}
