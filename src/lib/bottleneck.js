// Resolution weights: how much the CPU vs GPU drives performance at each target.
// Lower resolution leans on the CPU; higher leans on the GPU. A weakness in the
// component the resolution stresses most (CPU at 1080p, GPU at 4K) bites harder.
const WEIGHTS = {
  '1080p': { cpu: 0.6, gpu: 0.4 },
  '1440p': { cpu: 0.5, gpu: 0.5 },
  '4k':    { cpu: 0.35, gpu: 0.65 },
}

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

export function computeBottleneck(cpu, gpu, resolution) {
  if (!cpu || !gpu) return null

  const w = WEIGHTS[resolution] ?? WEIGHTS['1440p']
  const label = RES_LABEL[resolution] ?? resolution

  const cpuScore = cpu.perfScore ?? 0
  const gpuScore = gpu.perfScore ?? 0

  // The weaker component is the limiter; the gap between the two sets the
  // severity, amplified by how hard this resolution leans on the weaker part.
  const weakerIsCpu = cpuScore < gpuScore
  const weaker = Math.min(cpuScore, gpuScore)
  const stronger = Math.max(cpuScore, gpuScore) || 1
  const gap = 1 - weaker / stronger                  // 0 = identical
  const stress = weakerIsCpu ? w.cpu : w.gpu          // 0.35..0.65
  const severity = Math.min(1, gap * stress * 2)      // stress*2 in 0.7..1.3
  const balancePct = Math.round((1 - severity) * 100)

  let limitedBy = 'none'
  if (balancePct < 85) limitedBy = weakerIsCpu ? 'cpu' : 'gpu'

  let verdict
  if (limitedBy === 'none') {
    verdict = `Well matched for ${label}`
  } else if (limitedBy === 'cpu') {
    verdict = `Your CPU can't keep up with this GPU at ${label} — the GPU is overkill`
  } else {
    verdict = `Your GPU is holding the CPU back at ${label}`
  }

  return { balancePct, limitedBy, verdict }
}
