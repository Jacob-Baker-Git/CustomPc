import { estimateFps } from './fpsEstimate'

export const FPS_TARGETS = [60, 120, 144]

// Per-game FPS = the generic perfScore estimate scaled by the game's fpsFactor
// (esports > 1, demanding AAA < 1). An estimate, not a benchmark.
export function gameFps(cpu, gpu, resolution, game) {
  if (!cpu || !gpu || !game) return 0
  return Math.round(estimateFps(cpu, gpu, resolution) * (game.fpsFactor ?? 1))
}
