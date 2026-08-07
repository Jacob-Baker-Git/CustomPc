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
export function cellFor(model, game, resolution, presetId) {
  const cell = model?.gameConst?.[game?.id]?.[resolution]?.[presetId]
  if (!(cell?.A > 0) || !(cell?.B > 0)) return null
  return cell
}

export function exactKey({ cpu, gpu, game, resolution, presetId }) {
  return `${cpu?.id}|${gpu?.id}|${game?.id}|${resolution}|${presetId}`
}

// A combination somebody actually measured. The whole point of curating real
// data is that where it exists it is used directly, so this short-circuits the
// model rather than feeding it.
export function exactFor(model, context) {
  return model?.exact?.[exactKey(context)] ?? null
}

// Can this exact combination be estimated from measurement alone? Phase 1
// answers only where this is true and says "not enough data" everywhere else.
export function hasCoverage(model, { cpu, gpu, game, resolution, presetId }) {
  return (
    gpuIndexFor(model, gpu, resolution).value > 0 &&
    cpuIndexFor(model, cpu).value > 0 &&
    cellFor(model, game, resolution, presetId) != null
  )
}
