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

describe('game slugs', () => {
  it('every game has a URL-safe slug', () => {
    for (const game of gamesData) {
      expect(game.slug, `${game.id} has no slug`).toBeTruthy()
      expect(game.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('slugs are unique', () => {
    const slugs = gamesData.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('the legacy fields the old engine reads are all still present', () => {
    // gameFps still drives the CustomPC score. Adding fields is fine; losing
    // one would move every rating in the app.
    for (const game of gamesData) {
      expect(typeof game.fpsFactor).toBe('number')
      expect(typeof game.cpuFactor).toBe('number')
      expect(typeof game.name).toBe('string')
    }
  })

  it('the legacy field VALUES are unchanged, for every game', () => {
    // The type check above would wave through fpsFactor: 2.6 -> 9.9. This file
    // gets edited every time the performance engine gains a data field, and
    // legacyEngineUntouched.test.js only pins five of the 22 games — so
    // without this the other 17 could drift silently and move the CustomPC
    // score with them. [fpsFactor, cpuFactor, fpsCap ?? null]
    const FROZEN = {
      'lol': [3, 2.6, null],
      'valorant': [2.8, 2.5, null],
      'cs2': [2.6, 2.2, null],
      'dota2': [2.4, 1.9, null],
      'rocket-league': [2.5, 2.4, null],
      'r6-siege': [2.3, 2.1, null],
      'overwatch2': [2.2, 2, 600],
      'minecraft': [1.9, 1.1, null],
      'fortnite': [1.6, 1.5, null],
      'apex': [1.5, 1.4, 300],
      'gta5': [1.5, 1.3, 180],
      'marvel-rivals': [1.2, 1.1, null],
      'warzone': [1.1, 1, null],
      'tarkov': [1.1, 0.65, null],
      'elden-ring': [0.9, 1.2, 60],
      'helldivers2': [0.9, 0.8, null],
      'bg3': [0.85, 0.7, null],
      'hogwarts': [0.8, 0.75, null],
      'rdr2': [0.75, 0.9, null],
      'starfield': [0.65, 0.7, null],
      'cyberpunk': [0.5, 0.75, null],
      'alan-wake-2': [0.4, 0.8, null],
    }
    expect(gamesData.map((g) => g.id).sort()).toEqual(Object.keys(FROZEN).sort())
    for (const game of gamesData) {
      expect([game.fpsFactor, game.cpuFactor, game.fpsCap ?? null], game.id)
        .toEqual(FROZEN[game.id])
    }
  })
})
