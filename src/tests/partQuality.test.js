import { describe, it, expect } from 'vitest'
import { partQuality } from '../lib/partQuality'

describe('partQuality', () => {
  it('cpu/gpu score is perfScore', () => {
    expect(partQuality({ category: 'cpu', perfScore: 120 })).toBe(120)
    expect(partQuality({ category: 'gpu', perfScore: 300 })).toBe(300)
  })
  it('ram: capacity dominates, speed tiebreaks', () => {
    const small = partQuality({ category: 'ram', capacityGb: 16, speed: 6000 })
    const big   = partQuality({ category: 'ram', capacityGb: 32, speed: 5200 })
    expect(big).toBeGreaterThan(small)
    const fast = partQuality({ category: 'ram', capacityGb: 32, speed: 6000 })
    expect(fast).toBeGreaterThan(big)
  })
  it('storage rewards read speed and capacity', () => {
    const sata = partQuality({ category: 'storage', capacityGb: 1000, specs: { readMbps: 550 } })
    const nvme = partQuality({ category: 'storage', capacityGb: 1000, specs: { readMbps: 7000 } })
    expect(nvme).toBeGreaterThan(sata)
  })
  it('psu score is wattage', () => {
    expect(partQuality({ category: 'psu', wattage: 750 })).toBe(750)
  })
  it('cooler: AIO outranks air', () => {
    const air = partQuality({ category: 'cooler', specs: { type: 'air', height: 158 } })
    const aio = partQuality({ category: 'cooler', specs: { type: 'AIO', radiator: '360mm' } })
    expect(aio).toBeGreaterThan(air)
  })
  it('null part scores 0', () => {
    expect(partQuality(null)).toBe(0)
  })
})
