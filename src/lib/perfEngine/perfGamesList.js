// Derives the Performance tab's game list from the corpus.
//
// A game is listed because the corpus MEASURES it, never because somebody typed
// it in. The nine titles that used to sit in perfGames.json with no measurement
// anywhere were not a data problem — they were a list nobody could keep true by
// hand. This makes the list a consequence of the data, and perfGames.test.js
// fails the build when the file drifts from it in either direction.
//
// Zero imports: scripts/ runs this under plain Node, which cannot resolve this
// project's extensionless relative imports.

// Editorial metadata is REQUIRED, never defaulted. A missing name would fall
// back to the id and ship "black-myth-wukong" to a reader as a game title; a
// missing preset tier would have to be guessed, and the tier is what
// resolvePreset compares when a game lacks the preset the caller asked for.
export function buildPerfGames({ meta, entries, legacy = [] }) {
  const problems = []
  const live = entries.filter((e) => !e.supersededBy)

  const fpsCapById = new Map(
    legacy.filter((g) => g.fpsCap != null).map((g) => [g.id, g.fpsCap]),
  )

  // gameId -> presetId -> how many live entries use it
  const seen = new Map()
  for (const e of live) {
    if (!seen.has(e.gameId)) seen.set(e.gameId, new Map())
    const presets = seen.get(e.gameId)
    presets.set(e.presetId, (presets.get(e.presetId) ?? 0) + 1)
  }

  const games = []
  for (const [gameId, presetCounts] of [...seen].sort((a, b) => a[0].localeCompare(b[0]))) {
    const gameMeta = meta.games[gameId]
    if (!gameMeta) {
      problems.push(`"${gameId}" is measured by the corpus but has no gameMeta entry — ` +
                    'add a display name and slug rather than defaulting to the id')
      continue
    }

    const presets = []
    for (const [presetId, count] of presetCounts) {
      const presetMeta = meta.presets[presetId]
      if (!presetMeta) {
        problems.push(`preset "${presetId}" (used by ${gameId}) has no gameMeta entry — ` +
                      'its tier cannot be guessed, it is what preset fallback compares')
        continue
      }
      presets.push({
        id: presetId,
        label: gameMeta.presetLabels?.[presetId] ?? presetMeta.label,
        tier: presetMeta.tier,
        count,
      })
    }
    if (presets.length === 0) continue

    // Lowest tier first. resolvePreset in gamePresets.js breaks an EXACT TIE on
    // array order — its own comment says "write them lowest tier first" — so
    // this sort decides which preset the page quotes when two share a tier.
    // Count then id break the remaining ties, so two runs over the same corpus
    // produce byte-identical output.
    presets.sort((a, b) => a.tier - b.tier || b.count - a.count || a.id.localeCompare(b.id))

    const game = {
      id: gameId,
      name: gameMeta.name,
      slug: gameMeta.slug,
      presets: presets.map(({ id, label, tier }) => ({ id, label, tier })),
    }
    // An engine cap floors the frame rate and the 1% low alike. It is a property
    // of the GAME, so it is carried across from the legacy list rather than
    // restated — one hard-locked title, one place it is recorded.
    const cap = fpsCapById.get(gameId)
    if (cap != null) game.fpsCap = cap

    games.push(game)
  }

  return { games, problems }
}
