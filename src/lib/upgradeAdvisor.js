import { estimateFps } from './fpsEstimate'
import { checkCompatibility } from './compatibility'

// Only CPU/GPU swaps move the FPS needle, so those are the upgrade candidates.
const UPGRADEABLE = ['gpu', 'cpu']

// Suggestions below this aren't worth the hassle of a swap.
const MIN_GAIN = 5

// Among candidates whose gain is within this fraction of the best gain,
// prefer the best FPS-per-pound — avoids recommending a £900 halo part over
// a nearly identical £60 swap.
const NEAR_BEST = 0.85

const valueOf = (c) => (c.extraCost <= 0 ? Infinity : c.fpsGain / c.extraCost)

export function suggestUpgrade(selectedParts, budget, catalog, resolution = '1440p') {
  const cpu = selectedParts.cpu
  const gpu = selectedParts.gpu
  if (!cpu || !gpu) return null

  const totalSpent = Object.values(selectedParts).reduce((sum, p) => sum + (p?.price ?? 0), 0)
  const remaining = budget - totalSpent
  const baseFps = estimateFps(cpu, gpu, resolution)

  const candidates = []
  for (const category of UPGRADEABLE) {
    const current = selectedParts[category]
    if (!current) continue

    for (const cand of catalog) {
      if (cand.category !== category) continue
      if ((cand.perfScore ?? 0) <= (current.perfScore ?? 0)) continue

      const extraCost = cand.price - current.price
      if (extraCost > remaining) continue

      // Covers sockets, board fit, case clearance and PSU power headroom.
      const { compatible } = checkCompatibility(selectedParts, cand)
      if (!compatible) continue

      const nextParts = { ...selectedParts, [category]: cand }
      const fpsGain = estimateFps(nextParts.cpu, nextParts.gpu, resolution) - baseFps
      if (fpsGain < MIN_GAIN) continue

      candidates.push({ category, fromPart: current, toPart: cand, fpsGain, extraCost })
    }
  }
  if (candidates.length === 0) return null

  const bestGain = Math.max(...candidates.map((c) => c.fpsGain))
  return candidates
    .filter((c) => c.fpsGain >= NEAR_BEST * bestGain)
    .sort((a, b) => {
      const va = valueOf(a)
      const vb = valueOf(b)
      if (va !== vb) return va === Infinity ? -1 : vb === Infinity ? 1 : vb - va
      return b.fpsGain - a.fpsGain || a.extraCost - b.extraCost
    })[0]
}
