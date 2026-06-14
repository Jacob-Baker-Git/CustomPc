import { estimateFps } from './fpsEstimate'

// Performance points per £100 spent — higher is better value.
export function valuePerPound(part) {
  if (!part || !part.price || !part.perfScore) return 0
  return part.perfScore / (part.price / 100)
}

// Build-level value: estimated 1440p FPS per £100 of total build cost.
export function buildValuePerPound(cpu, gpu, totalPrice) {
  if (!cpu || !gpu || !totalPrice) return 0
  return estimateFps(cpu, gpu, '1440p') / (totalPrice / 100)
}
