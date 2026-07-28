import { resFactors } from './fpsEstimate'

// Graphics presets lean on the GPU side: dropping settings mostly relieves the
// graphics card. The CPU also gains a little (draw distance, shadows and crowd
// settings cost CPU too), so every game improves at lower presets — CPU-bound
// titles just improve less.
export const QUALITY_LEVELS = ['low', 'medium', 'high']
const QUALITY_GPU = { low: 1.45, medium: 1.2, high: 1.0 }
const QUALITY_CPU = { low: 1.15, medium: 1.07, high: 1.0 }

// Per-game FPS on the perfScore scale. Each game scales the GPU side
// (fpsFactor) and the CPU frame ceiling (cpuFactor) separately, so CPU-bound
// titles (Tarkov, Minecraft) and GPU-bound ones (Alan Wake 2) both behave
// believably. Engines with a frame cap declare `fpsCap` (e.g. Elden Ring 60).
// An estimate, not a benchmark.
export function gameFps(cpu, gpu, resolution, game, quality = 'high') {
  if (!cpu || !gpu || !game) return 0
  const f = resFactors(resolution)
  const gpuFps = (gpu.perfScore ?? 0) * f.gpu
    * (game.fpsFactor ?? 1) * (QUALITY_GPU[quality] ?? 1)
  const cpuCeil = (cpu.perfScore ?? 0) * f.cpu
    * (game.cpuFactor ?? game.fpsFactor ?? 1) * (QUALITY_CPU[quality] ?? 1)
  return Math.round(Math.min(gpuFps, cpuCeil, game.fpsCap ?? Infinity))
}
