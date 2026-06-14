import { valuePerPound, buildValuePerPound } from '../lib/valueScore'

describe('valuePerPound', () => {
  it('returns 0 for missing part, price, or perfScore', () => {
    expect(valuePerPound(null)).toBe(0)
    expect(valuePerPound({ perfScore: 50 })).toBe(0)
    expect(valuePerPound({ price: 100 })).toBe(0)
  })

  it('is perfScore per £100', () => {
    expect(valuePerPound({ perfScore: 80, price: 200 })).toBeCloseTo(40)
  })

  it('rises as perfScore rises and falls as price rises', () => {
    const cheap = valuePerPound({ perfScore: 80, price: 200 })
    const dearer = valuePerPound({ perfScore: 80, price: 400 })
    const faster = valuePerPound({ perfScore: 90, price: 200 })
    expect(faster).toBeGreaterThan(cheap)
    expect(cheap).toBeGreaterThan(dearer)
  })
})

describe('buildValuePerPound', () => {
  const cpu = { perfScore: 100 }
  const gpu = { perfScore: 100 }

  it('returns 0 when a part or total is missing', () => {
    expect(buildValuePerPound(null, gpu, 1000)).toBe(0)
    expect(buildValuePerPound(cpu, gpu, 0)).toBe(0)
  })

  it('is estimated 1440p FPS per £100 of build cost', () => {
    expect(buildValuePerPound(cpu, gpu, 1500)).toBeCloseTo(10)
  })
})
