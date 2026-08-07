import { describe, it, expect } from 'vitest'
import { gpuCapability, cpuCapability, teraflops, ARCH_EFFICIENCY, ARCH_CALIBRATED }
  from '../lib/perfEngine/capability'
import gpuSpecs from '../../data/specs/gpuSpecs.json'
import cpuSpecs from '../../data/specs/cpuSpecs.json'
import partsData from '../data/partsData.json'

const part = (id) => partsData.find((p) => p.id === id)
const gpuIdx = (id) => gpuCapability({ id }, gpuSpecs).index
const cpuIdx = (id) => cpuCapability(part(id), cpuSpecs).index

describe('teraflops', () => {
  it('is shaders x clock x 2, the published convention', () => {
    // RTX 4090: 16384 x 2520 MHz x 2 = 82.6 TFLOPS
    expect(teraflops({ shaders: 16384, boostMhz: 2520 })).toBeCloseTo(82.6, 1)
  })

  it('returns null rather than 0 when a figure is missing', () => {
    expect(teraflops({ shaders: 16384 })).toBeNull()
    expect(teraflops(null)).toBeNull()
  })
})

describe('gpuCapability', () => {
  it('reports basis "none" for a card with no specs, never a silent fallback', () => {
    const r = gpuCapability({ id: 'gpu-does-not-exist' }, gpuSpecs)
    expect(r.index).toBeNull()
    expect(r.basis).toBe('none')
  })

  it('ranks the whole Ada Lovelace line correctly', () => {
    // Within one architecture the model is trustworthy, because the only
    // uncalibrated term — architecture efficiency — is constant across them.
    const ada = ['gpu-rtx-4090', 'gpu-rtx-4080-super', 'gpu-rtx-4080',
                 'gpu-rtx-4070ti-super', 'gpu-rtx-4070ti', 'gpu-rtx-4070-super',
                 'gpu-rtx-4070', 'gpu-rtx-4060ti', 'gpu-rtx-4060']
    const scores = ada.map(gpuIdx)
    expect(scores.every((s) => s > 0)).toBe(true)
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i], `${ada[i]} should rank below ${ada[i - 1]}`).toBeLessThan(scores[i - 1])
    }
  })

  it('ranks the Ampere line correctly', () => {
    const ampere = ['gpu-rtx-3090-ti', 'gpu-rtx-3090', 'gpu-rtx-3080-ti', 'gpu-rtx-3080',
                    'gpu-rtx-3070-ti', 'gpu-rtx-3070', 'gpu-rtx-3060-ti', 'gpu-rtx-3060-12gb',
                    'gpu-rtx-3050']
    const scores = ampere.map(gpuIdx)
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i], `${ampere[i]} should rank below ${ampere[i - 1]}`).toBeLessThan(scores[i - 1])
    }
  })

  it('ranks the RDNA 3 line correctly', () => {
    const rdna3 = ['gpu-rx-7900xtx', 'gpu-rx-7900xt', 'gpu-rx-7800xt', 'gpu-rx-7700xt', 'gpu-rx-7600']
    const scores = rdna3.map(gpuIdx)
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i], `${rdna3[i]} should rank below ${rdna3[i - 1]}`).toBeLessThan(scores[i - 1])
    }
  })

  it('declares itself uncalibrated across architectures', () => {
    // The 4060 Ti 8GB and 16GB differ only in memory SIZE, not bandwidth or
    // compute, so a spec-derived index cannot separate them — and should not
    // pretend to.
    expect(gpuIdx('gpu-rtx-4060ti')).toBe(gpuIdx('gpu-rtx-4060ti-16gb'))
    expect(ARCH_CALIBRATED).toBe(false)
    expect(gpuCapability({ id: 'gpu-rtx-4090' }, gpuSpecs).comparable).toBe('within-architecture')
  })

  it('every architecture present in the specs has an efficiency entry', () => {
    // A missing key would silently default to 1.0 and hide the fact that a
    // whole architecture was never calibrated.
    for (const spec of Object.values(gpuSpecs.gpus)) {
      expect(ARCH_EFFICIENCY[spec.architecture], `no entry for ${spec.architecture}`)
        .toBeGreaterThan(0)
    }
  })

  it('carries the vendor unit name, so callers cannot compare counts naively', () => {
    expect(gpuCapability({ id: 'gpu-rtx-4090' }, gpuSpecs).shaderUnit).toBe('CUDA cores')
    expect(gpuCapability({ id: 'gpu-rx-7900xtx' }, gpuSpecs).shaderUnit).toBe('stream processors')
    expect(gpuCapability({ id: 'gpu-intel-arc-b580' }, gpuSpecs).shaderUnit).toBe('Xe vector engines')
  })
})

describe('cpuCapability', () => {
  it('reports basis "none" without specs', () => {
    expect(cpuCapability(part('cpu-ryzen-5-5500'), cpuSpecs).basis).toBe('none')
  })

  it('does not punish Intel for E-cores in the cache term', () => {
    // 36 MB across 24 total cores looks thin; across the 8 a game actually
    // uses it is generous, and the second reading describes the frame. Before
    // this the i9-14900K fell below six-core parts.
    expect(cpuIdx('cpu-i9-14900k')).toBeGreaterThan(cpuIdx('cpu-i5-12400f'))
    expect(cpuIdx('cpu-i9-14900ks')).toBeGreaterThan(cpuIdx('cpu-i5-14600k'))
  })

  it('rewards stacked cache, which is why X3D parts win games', () => {
    // Same core count, LOWER clock, far more cache — and it should still win.
    expect(cpuIdx('cpu-ryzen-7-7800x3d')).toBeGreaterThan(cpuIdx('cpu-ryzen-7-7700x'))
  })

  it('saturates core count, because games cannot use sixteen', () => {
    // 9950X and 9700X share an architecture; the 16-core part leads on clock
    // alone, not on having twice the cores.
    const many = cpuCapability(part('cpu-ryzen-9-9950x'), cpuSpecs)
    const few = cpuCapability(part('cpu-ryzen-7-9700x'), cpuSpecs)
    expect(many.index / few.index).toBeLessThan(1.3)
  })

  it('marks the cache figure as single-sourced', () => {
    // The catalogue has no cache column, so nothing corroborates it.
    expect(cpuCapability(part('cpu-ryzen-7-9800x3d'), cpuSpecs).cacheBasis).toBe('single-sourced')
  })
})
