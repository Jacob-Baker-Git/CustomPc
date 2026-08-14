import { describe, it, expect } from 'vitest'
import { selectPreset, BASIS_RANK } from '../lib/perfEngine/gameRows'
import { ORDER } from '../lib/perfEngine/rowBasis'

// A candidate is one preset of one game, with the set of resolutions it answers
// at. `row` is any answered row for that preset — they share preset metadata.
const cand = (over = {}) => ({
  presetKey: 'ultra|native',
  presetTier: 4,
  basis: 'ceiling',
  avgFps: 100,
  resolutions: new Set(['1080p', '1440p', '4k']),
  ...over,
})

describe('selectPreset', () => {
  it('prefers the preset covered at the most resolutions', () => {
    // The whole reason coverage outranks tier: the three columns have to
    // compare like with like, and a preset measured once cannot fill them.
    // Keys are chosen so alphabetical order opposes the correct answer
    // ('p-narrow' sorts before 'p-wide') — otherwise a tie-break chain
    // gutted down to the presetKey fallback could still pass this by luck.
    const wide = cand({ presetKey: 'p-wide|native', presetTier: 3 })
    const narrow = cand({ presetKey: 'p-narrow|native', presetTier: 4,
                          resolutions: new Set(['1080p']) })
    expect(selectPreset([narrow, wide]).presetKey).toBe('p-wide|native')
  })

  it('prefers the heaviest tier when coverage ties', () => {
    const heavy = cand({ presetKey: 'ultra|native', presetTier: 4 })
    const light = cand({ presetKey: 'low|native', presetTier: 1 })
    expect(selectPreset([light, heavy]).presetKey).toBe('ultra|native')
  })

  it('prefers the better-evidenced preset when coverage and tier tie', () => {
    // This is the German/English case: `sehr-hoch` and `very-high` are both
    // tier 4 and measure genuinely different settings.
    const weak = cand({ presetKey: 'sehr-hoch|native', basis: 'ceiling' })
    const strong = cand({ presetKey: 'very-high|native', basis: 'measured' })
    expect(selectPreset([weak, strong]).presetKey).toBe('very-high|native')
  })

  it('prefers the LOWER frame rate when coverage, tier and basis all tie', () => {
    // Under-promising, matching gamePresets.js: "the estimate errs toward a
    // LOWER frame rate... under-promising is the safer direction for a number
    // somebody is about to spend money on."
    const fast = cand({ presetKey: 'a|native', avgFps: 200 })
    const slow = cand({ presetKey: 'b|native', avgFps: 90 })
    expect(selectPreset([fast, slow]).presetKey).toBe('b|native')
  })

  it('falls back to presetKey so the result cannot depend on array order', () => {
    // The engine's existing heaviest-preset map breaks ties by array order,
    // which is how a 2.3x difference in F1 24 was being decided by nothing.
    const a = cand({ presetKey: 'aaa|native' })
    const b = cand({ presetKey: 'zzz|native' })
    expect(selectPreset([a, b]).presetKey).toBe('aaa|native')
    expect(selectPreset([b, a]).presetKey).toBe('aaa|native')
  })

  it('returns null for a game with no candidates', () => {
    expect(selectPreset([])).toBeNull()
  })

  it('ranks the four bases strongest to weakest', () => {
    expect(BASIS_RANK.measured).toBeGreaterThan(BASIS_RANK.modelled)
    expect(BASIS_RANK.modelled).toBeGreaterThan(BASIS_RANK['spec-derived'])
    expect(BASIS_RANK['spec-derived']).toBeGreaterThan(BASIS_RANK.ceiling)
  })

  it('derives BASIS_RANK from rowBasis.js ORDER, so a reorder cannot drift silently', () => {
    // Pins ORDER's actual contents so that reordering it — or inserting a
    // tier — fails loudly HERE, in the file whose ranking depends on it,
    // rather than BASIS_RANK quietly re-deriving from the new order with no
    // test noticing either way.
    expect(ORDER).toEqual(['measured', 'modelled', 'spec-derived', 'ceiling'])
    // The derivation itself: rank is distance from the weakest end of ORDER,
    // so the strongest basis gets the highest number. Reads ORDER directly
    // rather than the literal names, so it stays meaningful even if the
    // assertion above is updated for a genuine change to ORDER.
    ORDER.forEach((basis, i) => {
      expect(BASIS_RANK[basis]).toBe(ORDER.length - 1 - i)
    })
  })
})
