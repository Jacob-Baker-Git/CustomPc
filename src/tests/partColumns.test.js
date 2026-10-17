import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'
import { CATEGORIES } from '../lib/categories'
import { columnsFor, cellText } from '../lib/partColumns'

describe('columnsFor', () => {
  it.each(CATEGORIES.map((c) => c.id))('%s has at least two columns, and every value reads', (category) => {
    const cols = columnsFor(category, '1440p')
    expect(cols.length).toBeGreaterThanOrEqual(2)
    for (const part of partsData.filter((p) => p.category === category)) {
      for (const col of cols) expect(() => cellText(col, part)).not.toThrow()
    }
  })

  it('labels the cooler capacity as an estimate', () => {
    expect(columnsFor('cooler', '1440p').map((c) => c.label)).toContain('Cooling (est.)')
  })

  it('shows a dash for a value the part does not have', () => {
    const col = columnsFor('gpu', '1440p').find((c) => c.key === 'vram')
    expect(cellText(col, { category: 'gpu', price: 1, specs: {} })).toBe('—')
  })

  it('formats price in whole pounds and pence', () => {
    const col = columnsFor('cpu', '1440p').find((c) => c.key === 'price')
    expect(cellText(col, { price: 189.99 })).toBe('£189.99')
  })
})
