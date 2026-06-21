import { describe, it, expect } from 'vitest'
import { CATEGORIES } from '../lib/categories'
import partsData from '../data/partsData.json'

describe('thermal paste', () => {
  it('is a category', () => {
    expect(CATEGORIES.some((c) => c.id === 'paste')).toBe(true)
  })

  it('has selectable parts with zero TDP', () => {
    const paste = partsData.filter((p) => p.category === 'paste')
    expect(paste.length).toBeGreaterThanOrEqual(3)
    paste.forEach((p) => {
      expect(typeof p.name).toBe('string')
      expect(typeof p.price).toBe('number')
      expect(p.tdp).toBe(0)
    })
  })
})
