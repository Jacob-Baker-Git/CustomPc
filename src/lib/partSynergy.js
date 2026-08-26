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

// Nobody shops for a "2000GB" drive.
const capacity = (gb) => (gb >= 1000 && gb % 1000 === 0 ? `${gb / 1000}TB` : `${gb}GB`)

// Rough heat-dissipation rating in watts. 0 = unknown (no penalty upstream).
//
// ⚠️ THE ONLY cooler-capacity figure on the site. partStats.coolerCapacity()
// used to compute its own — radiator x 1.15, height x 1.35 — and both reached
// the screen: a 420mm AIO read 483 W under "Cooling capacity" on its info sheet
// and 320 W under "Cooler capacity" on the Performance tab. The stepped ladder
// won the merge because it is the more conservative of the two and because
// under-promising is the safer direction for a number somebody is about to
// spend money on, which is the same rule gamePresets.js resolves ties by.
// partStats now delegates here; pinned by partStats.test.js.
export function coolerCapacityW(cooler) {
  const s = cooler?.specs ?? {}
  if (s.type === 'AIO') {
    const mm = radiatorMm(s.radiator)
    // 420 is a real rung, not a rounding of 360. Without it the largest
    // radiator in the catalogue claimed exactly as much cooling as a 360 —
    // which made the biggest AIO on the list look like money for nothing.
    if (mm >= 420) return 360
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

const OK = { balance: 100, reason: null, detail: null }

// How well `category` pairs with the rest of the build for `useCase`.
// Returns { balance 0-100, reason string|null, detail string|null } for the six
// pairwise-scored categories, or null for categories with no strong partner
// (mobo/case/fans) so the caller can fall back to a tier comparison. Missing
// catalog metadata never lowers the score — an absent field yields 100.
//
// `reason` is the one-line headline shown on the row; `detail` is the longer
// answer to "why?" behind the row's disclosure — it names the mechanism and
// what would actually change it, because "underpowered" on its own tells
// nobody what to buy.
export function partSynergy(parts, category, useCase) {
  const part = parts[category]
  if (!part) return OK
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  const label = USE_CASE_LABEL[useCase] ?? 'this use'
  const needs = profile.needs ?? {}

  if (category === 'cpu' || category === 'gpu') {
    const res = profile.resolution
    const bn = profile.cpuGpuPaced ? computeBottleneck(parts.cpu, parts.gpu, res) : null
    let balance = 100
    let reason = null
    let detail = null
    if (bn && bn.limitedBy === category) {
      balance = soften(bn.balancePct)
      reason = category === 'cpu'
        ? `Sets the pace for the ${parts.gpu?.name ?? 'GPU'}`
        : `Waiting on the ${parts.cpu?.name ?? 'CPU'}`
      detail = category === 'cpu'
        ? `At ${res} the ${parts.gpu?.name ?? 'graphics card'} can draw frames faster than this CPU can prepare them, so in busy scenes you lose frames the card could otherwise deliver. Nothing is broken — a quicker CPU is simply where the next gain is.`
        : `At ${res} this card has capacity to spare and the ${parts.cpu?.name ?? 'CPU'} decides the frame rate. The card is not the part to change here; a stronger CPU is what unlocks it.`
    }
    if (category === 'gpu' && typeof part.specs?.vram === 'number' && needs.vram) {
      const v = ratioPct(part.specs.vram, needs.vram)
      if (v < balance) {
        balance = v
        reason = `${part.specs.vram}GB of VRAM is tight for ${label}`
        detail = `VRAM is the memory on the graphics card itself, and ${label} generally wants ${needs.vram}GB or more. Work that does not fit spills into system memory, which shows up as sudden stutter rather than a steadily lower speed. Dropping texture or preview quality one step is the usual workaround, and it is not something a faster card without more VRAM would fix.`
      }
    }
    return { balance, reason, detail }
  }

  if (category === 'ram') {
    if (!(part.capacityGb > 0) || !needs.ramGb) return OK
    const b = ratioPct(part.capacityGb, needs.ramGb)
    if (b >= 100) return { balance: b, reason: null, detail: null }
    return {
      balance: b,
      reason: `${part.capacityGb}GB — ${label} is happier with ${needs.ramGb}GB+`,
      detail: `${part.capacityGb}GB is enough to run things, but ${label} tends to fill it. Once memory is full the machine falls back on the drive, and that swap is what makes a fast PC feel like it is pausing. Adding a second kit is usually the cheapest fix in the build.`,
    }
  }

  if (category === 'storage') {
    const capB = part.capacityGb > 0 && needs.storageGb ? ratioPct(part.capacityGb, needs.storageGb) : 100
    const type = part.storageType ?? ''
    const heavy = useCase === 'gaming' || useCase === 'creation'
    const typeB = /HDD/i.test(type) ? (heavy ? 45 : 75) : /SATA/i.test(type) ? 85 : 100
    const balance = Math.min(capB, typeB)
    let reason = null
    let detail = null
    if (typeB <= capB && typeB < 100) {
      reason = 'A slower drive than the rest of the build deserves'
      detail = /HDD/i.test(type)
        ? `This is a spinning hard disk. Capacity per pound is unbeatable, but loading, booting and scrubbing through files wait on the drive rather than the CPU or GPU. Pairing it with even a small NVMe SSD for the system and current projects is the single most noticeable upgrade most builds can make.`
        : `This is a SATA SSD — quick, but roughly a quarter the throughput of an NVMe drive on the same motherboard. The difference shows up in large file copies and load times rather than day-to-day use.`
    } else if (capB < 100) {
      reason = `${capacity(part.capacityGb)} fills up quickly for ${label}`
      detail = `${label} wants room for ${capacity(needs.storageGb)}+ of installs and files. At ${capacity(part.capacityGb)} you will be uninstalling one thing to make room for the next — a chore rather than a fault, and one a second drive fixes later without replacing anything.`
    }
    return { balance, reason, detail }
  }

  if (category === 'psu') {
    const draw = systemDrawW(parts)
    if (!(part.wattage > 0) || draw <= 0) return OK
    const recommended = draw * 1.3
    const b = clamp(Math.round((100 * part.wattage) / recommended), 0, 100)
    if (b >= 100) return { balance: b, reason: null, detail: null }
    return {
      balance: b,
      reason: `Not much headroom over a ${draw}W draw`,
      detail: `The parts here add up to about ${draw}W, and a ${part.wattage}W supply leaves less than the ~30% margin worth aiming for. Headroom matters less for the average draw than for the split-second spikes a graphics card pulls, which are what trip a supply into shutting down. It also lets the supply sit nearer its quiet, efficient half-load band.`,
    }
  }

  if (category === 'cooler') {
    const cap = coolerCapacityW(part)
    const tdp = parts.cpu?.tdp ?? 0
    if (cap <= 0 || tdp <= 0) return OK
    const b = clamp(Math.round((100 * cap) / tdp), 0, 100)
    if (b >= 100) return { balance: b, reason: null, detail: null }
    return {
      balance: b,
      reason: `Working hard against a ${tdp}W CPU`,
      detail: `The ${parts.cpu?.name ?? 'CPU'} sheds around ${tdp}W under load and this cooler is good for roughly ${cap}W. Nothing gets damaged — the CPU simply drops its clocks to stay in range — but you lose some of the boost speed you paid for during long renders or compiles, and the fans get louder getting there.`,
    }
  }

  return null // motherboard / case / fans — no pairwise partner
}
