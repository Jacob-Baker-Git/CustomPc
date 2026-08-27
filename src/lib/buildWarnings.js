import { psuTooSmall } from './compatibility'

const RANK = { critical: 0, warning: 1 }

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

  return warnings.sort((a, b) => RANK[a.level] - RANK[b.level])
}
