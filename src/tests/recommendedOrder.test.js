import { RECOMMENDED_ORDER, nextRecommended } from '../lib/recommendedOrder'

describe('recommendedOrder', () => {
  it('lists all 9 categories starting with motherboard and ending with fans', () => {
    expect(RECOMMENDED_ORDER[0]).toBe('motherboard')
    expect(RECOMMENDED_ORDER[RECOMMENDED_ORDER.length - 1]).toBe('fans')
    expect(RECOMMENDED_ORDER).toHaveLength(9)
  })

  it('returns motherboard first when nothing is selected', () => {
    expect(nextRecommended({})).toBe('motherboard')
  })

  it('skips selected categories and returns the next gap in order', () => {
    expect(nextRecommended({ motherboard: { id: 'm' } })).toBe('cpu')
    expect(nextRecommended({ motherboard: { id: 'm' }, cpu: { id: 'c' } })).toBe('cooler')
  })

  it('returns null when every category is filled', () => {
    const full = {}
    for (const c of RECOMMENDED_ORDER) full[c] = { id: c }
    expect(nextRecommended(full)).toBeNull()
  })
})
