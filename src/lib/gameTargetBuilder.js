import { estimateBuildPerformance } from './perfEngine'
import { autoBuild } from './autoBuilder'
import { presetsFor } from './gamePresets'
import { BUILD_PROFILES } from './buildProfiles'
import { computeBottleneck } from './bottleneck'
import { coolerCapacityW } from './partSynergy'
import perfGames from '../data/perfGames.json'

const ESSENTIAL = ['cpu', 'gpu', 'motherboard', 'ram', 'cooler', 'case', 'storage', 'psu']
const NEEDS = BUILD_PROFILES.gaming.needs
const sumPrice = (sel) => Object.values(sel).reduce((s, p) => s + (p?.price ?? 0), 0)
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
// A measured row before an "up to" ceiling of the same frame rate: the ceiling
// cannot see the CPU, the measurement can.
const measuredFirst = (a, b) => (a.row.bound === 'upper') - (b.row.bound === 'upper')

// Fastest first. On equal FPS a measurement beats a ceiling, then the stronger
// CPU wins: most answers are graphics-card ceilings that cannot see the CPU,
// and spending spare budget on the chip is the sensible tie-break. Then
// cheaper, then ids.
export const compareFastFirst = (a, b) =>
  (b.row.avgFps - a.row.avgFps) || measuredFirst(a, b) || ((b.cpu.perfScore ?? 0) - (a.cpu.perfScore ?? 0)) ||
  (a.core - b.core) || byId(a.cpu.id, b.cpu.id) || byId(a.gpu.id, b.gpu.id)

// The engine's game list, not the catalogue's — see PerformanceScreen. A stored
// id the list no longer has is no game at all.
export const gameById = (id) => perfGames.find((g) => g.id === id) ?? null

// A preset is a measurement condition, and two runs of one preset at different
// render scales are different measurements — so the key carries both halves.
export const presetKey = (p) => `${p.id}|${p.upscaling}`

// Heaviest preset as the fallback, because erring toward the heavier preset
// errs toward a LOWER frame rate. Native over upscaled at the same tier: an
// upscaled run of the top preset is a higher frame rate, not a heavier one.
export function findPreset(game, key) {
  const presets = presetsFor(game)
  const exact = presets.find((p) => presetKey(p) === key)
  if (exact) return exact
  const top = Math.max(...presets.map((p) => p.tier))
  const atTop = presets.filter((p) => p.tier === top)
  return atTop.find((p) => p.upscaling === 'native') ?? atTop[0]
}

export function fpsFor(parts, game, resolution, preset, model) {
  const r = estimateBuildPerformance({ parts, resolution, presetId: preset.id, model, games: [game] })
  return r?.games.find((x) => x.presetId === preset.id && x.upscaling === preset.upscaling) ?? null
}

// What a sensible game build is made from: enough memory (as two sticks, so it
// runs dual-channel), SSD storage (an HDD boot drive was the cheapest 1TB part,
// so it got picked for a £1,500 gaming PC) and a cooler with the capacity for
// the chip's base power. No catalogue cooler carries a published rating, so
// capacity is coolerCapacityW's estimate — the one the Performance tab's
// Cooling verdict uses. Base power, not full boost: the estimate caps air
// coolers at 220 W, so full boost would force a 360mm AIO onto every build with
// a 250 W chip. Coolers of unknown capacity are kept only if nothing known fits.
export function sensibleCatalog(cpu, parts) {
  const coolers = parts.filter((p) => p.category === 'cooler')
  const known = coolers.filter((p) => coolerCapacityW(p) >= (cpu.tdp ?? 0))
  const okCooler = new Set(known.length > 0 ? known : coolers.filter((p) => coolerCapacityW(p) === 0))
  return parts.filter((p) =>
    (p.category !== 'ram' || ((p.capacityGb ?? 0) >= NEEDS.ramGb && (p.specs?.sticks ?? 1) >= 2)) &&
    (p.category !== 'storage' || ((p.capacityGb ?? 0) >= NEEDS.storageGb && p.storageType !== 'HDD')) &&
    (p.category !== 'cooler' || okCooler.has(p)))
}

