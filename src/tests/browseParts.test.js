import { describe, it, expect } from 'vitest'
import { browseParts } from '../lib/browseParts'

const parts = [
  { id: 'a', category: 'cpu', name: 'Zen Chip', brand: 'AMD', price: 300, perfScore: 90 },
  { id: 'b', category: 'gpu', name: 'Big GPU', brand: 'NVIDIA', price: 900, perfScore: 100 },
  { id: 'c', category: 'cpu', name: 'Blue Chip', brand: 'Intel', price: 250, perfScore: 80 },
]

describe('browseParts', () => {
  it('filters by category', () => {
    expect(browseParts(parts, { category: 'cpu' }).map((p) => p.id)).toEqual(['c', 'a'])
  })
  it('searches name and brand case-insensitively', () => {
    expect(browseParts(parts, { query: 'intel' }).map((p) => p.id)).toEqual(['c'])
    expect(browseParts(parts, { query: 'gpu' }).map((p) => p.id)).toEqual(['b'])
  })
  it('sorts by price and performance', () => {
    expect(browseParts(parts, { sort: 'price-desc' }).map((p) => p.id)).toEqual(['b', 'a', 'c'])
    expect(browseParts(parts, { sort: 'perf' }).map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })
})
