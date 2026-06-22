import { describe, it, expect } from 'vitest'
import { TIERS, partsForTier } from '../lib/tiers'
import partsData from '../data/partsData.json'
import { checkCompatibility } from '../lib/compatibility'

describe('tiers', () => {
  it('has the three tiers in order', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['budget', 'mainstream', 'ultimate'])
  })

  for (const tier of TIERS) {
    it(`${tier.id}: every id resolves to a real part`, () => {
      const map = partsForTier(tier, partsData)
      expect(Object.keys(map)).toHaveLength(tier.ids.length)
    })

    it(`${tier.id}: the build is internally compatible`, () => {
      const map = partsForTier(tier, partsData)
      for (const part of Object.values(map)) {
        const others = { ...map }
        delete others[part.category]
        expect(checkCompatibility(others, part).compatible).toBe(true)
      }
    })

    it(`${tier.id}: GPU fits the case and total is within the tier budget`, () => {
      const map = partsForTier(tier, partsData)
      expect(map.gpu.length).toBeLessThanOrEqual(map.case.maxGpuLength)
      const total = Object.values(map).reduce((s, p) => s + p.price, 0)
      expect(total).toBeLessThanOrEqual(tier.budget)
    })
  }
})
