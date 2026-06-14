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

  it('reports a well-matched pair as balanced (high balancePct, limitedBy none)', () => {
    const r = computeBottleneck(strongCpu, strongGpu, '1440p')
    expect(r.balancePct).toBeGreaterThanOrEqual(90)
    expect(r.limitedBy).toBe('none')
  })

  it('flags the CPU as the limiter when a weak CPU pairs a strong GPU', () => {
    const r = computeBottleneck(weakCpu, strongGpu, '1080p')
    expect(r.limitedBy).toBe('cpu')
    expect(r.balancePct).toBeLessThan(80)
    expect(r.verdict).toMatch(/cpu/i)
  })

  it('flags the GPU as the limiter when a weak GPU pairs a strong CPU', () => {
    const r = computeBottleneck(strongCpu, weakGpu, '4k')
    expect(r.limitedBy).toBe('gpu')
    expect(r.verdict).toMatch(/gpu/i)
  })

  it('mentions the chosen resolution in the verdict', () => {
    const r = computeBottleneck(strongCpu, strongGpu, '4k')
    expect(r.verdict).toMatch(/4k/i)
  })

  it('always returns a balancePct between 0 and 100', () => {
    for (const res of ['1080p', '1440p', '4k']) {
      const r = computeBottleneck(weakCpu, strongGpu, res)
      expect(r.balancePct).toBeGreaterThanOrEqual(0)
      expect(r.balancePct).toBeLessThanOrEqual(100)
    }
  })
})
