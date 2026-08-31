import { psuTooSmall } from './compatibility'

// 'note' is informational only — a thing that is true and worth knowing, and
// which is NOT a problem. It sorts last so it never crowds out a real warning.
const RANK = { critical: 0, warning: 1, note: 2 }

export function getBuildWarnings(selectedParts) {
  const warnings = []
  const { cpu, gpu, motherboard, ram, cooler, case: pcCase, storage, psu } = selectedParts
  const draw = Object.values(selectedParts).reduce((s, p) => s + (p?.tdp ?? 0), 0)
  const hasCore = Boolean(cpu || gpu)

  if (draw > 0 && !psu) {
    warnings.push({ level: 'critical', message: `Add a PSU: the build draws ${draw}W with no power supply.` })
  } else if (psu && psuTooSmall(draw, psu.wattage)) {
    warnings.push({ level: 'critical', message: `PSU too small: ${draw}W draw meets or exceeds the ${psu.wattage}W supply.` })
  } else if (psu && draw * 1.3 > psu.wattage) {
    warnings.push({ level: 'warning', message: `Low PSU headroom: ${draw}W draw vs ${psu.wattage}W (aim for ~30% spare).` })
  }

  if (cpu && !motherboard) warnings.push({ level: 'warning', message: 'Add a motherboard.' })
  if (cpu && !cooler) warnings.push({ level: 'warning', message: 'Add a CPU cooler.' })
  if (cpu && !ram) warnings.push({ level: 'warning', message: 'Add RAM.' })
  if (hasCore && !pcCase) warnings.push({ level: 'warning', message: 'Add a case.' })
  if (hasCore && !storage) warnings.push({ level: 'warning', message: 'Add storage.' })

  // Thermal, not physical, so this warns rather than blocking selection.
  // ⚠️ Only fires on a PUBLISHED rating. partSynergy.coolerCapacityW derives an
  // estimate from a ladder for the parts that have none; that estimate is not
  // firm enough to tell somebody their build is wrong.
  const rated = cooler?.specs?.ratedTdpW
  if (cpu && typeof rated === 'number' && typeof cpu.tdp === 'number' && rated < cpu.tdp) {
    warnings.push({
      level: 'warning',
      message: `Cooler is rated for ${rated}W; the ${cpu.name ?? 'CPU'} draws ${cpu.tdp}W.`,
    })
  }

  // ⚠️ Both of these are BACKWARD COMPATIBLE. A Gen5 card in a Gen4 slot runs at
  // Gen4 and is completely fine; saying otherwise would be inventing a fault.
  const boardGen = motherboard?.specs?.pcieGen
  const gpuGen = gpu?.specs?.pcieGen
  if (typeof boardGen === 'number' && typeof gpuGen === 'number' && gpuGen > boardGen) {
    warnings.push({
      level: 'note',
      message: `GPU supports PCIe ${gpuGen}; this board runs it at PCIe ${boardGen}. It works, with a little less bandwidth.`,
    })
  }

  const maxSpeed = motherboard?.specs?.maxRamSpeed
  if (typeof maxSpeed === 'number' && typeof ram?.speed === 'number' && ram.speed > maxSpeed) {
    warnings.push({
      level: 'note',
      message: `RAM is rated ${ram.speed} MT/s; this board is rated to ${maxSpeed}. It will run slower unless the board's own profile supports it.`,
    })
  }

  // ⚠️ NOT a block — see rule 1b in specRules.js, which deliberately blocks only
  // on a supply with NO EPS head. A board with two 8-pin sockets runs at stock
  // on one, so an unfilled second socket is worth knowing and is not a fault.
  // Fires only when both sides are researched, and never when the supply has
  // none — that case is already blocked, and saying it twice reads as two
  // different problems.
  const epsNeed = motherboard?.specs?.epsConnectors
  const epsHave = psu?.specs?.connectors?.eps8
  if (typeof epsNeed === 'number' && typeof epsHave === 'number' && epsHave >= 1 && epsHave < epsNeed) {
    warnings.push({
      level: 'note',
      message: `This board has ${epsNeed} 8-pin EPS sockets and the ${psu.name ?? 'PSU'} can fill ${epsHave}. It runs at stock; the spare socket matters only for sustained overclocking.`,
    })
  }

  return warnings.sort((a, b) => RANK[a.level] - RANK[b.level])
}
