import { describe, it, expect } from 'vitest'
import { RECOMMENDED_ORDER, nextRecommended } from '../lib/recommendedOrder'

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
