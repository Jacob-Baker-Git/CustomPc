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
// An upscaled frame rate is not a native one, so a preset measured at two render
// scales is two listed presets. The suffix is what stops the page rendering two
// rows both labelled "Ultra" that mean materially different things.
//
// A scale absent from this table is REPORTED, never passed through: an
// unlabelled scale renders identically to native, which is the same failure the
// cell key exists to prevent, one layer up.
const UPSCALING_LABELS = {
  native: null,
  'ultra-quality': 'DLSS/FSR Ultra Quality',
  quality: 'DLSS/FSR Quality',
  balanced: 'DLSS/FSR Balanced',
  performance: 'DLSS/FSR Performance',
  'ultra-performance': 'DLSS/FSR Ultra Performance',
}

export function buildPerfGames({ meta, entries, legacy = [] }) {
  const problems = []
  const live = entries.filter((e) => !e.supersededBy)

  const fpsCapById = new Map(
    legacy.filter((g) => g.fpsCap != null).map((g) => [g.id, g.fpsCap]),
  )

  // gameId -> "presetId|upscaling" -> how many live entries use it
  const seen = new Map()
  for (const e of live) {
    if (!seen.has(e.gameId)) seen.set(e.gameId, new Map())
    const presets = seen.get(e.gameId)
    const key = `${e.presetId}|${e.upscaling}`
    presets.set(key, (presets.get(key) ?? 0) + 1)
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
    for (const [key, count] of presetCounts) {
      const [presetId, upscaling] = key.split('|')
      const presetMeta = meta.presets[presetId]
      if (!presetMeta) {
        problems.push(`preset "${presetId}" (used by ${gameId}) has no gameMeta entry — ` +
                      'its tier cannot be guessed, it is what preset fallback compares')
        continue
      }
      if (!(upscaling in UPSCALING_LABELS)) {
        problems.push(`upscaling "${upscaling}" (used by ${gameId}) is not a known render ` +
                      'scale — it cannot be labelled, and an unlabelled scale reads as native')
        continue
      }
      const base = gameMeta.presetLabels?.[presetId] ?? presetMeta.label
      const suffix = UPSCALING_LABELS[upscaling]
      presets.push({
        id: presetId,
        label: suffix ? `${base} (${suffix})` : base,
        tier: presetMeta.tier,
        upscaling,
        count,
      })
    }
    if (presets.length === 0) continue

    // Lowest tier first. resolvePreset in gamePresets.js breaks an EXACT TIE on
    // array order — its own comment says "write them lowest tier first" — so
    // this sort decides which preset the page quotes when two share a tier.
    // Count then id break the remaining ties, so two runs over the same corpus
    // produce byte-identical output.
    presets.sort((a, b) =>
      a.tier - b.tier || b.count - a.count ||
      a.id.localeCompare(b.id) || a.upscaling.localeCompare(b.upscaling))

    const game = {
      id: gameId,
      name: gameMeta.name,
      slug: gameMeta.slug,
      presets: presets.map(({ id, label, tier, upscaling }) => ({ id, label, tier, upscaling })),
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
