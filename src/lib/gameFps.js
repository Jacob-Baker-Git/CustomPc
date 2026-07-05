import { RES_GPU, RES_CPU } from './fpsEstimate'

export const FPS_TARGETS = [60, 120, 144]

// Graphics presets scale the GPU side only: dropping settings relieves the
// graphics card but does nothing for a CPU-bound game, which is why esports
// titles gain little from Low while AAA games gain a lot.
export const QUALITY_LEVELS = ['low', 'medium', 'high']
const QUALITY_GPU = { low: 1.45, medium: 1.2, high: 1.0 }

// Per-game FPS on the perfScore scale. Each game scales the GPU side
// (fpsFactor) and the CPU frame ceiling (cpuFactor) separately, so CPU-bound
// titles (Tarkov, Minecraft) and GPU-bound ones (Alan Wake 2) both behave
// believably. Engines with a frame cap declare `fpsCap` (e.g. Elden Ring 60).
// An estimate, not a benchmark.
export function gameFps(cpu, gpu, resolution, game, quality = 'high') {
  if (!cpu || !gpu || !game) return 0
  const res = String(resolution ?? '1440p').toLowerCase()
  const gpuFps = (gpu.perfScore ?? 0) * (RES_GPU[res] ?? RES_GPU['1440p'])
    * (game.fpsFactor ?? 1) * (QUALITY_GPU[quality] ?? 1)
  const cpuCeil = (cpu.perfScore ?? 0) * (RES_CPU[res] ?? RES_CPU['1440p'])
    * (game.cpuFactor ?? game.fpsFactor ?? 1)
  return Math.round(Math.min(gpuFps, cpuCeil, game.fpsCap ?? Infinity))
}
