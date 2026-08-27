import { evaluateSpecRules } from './specRules'

// DDR5-only platforms: no DDR4 memory controller exists for these sockets,
// so the RAM check can fire even before a motherboard is picked.
const DDR5_ONLY_SOCKETS = ['AM5', 'LGA1851']

const drawOf = (parts) =>
  Object.values(parts).reduce((sum, p) => sum + (p?.tdp ?? 0), 0)

// Air-cooler height (AIOs mount their radiator elsewhere, so no height limit).
const airHeight = (cooler) =>
  cooler?.specs?.type === 'AIO' ? null : cooler?.specs?.height ?? null

// ⚠️ ONE definition of "this supply cannot run this build", because three
// call sites used to carry their own and they disagreed at exactly equality.
// Picking the supply tested `wattage < draw`, so a 400W unit on a 400W build
// was ALLOWED; re-picking any other part tested `draw >= wattage`, so the same
// build was BLOCKED; getBuildWarnings called it critical. You could therefore
// assemble a build the site immediately declared underpowered, and then find
// the graphics card already in it locked.
//
// `>=` is the side that wins: a supply run at 100% of its rating is a failure,
// not a pass. Exported so buildWarnings.js shares it rather than restating it.
export const psuTooSmall = (draw, wattage) => draw > 0 && draw >= wattage

// ⚠️ `compatible` is DERIVED, never stored independently. Two fields that can
// disagree is how the PSU equality bug survived in three places at once.
const blocked = (reason) => ({ status: 'blocked', compatible: false, reason })
const ok = () => ({ status: 'ok', compatible: true, reason: '' })

export function checkCompatibility(selectedParts, candidate) {
  const { motherboard, case: selectedCase, cpu, ram, cooler, gpu, psu } = selectedParts

  if (candidate.category === 'cpu' && motherboard) {
    if (candidate.socket !== motherboard.socket)
      return blocked(`Requires ${candidate.socket} socket; motherboard uses ${motherboard.socket}`)
  }

  if (candidate.category === 'motherboard' && cpu) {
    if (candidate.socket !== cpu.socket)
      return blocked(`Requires ${candidate.socket} socket; CPU uses ${cpu.socket}`)
  }

  if (candidate.category === 'ram' && motherboard) {
    if (candidate.ramType !== motherboard.ramType)
      return blocked(`Requires ${candidate.ramType}; motherboard supports ${motherboard.ramType} only`)
  }

  if (candidate.category === 'motherboard' && ram) {
    if (candidate.ramType !== ram.ramType)
      return blocked(`Requires ${candidate.ramType}; your RAM is ${ram.ramType}`)
  }

  // Platform RAM-type check that works even before a motherboard is chosen.
  if (candidate.category === 'ram' && cpu && !motherboard) {
    if (DDR5_ONLY_SOCKETS.includes(cpu.socket) && candidate.ramType === 'DDR4')
      return blocked(`${cpu.socket} platform is DDR5-only; DDR4 won't work with this CPU`)
  }

  if (candidate.category === 'cpu' && ram && !motherboard) {
    if (DDR5_ONLY_SOCKETS.includes(candidate.socket) && ram.ramType === 'DDR4')
      return blocked(`${candidate.socket} platform is DDR5-only; your RAM is DDR4`)
  }

  if (candidate.category === 'case' && motherboard) {
    if (Array.isArray(candidate.supportedFormFactors) && !candidate.supportedFormFactors.includes(motherboard.formFactor))
      return blocked(`Does not support ${motherboard.formFactor} form factor`)
  }

  if (candidate.category === 'motherboard' && selectedCase) {
    if (Array.isArray(selectedCase.supportedFormFactors) && !selectedCase.supportedFormFactors.includes(candidate.formFactor))
      return blocked(`Case does not support ${candidate.formFactor} form factor`)
  }

  if (candidate.category === 'gpu' && selectedCase) {
    if (candidate.length > selectedCase.maxGpuLength)
      return blocked(`GPU length ${candidate.length}mm exceeds case clearance of ${selectedCase.maxGpuLength}mm`)
  }

  if (candidate.category === 'case' && gpu) {
    if (gpu.length > candidate.maxGpuLength)
      return blocked(`Your ${gpu.length}mm GPU exceeds this case's ${candidate.maxGpuLength}mm clearance`)
  }

  if (candidate.category === 'cooler' && selectedCase) {
    const h = airHeight(candidate)
    if (h != null && typeof selectedCase.maxCoolerHeight === 'number' && h > selectedCase.maxCoolerHeight)
      return blocked(`Cooler is ${h}mm tall; case fits up to ${selectedCase.maxCoolerHeight}mm`)
  }

  if (candidate.category === 'case' && cooler) {
    const h = airHeight(cooler)
    if (h != null && typeof candidate.maxCoolerHeight === 'number' && h > candidate.maxCoolerHeight)
      return blocked(`Your ${h}mm cooler exceeds this case's ${candidate.maxCoolerHeight}mm limit`)
  }

  if (candidate.category === 'cooler' && motherboard) {
    if (Array.isArray(candidate.sockets) && !candidate.sockets.includes(motherboard.socket))
      return blocked(`Cooler does not support ${motherboard.socket} socket`)
  }

  if (candidate.category === 'cooler' && cpu) {
    if (Array.isArray(candidate.sockets) && !candidate.sockets.includes(cpu.socket))
      return blocked(`Cooler does not support ${cpu.socket} socket`)
  }

  if (candidate.category === 'cpu' && cooler) {
    if (Array.isArray(cooler.sockets) && !cooler.sockets.includes(candidate.socket))
      return blocked(`Selected cooler does not support ${candidate.socket} socket`)
  }

  if (candidate.category === 'motherboard' && cooler) {
    if (Array.isArray(cooler.sockets) && !cooler.sockets.includes(candidate.socket))
      return blocked(`Selected cooler does not support ${candidate.socket} socket`)
  }

  // Power fit: a PSU must at least cover what the build already draws, and a
  // new part must not push the draw past the selected PSU. (Headroom advice
  // stays a soft warning in buildWarnings — this only blocks hard failures.)
  if (candidate.category === 'psu') {
    const draw = drawOf(selectedParts)
    if (psuTooSmall(draw, candidate.wattage))
      return blocked(`${candidate.wattage}W cannot run the build's ${draw}W draw`)
  }

  if (candidate.category !== 'psu' && psu && (candidate.tdp ?? 0) > 0) {
    const current = selectedParts[candidate.category]
    const draw = drawOf(selectedParts) - (current?.tdp ?? 0) + candidate.tdp
    if (psuTooSmall(draw, psu.wattage))
      return blocked(`Would draw ${draw}W; your PSU supplies ${psu.wattage}W`)
  }

  // ⚠️ Reached only when every existing check passed, so a block here cannot be
  // masking one above it. New rules may still block, or report unverified.
  const spec = evaluateSpecRules(selectedParts, candidate)
  if (spec.status === 'blocked') return blocked(spec.reason)
  if (spec.status === 'unverified')
    return { status: 'unverified', compatible: true, reason: spec.reason }
  return ok()
}

export function getLockedReasons(selectedParts, allParts) {
  const reasons = {}
  for (const part of allParts) {
    const { compatible, reason } = checkCompatibility(selectedParts, part)
    if (!compatible) reasons[part.id] = reason
  }
  return reasons
}
