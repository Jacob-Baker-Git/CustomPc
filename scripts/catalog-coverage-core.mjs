// How much of a category has actually been researched to the standard in
// docs/superpowers/specs/2026-08-27-component-spec-schema-and-compatibility-design.md
//
// Pure and I/O-free so it can be unit-tested, like catalog-diff-core.mjs.

// What each category is expected to carry once researched. Categories are added
// here as their research is specced — GPUs first.
//
// ⚠️ `optional` is for fields whose ABSENCE is itself a fact: most cards ship no
// power adapter, so a missing `adapterFrom` is not an outstanding gap.
export const EXPECTED = {
  gpu: {
    required: ['length', 'tdp', 'slotsThick', 'pcieGen', 'powerConnectors', 'vram', 'memType'],
    optional: ['adapterFrom'],
  },
  // The five fields the compatibility engine reads off a case. Nothing here is
  // optional: unlike a GPU's adapterFrom, a case that omits one of these has a
  // gap, not a fact.
  case: {
    required: ['maxGpuLength', 'maxCoolerHeight', 'supportedFormFactors', 'expansionSlots', 'radiatorSupport'],
    optional: [],
  },
  // The three fields the engine reads off a supply: `connectors` for rules 1
  // and 1b, `wattage` for psuTooSmall and autoBuilder, `rating` for the quality
  // score via psuEfficiency(). Length, form factor and modularity are omitted
  // deliberately - no rule reads them.
  psu: {
    required: ['wattage', 'rating', 'connectors'],
    optional: [],
  },
}

// Which top-level fields a category owes a source once it is ratcheted.
//
// ⚠️ PER-CATEGORY, and it must stay that way. A case carries `tdp: 0` meaning
// "draws nothing" — a sentinel nobody measured. The global ['length','tdp']
// this replaced would have demanded provenance for 59 such zeros.
export const RATCHETED_KEYS = {
  gpu: ['length', 'tdp'],
  case: ['maxGpuLength', 'maxCoolerHeight', 'supportedFormFactors'],
  // ⚠️ `wattage` ONLY. A PSU carries tdp: 0 for the same reason a case does -
  // it draws nothing itself - so tdp here is a sentinel, not a measurement.
  psu: ['wattage'],
}

// Every "<id>.<field>" in a verified category that carries a value but no source.
export function missingRatchetSources(parts, sources, verifiedCategories) {
  const missing = []
  for (const part of parts) {
    if (!verifiedCategories.has(part.category)) continue
    for (const key of RATCHETED_KEYS[part.category] ?? []) {
      if (part[key] === undefined) continue
      if (!sources[part.id]?.[key]) missing.push(`${part.id}.${key}`)
    }
  }
  return missing
}

const hasField = (part, key) =>
  part.specs?.[key] !== undefined || part[key] !== undefined

// A field counts as researched when it is present WITH a source, or absent and
// explicitly recorded as unpublished. Both are finished states.
const isResearched = (part, sources, key) => {
  const entry = sources[part.id]?.[key]
  if (!entry) return false
  if (entry.result === 'unverifiable') return !hasField(part, key)
  return hasField(part, key)
}

export function coverageFor(category, parts, sources) {
  const spec = EXPECTED[category]
  if (!spec) return null

  const rows = parts.filter((p) => p.category === category)
  const fields = {}
  for (const key of [...spec.required, ...spec.optional]) {
    let present = 0
    let sourced = 0
    for (const part of rows) {
      if (hasField(part, key)) present++
      if (isResearched(part, sources, key)) sourced++
    }
    fields[key] = { present, sourced, optional: spec.optional.includes(key) }
  }

  const verified = rows.filter((part) =>
    spec.required.every((key) => isResearched(part, sources, key))
  ).length

  return { category, total: rows.length, verified, fields }
}
