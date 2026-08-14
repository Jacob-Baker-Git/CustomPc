// Turns three per-resolution reports into one row per game.
//
// The Performance tab used to render one card per game AND preset — 60 cards at
// 1440p and 155 at 1080p once the prior and ceiling rows landed. This collapses
// that to one row per game with a column per resolution, which means choosing
// ONE preset per game: three columns that compare different settings are not a
// comparison.

export const RESOLUTIONS = ['1080p', '1440p', '4k']

// Strongest to weakest. Same names rowBasis.js composes.
export const BASIS_RANK = { measured: 3, modelled: 2, 'spec-derived': 1, ceiling: 0 }

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
  if (a.avgFps !== b.avgFps) return a.avgFps - b.avgFps           // under-promise
  return a.presetKey.localeCompare(b.presetKey)                  // determinism
}
