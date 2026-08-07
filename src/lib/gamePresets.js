// Games do not share preset names — Fortnite's "Epic" and Cyberpunk's "Ultra"
// are different words for roughly the same rung. `tier` is the canonical rung
// (1 = lowest), and it is what cross-game fallback compares.
//
// Real per-game preset names are NOT invented here. They arrive attached to the
// measurements that use them: the curation harness records the preset a review
// actually tested, and that populates `game.presets` over time. Until a game
// has its own, the canonical ladder applies and the report says which preset it
// is quoting.
export const CANONICAL_PRESETS = [
  { id: 'low', label: 'Low', tier: 1 },
  { id: 'medium', label: 'Medium', tier: 2 },
  { id: 'high', label: 'High', tier: 3 },
  { id: 'ultra', label: 'Ultra', tier: 4 },
]

// High, not Medium. An unrecognised preset id resolves to the higher rung so
// the estimate errs toward a LOWER frame rate. Under-promising is the safer
// direction for a number somebody is about to spend money on.
const DEFAULT_TIER = 3

export function presetsFor(game) {
  return game?.presets?.length ? game.presets : CANONICAL_PRESETS
}

// { preset, exact } — `exact` false means the caller asked for a preset this
// game does not have and got the nearest tier instead, which costs confidence
// downstream rather than being silently equivalent.
export function resolvePreset(game, presetId) {
  const presets = presetsFor(game)
  const exact = presets.find((p) => p.id === presetId)
  if (exact) return { preset: exact, exact: true }

  const wantedTier =
    CANONICAL_PRESETS.find((p) => p.id === presetId)?.tier ?? DEFAULT_TIER
  // Seeded explicitly rather than leaning on reduce's no-initial-value form,
  // matching snapToLadder in priceBands.js.
  //
  // ⚠️ On an exact tie the FIRST entry in the array wins. That is unreachable
  // on the canonical ladder, whose tiers are unique — an exact id match always
  // fires before this. It goes live the moment a game gets its own `presets`
  // in gamesData.json, and at that point the order you write them in silently
  // decides ties. Write them lowest tier first.
  const nearest = presets.reduce(
    (best, p) => (Math.abs(p.tier - wantedTier) < Math.abs(best.tier - wantedTier) ? p : best),
    presets[0],
  )
  return { preset: nearest, exact: false }
}
