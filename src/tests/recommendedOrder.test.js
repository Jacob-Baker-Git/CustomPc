import { describe, it, expect } from 'vitest'
import { RECOMMENDED_ORDER, nextRecommended, ESSENTIALS, isOptional, countEssentials } from '../lib/recommendedOrder'

describe('recommendedOrder', () => {
  it('starts with motherboard and ends with the optional paste (10 entries)', () => {
    expect(RECOMMENDED_ORDER[0]).toBe('motherboard')
    expect(RECOMMENDED_ORDER[RECOMMENDED_ORDER.length - 1]).toBe('paste')
    expect(RECOMMENDED_ORDER).toHaveLength(10)
  })

  it('returns motherboard first when nothing is selected', () => {
    expect(nextRecommended({})).toBe('motherboard')
  })

  it('skips selected categories and returns the next gap in order', () => {
    expect(nextRecommended({ motherboard: { id: 'm' } })).toBe('cpu')
    expect(nextRecommended({ motherboard: { id: 'm' }, cpu: { id: 'c' } })).toBe('cooler')
  })

  it('treats paste as optional — never returns it as the next pick', () => {
    const allButPaste = {}
    for (const c of RECOMMENDED_ORDER) if (c !== 'paste') allButPaste[c] = { id: c }
    expect(nextRecommended(allButPaste)).toBeNull()
  })

  it('returns null when every category is filled', () => {
    const full = {}
    for (const c of RECOMMENDED_ORDER) full[c] = { id: c }
    expect(nextRecommended(full)).toBeNull()
  })
})

describe('essentials', () => {
  it('treats thermal paste as optional — most coolers ship with paste applied', () => {
    expect(isOptional('paste')).toBe(true)
    expect(ESSENTIALS).not.toContain('paste')
  })

  it('treats every other category as essential', () => {
    for (const c of ['motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case', 'fans']) {
      expect(isOptional(c), c).toBe(false)
      expect(ESSENTIALS, c).toContain(c)
    }
  })

  it('counts only essentials, so a finished build reads 9 of 9', () => {
    const full = Object.fromEntries(ESSENTIALS.map((c) => [c, { id: c }]))
    expect(countEssentials(full)).toEqual({ chosen: 9, total: 9, missing: [] })
  })

  it('reports which essentials are still missing', () => {
    expect(countEssentials({ cpu: { id: 'x' } })).toMatchObject({ chosen: 1, total: 9 })
    expect(countEssentials({ cpu: { id: 'x' } }).missing).toContain('gpu')
  })

  it('does not count paste towards the total', () => {
    const full = Object.fromEntries(ESSENTIALS.map((c) => [c, { id: c }]))
    expect(countEssentials({ ...full, paste: { id: 'p' } })).toEqual({ chosen: 9, total: 9, missing: [] })
  })
})
