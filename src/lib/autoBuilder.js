import { checkCompatibility } from './compatibility'

const BASE_WEIGHTS = {
  cpu: 0.18, gpu: 0.32, motherboard: 0.11, ram: 0.08, storage: 0.07,
  psu: 0.07, case: 0.08, cooler: 0.06, fans: 0.03,
}

// CPU/GPU first (perf drivers), parts that depend on them next, PSU last.
const FILL_ORDER = ['cpu', 'gpu', 'motherboard', 'ram', 'cooler', 'case', 'storage', 'fans', 'psu']
const PERF = new Set(['cpu', 'gpu'])

function weightsFor(resolution) {
  const w = { ...BASE_WEIGHTS }
  if (resolution === '4k') { w.cpu -= 0.06; w.gpu += 0.06 }
  else if (resolution === '1080p') { w.gpu -= 0.04; w.cpu += 0.04 }
  return w
}

const ofCategory = (parts, c) => parts.filter((p) => p.category === c)
const drawOf = (sel) => Object.values(sel).reduce((s, p) => s + (p?.tdp ?? 0), 0)

function choosePsu(candidates, draw, remaining) {
  const byPrice = [...candidates].sort((a, b) => a.price - b.price)
  return (
    byPrice.find((p) => p.wattage >= draw * 1.3 && p.price <= remaining) ||
    byPrice.find((p) => p.wattage >= draw && p.price <= remaining) ||
    byPrice.find((p) => p.wattage >= draw * 1.3) ||
    byPrice.find((p) => p.wattage >= draw) ||
    byPrice[byPrice.length - 1] ||
    null
  )
}

function chooseBest(category, candidates, slice, remaining) {
  if (candidates.length === 0) return null
  let pool = candidates.filter((p) => p.price <= slice)
  if (pool.length === 0) pool = candidates.filter((p) => p.price <= remaining)
  if (pool.length === 0) return [...candidates].sort((a, b) => a.price - b.price)[0]
  if (PERF.has(category)) return [...pool].sort((a, b) => (b.perfScore - a.perfScore) || (a.price - b.price))[0]
  return [...pool].sort((a, b) => a.price - b.price)[0]
}

export function autoBuild(selectedParts, budget, partsData, resolution = '1440p') {
  const result = { ...selectedParts }
  const userCats = new Set(Object.keys(selectedParts))
  const weights = weightsFor(resolution)
  const spentExisting = Object.values(result).reduce((s, p) => s + (p?.price ?? 0), 0)
  const available = Math.max(0, budget - spentExisting)
  let remaining = available

  const emptyCats = FILL_ORDER.filter((c) => !result[c])
  const weightSum = emptyCats.reduce((s, c) => s + weights[c], 0) || 1
  // Hold back the PSU's slice so the upgrade pass can't spend the power budget.
  const psuReserve = result.psu ? 0 : (weights.psu / weightSum) * available

  // Fill every empty category except PSU (sized last, after upgrades).
  for (const category of emptyCats) {
    if (category === 'psu') continue
    const slice = (weights[category] / weightSum) * available
    let candidates = ofCategory(partsData, category).filter((p) => checkCompatibility(result, p).compatible)
    // compatibility.js only checks GPU-length when selecting a GPU, not a case —
    // so enforce it here when a GPU is already chosen.
    if (category === 'case' && result.gpu) {
      candidates = candidates.filter((p) => result.gpu.length <= p.maxGpuLength)
    }
    const pick = chooseBest(category, candidates, slice, remaining - psuReserve)
    if (pick) {
      result[category] = pick
      remaining -= pick.price
    }
  }

  // Spend leftover upgrading auto-picked perf drivers (never the user's own picks).
  for (const category of ['gpu', 'cpu']) {
    if (userCats.has(category)) continue
    const current = result[category]
    if (!current) continue
    const without = { ...result, [category]: undefined }
    const better = ofCategory(partsData, category)
      .filter((p) => checkCompatibility(without, p).compatible)
      .filter((p) => p.perfScore > current.perfScore && p.price - current.price <= remaining - psuReserve)
      .sort((a, b) => (b.perfScore - a.perfScore) || (a.price - b.price))[0]
    if (better) {
      remaining -= better.price - current.price
      result[category] = better
    }
  }

  // Size the PSU last, against the final draw.
  if (!result.psu) {
    const psu = choosePsu(ofCategory(partsData, 'psu'), drawOf(result), remaining)
    if (psu) {
      result.psu = psu
      remaining -= psu.price
    }
  }

  return result
}
