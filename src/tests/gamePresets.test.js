import { describe, it, expect } from 'vitest'
import { CANONICAL_PRESETS, presetsFor, resolvePreset } from '../lib/gamePresets'
import gamesData from '../data/gamesData.json'

describe('gamePresets', () => {
  it('exposes a four-rung canonical ladder', () => {
    expect(CANONICAL_PRESETS.map((p) => p.id)).toEqual(['low', 'medium', 'high', 'ultra'])
    expect(CANONICAL_PRESETS.map((p) => p.tier)).toEqual([1, 2, 3, 4])
  })

  it('falls back to the canonical ladder for a game with no presets of its own', () => {
    expect(presetsFor({ id: 'x' })).toEqual(CANONICAL_PRESETS)
  })

  it("uses the game's own presets when it has them", () => {
    const own = [{ id: 'epic', label: 'Epic', tier: 4 }]
    expect(presetsFor({ id: 'fortnite', presets: own })).toEqual(own)
  })

  it('resolves an exact preset id directly', () => {
    const r = resolvePreset({ id: 'x' }, 'high')
    expect(r.preset.id).toBe('high')
    expect(r.exact).toBe(true)
  })

  it('falls back to the nearest tier when the id is unknown', () => {
    // "epic" is not on the canonical ladder; tier 4 is the nearest thing to it.
    const game = { id: 'fortnite', presets: [{ id: 'epic', label: 'Epic', tier: 4 }] }
    const r = resolvePreset(game, 'ultra')
    expect(r.preset.id).toBe('epic')
    expect(r.exact).toBe(false)
  })

  it('falls back to tier 3 for an unrecognisable preset id', () => {
    const r = resolvePreset({ id: 'x' }, 'nonsense')
    expect(r.preset.id).toBe('high')
    expect(r.exact).toBe(false)
  })

  it('every catalogue game resolves a high preset exactly', () => {
    // No catalogue game has its own presets yet, so all 22 take the canonical
    // ladder and match exactly. Asserting the id and the flag rather than mere
    // truthiness means this notices when that stops being true — which is
    // precisely when the curation harness starts populating game.presets.
    for (const game of gamesData) {
      const { preset, exact } = resolvePreset(game, 'high')
      expect(preset.id, `${game.id} resolved ${preset.id}`).toBe('high')
      expect(exact, `${game.id} was not an exact match`).toBe(true)
    }
  })
})
