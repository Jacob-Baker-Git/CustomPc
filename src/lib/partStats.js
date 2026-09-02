import { RES_GPU } from './fpsEstimate'
import { coolerCapacityW } from './partSynergy'

// Derived headline stats, computed from fields the catalogue already holds.
//
// Everything here is arithmetic on real data — nothing is invented. That matters:
// making up a cache size or a CAS latency for 554 real products would be
// presenting fiction as specification, which is exactly what the terms page
// promises we do not do. If a stat cannot be derived from a field we actually
// have, it is not here.

const num = (v) => (Number.isFinite(v) ? v : null)
const per100 = (value, price) => (price > 0 && value > 0 ? (value / price) * 100 : null)

// A GPU's own frame ceiling — what it can push before the CPU is considered.
// The same RES_GPU factors the FPS model uses, so this can never drift from it.
export function gpuFpsCeiling(part, resolution = '1440p') {
  if (part?.category !== 'gpu') return null
  const factor = RES_GPU[String(resolution).toLowerCase()] ?? RES_GPU['1440p']
  return Math.round((part.perfScore ?? 0) * factor)
}

// The stat the request named: frames per £100, at a stated resolution.
export function fpsPerPound(part, resolution = '1440p') {
  const fps = gpuFpsCeiling(part, resolution)
  return fps == null ? null : per100(fps, part.price)
}

// Performance points per £100. Only meaningful where perfScore exists.
export function perfPerPound(part) {
  return per100(part?.perfScore ?? 0, part?.price ?? 0)
}

// Performance points per watt drawn — the efficiency axis, which price and raw
// performance both miss. A part that matches another on 40W less is the better
// part, and nothing in the catalogue said so before.
export function perfPerWatt(part) {
  const perf = part?.perfScore ?? 0
  const tdp = part?.tdp ?? 0
  return perf > 0 && tdp > 0 ? perf / tdp : null
}

export function pricePerGb(part) {
  const gb = part?.capacityGb ?? 0
  return gb > 0 && part.price > 0 ? part.price / gb : null
}

export function pricePer100W(part) {
  const w = part?.wattage ?? 0
  return w > 0 && part.price > 0 ? (part.price / w) * 100 : null
}

// 80 PLUS tiers as a comparable number. Efficiency is a running-cost and
// heat/noise property that wattage alone does not express.
const PSU_EFFICIENCY = { titanium: 100, platinum: 90, gold: 80, silver: 70, bronze: 60, white: 50, standard: 45 }
export function psuEfficiency(part) {
  const key = String(part?.specs?.rating ?? '').toLowerCase()
  for (const [name, score] of Object.entries(PSU_EFFICIENCY)) if (key.includes(name)) return score
  return null
}

const mmOf = (v) => { const m = /(\d{2,3})/.exec(String(v ?? '')); return m ? Number(m[1]) : 0 }

// Total swept fan area in cm² — three 120s really do move more air than one 140,
// and only the product of count and area says so.
export function fanArea(part) {
  const size = mmOf(part?.specs?.size)
  const count = part?.specs?.count ?? 1
  if (!size) return null
  return Math.round((count * Math.PI * (size / 2) ** 2) / 100)
}

// What a cooler can actually dissipate, in watts.
//
// ⚠️ This used to be a SECOND formula (radiator x 1.15, height x 1.35) that only
// claimed to "mirror partSynergy's ordering" — and mirroring the ordering is not
// agreeing on the number. It did not: a 420mm AIO printed 483 here and 320 on
// the Performance tab, for the same cooler on the same build. There is now one
// implementation and this defers to it.
//
// The `|| null` is the one real difference and it is deliberate: coolerCapacityW
// returns 0 for "specs unknown", which estimateThermals reads as absent, but
// partStats' add() would happily print a literal "0 W". Null makes the row
// disappear instead, which is what an unknown spec should do.
export function coolerCapacity(part) {
  return coolerCapacityW(part) || null
}

const fmt = (v, digits = 1) => (v == null ? null : Number(v.toFixed(digits)))

