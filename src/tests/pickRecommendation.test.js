import { it, expect } from 'vitest'
import { pickRecommendation } from '../lib/partRatings'

const rating = { parts: { storage: { score: 50, part: { id: 'hdd' } }, fans: { score: 55, part: { id: 'fan' } } } }

it('skips a swap that barely moves the score and offers a real one', () => {
  const tip = pickRecommendation(rating, {
    storage: [{ toPart: { id: 'hdd2' }, extraCost: 3, newScore: 51 }],
    fans: [{ toPart: { id: 'fan2' }, extraCost: 20, newScore: 70 }],
  })
  expect(tip.toPart.id).toBe('fan2')
})

it('still picks the worst part when its swap is worth making', () => {
  const tip = pickRecommendation(rating, {
    storage: [{ toPart: { id: 'hdd2' }, extraCost: 3, newScore: 51 }, { toPart: { id: 'ssd' }, extraCost: 40, newScore: 80 }],
  })
  expect(tip.toPart.id).toBe('ssd')
})
