// Lookup into the fitted artefact.
//
// Every accessor reports the BASIS of what it returns, not just a number. That
// distinction is the whole trust story: "measured" and "we had nothing and made
// something up" must never be indistinguishable to the caller, and the only way
// to guarantee that is to make the basis impossible to drop.

import { applyPrior } from './prior'

const EMPTY_INDEX = {
  value: null, basis: 'none', anchors: 0, resolutionCopied: false,
  errorPct: null, extrapolated: false,
}

// A measurement answers with no error band: `errorPct` describes how wrong a
// PREDICTION usually is, and there is no prediction here. Null rather than zero
// — zero would claim the reading is exact.
const measuredIndex = (value, row, resolutionCopied) => ({
  value,
  basis: row.basis ?? 'measured',
  anchors: row.anchors ?? 0,
  resolutionCopied,
  errorPct: null,
  extrapolated: false,
})

// No measurement. The prior is data-derived and publishes its own held-out
// error, so it is an answer — but never one that reports itself as measured.
const priorIndex = (p) => ({
  value: p.value,
  basis: p.basis,
  anchors: 0,
  resolutionCopied: false,
  errorPct: p.errorPct,
  extrapolated: p.extrapolated,
})

export function gpuIndexFor(model, gpu, resolution) {
  const row = gpu?.id ? model?.gpuIndex?.[gpu.id] : null
  const value = row?.[resolution]
  if (value > 0) {
    return measuredIndex(value, row, Boolean(row.copiedResolutions?.includes(resolution)))
  }
  const p = applyPrior(model?.prior?.gpu?.[resolution], gpu?.perfScore)
  return p ? priorIndex(p) : { ...EMPTY_INDEX }
}

export function cpuIndexFor(model, cpu) {
  const row = cpu?.id ? model?.cpuIndex?.[cpu.id] : null
  if (row?.value > 0) return measuredIndex(row.value, row, false)

  const p = applyPrior(model?.prior?.cpu, cpu?.perfScore)
  return p ? priorIndex(p) : { ...EMPTY_INDEX }
}

// The fitted per-cell constants. A is the GPU-side constant, B the CPU-side.
//
// Existence is A. B is NOT required here, because a gpu-scaling review — the
// most common and most useful shape — pins one CPU on purpose and so can never
// produce one. Demanding B discarded the entire cell for those reviews, and
// with it the measured `lowBase` sitting right beside A: a 1% low backed by 25
// real rows silently reverted to the 1.35 default and was then rendered under a
// "measured" badge, understating it by 20%.
//
// Callers that need the two-way SPLIT must check `cell.B > 0` themselves —
// see the `modelled` guard in index.js. That is the one thing B is for.
export function cellFor(model, game, resolution, presetId, upscaling) {
  const cell = model?.gameConst?.[game?.id]?.[resolution]?.[cellKeyFor(presetId, upscaling)]
  if (!(cell?.A > 0)) return null
  return cell
}

// The cell key, built in ONE place so no caller concatenates it by hand.
//
// Upscaling is part of the key because it is part of the measurement. Without it
// an `A` fitted from DLSS-Quality rows pairs with a `B` fitted from native rows,
// and the blended frame time describes neither — the eighth instance of this
// engine's founding failure mode, a number nobody measured presented exactly
// like one that was.
//
// scripts/fit-perf-model.mjs builds the same key when it writes the artefact. A
// mismatch between the two is SILENT: the table simply never hits.
export function cellKeyFor(presetId, upscaling) {
  return `${presetId}|${upscaling}`
}

export function exactKey({ cpu, gpu, game, resolution, presetId, upscaling }) {
  return `${cpu?.id}|${gpu?.id}|${game?.id}|${resolution}|${cellKeyFor(presetId, upscaling)}`
}

// A combination somebody actually measured. The whole point of curating real
// data is that where it exists it is used directly, so this short-circuits the
// model rather than feeding it.
export function exactFor(model, context) {
  // Guard the way the index accessors do. Without it a missing part stringifies
  // to the literal "undefined" in the key, and a table containing a key of that
  // shape would match it. Unreachable through estimateBuildPerformance, which
  // returns early without a CPU and a GPU — but this module's entire contract
  // is that a caller cannot accidentally receive a number it did not earn, and
  // an accessor that depends on someone else checking first does not honour it.
  if (!context?.cpu?.id || !context?.gpu?.id || !context?.game?.id) return null
  return model?.exact?.[exactKey(context)] ?? null
}

// Can this exact combination be estimated from measurement alone?
//
// ⚠️ Tests the BASIS, not the value. Once the accessors fall back to the prior,
// `value > 0` is true for a part nobody ever benchmarked — so the old test would
// have kept its name while quietly answering a different question, and every
// caller trusting "from measurement alone" would have been told yes for a
// spec-derived guess. The engine reports the weaker tiers through rowBasis
// instead; this stays the strict question.
export function hasCoverage(model, { cpu, gpu, game, resolution, presetId, upscaling }) {
  // Asks for a FULL two-way estimate, so it wants B as well — unlike cellFor,
  // whose job is only to say the cell exists.
  return (
    gpuIndexFor(model, gpu, resolution).basis === 'measured' &&
    cpuIndexFor(model, cpu).basis === 'measured' &&
    cellFor(model, game, resolution, presetId, upscaling)?.B > 0
  )
}
