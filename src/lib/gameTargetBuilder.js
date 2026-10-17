import { estimateBuildPerformance } from './perfEngine'
import { autoBuild } from './autoBuilder'
import { presetsFor } from './gamePresets'
import { BUILD_PROFILES } from './buildProfiles'
import { computeBottleneck } from './bottleneck'
import { coolerCapacityW } from './partSynergy'
import perfGames from '../data/perfGames.json'

// How much frame rate a step up in price must buy to count as good value: the
// percentage gain in fps over the percentage rise in price. 1 = +5% price needs
// at least +5% fps. The one knob for how keen the Middle answer is to spend.
export const VALUE_BAR = 1

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
  if (pairs.length === 0) {
    return { noData: true, unreachable: false, best: null, middle: null, cheapest: null, fastest: null, noValueStep: false }
  }

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
    if (b && sumPrice(b) <= budget) {
      // The fastest pair the budget allows, then whatever is left spent on the
      // rest of the build, scored as a gaming PC. The engine's frame rate
      // depends only on the pair, so the row stands.
      const full = autoBuild({ cpu: p.cpu, gpu: p.gpu }, budget, sensibleCatalog(p.cpu, parts), resolution,
                             { maximise: true, rateFor: 'gaming' })
      const spent = ESSENTIAL.every((c) => full[c]) && sumPrice(full) <= budget ? full : b
      best = option(spent, p.row)
      break
    }
  }

  const unreachable = !pairs.some((p) => p.row.avgFps >= targetFps)

  let cheapest = null
  if (!unreachable) {
    const cheapFirst = pairs.filter((p) => p.row.avgFps >= targetFps).sort((a, b) =>
      (a.core - b.core) || (b.row.avgFps - a.row.avgFps) || measuredFirst(a, b) || byId(a.cpu.id, b.cpu.id) || byId(a.gpu.id, b.gpu.id))
    for (const p of cheapFirst) {
      // CPU + GPU alone already costs more than the cheapest whole build found.
      if (cheapest && p.core >= cheapest.total) break
      const b = complete(p)
      if (!b) continue
      const t = sumPrice(b)
      if (!cheapest || t < cheapest.total) cheapest = option(b, p.row)
    }
  }

  const middlePossible = Boolean(cheapest && best && cheapest.total <= budget && best.fps > cheapest.fps)
  const middle = middlePossible ? valueStep(pairs, cheapest, best, complete) : null

  return { noData: false, unreachable, best, middle, cheapest, fastest, noValueStep: middlePossible && middle === null }
}

// Pairs strictly between two answers on both price and frame rate, as complete
// builds, keeping only those no other candidate beats on both (the frontier).
//
// ponytail: the frontier is taken on CPU+GPU price before completion, so a pair
// whose platform is unusually cheap can be missed; complete every candidate if
// that shows up.
function frontierBetween(pairs, low, high, complete) {
  const inRange = pairs.filter((p) => p.row.avgFps > low.fps && p.row.avgFps < high.fps && p.core < high.total)
    .sort((a, b) => (a.core - b.core) || (b.row.avgFps - a.row.avgFps) || measuredFirst(a, b))
  const onCore = []
  let topFps = -Infinity
  for (const p of inRange) if (p.row.avgFps > topFps) { onCore.push(p); topFps = p.row.avgFps }
  const built = onCore.map((p) => { const b = complete(p); return b && option(b, p.row) })
    .filter((o) => o && o.total > low.total && o.total < high.total)
    .sort((a, b) => (a.total - b.total) || (b.fps - a.fps))
  const frontier = []
  topFps = -Infinity
  for (const o of built) if (o.fps > topFps) { frontier.push(o); topFps = o.fps }
  return frontier
}

// The best-value build above the cheapest: climb from it, each time to the
// point above that buys the most frame rate per pound — as long as the
// percentage gain in frame rate is at least VALUE_BAR times the percentage rise
// in price. Looking at every point above, not just the next, lets it pass a
// poor step to reach a good one further up. Null when no step clears the bar.
function valueStep(pairs, cheapest, best, complete) {
  const frontier = frontierBetween(pairs, cheapest, best, complete)
  let cur = cheapest
  for (;;) {
    let next = null
    let bestRatio = VALUE_BAR
    for (const c of frontier) {
      if (c.total <= cur.total || c.fps <= cur.fps) continue
      const ratio = ((c.fps - cur.fps) / cur.fps) / ((c.total - cur.total) / cur.total)
      if (ratio >= bestRatio) { bestRatio = ratio; next = c }
    }
    if (!next) break
    cur = next
  }
  return cur === cheapest ? null : cur
}
