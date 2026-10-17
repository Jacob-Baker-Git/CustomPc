import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'
import perfModel from '../data/perfModel.json'
import perfGames from '../data/perfGames.json'
import { getBuildWarnings } from '../lib/buildWarnings'
import { computeBottleneck } from '../lib/bottleneck'
import {
  presetKey, findPreset, fpsFor, completeBuild, buildForGame,
} from '../lib/gameTargetBuilder'

const game = perfGames.find((g) => g.id === 'fortnite')
const preset = findPreset(game, 'epic|native')
const RES = '1440p'
const total = (b) => Object.values(b).reduce((s, p) => s + p.price, 0)
const ids = (o) => o && Object.fromEntries(Object.entries(o.parts).map(([k, v]) => [k, v.id]))
const run = (extra) => buildForGame({
  game, preset, resolution: RES, targetFps: 60, budget: 1600,
  parts: partsData, model: perfModel, ...extra,
})

// Every 7th CPU against every 5th GPU: a fixed, spread sample of real pairs to
// hold the optimiser's answers against.
const cpus = partsData.filter((p) => p.category === 'cpu' && !p.legacy).filter((_, i) => i % 7 === 0)
const gpus = partsData.filter((p) => p.category === 'gpu' && !p.legacy).filter((_, i) => i % 5 === 0)
const sample = cpus.flatMap((cpu) => gpus.map((gpu) => {
  const b = completeBuild(cpu, gpu, partsData, RES)
  const row = b && fpsFor(b, game, RES, preset, perfModel)
  return b && row?.avgFps != null ? { total: total(b), fps: row.avgFps } : null
})).filter(Boolean)

it('samples enough real builds to mean something', () => {
  expect(sample.length).toBeGreaterThan(20)
})

describe('findPreset', () => {
  it('finds a preset by key', () => {
    expect(presetKey(findPreset(game, 'high|native'))).toBe('high|native')
  })
  it('falls back to the heaviest preset for a key the game lacks', () => {
    expect(findPreset(game, 'ultra|dlss-quality')).toBe(game.presets.at(-1))
    expect(findPreset(game, null)).toBe(game.presets.at(-1))
  })
})

describe('completeBuild', () => {
  const b = completeBuild(cpus[0], gpus.at(-1), partsData, RES)

  it('fills every essential category', () => {
    for (const c of ['cpu', 'gpu', 'motherboard', 'ram', 'cooler', 'case', 'storage', 'psu']) {
      expect(b[c], c).toBeTruthy()
    }
  })
  it('is sensible: enough memory and storage for gaming, nothing the app would warn about', () => {
    expect(b.ram.capacityGb).toBeGreaterThanOrEqual(16)
    expect(b.storage.capacityGb).toBeGreaterThanOrEqual(1000)
    expect(b.storage.storageType).not.toBe('HDD')
    expect(b.ram.specs.sticks).toBeGreaterThanOrEqual(2)
    const bad = getBuildWarnings(b).filter((w) => w.level !== 'note')
    expect(bad).toEqual([])
  })
})

describe('buildForGame', () => {
  const r = run()

  it('finds a best build inside the budget', () => {
    expect(r.noData).toBe(false)
    expect(r.best.total).toBeLessThanOrEqual(1600)
    expect(r.best.total).toBeCloseTo(total(r.best.parts), 2)
  })
  it('no sampled build within budget beats it', () => {
    for (const s of sample.filter((x) => x.total <= 1600)) expect(s.fps).toBeLessThanOrEqual(r.best.fps)
  })
  it('is deterministic', () => {
    expect(ids(run().best)).toEqual(ids(r.best))
  })
  it('reports the cheapest build that hits a target the budget misses', () => {
    const hard = run({ budget: 700, targetFps: r.fastest.fps })
    expect(hard.best === null || hard.best.fps < r.fastest.fps).toBe(true)
    expect(hard.cheapestHit.fps).toBeGreaterThanOrEqual(r.fastest.fps)
    for (const s of sample.filter((x) => x.fps >= r.fastest.fps)) {
      expect(hard.cheapestHit.total).toBeLessThanOrEqual(s.total)
    }
  })
  it('skips the cheapest-hit search when the best build already hits', () => {
    const easy = run({ targetFps: 1 })
    expect(easy.cheapestHit).toBeNull()
    expect(easy.unreachable).toBe(false)
  })
  it('says when no build can reach the target, and gives the fastest', () => {
    const r2 = run({ targetFps: 100000 })
    expect(r2.unreachable).toBe(true)
    expect(r2.cheapestHit).toBeNull()
    expect(r2.fastest.fps).toBeGreaterThan(0)
  })
  it('returns no best build when the budget buys nothing complete', () => {
    expect(run({ budget: 100 }).best).toBeNull()
  })
  it('reports noData for a cell the corpus does not cover', () => {
    const ghost = { id: 'no-such-game', name: 'Ghost', presets: [{ id: 'high', label: 'High', tier: 3, upscaling: 'native' }] }
    const r3 = run({ game: ghost, preset: ghost.presets[0] })
    expect(r3).toEqual({ noData: true, unreachable: false, best: null, cheapestHit: null, fastest: null })
  })
})

// Final review, Important #1: a ceiling ("up to") cannot see the CPU, so it
// must not be allowed to pair a flagship card with the weakest chip. Those
// pairs answer only when the site's own balance rule (computeBottleneck, which
// the CustomPC score also uses) does not call them CPU-limited.
describe('ceilings never buy a CPU-bottlenecked pair', () => {
  const unbalanced = (o) => Boolean(o) && o.bound === 'upper' &&
    computeBottleneck(o.parts.cpu, o.parts.gpu, RES).limitedBy === 'cpu'

  it.each(['a-plague-tale-requiem', 'alan-wake-2', 'armored-core-6', 'fortnite'])('%s', (id) => {
    const g = perfGames.find((x) => x.id === id)
    const r = buildForGame({ game: g, preset: findPreset(g, null), resolution: RES, targetFps: 120,
      budget: 600, parts: partsData, model: perfModel })
    for (const o of [r.best, r.cheapestHit, r.fastest]) expect(unbalanced(o), JSON.stringify(o && [o.parts.cpu.id, o.parts.gpu.id])).toBe(false)
  })
})

// Final review, Important #2: the fallback must be the heaviest NATIVE preset;
// an upscaled run of the top tier is a higher frame rate, not a heavier one.
it('falls back to a native preset for every game that has one at its top tier', () => {
  for (const g of perfGames) {
    const top = Math.max(...g.presets.map((p) => p.tier))
    const hasNative = g.presets.some((p) => p.tier === top && p.upscaling === 'native')
    const p = findPreset(g, null)
    expect(p.tier, g.id).toBe(top)
    if (hasNative) expect(p.upscaling, g.id).toBe('native')
  }
})
