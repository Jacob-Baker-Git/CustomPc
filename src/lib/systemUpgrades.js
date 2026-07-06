import { upgradeCandidates, sortCandidates } from './upgradeAdvisor'
import { computeBottleneck } from './bottleneck'
import { checkCompatibility } from './compatibility'
import { partQuality } from './partQuality'

// Supporting parts that have an honest, non-FPS upgrade axis. case / motherboard
// / fans deliberately excluded — no real performance ranking, so we route the
// user to the Build tab instead of fabricating one.
const SUPPORTING = ['ram', 'storage', 'psu', 'cooler']
const MAX_PER_CAT = 3

function reasonFor(category, part) {
  const read = part.specs?.readMbps ?? 0
  switch (category) {
    case 'ram':
      return `${part.capacityGb}GB${part.speed ? ` · ${part.speed}MT/s` : ''}`
    case 'storage':
      if (read >= 5000) return 'PCIe 4.0 NVMe — far faster loads'
      if (read >= 2000) return 'NVMe SSD'
      if (read >= 400)  return 'SATA SSD — quicker than a hard drive'
      return `${part.capacityGb ?? 0}GB — more space`
    case 'psu':
      return `${part.wattage}W — comfortable headroom`
    case 'cooler':
      return 'handles a hot CPU with less noise'
    default:
      return ''
  }
}

function supportingCandidates(currentParts, category, budget, catalog) {
  const current = currentParts[category]
  if (!current) return []
  const curQ = partQuality(current)
  return catalog
    .filter((p) => p.category === category && partQuality(p) > curQ)
    .map((p) => ({
      category,
      fromPart: current,
      toPart: p,
      extraCost: p.price - current.price,
      reason: reasonFor(category, p),
    }))
    .filter((c) => c.extraCost > 0 && c.extraCost <= budget)
    .filter((c) => checkCompatibility(currentParts, c.toPart).compatible)
    .sort((a, b) => a.extraCost - b.extraCost)
    .slice(0, MAX_PER_CAT)
}

const drawOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.tdp ?? 0), 0)

function deficienciesFor(currentParts, bottleneck) {
  const out = []
  const { ram, storage, psu } = currentParts

  if (ram && (ram.capacityGb ?? 0) < 16) {
    out.push({ category: 'ram', severity: 'high',
      reason: `${ram.capacityGb}GB RAM holds modern games back — 16GB is the baseline.` })
  }
  if (storage) {
    if (storage.storageType === 'HDD') {
      out.push({ category: 'storage', severity: 'medium', reason: 'An SSD would cut load times dramatically.' })
    } else if ((storage.capacityGb ?? 0) < 1000) {
      out.push({ category: 'storage', severity: 'low', reason: 'Under 1TB fills up fast — consider more space.' })
    }
  }
  const draw = drawOf(currentParts)
  if (!psu || draw * 1.3 > (psu.wattage ?? 0)) {
    out.push({ category: 'psu', severity: 'high',
      reason: psu ? 'Your PSU leaves under ~30% headroom for this build.' : 'No power supply selected.' })
  }
  if (bottleneck && bottleneck.limitedBy === 'cpu') {
    out.push({ category: 'cpu', severity: 'high', reason: bottleneck.verdict })
  }
  return out
}

// Whole-system upgrade analysis. CPU/GPU carry real FPS gains (via
// upgradeCandidates); supporting parts carry an honest `reason` string.
// `budget` is the extra spend allowed for a swap (not the whole build).
export function systemUpgrades(currentParts, goal, budget, catalog) {
  const { cpu, gpu } = currentParts
  const bottleneck = cpu && gpu ? computeBottleneck(cpu, gpu, goal.resolution) : null

  const fpsList = cpu && gpu
    ? upgradeCandidates(currentParts, { ...goal, budget }, catalog)
    : []

  const byCat = {}
  const cpuList = sortCandidates(fpsList.filter((c) => c.category === 'cpu'), 'value')
  const gpuList = sortCandidates(fpsList.filter((c) => c.category === 'gpu'), 'value')
  if (cpuList.length) byCat.cpu = cpuList
  if (gpuList.length) byCat.gpu = gpuList
  for (const cat of SUPPORTING) {
    const list = supportingCandidates(currentParts, cat, budget, catalog)
    if (list.length) byCat[cat] = list
  }

  return { bottleneck, byCat, deficiencies: deficienciesFor(currentParts, bottleneck) }
}
