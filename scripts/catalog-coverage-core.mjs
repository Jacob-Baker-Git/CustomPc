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
  // The eleven fields a researched board carries. Four already had values -
  // socket, formFactor and ramType at top level, chipset in specs - and are
  // RE-VERIFIED rather than added, because compatibility.js blocks on the first
  // three and a wrong one refuses a correct build in silence.
  motherboard: {
    required: [
      'socket', 'formFactor', 'ramType', 'chipset',
      'ramSlots', 'maxRamGb', 'maxRamSpeed', 'pcieGen',
      'epsConnectors', 'sataPorts', 'm2Slots',
    ],
    optional: [],
  },
  // ⚠️ THE FIRST CATEGORY WHOSE REQUIRED LIST DEPENDS ON THE PART. An air
  // cooler owes its height; an AIO owes its radiator size. The split in the
  // data is already clean - all 31 air rows carry `height` and no radiator,
  // all 22 AIO rows the reverse - so a flat list with both marked `optional`
  // would pass a cooler carrying NEITHER. That is a gap, not a fact.
  //
  // `type` is required rather than assumed because it selects WHICH RULE RUNS:
  // compatibility.js skips the height check for anything typed AIO, and rule 4
  // in specRules.js skips anything not typed AIO. A mislabelled cooler is
  // checked by neither rule and blocks nothing.
  cooler: {
    variants: [
      { when: (p) => p.specs?.type === 'AIO', required: ['sockets', 'type', 'radiatorMm'] },
      { when: (p) => p.specs?.type === 'Air', required: ['sockets', 'type', 'height'] },
    ],
    optional: [],
  },
  // The SECOND conditional category, after coolers. Only an M.2 drive can owe
  // `m2Sata`: a 2.5" SATA SSD and a 3.5" HDD have no M.2 interface to describe.
  //
  // 🛑 THE PREDICATE IS THE SAME REGEX RULE 3 USES, deliberately, and
  // catalogCoverage.test.js pins the two copies together across the whole
  // catalogue. It cannot be a shared import: scripts/ may not require src/lib,
  // because vite-node is not a local dependency. Two private copies of one
  // definition drifting apart is exactly what shipped the partPages.js
  // `=== 'NVMe'` bug that this project fixes - that comparison never matched
  // anything, because every NVMe row is typed "NVMe SSD".
  storage: {
    variants: [
      { when: (p) => /nvme|m\.2/i.test(p.storageType ?? ''), required: ['storageType', 'capacityGb', 'readMbps', 'm2Sata'] },
      { when: () => true, required: ['storageType', 'capacityGb', 'readMbps'] },
    ],
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
  // ⚠️ `tdp` is absent for a DIFFERENT reason from the case and PSU zeros. A
  // board carries tdp: 12-15, a real number feeding the build's draw total in
  // compatibility.js, buildWarnings.js, autoBuilder.js and partSynergy.js - but
  // NO MAKER PUBLISHES A MOTHERBOARD TDP. It is the app's own estimate, in the
  // family of partSynergy.coolerCapacityW's derived ladder, and a source entry
  // would assert provenance for a figure nobody published.
  //
  // `chipset` is absent too: EXPECTED requires it, so it is re-verified, but no
  // rule blocks on it and no future board should owe it provenance.
  motherboard: ['socket', 'formFactor', 'ramType'],
  // `sockets` is the only top-level field on a cooler that any rule reads, and
  // it blocks in FOUR directions in compatibility.js. `tdp` is absent for the
  // same reason it is absent for a motherboard: the 2-5 W is the app's own
  // estimate of fan and pump draw, which no maker publishes.
  cooler: ['sockets'],
  // `storageType` is rule 3's branch selector - a drive typed wrongly is
  // checked against the wrong bus entirely - and `capacityGb` is the number
  // users compare drives on, feeding pricePerGb, partQuality and partSynergy.
  //
  // `readMbps` is deliberately absent: EXPECTED requires it, so a future drive
  // owes a source, but no rule blocks on it and it is a sequential-read
  // headline that varies with capacity and test conditions.
  storage: ['storageType', 'capacityGb'],
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

// The fields THIS part owes. A flat category answers the same list for every
// row; a variant category answers by the part's own type. `null` means no
// variant matched - an unclassifiable part, which can never be verified.
export function requiredFor(spec, part) {
  if (!spec.variants) return spec.required
  return spec.variants.find((v) => v.when(part))?.required ?? null
}

export function coverageFor(category, parts, sources) {
  const spec = EXPECTED[category]
  if (!spec) return null

  const rows = parts.filter((p) => p.category === category)
  const required = spec.variants
    ? [...new Set(spec.variants.flatMap((v) => v.required))]
    : spec.required

  const fields = {}
  for (const key of [...required, ...spec.optional]) {
    let present = 0
    let sourced = 0
    let applies = 0
    for (const part of rows) {
      const owed = requiredFor(spec, part)
      // A key this part does not owe is not counted against it, so a variant
      // category reports `height 31/31` rather than a misleading `31/53`.
      if (owed && !owed.includes(key) && !spec.optional.includes(key)) continue
      applies++
      if (hasField(part, key)) present++
      if (isResearched(part, sources, key)) sourced++
    }
    fields[key] = { present, sourced, applies, optional: spec.optional.includes(key) }
  }

  const verified = rows.filter((part) => {
    const owed = requiredFor(spec, part)
    return owed !== null && owed.every((key) => isResearched(part, sources, key))
  }).length

  return { category, total: rows.length, verified, fields }
}
