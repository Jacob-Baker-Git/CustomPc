import { computeBottleneck } from './bottleneck'
import { BUILD_PROFILES, USE_CASE_LABEL } from './buildProfiles'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const ratioPct = (have, target) => clamp(Math.round((100 * have) / target), 0, 100)

// A bottlenecked part is a weak link but still runs — floor it at 25, not 0.
const soften = (pct) => Math.round(25 + 0.75 * pct)

function radiatorMm(radiator) {
  const m = /(\d{2,3})/.exec(String(radiator ?? ''))
  return m ? Number(m[1]) : 0
}

// Rough heat-dissipation rating in watts. 0 = unknown (no penalty upstream).
export function coolerCapacityW(cooler) {
  const s = cooler?.specs ?? {}
  if (s.type === 'AIO') {
    const mm = radiatorMm(s.radiator)
    if (mm >= 360) return 320
    if (mm >= 280) return 260
    if (mm >= 240) return 220
    if (mm > 0) return 160
    return 0
  }
  const h = s.height ?? 0
  if (h <= 0) return 0
  if (h >= 160) return 220
  if (h >= 145) return 180
  if (h >= 120) return 130
  return 80
}

export function systemDrawW(parts) {
  return Object.values(parts).reduce((sum, p) => sum + (p?.tdp ?? 0), 0)
}

const OK = { balance: 100, reason: null }

// How well `category` pairs with the rest of the build for `useCase`.
// Returns { balance 0-100, reason string|null } for the six pairwise-scored
// categories, or null for categories with no strong partner (mobo/case/fans)
// so the caller can fall back to a tier comparison. Missing catalog metadata
// never lowers the score — an absent field yields 100.
export function partSynergy(parts, category, useCase) {
  const part = parts[category]
  if (!part) return OK
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  const label = USE_CASE_LABEL[useCase] ?? 'this use'
  const needs = profile.needs ?? {}

  if (category === 'cpu' || category === 'gpu') {
    const bn = computeBottleneck(parts.cpu, parts.gpu, profile.resolution)
    let balance = 100
    let reason = null
    if (bn && bn.limitedBy === category) {
      balance = soften(bn.balancePct)
      reason = category === 'cpu'
        ? `Bottlenecks the ${parts.gpu?.name ?? 'GPU'} for ${label}`
        : `Held back by the ${parts.cpu?.name ?? 'CPU'}`
    }
    if (category === 'gpu' && typeof part.specs?.vram === 'number' && needs.vram) {
      const v = ratioPct(part.specs.vram, needs.vram)
      if (v < balance) {
        balance = v
        reason = `${part.specs.vram}GB VRAM is tight for ${label}`
      }
    }
    return { balance, reason }
  }

  if (category === 'ram') {
    if (!(part.capacityGb > 0) || !needs.ramGb) return OK
    const b = ratioPct(part.capacityGb, needs.ramGb)
    return { balance: b, reason: b < 100 ? `${part.capacityGb}GB RAM — ${label} wants ${needs.ramGb}GB+` : null }
  }

  if (category === 'storage') {
    const capB = part.capacityGb > 0 && needs.storageGb ? ratioPct(part.capacityGb, needs.storageGb) : 100
    const type = part.storageType ?? ''
    const heavy = useCase === 'gaming' || useCase === 'creation'
    const typeB = /HDD/i.test(type) ? (heavy ? 45 : 75) : /SATA/i.test(type) ? 85 : 100
    const balance = Math.min(capB, typeB)
    let reason = null
    if (typeB <= capB && typeB < 100) reason = 'A slow disk holds back load and scratch times'
    else if (capB < 100) reason = `Low capacity for ${label}`
    return { balance, reason }
  }

  if (category === 'psu') {
    const draw = systemDrawW(parts)
    if (!(part.wattage > 0) || draw <= 0) return OK
    const recommended = draw * 1.3
    const b = clamp(Math.round((100 * part.wattage) / recommended), 0, 100)
    return { balance: b, reason: b < 100 ? `Little headroom over a ${draw}W system draw` : null }
  }

  if (category === 'cooler') {
    const cap = coolerCapacityW(part)
    const tdp = parts.cpu?.tdp ?? 0
    if (cap <= 0 || tdp <= 0) return OK
    const b = clamp(Math.round((100 * cap) / tdp), 0, 100)
    return { balance: b, reason: b < 100 ? `Undersized for a ${tdp}W CPU` : null }
  }

  return null // motherboard / case / fans — no pairwise partner
}
