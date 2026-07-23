import { describe, it, expect } from 'vitest'
import { maxOutBudget } from '../lib/maxOutBudget'
import { buildForUseCase } from '../lib/useCaseBuilder'
import { checkCompatibility } from '../lib/compatibility'
import partsData from '../data/partsData.json'

const CATS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']
const total = (b) => CATS.reduce((s, c) => s + (b[c]?.price ?? 0), 0)
const ids = (b) => Object.fromEntries(CATS.map((c) => [c, b[c]?.id]))

describe('maxOutBudget', () => {
  it('spends the leftover across categories, staying compatible and within budget', () => {
    const base = buildForUseCase(1200, 'gaming', partsData)
    const upgraded = maxOutBudget(base, 2200, partsData, 'gaming')
    expect(total(upgraded)).toBeGreaterThan(total(base))
    expect(total(upgraded)).toBeLessThanOrEqual(2200)
    for (const c of CATS) {
      const others = { ...upgraded }; delete others[c]
      expect(checkCompatibility(others, upgraded[c]).compatible).toBe(true)
    }
    const changed = CATS.filter((c) => upgraded[c]?.id !== base[c]?.id)
    expect(changed.some((c) => c !== 'cpu' && c !== 'gpu')).toBe(true)
  })

  it('is use-case aware: programming never shrinks RAM when spending leftover', () => {
    const base = buildForUseCase(1200, 'programming', partsData)
    const up = maxOutBudget(base, 2600, partsData, 'programming')
    expect(up.ram.capacityGb).toBeGreaterThanOrEqual(base.ram.capacityGb)
  })

  it('leaves the build unchanged when there is no budget to spend', () => {
    const base = buildForUseCase(1500, 'gaming', partsData)
    expect(ids(maxOutBudget(base, total(base), partsData, 'gaming'))).toEqual(ids(base))
  })
})
