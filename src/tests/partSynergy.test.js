import { describe, it, expect } from 'vitest'
import { partSynergy, coolerCapacityW, systemDrawW } from '../lib/partSynergy'

const cpuBig = { id: 'c', category: 'cpu', perfScore: 95, tdp: 170 }
const cpuTiny = { id: 'ct', category: 'cpu', perfScore: 20, tdp: 65 }
const gpuBig = { id: 'g', category: 'gpu', perfScore: 100, tdp: 450, specs: { vram: 8 } }

describe('helpers', () => {
  it('systemDrawW sums tdp of present parts', () => {
    expect(systemDrawW({ cpu: cpuBig, gpu: gpuBig })).toBe(620)
  })
  it('coolerCapacityW rates AIO by radiator and air by height', () => {
    expect(coolerCapacityW({ specs: { type: 'AIO', radiatorMm: 360 } })).toBe(320)
    expect(coolerCapacityW({ specs: { type: 'Air', height: 165 } })).toBe(220)
    expect(coolerCapacityW({ specs: {} })).toBe(0)
  })
})

describe('partSynergy', () => {
  it('caps a tiny CPU behind a big GPU but floors it at 25 (gaming)', () => {
    const s = partSynergy({ cpu: cpuTiny, gpu: gpuBig }, 'cpu', 'gaming')
    expect(s.balance).toBeGreaterThanOrEqual(25)
    expect(s.balance).toBeLessThan(60)
    // Names the GPU it is holding back, and explains why behind the disclosure.
    expect(s.reason).toMatch(/GPU/)
    expect(s.detail).toMatch(/frames/i)
  })
  it('ignores the CPU/GPU pairing for use cases that are not frame-paced', () => {
    // Nobody notices a "bottleneck" while writing email — docking office and
    // programming builds for one only made honest builds look broken.
    expect(partSynergy({ cpu: cpuTiny, gpu: gpuBig }, 'cpu', 'office').balance).toBe(100)
    expect(partSynergy({ cpu: cpuTiny, gpu: gpuBig }, 'cpu', 'programming').balance).toBe(100)
  })
  it('flags low VRAM on the GPU for creation', () => {
    const s = partSynergy({ cpu: cpuBig, gpu: gpuBig }, 'gpu', 'creation')
    expect(s.balance).toBeLessThan(60) // 8GB vs 16 target -> 50
    expect(s.reason).toMatch(/vram/i)
  })
  it('flags low RAM capacity for programming', () => {
    const s = partSynergy({ cpu: cpuBig, gpu: gpuBig, ram: { category: 'ram', capacityGb: 8 } }, 'ram', 'programming')
    expect(s.balance).toBe(25) // 8/32
    expect(s.reason).toMatch(/ram/i)
  })
  it('flags a PSU with no headroom', () => {
    const s = partSynergy({ cpu: cpuBig, gpu: gpuBig, psu: { category: 'psu', wattage: 600 } }, 'psu', 'gaming')
    expect(s.balance).toBeLessThan(100) // 600 vs 620*1.3=806
    expect(s.reason).toMatch(/headroom/i)
  })
  it('flags an undersized cooler for the CPU', () => {
    const s = partSynergy({ cpu: cpuBig, gpu: gpuBig, cooler: { category: 'cooler', specs: { type: 'Air', height: 100 } } }, 'cooler', 'gaming')
    expect(s.balance).toBeLessThan(100) // 80W cap vs 170W CPU
    expect(s.reason).toMatch(/170W/)
    expect(s.detail).toMatch(/throttl|clock/i)
  })
  it('never penalises missing metadata (GPU with no vram field)', () => {
    const s = partSynergy({ cpu: cpuBig, gpu: { category: 'gpu', perfScore: 100, tdp: 300 } }, 'gpu', 'creation')
    expect(s.balance).toBe(100)
  })
  it('returns null for categories with no pairwise partner (case)', () => {
    expect(partSynergy({ cpu: cpuBig, gpu: gpuBig, case: { category: 'case' } }, 'case', 'gaming')).toBeNull()
  })
})
