import { computeBottleneck } from '../lib/bottleneck'

const strongCpu = { perfScore: 95 }
const weakCpu   = { perfScore: 45 }
const strongGpu = { perfScore: 95 }
const weakGpu   = { perfScore: 45 }

describe('computeBottleneck', () => {
  it('returns null when CPU or GPU is missing', () => {
    expect(computeBottleneck(null, strongGpu, '1080p')).toBeNull()
    expect(computeBottleneck(strongCpu, null, '1080p')).toBeNull()
  })

  it('reports equal-tier parts at 1440p as well matched', () => {
    const r = computeBottleneck(strongCpu, strongGpu, '1440p')
    expect(r.limitedBy).toBe('none')
    expect(r.balancePct).toBeGreaterThanOrEqual(80)
  })

  it('flags the CPU as the limiter when a weak CPU pairs a strong GPU', () => {
    const r = computeBottleneck(weakCpu, strongGpu, '1080p')
    expect(r.limitedBy).toBe('cpu')
    expect(r.balancePct).toBeLessThan(80)
    expect(r.verdict).toMatch(/cpu/i)
    // The verdict quantifies the loss so it's actionable.
    expect(r.verdict).toMatch(new RegExp(`~${r.gpuFps}`))
    expect(r.verdict).toMatch(new RegExp(`~${r.cpuFps}`))
  })

  it('compares delivered FPS, not raw scores: equal parts at 4K are GPU-bound', () => {
    // 95/95 at 4K: the GPU delivers ~90 fps while the CPU could feed ~190 —
    // that is GPU-bound, which raw-score comparison would miss entirely.
    const r = computeBottleneck(strongCpu, strongGpu, '4k')
    expect(r.gpuFps).toBeLessThan(r.cpuFps)
    expect(['none', 'gpu']).toContain(r.limitedBy)
  })

  it('flags heavy CPU overkill as GPU-bound with a calm explanation', () => {
    const r = computeBottleneck(strongCpu, weakGpu, '4k')
    expect(r.limitedBy).toBe('gpu')
    expect(r.verdict).toMatch(/normal at higher resolutions/i)
  })

  it('being mildly GPU-bound is healthy, not a warning', () => {
    // CPU delivering ~30% more than the GPU is the classic good build.
    const r = computeBottleneck({ perfScore: 80 }, { perfScore: 90 }, '1440p')
    expect(r.limitedBy).toBe('none')
  })

  it('mentions the chosen resolution in the verdict', () => {
    const r = computeBottleneck(strongCpu, strongGpu, '4k')
    expect(r.verdict).toMatch(/4k/i)
  })

  it('supports custom WxH resolutions', () => {
    const r = computeBottleneck(strongCpu, strongGpu, '3440x1440')
    expect(r).not.toBeNull()
    expect(r.balancePct).toBeGreaterThanOrEqual(0)
    expect(r.balancePct).toBeLessThanOrEqual(100)
    expect(r.verdict).toMatch(/3440x1440/)
  })

  it('always returns a balancePct between 0 and 100', () => {
    for (const res of ['1080p', '1440p', '4k', '2560x1080']) {
      const r = computeBottleneck(weakCpu, strongGpu, res)
      expect(r.balancePct).toBeGreaterThanOrEqual(0)
      expect(r.balancePct).toBeLessThanOrEqual(100)
    }
  })
})