// The cheapest SENSIBLE complete build around a CPU and GPU, so nothing in it
// trips a build warning. autoBuild with a zero budget fills every empty
// category with its cheapest compatible part and sizes the PSU to the peak.
export function completeBuild(cpu, gpu, parts, resolution) {
  const build = autoBuild({ cpu, gpu }, 0, sensibleCatalog(cpu, parts), resolution)
  return ESSENTIAL.every((c) => build[c]) ? build : null
}

const option = (build, row) => ({
  parts: build, total: sumPrice(build), fps: row.avgFps, lowFps: row.lowFps, basis: row.basis, bound: row.bound,
})

export function buildForGame({ game, preset, resolution, targetFps, budget, parts, model }) {
  const cpus = parts.filter((p) => p.category === 'cpu' && !p.legacy)
  const gpus = parts.filter((p) => p.category === 'gpu' && !p.legacy)

  const pairs = []
  for (const cpu of cpus) {
    for (const gpu of gpus) {
      const row = fpsFor({ cpu, gpu }, game, resolution, preset, model)
      if (row?.avgFps == null) continue
      // A ceiling ("up to", no CPU term) cannot see the CPU, so on its own it
      // would pair a flagship card with the weakest chip. Such a pair counts
      // only if the site's own balance rule — the one the CustomPC score uses —
      // does not call it CPU-limited.
      if (row.limitedBy == null && computeBottleneck(cpu, gpu, resolution)?.limitedBy === 'cpu') continue
      pairs.push({ cpu, gpu, row, core: cpu.price + gpu.price })
    }
  }
  if (pairs.length === 0) return { noData: true, unreachable: false, best: null, cheapestHit: null, fastest: null }

  // Completing a pair costs ~0.5 ms, so builds are made lazily and memoised;
  // the engine call per pair is the cheap part.
  const memo = new Map()
  const complete = (p) => {
    const k = `${p.cpu.id}|${p.gpu.id}`
    if (!memo.has(k)) memo.set(k, completeBuild(p.cpu, p.gpu, parts, resolution))
    return memo.get(k)
  }

  const fastFirst = [...pairs].sort(compareFastFirst)

  let fastest = null
  for (const p of fastFirst) {
    const b = complete(p)
    if (b) { fastest = option(b, p.row); break }
  }

  // ponytail: a linear walk down the FPS ranking; worst case completes every
  // pair (~2 s) when the budget is below every complete build. Add a per-CPU
  // platform floor to the `core` bound if that ever shows up in use.
  let best = null
  for (const p of fastFirst) {
    if (p.core > budget) continue
    const b = complete(p)
    if (b && sumPrice(b) <= budget) { best = option(b, p.row); break }
  }

  const unreachable = !pairs.some((p) => p.row.avgFps >= targetFps)

  let cheapestHit = null
  if (!unreachable && !(best && best.fps >= targetFps)) {
    const cheapFirst = pairs.filter((p) => p.row.avgFps >= targetFps).sort((a, b) =>
      (a.core - b.core) || (b.row.avgFps - a.row.avgFps) || measuredFirst(a, b) || byId(a.cpu.id, b.cpu.id) || byId(a.gpu.id, b.gpu.id))
    for (const p of cheapFirst) {
      // CPU + GPU alone already costs more than the cheapest whole build found.
      if (cheapestHit && p.core >= cheapestHit.total) break
      const b = complete(p)
      if (!b) continue
      const t = sumPrice(b)
      if (!cheapestHit || t < cheapestHit.total) cheapestHit = option(b, p.row)
    }
  }

  return { noData: false, unreachable, best, cheapestHit, fastest }
}
