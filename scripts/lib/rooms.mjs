/**
 * Room pins for the Convention Floor Map.
 *
 * Eventeny's floor map (mid 22626) has NO vector elements — it's a flat 1600x2400
 * raster. So the "show me where this panel is" feature needs coordinates we author
 * ourselves. These were read off a coordinate grid overlaid on the map image and
 * then visually verified (see scripts/dev/pin-audit.mjs).
 *
 * Coordinates are normalized 0..1 fractions of the background image, matching the
 * convention Eventeny uses for booths on the other two maps.
 *
 * Keyed by Eventeny track_id, which is stable across schedule refreshes — unlike
 * track titles, which the con edits mid-event.
 */
export const ROOM_PINS = {
  // ---- Floor 1 ----
  87723: { x: 0.318, y: 0.081, floor: 1, room: 'Hall E' },           // Tekko Market (Hall E)
  89035: { x: 0.150, y: 0.158, floor: 1, room: 'West Lobby' },       // Photospot A

  // ---- Floor 2 ----
  89044: { x: 0.780, y: 0.290, floor: 2, room: 'Halls B & C' },      // Expo Hall
  92904: { x: 0.855, y: 0.245, floor: 2, room: 'Exhibition Hall' },  // Autographs
  89045: { x: 0.420, y: 0.300, floor: 2, room: 'Hall A' },           // Gaming Hall (Board Games)
  92439: { x: 0.420, y: 0.300, floor: 2, room: 'Hall A' },           // Gaming Hall (Video Games)
  92323: { x: 0.420, y: 0.300, floor: 2, room: 'Hall A' },           // CCG
  89625: { x: 0.420, y: 0.300, floor: 2, room: 'Hall A' },           // Speedrunning
  89417: { x: 0.420, y: 0.300, floor: 2, room: 'Hall A' },           // Pokemon League
  89036: { x: 0.968, y: 0.351, floor: 2, room: 'East Concourse' },   // Photospot B
  89037: { x: 0.323, y: 0.443, floor: 2, room: 'West Concourse' },   // Photospot C

  // ---- Floor 3 ----
  87704: { x: 0.150, y: 0.437, floor: 3, room: 'Spirit of Pittsburgh Ballroom' }, // Main Stage
  87716: { x: 0.371, y: 0.513, floor: 3, room: 'East Atrium' },      // Hall Stage
  87718: { x: 0.264, y: 0.577, floor: 3, room: '303-305' },          // Panel 1
  87719: { x: 0.373, y: 0.577, floor: 3, room: '306-307' },          // Panel 2
  87767: { x: 0.494, y: 0.577, floor: 3, room: '310-311' },          // Panel 3
  88650: { x: 0.622, y: 0.577, floor: 3, room: '315-316' },          // Panel 4
  88654: { x: 0.659, y: 0.577, floor: 3, room: '317' },              // Panel 5
  88657: { x: 0.695, y: 0.577, floor: 3, room: '318' },              // Panel 6
  88646: { x: 0.793, y: 0.577, floor: 3, room: '319' },              // Panel 7
  88667: { x: 0.841, y: 0.577, floor: 3, room: '320-321' },          // Panel 8
  89039: { x: 0.929, y: 0.575, floor: 3, room: 'East Stairs' },      // Photospot E
  88679: { x: 0.857, y: 0.695, floor: 3, room: '323' },              // Panel 9
  92509: { x: 0.823, y: 0.695, floor: 3, room: '324' },              // Chibi Tekko 2
  92507: { x: 0.789, y: 0.695, floor: 3, room: '325' },              // Chibi Tekko 1
  89038: { x: 0.929, y: 0.697, floor: 3, room: 'East Corridor' },    // Photospot D
  90752: { x: 0.690, y: 0.697, floor: 3, room: '326-327' },          // RPG 1&2
  88662: { x: 0.674, y: 0.697, floor: 3, room: '327' },              // RPG 1
  89110: { x: 0.638, y: 0.699, floor: 3, room: '328' },              // Anime RP
  89756: { x: 0.589, y: 0.699, floor: 3, room: '329-330' },          // LARP
  90758: { x: 0.348, y: 0.730, floor: 3, room: '331' },              // Zen Zone
  88826: { x: 0.309, y: 0.740, floor: 3, room: '333' },              // Scale Model Room
  92217: { x: 0.254, y: 0.744, floor: 3, room: '334-335' },          // Videos

  // ---- Floor 4 ----
  87747: { x: 0.252, y: 0.931, floor: 4, room: '406' },              // Cosplay Panel
  87765: { x: 0.400, y: 0.931, floor: 4, room: '407' },              // Tekko Gakkou
  87728: { x: 0.530, y: 0.927, floor: 4, room: '408-410' },          // Tekko Formal
  87722: { x: 0.625, y: 0.927, floor: 4, room: '411-412' },          // Meet Ups 1
  88727: { x: 0.753, y: 0.927, floor: 4, room: '413' },              // Meet Ups 2
  87733: { x: 0.809, y: 0.927, floor: 4, room: '414-415' },          // AMV
  87744: { x: 0.923, y: 0.934, floor: 4, room: 'Garrison Overlook' },// Stage Uzume
};

/**
 * Tracks that deliberately have no pin. Listed explicitly so validate.mjs can tell
 * "we decided this isn't on the map" apart from "we forgot one".
 */
export const UNMAPPED_TRACKS = {
  89492: 'Rooftop Terrace is not drawn on the convention floor map',
};
