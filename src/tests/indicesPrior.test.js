import { describe, it, expect } from 'vitest'
import { cpuIndexFor, gpuIndexFor, hasCoverage } from '../lib/perfEngine/indices'

const model = {
  cpuIndex: { 'cpu-known': { value: 70, basis: 'measured', anchors: 12 } },
  gpuIndex: { 'gpu-known': { '1440p': 60, basis: 'measured', anchors: 9 } },
  gameConst: { g: { '1440p': { 'high|native': { A: 400, B: 402 } } } },
  prior: {
    cpu: {
      form: 'linear', slope: 0.52, intercept: 34.04, n: 24, domain: [40, 106],
      bands: [{ minPerfScore: 0, maxPerfScore: null, looMedianPct: 5.5, looP90Pct: 13.5, parts: 24 }],
    },
    gpu: {
      '1440p': {
        form: 'loglog', slope: 1.2, intercept: -1, n: 40, domain: [15, 132],
        bands: [{ minPerfScore: 0, maxPerfScore: null, looMedianPct: 6.7, looP90Pct: 13.5, parts: 40 }],
      },
    },
  },
}

describe('index accessors fall back to the prior', () => {
  it('prefers a measurement over the prior', () => {
    const out = cpuIndexFor(model, { id: 'cpu-known', perfScore: 78 })
    expect(out.basis).toBe('measured')
    expect(out.value).toBe(70)
    expect(out.errorPct).toBeNull()
  })

  it('uses the prior for an unmeasured chip that has a perfScore', () => {
    const out = cpuIndexFor(model, { id: 'cpu-new', perfScore: 78 })
    expect(out.basis).toBe('prior')
    expect(out.value).toBeCloseTo(0.52 * 78 + 34.04, 5)
    expect(out.errorPct).toBe(5.5)
  })

  it('still reports none for a part with no measurement AND no perfScore', () => {
    // A gap in the catalogue is not evidence of a slow part, and inventing a
    // perfScore to feed the prior would be the fabrication this all avoids.
    expect(cpuIndexFor(model, { id: 'cpu-new' }).basis).toBe('none')
    expect(gpuIndexFor(model, { id: 'gpu-new' }, '1440p').basis).toBe('none')
  })

  it('uses the per-resolution GPU prior', () => {
    const out = gpuIndexFor(model, { id: 'gpu-new', perfScore: 50 }, '1440p')
    expect(out.basis).toBe('prior')
    expect(out.value).toBeGreaterThan(0)
    expect(out.errorPct).toBe(6.7)
  })

  it('reports none where no prior was fitted for that resolution', () => {
    expect(gpuIndexFor(model, { id: 'gpu-new', perfScore: 50 }, '4k').basis).toBe('none')
  })

  it('carries the extrapolation flag out to the caller', () => {
    // rowBasis turns this into the `index-extrapolated` caveat. If it stopped
    // here, a regression applied outside its fitted range would render exactly
    // like one applied inside it.
    expect(cpuIndexFor(model, { id: 'cpu-new', perfScore: 200 }).extrapolated).toBe(true)
    expect(cpuIndexFor(model, { id: 'cpu-new', perfScore: 78 }).extrapolated).toBe(false)
  })

  it('never marks a measured index as extrapolated', () => {
    expect(cpuIndexFor(model, { id: 'cpu-known', perfScore: 200 }).extrapolated).toBeFalsy()
  })

  it('leaves a prior-derived index out of hasCoverage', () => {
    // hasCoverage asks whether this combination can be answered FROM MEASUREMENT
    // ALONE. Wiring the prior into the accessors makes `value > 0` true for a
    // part nobody ever benchmarked, so a `value`-based test would silently start
    // answering a different question under the same name.
    const covered = { cpu: { id: 'cpu-known' }, gpu: { id: 'gpu-known' }, game: { id: 'g' },
                      resolution: '1440p', presetId: 'high', upscaling: 'native' }
    expect(hasCoverage(model, covered)).toBe(true)

    // Same cell, same GPU, a CPU that only the prior can price.
    expect(hasCoverage(model, { ...covered, cpu: { id: 'cpu-new', perfScore: 78 } })).toBe(false)
    expect(hasCoverage(model, { ...covered, gpu: { id: 'gpu-new', perfScore: 50 } })).toBe(false)
  })
})
