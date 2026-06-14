// Transparent FPS heuristic on the 0–100 perfScore scale. FPS is GPU-bound at
// higher resolutions; a weak CPU sets a frame ceiling that bites hardest at low
// resolution (mirrors the bottleneck model). Clearly an estimate, not a benchmark.
const RES_GPU = { '1080p': 2.0, '1440p': 1.5, '4k': 0.95 } // fps per GPU perf point
const RES_CPU = { '1080p': 2.4, '1440p': 2.2, '4k': 2.0 }  // CPU frame-ceiling factor

export function estimateFps(cpu, gpu, resolution) {
  if (!cpu || !gpu) return 0
  const res = String(resolution ?? '1440p').toLowerCase()
  const gpuFactor = RES_GPU[res] ?? RES_GPU['1440p']
  const cpuFactor = RES_CPU[res] ?? RES_CPU['1440p']
  const gpuFps = (gpu.perfScore ?? 0) * gpuFactor
  const cpuCeil = (cpu.perfScore ?? 0) * cpuFactor
  return Math.round(Math.min(gpuFps, cpuCeil))
}
