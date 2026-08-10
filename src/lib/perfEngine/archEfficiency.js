// Fits ARCH_EFFICIENCY — the per-architecture correction the spec-derived
// capability index needs — from the measured corpus.
//
// WHY IT IS NEEDED. `shaders x clock x 2` is arithmetic over published figures,
// so theoretical throughput is a fact. How much of it a game realises is not,
// and it differs by architecture because vendors count shaders differently:
// Ada's CUDA total includes a shared FP32/INT32 datapath, RDNA 3's dual-issue
// publishes 6144 and 12288 for the same silicon, Intel counts Xe vector engines.
// The result is that raw throughput ranks an RTX 4070 Ti (40.1 TFLOPS) above an
// RX 7900 XTX (30.7) when the Radeon is the faster card in raster.
//
// HOW IT IS FITTED. For every GPU the corpus has measured AND the spec table
// covers, compare the measured index against what the spec formula predicts. The
// ratio is what the formula is getting wrong for that card; averaged over an
// architecture, it is the architecture's correction. One architecture is anchored
// at 1.0 because only ratios mean anything — the measured index and the spec
// index are in different units.
//
// WHAT IT IS NOT. It is not circular. The capability tier answers for parts the
// corpus does NOT cover; the correction is learned from the sibling parts of the
// same architecture that it does, then applied to the rest. That is only as good
// as the sibling coverage, which is exactly why `parts` and `spreadPct` are
// recorded per architecture and an architecture below `minParts` is left alone.
//
// Zero imports: scripts/fit-perf-model.mjs loads this under plain Node.

// Must match capability.js. Duplicated deliberately rather than imported: this
// module is loaded by a plain-Node script and capability.js is not, and a test
// pins the two together so they cannot drift.
const COMPUTE_WEIGHT = 0.65
const BANDWIDTH_WEIGHT = 0.35
const GPU_REFERENCE_TFLOPS = 82.6
const GPU_REFERENCE_BANDWIDTH = 1008

// Below this, an architecture is not calibrated. A ratio from a single card is a
// point estimate wearing a fit's clothes, and this codebase's rule is that a
// number which cannot be defended is not shipped.
export const MIN_PARTS_TO_CALIBRATE = 3

const specIndexOf = (spec) => {
  const tflops = (spec.shaders * spec.boostMhz * 2) / 1e6
  if (!(tflops > 0) || !(spec.bandwidthGbs > 0)) return null
  return 100
    * ((tflops / GPU_REFERENCE_TFLOPS) ** COMPUTE_WEIGHT)
    * ((spec.bandwidthGbs / GPU_REFERENCE_BANDWIDTH) ** BANDWIDTH_WEIGHT)
}

export function fitArchEfficiency({
  gpuIndex = {}, gpuSpecs = {}, resolution = '1440p', minParts = MIN_PARTS_TO_CALIBRATE,
} = {}) {
  // Ratio of measured to spec-predicted, per architecture.
  const perArch = new Map()
  for (const [id, entry] of Object.entries(gpuIndex)) {
    const measured = entry?.[resolution]
    const spec = gpuSpecs?.gpus?.[id]
    if (!(measured > 0) || !spec?.architecture) continue
    const predicted = specIndexOf(spec)
    if (!(predicted > 0)) continue
    if (!perArch.has(spec.architecture)) perArch.set(spec.architecture, [])
    perArch.get(spec.architecture).push(measured / predicted)
  }

  // The anchor is the architecture with the MOST measured parts, decided by the
  // data rather than picked — a hand-chosen reference is how a constant ends up
  // flattering one vendor.
  const ranked = [...perArch].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  const reference = ranked[0]?.[0] ?? null
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length
  const base = reference ? mean(perArch.get(reference)) : null

  const byArch = {}
  for (const [arch, ratios] of [...perArch].sort((a, b) => a[0].localeCompare(b[0]))) {
    const m = mean(ratios)
    const lo = Math.min(...ratios)
    const hi = Math.max(...ratios)
    const calibrated = ratios.length >= minParts
    byArch[arch] = {
      // An uncalibrated architecture is left at exactly 1.0 — the same value it
      // had before any of this ran, so its index does not move.
      efficiency: calibrated ? Number((m / base).toFixed(4)) : 1,
      parts: ratios.length,
      // How much the single scalar is hiding. A wide spread means the
      // architecture is not well described by one number, whatever its mean.
      spreadPct: Number((((hi - lo) / m) * 100).toFixed(1)),
      calibrated,
    }
  }

  return {
    resolution,
    reference,
    // What 1.0 means, spelled out, so nobody reads these as absolute fractions.
    referenceNote: reference
      ? `${reference} is anchored at 1.0; every value is relative to it, not an absolute realised fraction`
      : null,
    minParts,
    byArch,
    calibrated: Object.keys(byArch).filter((a) => byArch[a].calibrated).sort(),
    uncalibrated: Object.keys(byArch).filter((a) => !byArch[a].calibrated).sort(),
  }
}
