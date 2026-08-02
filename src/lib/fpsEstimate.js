// Transparent FPS heuristic on the perfScore scale (~100 anchors last-gen
// flagships like the RTX 4090 / i9-14900K; current flagships exceed it). FPS is
// GPU-bound at higher resolutions; a weak CPU sets a frame ceiling that bites
// hardest at low resolution (mirrors the bottleneck model). An estimate, not a benchmark.
export const RES_GPU = { '1080p': 2.0, '1440p': 1.5, '4k': 0.95 } // fps per GPU perf point
const RES_CPU = { '1080p': 2.4, '1440p': 2.2, '4k': 2.0 }  // CPU frame-ceiling factor

// Megapixel counts of the calibrated presets — the anchors that custom
// resolutions (ultrawide, 5K, ...) interpolate between.
const PRESET_MP = { '1080p': 2.0736, '1440p': 3.6864, '4k': 8.2944 }

// "3440x1440" → megapixels; null when the string isn't a WxH resolution.
function resolutionMegapixels(resolution) {
  const m = /^(\d{3,4})\s*[x×]\s*(\d{3,4})$/.exec(String(resolution ?? '').trim().toLowerCase())
  if (!m) return null
  return (Number(m[1]) * Number(m[2])) / 1e6
}

// Piecewise-linear interpolation of a preset-keyed factor table over
// megapixels; past the ends it extrapolates along the nearest segment,
// clamped to [min, max] so absurd inputs stay believable.
function lerpFactorByMp(table, mp, min, max) {
  const pts = ['1080p', '1440p', '4k'].map((k) => [PRESET_MP[k], table[k]])
  const [a, b] = mp <= pts[1][0] ? [pts[0], pts[1]] : [pts[1], pts[2]]
  const t = (mp - a[0]) / (b[0] - a[0])
  const value = a[1] + t * (b[1] - a[1])
  return Math.min(max, Math.max(min, value))
}

// {gpu, cpu} factors for any resolution: presets directly, "WxH" strings by
// pixel-count interpolation, anything else falls back to 1440p.
export function resFactors(resolution) {
  const res = String(resolution ?? '1440p').toLowerCase()
  if (res in RES_GPU) return { gpu: RES_GPU[res], cpu: RES_CPU[res] }
  const mp = resolutionMegapixels(res)
  if (mp == null) return { gpu: RES_GPU['1440p'], cpu: RES_CPU['1440p'] }
  return {
    gpu: lerpFactorByMp(RES_GPU, mp, 0.35, 2.6),
    cpu: lerpFactorByMp(RES_CPU, mp, 1.8, 2.6),
  }
}

export function estimateFps(cpu, gpu, resolution) {
  if (!cpu || !gpu) return 0
  const f = resFactors(resolution)
  const gpuFps = (gpu.perfScore ?? 0) * f.gpu
  const cpuCeil = (cpu.perfScore ?? 0) * f.cpu
  return Math.round(Math.min(gpuFps, cpuCeil))
}
