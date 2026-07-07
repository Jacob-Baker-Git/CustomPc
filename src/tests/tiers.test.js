import { describe, it, expect } from 'vitest'
import { TIERS } from '../lib/tiers'

describe('tiers', () => {
  it('are budget presets in ascending order with no fixed use case', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['budget', 'mainstream', 'ultimate'])
    for (const t of TIERS) {
      expect(t.budget).toBeGreaterThan(0)
      expect(typeof t.label).toBe('string')
      expect(t).not.toHaveProperty('useCase')
    }
    const budgets = TIERS.map((t) => t.budget)
    expect([...budgets].sort((a, b) => a - b)).toEqual(budgets)
  })
})
