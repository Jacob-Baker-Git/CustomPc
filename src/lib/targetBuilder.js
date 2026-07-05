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
// autoBuild. Tries High settings first, then Medium and Low — an aggressive
// esports target (360fps for a 360Hz monitor) is often reachable by dropping
// the preset, and that beats telling the user it's impossible. Only when even
// Low can't hit it does the result report `met: false`.
export function targetBuild(budget, resolution, targetFps, game, partsData) {
  const cpus = partsData.filter((p) => p.category === 'cpu')
  const gpus = partsData.filter((p) => p.category === 'gpu')
  const pairBudget = budget - supportReserve(partsData)

  let best = null
  let quality = 'low'
  for (const q of ['high', 'medium', 'low']) {
    for (const cpu of cpus) {
      for (const gpu of gpus) {
        const price = cpu.price + gpu.price
        if (price > pairBudget) continue
        const fps = gameFps(cpu, gpu, resolution, game, q)
        if (fps < targetFps) continue
        if (!best || price < best.price || (price === best.price && fps > best.fps)) {
          best = { cpu, gpu, price, fps }
        }
      }
    }
    if (best) {
      quality = q
      break
    }
  }

  const seed = best ? { cpu: best.cpu, gpu: best.gpu } : {}
  const parts = autoBuild(seed, budget, partsData, resolution)
  return {
    parts,
    met: Boolean(best),
    quality, // preset the estimate assumes; 'low' = best case when unmet
    estFps: gameFps(parts.cpu, parts.gpu, resolution, game, quality),
  }
}
