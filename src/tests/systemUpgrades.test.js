import { describe, it, expect } from 'vitest'
import { systemUpgrades } from '../lib/systemUpgrades'

const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const cpuHi = { id: 'cpu-hi', category: 'cpu', name: 'CPU Hi', price: 300, perfScore: 250, tdp: 105, socket: 'AM5' }
const gpuLo = { id: 'gpu-lo', category: 'gpu', name: 'GPU Lo', price: 200, perfScore: 300, tdp: 200, length: 250 }
const ram16 = { id: 'ram-16', category: 'ram', name: 'RAM 16', price: 60,  capacityGb: 16, ramType: 'DDR5', speed: 6000 }
const ram32 = { id: 'ram-32', category: 'ram', name: 'RAM 32', price: 110, capacityGb: 32, ramType: 'DDR5', speed: 6000 }
const game  = { id: 'g', name: 'G', fpsFactor: 1, cpuFactor: 1 }
const catalog = [cpuLo, cpuHi, gpuLo, ram16, ram32]
const goal = { game, resolution: '1080p', targetFps: 1 }

describe('systemUpgrades — byCat', () => {
  it('groups the CPU FPS upgrade under byCat.cpu', () => {
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo }, goal, 1000, catalog)
    expect(r.byCat.cpu.map((c) => c.toPart.id)).toContain('cpu-hi')
    expect(r.byCat.cpu[0].fpsGain).toBeGreaterThan(0)
  })
  it('offers a bigger RAM stick with a reason and no fps fields', () => {
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, ram: ram16 }, goal, 1000, catalog)
    const up = r.byCat.ram.find((c) => c.toPart.id === 'ram-32')
    expect(up).toBeTruthy()
    expect(up.extraCost).toBe(50)
    expect(up.reason).toMatch(/32GB/)
    expect(up.resultFps).toBeUndefined()
  })
  it('respects the upgrade budget for supporting parts', () => {
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, ram: ram16 }, goal, 40, catalog)
    expect(r.byCat.ram).toBeUndefined() // +50 over the £40 cap
  })
  it('omits categories with no meaningful upgrade axis', () => {
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo }, goal, 1000, catalog)
    expect(r.byCat.case).toBeUndefined()
    expect(r.byCat.motherboard).toBeUndefined()
    expect(r.byCat.fans).toBeUndefined()
  })
  it('returns a bottleneck object when cpu+gpu present', () => {
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo }, goal, 1000, catalog)
    expect(r.bottleneck).toBeTruthy()
    expect(typeof r.bottleneck.limitedBy).toBe('string')
  })
})

describe('systemUpgrades — deficiencies', () => {
  const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50, tdp: 65, socket: 'AM5' }
  const gpuLo = { id: 'gpu-lo', category: 'gpu', name: 'GPU Lo', price: 200, perfScore: 300, tdp: 200, length: 250 }
  const game  = { id: 'g', name: 'G', fpsFactor: 1, cpuFactor: 1 }
  const goal  = { game, resolution: '1080p', targetFps: 1 }
  const has = (r, cat, sev) => r.deficiencies.some((d) => d.category === cat && d.severity === sev)

  it('flags RAM under 16GB as high severity', () => {
    const ram8 = { id: 'r8', category: 'ram', name: 'R8', price: 30, capacityGb: 8, ramType: 'DDR5', speed: 5200 }
    const psu  = { id: 'p', category: 'psu', name: 'PSU', price: 80, wattage: 850 }
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, ram: ram8, psu }, goal, 1000, [])
    expect(has(r, 'ram', 'high')).toBe(true)
  })
  it('does not flag 16GB RAM', () => {
    const ram16 = { id: 'r16', category: 'ram', name: 'R16', price: 60, capacityGb: 16, ramType: 'DDR5', speed: 6000 }
    const psu   = { id: 'p', category: 'psu', name: 'PSU', price: 80, wattage: 850 }
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, ram: ram16, psu }, goal, 1000, [])
    expect(r.deficiencies.some((d) => d.category === 'ram')).toBe(false)
  })
  it('flags an HDD as medium severity', () => {
    const hdd = { id: 'h', category: 'storage', name: 'HDD', price: 40, capacityGb: 2000, storageType: 'HDD', specs: { readMbps: 180 } }
    const psu = { id: 'p', category: 'psu', name: 'PSU', price: 80, wattage: 850 }
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, storage: hdd, psu }, goal, 1000, [])
    expect(has(r, 'storage', 'medium')).toBe(true)
  })
  it('flags a PSU with under ~30% headroom as high', () => {
    const psuSmall = { id: 'ps', category: 'psu', name: 'PSU Small', price: 50, wattage: 300 } // draw 265 * 1.3 = 344 > 300
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, psu: psuSmall }, goal, 1000, [])
    expect(has(r, 'psu', 'high')).toBe(true)
  })
})
