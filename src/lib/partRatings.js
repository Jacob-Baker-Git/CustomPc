import { partQuality } from './partQuality'
import { checkCompatibility } from './compatibility'
import { gameFps } from './gameFps'
import { partSynergy } from './partSynergy'
import { BUILD_PROFILES, USE_CASE_LABEL } from './buildProfiles'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const FPS_USES = new Set(['gaming', 'streaming'])

// Per-category quality range, memoised per catalog. partLevel is called once
// per candidate AND once per category inside rateBuild for every candidate, so
// rescanning all ~317 parts each time dominated the rating panel's render cost.
// Keyed on the catalog array itself: the store swaps in a new array when the
// live catalog loads, which invalidates the entry for free.
const rangeCache = new WeakMap()

function categoryRange(catalog, category) {
  let byCategory = rangeCache.get(catalog)
  if (!byCategory) {
    byCategory = new Map()
    rangeCache.set(catalog, byCategory)
  }
  let range = byCategory.get(category)
  if (range === undefined) {
    let min = Infinity
    let max = -Infinity
    let count = 0
    for (const p of catalog) {
      if (p.category !== category) continue
      const q = partQuality(p)
      if (q < min) min = q
      if (q > max) max = q
      count++
    }
    range = count === 0 ? null : { min, max }
    byCategory.set(category, range)
  }
  return range
}

// Percentile of a part's quality within its category across the catalog (0-100).
export function partLevel(part, catalog) {
  if (!part) return 0
  const range = categoryRange(catalog, part.category)
  if (!range) return 0
  const { min, max } = range
  return max > min ? Math.round(100 * (partQuality(part) - min) / (max - min)) : 100
}

function verdictFor(overall, label) {
  if (overall >= 85) return `Excellent for ${label}`
  if (overall >= 70) return `Strong for ${label}`
  if (overall >= 50) return `Okay for ${label}`
  return `Struggles with ${label}`
}

// Score every present part /100 for the use case. `balance` (how well it pairs
// with the rest of the build) comes from partSynergy for cpu/gpu/ram/storage/psu/
// cooler; mobo/case/fans fall back to a vs-build-tier comparison. A part is only
// as good as its worst of {adequacy vs the use-case expectation, balance}, and the
// limiting factor is surfaced as `reason`.
export function rateBuild(parts, useCase, catalog) {
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  const label = USE_CASE_LABEL[useCase] ?? 'this use'
  if (!parts.cpu || !parts.gpu) return { overall: 0, verdict: verdictFor(0, label), parts: {} }

  const cats = Object.keys(parts).filter((c) => parts[c])
  const w = profile.weights
  const expect = profile.expect

  const level = {}
  for (const c of cats) level[c] = partLevel(parts[c], catalog)

  let wsum = 0, lsum = 0
  for (const c of cats) { const wc = w[c] ?? 0; wsum += wc; lsum += wc * level[c] }
  const D = wsum > 0 ? lsum / wsum : 0

  const out = {}
  for (const c of cats) {
    const adequacy = clamp(Math.round(100 * level[c] / Math.max(expect[c] ?? 1, 1)), 0, 100)
    const syn = partSynergy(parts, c, useCase)
    let balance
    let synReason = null
    if (syn) {
      balance = syn.balance
      synReason = syn.reason
    } else {
      balance = clamp(Math.round(100 * level[c] / Math.max(D, 1)), 0, 100)
    }
    const score = Math.round(Math.min(adequacy, balance))
    const reason = balance < adequacy ? synReason : adequacy < 70 ? `Underpowered for ${label}` : null
    out[c] = { score, level: level[c], part: parts[c], isWeakLink: score < 70, reason }
  }

  let owsum = 0, ossum = 0
  for (const c of cats) { const wc = w[c] ?? 0; owsum += wc; ossum += wc * out[c].score }
  const overall = owsum > 0 ? Math.round(ossum / owsum) : 0
  return { overall, verdict: verdictFor(overall, label), parts: out }
}

// Better-in-category swaps that would raise this part's score. Cheapest first,
// capped to `limit`. gaming/streaming cpu/gpu also carry an fps gain when a
// representative `game` is supplied.
export function partUpgradeOptions(parts, useCase, category, catalog, { game = null, limit = 5 } = {}) {
  const current = parts[category]
  if (!current) return []
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  const curLevel = partLevel(current, catalog)
  const curScore = rateBuild(parts, useCase, catalog).parts[category]?.score ?? 0
  const showFps = Boolean(game) && FPS_USES.has(useCase) && (category === 'cpu' || category === 'gpu')
  const baseFps = showFps ? gameFps(parts.cpu, parts.gpu, profile.resolution, game, 'high') : 0

  const out = []
  for (const cand of catalog) {
    if (cand.category !== category) continue
    if (partLevel(cand, catalog) <= curLevel) continue
    if (cand.price <= current.price) continue
    if (!checkCompatibility(parts, cand).compatible) continue
    const next = { ...parts, [category]: cand }
    const newScore = rateBuild(next, useCase, catalog).parts[category]?.score ?? 0
    if (newScore <= curScore) continue
    const opt = { toPart: cand, extraCost: cand.price - current.price, newScore }
    if (showFps) opt.fpsGain = gameFps(next.cpu, next.gpu, profile.resolution, game, 'high') - baseFps
    out.push(opt)
  }
  return out.sort((a, b) => a.extraCost - b.extraCost).slice(0, limit)
}
