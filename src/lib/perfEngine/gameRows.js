// Turns three per-resolution reports into one row per game.
//
// The Performance tab used to render one card per game AND preset — 60 cards at
// 1440p and 155 at 1080p once the prior and ceiling rows landed. This collapses
// that to one row per game with a column per resolution, which means choosing
// ONE preset per game: three columns that compare different settings are not a
// comparison.

import { ORDER as BASIS_ORDER } from './rowBasis'

export const RESOLUTIONS = ['1080p', '1440p', '4k']

// Strongest to weakest, DERIVED from rowBasis.js's ORDER rather than
// hand-copied. A hand-copied list agrees with ORDER today and says nothing
// about tomorrow: reordering ORDER or inserting a tier would silently
// mis-rank candidates here with zero test failure, which is the exact kind of
// silent wrongness rowBasis.js exists to prevent. Rank is distance from the
// weakest end of ORDER, so the strongest basis gets the highest number —
// measured: 3, modelled: 2, 'spec-derived': 1, ceiling: 0, the same shape
// Task 2 and the corpus test both depend on.
export const BASIS_RANK = Object.fromEntries(
  BASIS_ORDER.map((basis, i) => [basis, BASIS_ORDER.length - 1 - i]),
)

// The one cell of a grouped row that carries a CPU/GPU attribution, or null.
//
// Shared rather than reimplemented, because two places describe the same game's
// split — the row's expansion and the bottleneck section below the table — and
// two copies of "first cell with a share" would eventually disagree about one
// game on one screen. Only 2 of 56 game rows have a split at all, so "none" is
// the normal answer and the caller has to say so rather than draw an empty bar.
//
// ⚠️ Searched over the CHOSEN preset's cells only. The engine reports a split
// for 5 games at 1440p, but three of those are on a preset the row does not
// show; quoting one of them would attribute the row to a measurement of
// different settings.
export function splitCell(game, { resolutions = RESOLUTIONS } = {}) {
  if (!game?.cells) return null
  return resolutions
    .map((res) => game.cells[res])
    .find((c) => c && c.cpuShare != null && c.limitedBy != null) ?? null
}

// Which preset a game's collapsed row shows.
//
// COVERAGE OUTRANKS TIER, deliberately. A preset measured at one resolution
// cannot fill three columns, and a row whose columns are different settings is
// worse than a row on slightly lighter settings. Measured against the live
// corpus this costs one real tier drop across 56 games (Dragon's Dogma 2 shows
// High rather than Grafik priorisieren); the other five disagreements are the
// German/English and DLSS pairs, which are the SAME tier and differ only in
// label — and resolving those toward the English name is a gain.
//
// The last two rules never decide anything today. They exist because the
// engine's existing heaviest-preset map breaks ties by array order, which had a
// 2.3x difference in F1 24 being decided by nothing at all.
export function selectPreset(candidates) {
  if (!candidates?.length) return null
  return [...candidates].sort(compareCandidates)[0]
}

function compareCandidates(a, b) {
  const ca = a.resolutions?.size ?? 0
  const cb = b.resolutions?.size ?? 0
  if (ca !== cb) return cb - ca                                  // widest coverage
  const ta = a.presetTier ?? 0
  const tb = b.presetTier ?? 0
  if (ta !== tb) return tb - ta                                  // heaviest tier
  const ra = BASIS_RANK[a.basis] ?? -1
  const rb = BASIS_RANK[b.basis] ?? -1
  if (ra !== rb) return rb - ra                                  // best evidence
  // avgFps is always Math.round()ed before it reaches here (see index.js), so
  // this is an integer comparison — no float-equality risk to guard against.
  if (a.avgFps !== b.avgFps) return a.avgFps - b.avgFps           // under-promise
  // Plain byte comparison, NOT localeCompare: collation is locale-dependent,
  // and this level exists specifically to replace "decided by array order"
  // with something deterministic. A comparison whose result can change with
  // the runtime's default locale would undercut the one thing it's here for —
  // dormant today since preset ids are ASCII kebab-case, but do not "tidy"
  // this back to localeCompare.
  return a.presetKey < b.presetKey ? -1 : a.presetKey > b.presetKey ? 1 : 0
}

