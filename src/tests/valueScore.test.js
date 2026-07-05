import { valuePerPound } from '../lib/valueScore'

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