// Headline stats for display, in the order they should be read. Each entry is
// { label, value, unit, hint } — value already rounded, so the UI just prints it.
export function partStats(part, { resolution = '1440p' } = {}) {
  if (!part) return []
  const s = part.specs ?? {}
  const out = []
  // `derived` marks a stat that is COMPUTED rather than read straight off the
  // part. specSheetContent.js already prints every raw field, so the spec sheet
  // shows only these and nothing appears twice.
  const add = (label, value, unit = '', hint = '', derived = false) => {
    if (value == null || value === '' || Number.isNaN(value)) return
    out.push({ label, value, unit, hint, derived })
  }
  const addDerived = (label, value, unit = '', hint = '') => add(label, value, unit, hint, true)

  switch (part.category) {
    case 'gpu':
      // Deliberately no "FPS ceiling" row: the spec sheet already prints a chip
      // per resolution above this table (gpuResChips), and repeating the same
      // number in two places invites them to disagree later.
      addDerived('FPS per £100', fmt(fpsPerPound(part, resolution)), ` @ ${resolution}`, 'Frames per £100 spent: higher is better value')
      addDerived('Efficiency', fmt(perfPerWatt(part), 2), ' pts/W', 'Performance per watt: higher runs cooler and quieter')
      add('VRAM', num(s.vram), ' GB', 'Video memory; more suits higher resolutions and textures')
      add('Memory type', s.memType)
      add('Power draw', num(part.tdp), ' W')
      add('Length', num(part.length), ' mm', 'Must fit your case')
      break

    case 'cpu':
      addDerived('Perf per £100', fmt(perfPerPound(part)), '', 'Performance points per £100 spent')
      addDerived('Efficiency', fmt(perfPerWatt(part), 2), ' pts/W', 'Performance per watt: drives cooler choice')
      add('Cores', num(s.cores))
      add('Boost clock', num(s.boostClock), ' GHz', 'Peak single-core speed')
      add('Power draw', num(part.tdp), ' W')
      add('Socket', part.socket, '', 'Must match the motherboard')
      break

    case 'ram':
      addDerived('Price per GB', fmt(pricePerGb(part), 2), ' £/GB')
      add('Capacity', num(part.capacityGb), ' GB')
      add('Speed', num(part.speed), ' MT/s', 'Higher helps CPUs that share memory bandwidth')
      add('Sticks', num(s.sticks), '', 'Two or more enables dual-channel')
      add('Type', part.ramType, '', 'Must match the motherboard')
      break

    case 'storage':
      addDerived('Price per GB', fmt(pricePerGb(part), 3), ' £/GB')
      add('Capacity', num(part.capacityGb), ' GB')
      add('Read speed', num(s.readMbps), ' MB/s', 'How fast large files and games load')
      add('Type', part.storageType)
      break

    case 'psu':
      addDerived('Price per 100W', fmt(pricePer100W(part), 2), ' £')
      add('Wattage', num(part.wattage), ' W')
      add('Efficiency', s.rating, '', 'Higher 80 PLUS tiers waste less power as heat')
      break

    case 'motherboard':
      add('Chipset', s.chipset, '', 'Sets lane count, VRM class and how far the board can be pushed')
      add('Socket', part.socket)
      add('Memory', part.ramType)
      add('Size', part.formFactor, '', 'Must be supported by the case')
      break

    case 'case':
      add('Max GPU length', num(part.maxGpuLength), ' mm')
      add('Max cooler height', num(part.maxCoolerHeight), ' mm')
      add('Board sizes', Array.isArray(part.supportedFormFactors) ? part.supportedFormFactors.join(', ') : null)
      add('Style', s.type)
      break

    case 'cooler':
      addDerived('Cooling capacity', coolerCapacity(part), ' W', 'Roughly the CPU power it can keep in check')
      add('Type', s.type)
      add('Radiator', s.radiatorMm && `${s.radiatorMm}mm`)
      add('Height', num(s.height), ' mm', 'Must clear the case side panel')
      break

    case 'fans':
      addDerived('Total airflow area', fanArea(part), ' cm²', 'Combined swept area: more area moves more air per turn')
      add('Fans', num(s.count))
      add('Size', s.size)
      break

    default:
      add('Price', part.price, ' £')
  }

  return out
}

// Only the computed metrics — what the raw spec table cannot already tell you.
export function derivedStats(part, opts) {
  return partStats(part, opts).filter((s) => s.derived)
}
