import { describe, it, expect } from 'vitest'
import { estimatePower, estimateThermals } from '../lib/perfEngine/power'

// `tdp` is base power. At full boost an i7-14700KF draws 253 W, not 125, and
// peak, the PSU recommendation and the cooling verdict all used to read 125.
const k14700 = { category: 'cpu', tdp: 125, specs: { maxPowerW: 253 } }
const gpu = { category: 'gpu', tdp: 300 }
const tower = { category: 'cooler', specs: { type: 'Air', height: 160 } } // 220 W on the height ladder

describe('estimatePower', () => {
  it('peaks at the CPU full-boost power plus the graphics card and the rest', () => {
    expect(estimatePower({ cpu: k14700, gpu }).peakW).toBe(553)
  })

  it('falls back to base power when no max power is recorded', () => {
    expect(estimatePower({ cpu: { tdp: 125 }, gpu }).peakW).toBe(425)
  })

  it('sizes the recommended supply from that peak', () => {
    expect(estimatePower({ cpu: k14700, gpu }).recommendedPsuW).toBe(750)
  })
})

describe('estimateThermals', () => {
  it('measures the cooler against full-boost heat, not base power', () => {
    const t = estimateThermals({ cpu: k14700, cooler: tower })
    expect(t.cpuHeatW).toBe(253)
    expect(t.headroomPct).toBe(-13)
    expect(t.verdict).toBe('working hard')
  })
})
