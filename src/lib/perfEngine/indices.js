// Lookup into the fitted artefact.
//
// Every accessor reports the BASIS of what it returns, not just a number. That
// distinction is the whole trust story: "measured" and "we had nothing and made
// something up" must never be indistinguishable to the caller, and the only way
// to guarantee that is to make the basis impossible to drop.

const EMPTY_INDEX = { value: null, basis: 'none', anchors: 0, resolutionCopied: false }

export function gpuIndexFor(model, gpu, resolution) {
  const row = gpu?.id ? model?.gpuIndex?.[gpu.id] : null
  const value = row?.[resolution]
  if (!(value > 0)) return { ...EMPTY_INDEX }
  return {
    value,
    basis: row.basis ?? 'measured',
    anchors: row.anchors ?? 0,
    resolutionCopied: Boolean(row.copiedResolutions?.includes(resolution)),
  }
}

export function cpuIndexFor(model, cpu) {
  const row = cpu?.id ? model?.cpuIndex?.[cpu.id] : null
  if (!(row?.value > 0)) return { ...EMPTY_INDEX }
  return {
    value: row.value,
    basis: row.basis ?? 'measured',
    anchors: row.anchors ?? 0,
    resolutionCopied: false,
  }
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
export function cellFor(model, game, resolution, presetId) {
  const cell = model?.gameConst?.[game?.id]?.[resolution]?.[presetId]
  if (!(cell?.A > 0)) return null
  return cell
}

export function exactKey({ cpu, gpu, game, resolution, presetId }) {
  return `${cpu?.id}|${gpu?.id}|${game?.id}|${resolution}|${presetId}`
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

// Can this exact combination be estimated from measurement alone? Phase 1
// answers only where this is true and says "not enough data" everywhere else.
export function hasCoverage(model, { cpu, gpu, game, resolution, presetId }) {
  // Asks for a FULL two-way estimate, so it wants B as well — unlike cellFor,
  // whose job is only to say the cell exists.
  return (
    gpuIndexFor(model, gpu, resolution).value > 0 &&
    cpuIndexFor(model, cpu).value > 0 &&
    cellFor(model, game, resolution, presetId)?.B > 0
  )
}
