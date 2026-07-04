import { autoBuild } from './autoBuilder'
import { gameFps } from './gameFps'

const SUPPORT = ['motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']

// Rough floor for everything that isn't the CPU/GPU pair, so the pair search
// can't spend money the supporting parts will need. autoBuild enforces real
// compatibility later; this is only a budget reserve.
function supportReserve(partsData) {
  return SUPPORT.reduce((sum, cat) => {
    const cheapest = partsData
      .filter((p) => p.category === cat)
      .reduce((min, p) => (min && min.price <= p.price ? min : p), null)
    return sum + (cheapest?.price ?? 0)
  }, 0)
}

// Build to an FPS target: pick the cheapest CPU+GPU pair whose estimated FPS in
// `game` at `resolution` meets `targetFps`, then fill the rest of the build with
// autoBuild. If no affordable pair hits the target, fall back to the best
// full-budget build and report `met: false`.
export function targetBuild(budget, resolution, targetFps, game, partsData) {
  const cpus = partsData.filter((p) => p.category === 'cpu')
  const gpus = partsData.filter((p) => p.category === 'gpu')
  const pairBudget = budget - supportReserve(partsData)

  let best = null
  for (const cpu of cpus) {
    for (const gpu of gpus) {
      const price = cpu.price + gpu.price
      if (price > pairBudget) continue
      const fps = gameFps(cpu, gpu, resolution, game)
      if (fps < targetFps) continue
      if (!best || price < best.price || (price === best.price && fps > best.fps)) {
        best = { cpu, gpu, price, fps }
      }
    }
  }

  const seed = best ? { cpu: best.cpu, gpu: best.gpu } : {}
  const parts = autoBuild(seed, budget, partsData, resolution)
  return {
    parts,
    met: Boolean(best),
    estFps: gameFps(parts.cpu, parts.gpu, resolution, game),
  }
}
