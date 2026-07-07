import { partQuality } from './partQuality'
import { computeBottleneck } from './bottleneck'
import { checkCompatibility } from './compatibility'
import { gameFps } from './gameFps'
import { BUILD_PROFILES, USE_CASE_LABEL } from './buildProfiles'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const FPS_USES = new Set(['gaming', 'streaming'])

// Percentile of a part's quality within its category across the catalog (0-100).
export function partLevel(part, catalog) {
  if (!part) return 0
  const qs = catalog.filter((p) => p.category === part.category).map(partQuality)
  if (qs.length === 0) return 0
  const min = Math.min(...qs)
  const max = Math.max(...qs)
  return max > min ? Math.round(100 * (partQuality(part) - min) / (max - min)) : 100
}

function verdictFor(overall, label) {
  if (overall >= 85) return `Excellent for ${label}`
  if (overall >= 70) return `Strong for ${label}`
  if (overall >= 50) return `Okay for ${label}`
  return `Struggles with ${label}`
}

// Score every present part /100 for the use case. cpu/gpu balance comes from the
// FPS bottleneck; other parts are judged against the build's own tier. A part is
// only as good as its worst of {adequacy vs the use-case expectation, balance}.
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

  const bn = computeBottleneck(parts.cpu, parts.gpu, profile.resolution)

  const out = {}
  for (const c of cats) {
    const adequacy = clamp(Math.round(100 * level[c] / Math.max(expect[c] ?? 1, 1)), 0, 100)
    let balance
    if (c === 'cpu') balance = bn && bn.limitedBy === 'cpu' ? bn.balancePct : 100
    else if (c === 'gpu') balance = bn && bn.limitedBy === 'gpu' ? bn.balancePct : 100
    else balance = clamp(Math.round(100 * level[c] / Math.max(D, 1)), 0, 100)
    const score = Math.round(Math.min(adequacy, balance))
    out[c] = { score, level: level[c], part: parts[c], isWeakLink: score < 70 }
  }

  let owsum = 0, ossum = 0
  for (const c of cats) { const wc = w[c] ?? 0; owsum += wc; ossum += wc * out[c].score }
  const overall = owsum > 0 ? Math.round(ossum / owsum) : 0
  return { overall, verdict: verdictFor(overall, label), parts: out }
}