const presetKeyOf = (r) => `${r.presetId}|${r.upscaling}`

// `reports` is { '1080p': report, '1440p': report, '4k': report }. Missing
// resolutions are tolerated so a caller can pass fewer.
export function buildGameRows(reports, { resolutions = RESOLUTIONS } = {}) {
  // gameId -> presetKey -> { candidate fields, rowByRes }
  const games = new Map()

  for (const res of resolutions) {
    for (const r of reports?.[res]?.games ?? []) {
      if (!(r.avgFps > 0)) continue
      if (!games.has(r.gameId)) games.set(r.gameId, { name: r.name, genre: r.genre, presets: new Map() })
      const g = games.get(r.gameId)
      const key = presetKeyOf(r)
      if (!g.presets.has(key)) {
        g.presets.set(key, {
          presetKey: key, presetId: r.presetId, preset: r.preset,
          upscaling: r.upscaling, presetTier: r.presetTier,
          basis: r.basis, avgFps: r.avgFps,
          resolutions: new Set(), rowByRes: {},
        })
      }
      const p = g.presets.get(key)
      p.resolutions.add(res)
      p.rowByRes[res] = r
      // The candidate's basis and fps describe the preset as a whole, so take
      // the weakest basis and the lowest rate across the resolutions it covers
      // — the same conservative direction the tie-break uses.
      if ((BASIS_RANK[r.basis] ?? -1) < (BASIS_RANK[p.basis] ?? -1)) p.basis = r.basis
      if (r.avgFps < p.avgFps) p.avgFps = r.avgFps
    }
  }

  const out = []
  for (const [gameId, g] of games) {
    const candidates = [...g.presets.values()]
    const chosen = selectPreset(candidates)
    if (!chosen) continue

    const cells = {}
    for (const res of resolutions) cells[res] = chosen.rowByRes[res] ?? null
    const shown = resolutions.map((res) => cells[res]).filter(Boolean)

    // `chosen.basis` was already accumulated to the weakest basis across
    // every resolution the candidate covers (see the accumulation above).
    // `cells` is built from the same `resolutions` array the candidates were
    // accumulated over, so the candidate's accumulated basis is by
    // construction the weakest across exactly the cells shown here. If
    // `cells` ever stops being exactly the candidate's covered resolutions,
    // this has to go back to reducing over `shown`.
    const basis = chosen.basis
    // No candidate-level equivalent exists for errorPct, so this still has to
    // reduce over `shown` directly — do not "simplify" it the way basis was.
    const bands = shown.map((r) => r.errorPct).filter((v) => v != null)

    // `cells[res]` and `otherPresets[i]` are not copies — they alias row
    // objects straight out of the caller's `reports`. Inert today since
    // nothing mutates them, but the consumer landing in a later task will
    // source `reports` from a memoised computation, and an in-place mutation
    // here would corrupt that cache silently. Treat everything returned by
    // this function as read-only.
    out.push({
      gameId,
      name: g.name,
      genre: g.genre,
      preset: chosen.preset,
      presetId: chosen.presetId,
      upscaling: chosen.upscaling,
      presetTier: chosen.presetTier,
      cells,
      basis,
      errorPct: bands.length ? Math.max(...bands) : null,
      // Every caveat seen on any shown cell, deduplicated — the expansion lists
      // them, and a caveat true at one resolution is still true of the row.
      caveats: [...new Set(shown.flatMap((r) => r.caveats ?? []))],
      otherPresets: candidates
        .filter((c) => c.presetKey !== chosen.presetKey)
        .sort((a, b) => (b.presetTier ?? 0) - (a.presetTier ?? 0)),
      bestFps: Math.max(...shown.map((r) => r.avgFps)),
    })
  }

  // Fastest game first, matching the order the engine already sorts rows into.
  // Byte comparison on the tie-break, not localeCompare — same reasoning as
  // compareCandidates above: collation is locale-dependent, and a fixed
  // grouping order must not change with the runtime's default locale.
  return out.sort((a, b) => {
    if (a.bestFps !== b.bestFps) return b.bestFps - a.bestFps
    return a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Genre grouping and column sorting.
//
// Fifty-six rows in one list is a wall even once it is a table rather than 155
// cards. Grouping by genre gives a reader somewhere to start — most people care
// about one or two kinds of game — and the bars ship SHUT, so the tab opens as
// six lines instead of fifty-six.

// Display names, one per key used in data/games/gameMeta.json.
export const GENRE_LABEL = {
  shooter: 'Shooters',
  rpg: 'RPGs',
  'action-adventure': 'Action & adventure',
  'strategy-sim': 'Strategy & simulation',
  horror: 'Horror',
  racing: 'Racing',
  other: 'Other',
}

// A FIXED order, not one derived from how many games each genre holds. A
// count-ordered list reshuffles itself every time the corpus grows, and a
// reader who learned where "Racing" sits would have to find it again.
// `other` is last and exists only as a safety net — see groupByGenre.
export const GENRE_ORDER = [
  'shooter', 'rpg', 'action-adventure', 'strategy-sim', 'horror', 'racing', 'other',
]

// Groups rows into genre bars, in GENRE_ORDER, dropping genres nothing is in.
//
// `target` decides which column the bar's fps range describes — the bar is
// collapsed, so that range is the only figure standing in for the games inside
// it, and it has to be the column the reader is actually looking at.
export function groupByGenre(rows, { target = '1440p' } = {}) {
  const byGenre = new Map()
  for (const row of rows) {
    // An unrecognised genre lands in `other` rather than being dropped.
    // buildPerfGames refuses a game with no genre at all, so this can only
    // fire when a genre is added to the data and not to GENRE_LABEL — and
    // silently losing those rows would be far worse than a vague heading.
    const key = GENRE_LABEL[row.genre] ? row.genre : 'other'
    if (!byGenre.has(key)) byGenre.set(key, [])
    byGenre.get(key).push(row)
  }

  return GENRE_ORDER.filter((key) => byGenre.has(key)).map((key) => {
    const games = byGenre.get(key)
    // Only cells the target column actually answered. A null cell is absence,
    // and counting it as 0 would put "0–200 fps" on a genre whose slowest
    // measured game runs at 60.
    const fps = games.map((g) => g.cells?.[target]?.avgFps).filter((v) => v > 0)
    return {
      genre: key,
      label: GENRE_LABEL[key],
      games,
      count: games.length,
      fastest: fps.length ? Math.max(...fps) : null,
      slowest: fps.length ? Math.min(...fps) : null,
    }
  })
}

// Every column the table renders, in the order it renders them.
export const SORT_KEYS = ['name', 'preset', '1080p', '1440p', '4k', 'basis']

// What each column sorts on. Returning null means "this row has no value here"
// and sinks the row, which is why a resolution reads the CELL rather than
// falling back to bestFps: Bravo can be slower overall and faster at 1440p, and
// a fallback would sort by a number the reader is not looking at.
const sortValue = (row, key) => {
  if (key === 'name') return row.name ?? ''
  if (key === 'preset') return row.presetTier ?? null
  if (key === 'basis') return BASIS_RANK[row.basis] ?? null
  return row.cells?.[key]?.avgFps ?? null
}

// Sorts a genre's games by one column. `sort` is `{ key, dir }` or null for the
// engine's own order, fastest game first.
//
// Rows with nothing in the sorted column sink to the BOTTOM in both
// directions. A dash is absence, not a very small number — ascending must not
// promote every empty cell to the top of the table.
export function sortGameRows(rows, sort) {
  const list = [...rows]
  if (!sort || !SORT_KEYS.includes(sort.key)) {
    return list.sort((a, b) => (b.bestFps - a.bestFps)
      || (a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0))
  }

  const flip = sort.dir === 'asc' ? -1 : 1
  return list.sort((a, b) => {
    const va = sortValue(a, sort.key)
    const vb = sortValue(b, sort.key)
    const aEmpty = va == null || va === ''
    const bEmpty = vb == null || vb === ''
    if (aEmpty || bEmpty) return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1
    // Byte comparison, not localeCompare: collation is locale-dependent and a
    // sort order must not change with the runtime's default locale. Same
    // reasoning as compareCandidates above.
    if (typeof va === 'string') {
      if (va !== vb) return (va < vb ? -1 : 1) * -flip
    } else if (va !== vb) {
      return (vb - va) * flip
    }
    return a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0
  })
}
