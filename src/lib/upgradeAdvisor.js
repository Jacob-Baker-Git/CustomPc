import { estimateFps } from './fpsEstimate'
import { checkCompatibility } from './compatibility'

// Only CPU/GPU swaps move the FPS needle, so those are the upgrade candidates.
const UPGRADEABLE = ['gpu', 'cpu']

export function suggestUpgrade(selectedParts, budget, catalog, resolution = '1440p') {
  const cpu = selectedParts.cpu
  const gpu = selectedParts.gpu
  if (!cpu || !gpu) return null

  const totalSpent = Object.values(selectedParts).reduce((sum, p) => sum + (p?.price ?? 0), 0)
  const remaining = budget - totalSpent
  const baseFps = estimateFps(cpu, gpu, resolution)

  let best = null
  for (const category of UPGRADEABLE) {
    const current = selectedParts[category]
    if (!current) continue

    for (const cand of catalog) {
      if (cand.category !== category) continue
      if ((cand.perfScore ?? 0) <= (current.perfScore ?? 0)) continue

      const extraCost = cand.price - current.price
      if (extraCost > remaining) continue

      const { compatible } = checkCompatibility(selectedParts, cand)
      if (!compatible) continue

      const nextParts = { ...selectedParts, [category]: cand }
      const fpsGain = estimateFps(nextParts.cpu, nextParts.gpu, resolution) - baseFps
      if (fpsGain <= 0) continue

      const better =
        !best ||
        fpsGain > best.fpsGain ||
        (fpsGain === best.fpsGain && extraCost < best.extraCost)
      if (better) best = { category, fromPart: current, toPart: cand, fpsGain, extraCost }
    }
  }
  return best
}
