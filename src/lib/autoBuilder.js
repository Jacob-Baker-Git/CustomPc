import { checkCompatibility } from './compatibility'
import { partQuality } from './partQuality'
import { rateBuild } from './partRatings'

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

// Head of a best-first pool, or a random one of its top k when an rng is given —
// keeps a varied build inside the best tier. Deterministic (head) without rng.
function pick(sortedBestFirst, rng, k = 3) {
  if (sortedBestFirst.length === 0) return null
  if (!rng) return sortedBestFirst[0]
  return sortedBestFirst[Math.floor(rng() * Math.min(k, sortedBestFirst.length))]
}

function chooseBest(category, candidates, slice, remaining, rng) {
  if (candidates.length === 0) return null
  let pool = candidates.filter((p) => p.price <= slice)
  if (pool.length === 0) pool = candidates.filter((p) => p.price <= remaining)
  if (pool.length === 0) return [...candidates].sort((a, b) => a.price - b.price)[0]
  if (PERF.has(category)) return pick([...pool].sort((a, b) => (b.perfScore - a.perfScore) || (a.price - b.price)), rng)
  return pick([...pool].sort((a, b) => a.price - b.price), rng)
}

export function autoBuild(selectedParts, budget, partsData, resolution = '1440p', options = {}) {
  const weights = options.weights ?? weightsFor(resolution)
  const upgradeOrder = options.upgradeOrder ?? ['gpu', 'cpu']
  const maximise = options.maximise ?? false
  const rng = options.rng ?? null
  const lockExisting = options.lockExisting ?? true
  // Use case to score against. Absent, the maximise pass keeps its original
  // quality-stepping behaviour — so every existing caller is untouched.
  const rateFor = options.rateFor ?? null

  const result = { ...selectedParts }
  const userCats = lockExisting ? new Set(Object.keys(selectedParts)) : new Set()
  const spentExisting = Object.values(result).reduce((s, p) => s + (p?.price ?? 0), 0)
  const available = Math.max(0, budget - spentExisting)
  let remaining = available

  const emptyCats = FILL_ORDER.filter((c) => !result[c])
  const weightSum = emptyCats.reduce((s, c) => s + (weights[c] ?? 0), 0) || 1
  // Hold back the PSU's slice so the upgrade pass can't spend the power budget.
  const psuReserve = result.psu ? 0 : ((weights.psu ?? 0) / weightSum) * available

  // Fill every empty category except PSU (sized last, after upgrades).
  for (const category of emptyCats) {
    if (category === 'psu') continue
    const slice = ((weights[category] ?? 0) / weightSum) * available
    let candidates = ofCategory(partsData, category).filter((p) => checkCompatibility(result, p).compatible)
    // compatibility.js only checks GPU-length when selecting a GPU, not a case —
    // so enforce it here when a GPU is already chosen.
    if (category === 'case' && result.gpu) {
      candidates = candidates.filter((p) => result.gpu.length <= p.maxGpuLength)
    }
    const chosen = chooseBest(category, candidates, slice, remaining - psuReserve, rng)
    if (chosen) {
      result[category] = chosen
      remaining -= chosen.price
    }
  }

  // Affordable, compatible, strictly-better swaps for a category, cheapest first.
  const upgradePool = (category) => {
    const current = result[category]
    if (!current) return []
    const curQ = partQuality(current)
    const without = { ...result, [category]: undefined }
    let pool = ofCategory(partsData, category)
      .filter((p) => checkCompatibility(without, p).compatible)
      .filter((p) => partQuality(p) > curQ && p.price - current.price <= remaining - psuReserve)
    // Same gap as the fill pass: compatibility.js checks GPU length when picking
    // a GPU, never when picking the case it has to fit inside.
    if (category === 'case' && result.gpu) {
      pool = pool.filter((p) => result.gpu.length <= p.maxGpuLength)
    }
    return pool.sort((a, b) => a.price - b.price)
  }

  // Best higher-quality part in `category` we can still afford. `cheapest` picks
  // the smallest affordable step up (used by the maximise loop); otherwise the
  // best affordable jump (the original leftover behavior).
  const affordableUpgrade = (category, cheapest) => {
    const pool = upgradePool(category)
    if (pool.length === 0) return null
    const sorted = cheapest
      ? [...pool].sort((a, b) => (a.price - b.price) || (partQuality(b) - partQuality(a)))
      : [...pool].sort((a, b) => (partQuality(b) - partQuality(a)) || (a.price - b.price))
    return pick(sorted, rng)
  }

  // A handful of candidates spread across the affordable price range. Rating
  // every one of ~35 parts in every category on every round is what this cap
  // avoids; the loop iterates, so a step skipped now is still reachable next
  // round once something cheaper has been bought.
  const upgradeCandidates = (category, cap = 6) => {
    const pool = upgradePool(category)
    if (pool.length <= cap) return pool
    const out = new Set()
    for (let i = 0; i < cap; i++) out.add(pool[Math.round((i * (pool.length - 1)) / (cap - 1))])
    return [...out]
  }

  // The original maximise pass: walk the priority list taking the cheapest step
  // up in each until nothing more is affordable. Terminates because quality
  // strictly increases each step over a finite catalog.
  const stepUpQuality = () => {
    let guard = 0
    let stepped = true
    while (stepped && guard++ < 200) {
      stepped = false
      for (const category of upgradeOrder) {
        if (userCats.has(category)) continue
        const next = affordableUpgrade(category, true)
        if (next) {
          remaining -= next.price - result[category].price
          result[category] = next
          stepped = true
        }
      }
    }
  }

  if (maximise && rateFor) {
    // Score-greedy maximise. Every affordable single-part swap is priced against
    // the CustomPC score it would actually buy, and the best score-per-pound one
    // wins each round.
    //
    // The old pass walked a fixed priority list taking the cheapest step up in
    // each, over and over. That has no notion of diminishing returns, so a £1700
    // gaming build marched the CPU to an i9-14900KS — £650 that bought nothing a
    // gamer would feel — while the GPU, which the profile weights nearly twice as
    // heavily, sat at 76. Rating each candidate is what makes "best within the
    // budget" mean the thing the user is shown.
    let guard = 0
    while (guard++ < 60) {
      const base = rateBuild(result, rateFor, partsData).overall
      const steps = []
      for (const category of FILL_ORDER) {
        if (category === 'psu' || userCats.has(category) || !result[category]) continue
        for (const cand of upgradeCandidates(category)) {
          const cost = cand.price - result[category].price
          const gain = rateBuild({ ...result, [category]: cand }, rateFor, partsData).overall - base
          if (gain <= 0) continue
          steps.push({ category, cand, cost, value: cost > 0 ? gain / cost : Infinity })
        }
      }
      if (steps.length === 0) break
      steps.sort((a, b) => b.value - a.value || a.cost - b.cost)
      const step = pick(steps, rng, 2)
      remaining -= step.cost
      result[step.category] = step.cand
    }
    // Nothing left that raises the score, so put any remainder into raw quality
    // the way the old pass did — a better case or cooler still beats change in
    // the user's pocket.
    stepUpQuality()
  } else if (maximise) {
    stepUpQuality()
  } else {
    // Spend leftover upgrading auto-picked parts (never the user's own picks).
    for (const category of upgradeOrder) {
      if (userCats.has(category)) continue
      const better = affordableUpgrade(category, false)
      if (better) {
        remaining -= better.price - result[category].price
        result[category] = better
      }
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
