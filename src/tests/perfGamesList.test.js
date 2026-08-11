import { describe, it, expect } from 'vitest'
import { buildPerfGames } from '../lib/perfEngine/perfGamesList'

const META = {
  presets: {
    low: { label: 'Low', tier: 1 },
    high: { label: 'High', tier: 3 },
    ultra: { label: 'Ultra', tier: 4 },
    'sehr-hoch': { label: 'Sehr hoch', tier: 4 },
  },
  games: {
    alpha: { name: 'Alpha', slug: 'alpha' },
    beta: { name: 'Beta', slug: 'beta', presetLabels: { ultra: 'Ultra, all details' } },
  },
}

const entry = (over) => ({
  gameId: 'alpha', presetId: 'high', upscaling: 'native', supersededBy: null, ...over,
})

describe('buildPerfGames', () => {
  it('lists only games the corpus measures', () => {
    const { games, problems } = buildPerfGames({ meta: META, entries: [entry()] })
    expect(problems).toEqual([])
    expect(games.map((g) => g.id)).toEqual(['alpha'])
  })

  it('drops a game whose only entries are superseded', () => {
    const { games } = buildPerfGames({
      meta: META, entries: [entry({ gameId: 'beta', supersededBy: 'be-newer' })],
    })
    expect(games.map((g) => g.id)).toEqual([])
  })

  it('orders presets lowest tier first, because resolvePreset breaks ties on array order', () => {
    const { games } = buildPerfGames({
      meta: META,
      entries: [entry({ presetId: 'ultra' }), entry({ presetId: 'low' }), entry()],
    })
    expect(games[0].presets.map((p) => p.id)).toEqual(['low', 'high', 'ultra'])
    expect(games[0].presets.map((p) => p.tier)).toEqual([1, 3, 4])
  })

  it('breaks a tier tie on measurement count, so the output is deterministic', () => {
    const { games } = buildPerfGames({
      meta: META,
      entries: [
        entry({ presetId: 'ultra' }),
        entry({ presetId: 'sehr-hoch' }), entry({ presetId: 'sehr-hoch' }),
      ],
    })
    expect(games[0].presets.map((p) => p.id)).toEqual(['sehr-hoch', 'ultra'])
  })

  it('prefers a per-game preset label over the canonical one', () => {
    const { games } = buildPerfGames({
      meta: META, entries: [entry({ gameId: 'beta', presetId: 'ultra' })],
    })
    expect(games[0].presets[0].label).toBe('Ultra, all details')
  })

  it('carries fpsCap across from the legacy list where the id matches', () => {
    const { games } = buildPerfGames({
      meta: META, entries: [entry()], legacy: [{ id: 'alpha', fpsCap: 60 }],
    })
    expect(games[0].fpsCap).toBe(60)
  })

  it('omits fpsCap entirely when the legacy list has none', () => {
    const { games } = buildPerfGames({ meta: META, entries: [entry()], legacy: [{ id: 'alpha' }] })
    expect(games[0]).not.toHaveProperty('fpsCap')
  })

  it('reports a measured game with no metadata instead of inventing a name', () => {
    const { games, problems } = buildPerfGames({
      meta: META, entries: [entry({ gameId: 'gamma' })],
    })
    expect(games.map((g) => g.id)).toEqual([])
    expect(problems.join(' ')).toMatch(/gamma/)
  })

  it('reports a preset with no metadata rather than guessing its tier', () => {
    const { problems } = buildPerfGames({
      meta: META, entries: [entry({ presetId: 'cinematic' })],
    })
    expect(problems.join(' ')).toMatch(/cinematic/)
  })

  it('lists a preset once per render scale it was measured at', () => {
    const { games, problems } = buildPerfGames({
      meta: META,
      entries: [
        entry({ presetId: 'ultra', upscaling: 'native' }),
        entry({ presetId: 'ultra', upscaling: 'quality' }),
        entry({ presetId: 'ultra', upscaling: 'quality' }),
      ],
    })
    expect(problems).toEqual([])
    expect(games[0].presets).toEqual([
      { id: 'ultra', label: 'Ultra (DLSS/FSR Quality)', tier: 4, upscaling: 'quality' },
      { id: 'ultra', label: 'Ultra', tier: 4, upscaling: 'native' },
    ])
  })

  it('reports an unknown render scale rather than letting it read as native', () => {
    const { problems } = buildPerfGames({
      meta: META, entries: [entry({ upscaling: '70-percent-tsr' })],
    })
    expect(problems.join(' ')).toMatch(/70-percent-tsr/)
  })

  it('is sorted by id, so the diff is stable across runs', () => {
    const { games } = buildPerfGames({
      meta: META, entries: [entry({ gameId: 'beta' }), entry({ gameId: 'alpha' })],
    })
    expect(games.map((g) => g.id)).toEqual(['alpha', 'beta'])
  })
})
