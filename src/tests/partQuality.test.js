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
  it('psu score leads on wattage but separates equal-wattage units by efficiency', () => {
    // Wattage alone rated a 750W Bronze exactly level with a 750W Platinum, which
    // is wrong in running cost, heat and noise. Efficiency now breaks that tie
    // without ever overturning a real wattage gap.
    const gold = partQuality({ category: 'psu', wattage: 750, specs: { rating: '80+ Gold' } })
    const bronze = partQuality({ category: 'psu', wattage: 750, specs: { rating: '80+ Bronze' } })
    expect(gold).toBeGreaterThan(bronze)

    const biggerBronze = partQuality({ category: 'psu', wattage: 1000, specs: { rating: '80+ Bronze' } })
    expect(biggerBronze).toBeGreaterThan(gold)

    // Wattage still dominates the scale.
    expect(partQuality({ category: 'psu', wattage: 750 })).toBeGreaterThan(partQuality({ category: 'psu', wattage: 650 }))
  })
  it('cooler: AIO outranks air', () => {
    const air = partQuality({ category: 'cooler', specs: { type: 'air', height: 158 } })
    const aio = partQuality({ category: 'cooler', specs: { type: 'AIO', radiatorMm: 360 } })
    expect(aio).toBeGreaterThan(air)
  })
  it('null part scores 0', () => {
    expect(partQuality(null)).toBe(0)
  })
})
