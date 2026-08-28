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
