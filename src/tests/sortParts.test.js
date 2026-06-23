import { describe, it, expect } from 'vitest'
import { sortParts, SORT_OPTIONS } from '../lib/sortParts'

const parts = [
  { id: 'a', name: 'Zeta', brand: 'Zen', price: 300, tdp: 50 },
  { id: 'b', name: 'Alpha', brand: 'Acme', price: 100, tdp: 200 },
  { id: 'c', name: 'Mid', brand: 'Mako', price: 200, tdp: 10 },
]

describe('sortParts', () => {
  it('exposes the four sort options in order', () => {
    expect(SORT_OPTIONS.map((o) => o.key)).toEqual(['price-asc', 'price-desc', 'brand-asc', 'tdp-desc'])
  })
  it('sorts price low to high', () => {
    expect(sortParts(parts, 'price-asc').map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })
  it('sorts price high to low', () => {
    expect(sortParts(parts, 'price-desc').map((p) => p.id)).toEqual(['a', 'c', 'b'])
  })
  it('sorts by brand A-Z', () => {
    expect(sortParts(parts, 'brand-asc').map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })
  it('sorts by power draw (TDP) high to low', () => {
    expect(sortParts(parts, 'tdp-desc').map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })
  it('does not mutate the input', () => {
    const copy = [...parts]
    sortParts(parts, 'price-desc')
    expect(parts).toEqual(copy)
  })
  it('breaks brand ties by name (A-Z)', () => {
    const items = [
      { id: 'z', name: 'Zeta', brand: 'Acme', price: 1, tdp: 0 },
      { id: 'a', name: 'Alpha', brand: 'Acme', price: 2, tdp: 0 },
    ]
    expect(sortParts(items, 'brand-asc').map((p) => p.id)).toEqual(['a', 'z'])
  })
})
