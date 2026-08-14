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
      if (!games.has(r.gameId)) games.set(r.gameId, { name: r.name, presets: new Map() })
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

    // Weakest basis across the cells actually shown, and the worst error band.
    // Neither can overstate what the row is worth. See rowBasis.js.
    const basis = shown.reduce(
      (worst, r) => ((BASIS_RANK[r.basis] ?? -1) < (BASIS_RANK[worst] ?? -1) ? r.basis : worst),
      shown[0].basis,
    )
    const bands = shown.map((r) => r.errorPct).filter((v) => v != null)

    out.push({
      gameId,
      name: g.name,
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
