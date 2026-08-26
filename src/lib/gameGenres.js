// Genre per game in the frame-rate catalogue, for artwork only.
//
// ⚠️ This is a LOCAL lookup rather than a field on the game, and it has to be.
// useCatalogStore serves games from the bundled JSON on first paint and then
// replaces them wholesale with rows from Supabase if that fetch succeeds. A
// `genre` column added to the bundle would therefore be present before the
// fetch and gone after it, so every cover plate on the page would change colour
// a second after load. Keying off the id survives both sources.
//
// The vocabulary matches perfEngine's GENRE_LABEL where the two overlap, plus
// `moba` and `sports`, which the perf corpus has no games in yet.
//
// Nothing here affects a number. An id missing from this map draws the neutral
// plate, which is why there is no test asserting the map is exhaustive: a new
// game showing up grey is a cosmetic gap, not a defect.
const GENRES = {
  lol: 'moba',
  dota2: 'moba',
  valorant: 'shooter',
  cs2: 'shooter',
  'r6-siege': 'shooter',
  overwatch2: 'shooter',
  fortnite: 'shooter',
  apex: 'shooter',
  'marvel-rivals': 'shooter',
  warzone: 'shooter',
  tarkov: 'shooter',
  helldivers2: 'shooter',
  'rocket-league': 'sports',
  minecraft: 'strategy-sim',
  gta5: 'action-adventure',
  hogwarts: 'action-adventure',
  rdr2: 'action-adventure',
  'elden-ring': 'rpg',
  bg3: 'rpg',
  starfield: 'rpg',
  cyberpunk: 'rpg',
  'alan-wake-2': 'horror',
}

// A game from the perf corpus already carries its own genre; one from the
// frame-rate catalogue does not. Prefer whatever the row states.
export function genreFor(game) {
  return game?.genre ?? GENRES[game?.id] ?? 'other'
}
