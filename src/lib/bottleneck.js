import { resFactors } from './fpsEstimate'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

// Compares what each side actually delivers at this resolution on the FPS
// model (comparable units), not raw perf scores. A mildly GPU-bound build is
// the healthy normal state — only CPU limits and extreme CPU-overkill get
// flagged. Custom "WxH" resolutions work via resFactors interpolation.
export function computeBottleneck(cpu, gpu, resolution) {
  if (!cpu || !gpu) return null

  const label = RES_LABEL[resolution] ?? resolution
  const f = resFactors(resolution)
  const gpuFps = Math.round((gpu.perfScore ?? 0) * f.gpu)
  const cpuFps = Math.round((cpu.perfScore ?? 0) * f.cpu)

  const weakerIsCpu = cpuFps < gpuFps
  const ratio = Math.min(gpuFps, cpuFps) / (Math.max(gpuFps, cpuFps) || 1)

  // CPU-limited wastes GPU money — score it by the raw ratio. GPU-limited is
  // expected (the GPU should be the limiter), so it scores on a gentler scale
  // and only drops below "matched" when the CPU is heavily overspecced.
  const balancePct = weakerIsCpu
    ? Math.round(ratio * 100)
    : Math.round(50 + ratio * 50)

  let limitedBy = 'none'
  if (weakerIsCpu && balancePct < 85) limitedBy = 'cpu'
  else if (!weakerIsCpu && balancePct < 75) limitedBy = 'gpu'

  let verdict
  if (limitedBy === 'none') {
    verdict = `Well matched for ${label}`
  } else if (limitedBy === 'cpu') {
    verdict = `CPU bottleneck at ${label}: the GPU could render ~${gpuFps} fps but the CPU caps it near ~${cpuFps}`
  } else {
    verdict = `GPU-bound at ${label}: ~${gpuFps} fps with ~${cpuFps} of CPU headroom. Normal at higher resolutions; drop settings or resolution for more frames`
  }

  return { balancePct, limitedBy, verdict, cpuFps, gpuFps }
}
