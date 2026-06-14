import { estimateFps } from './fpsEstimate'

// Performance points per £100 spent — higher is better value.
export function valuePerPound(part) {
  if (!part || !part.price || !part.perfScore) return 0
  return part.perfScore / (part.price / 100)
}

// Build-level value: estimated FPS at the given resolution per £100 of total
// build cost. Defaults to 1440p when no resolution is supplied.
export function buildValuePerPound(cpu, gpu, totalPrice, resolution = '1440p') {
  if (!cpu || !gpu || !totalPrice) return 0
  return estimateFps(cpu, gpu, resolution) / (totalPrice / 100)
}
