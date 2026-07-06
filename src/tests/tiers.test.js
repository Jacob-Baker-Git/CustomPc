import { describe, it, expect } from 'vitest'
import { TIERS, partsForTier } from '../lib/tiers'
import partsData from '../data/partsData.json'
import { checkCompatibility } from '../lib/compatibility'

const CATS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']

describe('tiers', () => {
  it('has the three tiers in order, each with a use case', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['budget', 'mainstream', 'ultimate'])
    for (const t of TIERS) expect(typeof t.useCase).toBe('string')
  })

  for (const tier of TIERS) {
    it(`${tier.id}: generates a complete, compatible build within budget`, () => {
      const map = partsForTier(tier, partsData)
      for (const c of CATS) expect(map[c], `missing ${c}`).toBeTruthy()
      for (const part of Object.values(map)) {
        const others = { ...map }; delete others[part.category]
        expect(checkCompatibility(others, part).compatible).toBe(true)
      }
      expect(map.gpu.length).toBeLessThanOrEqual(map.case.maxGpuLength)
      const total = Object.values(map).reduce((s, p) => s + p.price, 0)
      expect(total).toBeLessThanOrEqual(tier.budget)
    })
  }
})
