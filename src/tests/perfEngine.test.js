import { describe, it, expect } from 'vitest'
import { estimateBuildPerformance } from '../lib/perfEngine'

const cpu = { id: 'cpu-ryzen-5-7600x', name: 'AMD Ryzen 5 7600X', socket: 'AM5' }
const gpu = { id: 'gpu-rtx-5070', name: 'NVIDIA GeForce RTX 5070', specs: { vram: 12 } }
const games = [
  { id: 'cyberpunk', name: 'Cyberpunk 2077', slug: 'cyberpunk-2077', fpsFactor: 0.5, cpuFactor: 0.75 },
  { id: 'elden-ring', name: 'Elden Ring', slug: 'elden-ring', fpsFactor: 0.9, cpuFactor: 1.2, fpsCap: 60 },
  { id: 'starfield', name: 'Starfield', slug: 'starfield', fpsFactor: 0.65, cpuFactor: 0.7 },
]

const model = {
  modelVersion: '1.0.0',
  datasetVersion: '2026-08-07',
  blendK: 5.1,
  resCpuScale: { '1080p': 1.0, '1440p': 1.012, '4k': 1.031 },
  gpuIndex: { 'gpu-rtx-5070': { '1440p': 62.0, basis: 'measured', anchors: 11 } },
  cpuIndex: { 'cpu-ryzen-5-7600x': { value: 71.2, basis: 'measured', anchors: 9 } },
  gameConst: {
    cyberpunk: { '1440p': { 'high|native': { A: 399.0, B: 402.0, sources: 3, cv: 0.052 } } },
    'elden-ring': { '1440p': { 'high|native': { A: 200.0, B: 200.0, sources: 2, cv: 0.03 } } },
  },
}

const run = (over = {}) => estimateBuildPerformance({
  parts: { cpu, gpu }, resolution: '1440p', presetId: 'high',
  model, games, ...over,
})

describe('render scale is part of a row', () => {
  it('gives a native and an upscaled row of one preset different identities', () => {
    const scaledGames = [{
      id: 'wukong',
      name: 'Black Myth: Wukong',
      presets: [
        { id: 'kino', label: 'Kino', tier: 4, upscaling: 'native' },
        { id: 'kino', label: 'Kino (DLSS/FSR Quality)', tier: 4, upscaling: 'quality' },
      ],
    }]
    const scaledModel = {
      blendK: 5.1,
      resCpuScale: { '1440p': 1.0 },
      gpuIndex: { 'gpu-rtx-5070': { '1440p': 100, basis: 'measured' } },
      cpuIndex: { 'cpu-ryzen-5-7600x': { value: 100, basis: 'measured' } },
      gameConst: {
        wukong: {
          '1440p': {
            'kino|native': { A: 2000, B: 800 },
            'kino|quality': { A: 1250, B: 800 },
          },
        },
      },
      exact: {},
    }

    const out = estimateBuildPerformance({
      parts: { cpu, gpu }, resolution: '1440p', model: scaledModel, games: scaledGames,
    })

    const ids = out.games.map((r) => r.rowId)
    expect(ids).toContain('wukong|kino|native')
    expect(ids).toContain('wukong|kino|quality')

    const native = out.games.find((r) => r.rowId === 'wukong|kino|native')
    const quality = out.games.find((r) => r.rowId === 'wukong|kino|quality')
    // Upscaling renders fewer pixels, so the same preset runs faster. If the two
    // shared a cell one of these numbers would describe the other's measurement.
    expect(quality.avgFps).toBeGreaterThan(native.avgFps)
    expect(native.upscaling).toBe('native')
    expect(quality.upscaling).toBe('quality')
  })
})

describe('estimateBuildPerformance', () => {
  it('returns null without a CPU or a GPU', () => {
    expect(run({ parts: { gpu } })).toBeNull()
    expect(run({ parts: { cpu } })).toBeNull()
  })

  it('reproduces the spec worked example from the fitted model', () => {
    // t_gpu = 399.0 / 62.0                    = 6.4355 ms
    // t_cpu = 402.0 * 1.012 / 71.2            = 5.7138 ms
    // t     = (6.4355^5.1 + 5.7138^5.1)^(1/5.1) = 7.009 ms  ->  143 fps
    //
    // The spec's worked example says 142. The difference is the DDR5-5600
    // memory factor, which is Phase 3 — Phase 1 has no memory term at all, so
    // it lands one frame higher. That is expected, not a discrepancy.
    const row = run().games.find((g) => g.gameId === 'cyberpunk')
    expect(row.frameTimeMs).toBeCloseTo(7.01, 2)
    expect(row.avgFps).toBe(143)
    expect(row.limitedBy).toBe('gpu')
    expect(row.cpuShare).toBeCloseTo(0.353, 2)
    expect(row.basis).toBe('modelled')
  })

  it('prefers a real measurement over the model when one exists', () => {
    // 7.4074 ms is 135 fps. The fitted model would say 143. Where somebody
    // actually measured the combination, the measurement wins — that is the
    // entire point of curating real data.
    const withExact = {
      ...model,
      exact: { 'cpu-ryzen-5-7600x|gpu-rtx-5070|cyberpunk|1440p|high|native':
                 { frameTimeMs: 7.4074, sources: 2, entries: 2 } },
    }
    const row = run({ model: withExact }).games.find((g) => g.gameId === 'cyberpunk')
    expect(row.avgFps).toBe(135)
    expect(row.basis).toBe('measured')
    expect(row.sources).toBe(2)
    // The split still comes from the model — a measurement is a frame time, not
    // an attribution of it — so the verdict is unchanged.
    expect(row.limitedBy).toBe('gpu')
  })

  it('reports a measurement even when the cell itself was never fitted', () => {
    const onlyExact = {
      ...model, gameConst: {},
      exact: { 'cpu-ryzen-5-7600x|gpu-rtx-5070|cyberpunk|1440p|high|native':
                 { frameTimeMs: 8.0, sources: 1, entries: 1 } },
    }
    const row = run({ model: onlyExact }).games.find((g) => g.gameId === 'cyberpunk')
    expect(row.avgFps).toBe(125)
    expect(row.basis).toBe('measured')
    // Nothing can attribute the frame without the fitted constants, so the
    // split is reported as unknown rather than invented.
    expect(row.cpuShare).toBeNull()
    expect(row.limitedBy).toBeNull()
  })

  it('respects an engine frame cap', () => {
    const row = run().games.find((g) => g.gameId === 'elden-ring')
    expect(row.avgFps).toBe(60)
    expect(row.atEngineCap).toBe(true)
  })

  it('flags the cap when a measurement sits exactly on it', () => {
    // The likeliest real reading for a hard-locked game: a reviewer benchmarks
    // Elden Ring's rock-solid 60 and records exactly 60. Comparing frame times
    // to decide "was it capped" answers no here, because flooring changed
    // nothing — and says "not at the cap" for the one game everybody knows is.
    const atCap = {
      ...model,
      exact: { 'cpu-ryzen-5-7600x|gpu-rtx-5070|elden-ring|1440p|high':
                 { frameTimeMs: 1000 / 60, sources: 2, entries: 2 } },
    }
    const row = run({ model: atCap }).games.find((g) => g.gameId === 'elden-ring')
    expect(row.avgFps).toBe(60)
    expect(row.atEngineCap).toBe(true)
  })

  it('caps a measurement that exceeds the engine lock, and says it did', () => {
    // A reading above a hard lock is bad corpus data. The ceiling still
    // applies, so the number shown is no longer the raw measurement — which is
    // exactly why atEngineCap has to be true here rather than the basis label
    // quietly implying the 200 was observed.
    const overCap = {
      ...model,
      exact: { 'cpu-ryzen-5-7600x|gpu-rtx-5070|elden-ring|1440p|high|native':
                 { frameTimeMs: 5.0, sources: 1, entries: 1 } },
    }
    const row = run({ model: overCap }).games.find((g) => g.gameId === 'elden-ring')
    expect(row.avgFps).toBe(60)
    expect(row.atEngineCap).toBe(true)
    expect(row.basis).toBe('measured')
  })

  it('reports no data rather than guessing for an uncovered game', () => {
    const row = run().games.find((g) => g.gameId === 'starfield')
    expect(row.basis).toBe('none')
    expect(row.avgFps).toBeNull()
  })

  it('sorts covered games above uncovered ones, fastest first', () => {
    // cyberpunk 143, elden-ring capped at 60, starfield uncovered. These games
    // carry no presets of their own, so each gets the canonical four rows —
    // deduped here because this test is about the ORDER OF GAMES, and the
    // per-preset ordering has its own test below.
    const ids = [...new Set(run().games.map((g) => g.gameId))]
    expect(ids).toEqual(['cyberpunk', 'elden-ring', 'starfield'])
  })

  it('reports every preset of a game, heaviest first, grouped with its game', () => {
    // The engine answers all four canonical presets rather than picking one.
    // Choosing a single preset made coverage depend on which one was asked for:
    // the same corpus answered 8 games at 1440p and 3 at 1440p depending only on
    // whether the caller said "high" or the game's own top preset.
    const cyberpunk = run().games.filter((g) => g.gameId === 'cyberpunk')
    expect(new Set(cyberpunk.map((g) => g.rowId))).toEqual(new Set([
      'cyberpunk|ultra|native', 'cyberpunk|high|native',
      'cyberpunk|medium|native', 'cyberpunk|low|native',
    ]))
    // Only `high` is in the fixture's gameConst, so only that row answers — and
    // an answered row sorts ahead of an unanswered one whatever its tier, which
    // is what lets the grid split covered from uncovered without re-sorting.
    expect(cyberpunk[0].presetId).toBe('high')
    expect(cyberpunk.filter((g) => g.basis !== 'none').map((g) => g.presetId)).toEqual(['high'])
    // The unanswered remainder stays in tier order, heaviest first.
    expect(cyberpunk.slice(1).map((g) => g.presetId)).toEqual(['ultra', 'medium', 'low'])
  })

  it('marks which row was the preset the caller asked for', () => {
    const cyberpunk = run().games.filter((g) => g.gameId === 'cyberpunk')
    expect(cyberpunk.filter((g) => g.presetExact).map((g) => g.presetId)).toEqual(['high'])
  })

  it('summarises coverage in GAMES, and rows separately', () => {
    const report = run()
    expect(report.coverage).toEqual({
      // Two of three GAMES answered — not two of twelve rows. A row count
      // measures how many settings a reviewer tested, which is a fact about the
      // reviewer rather than about the build.
      gamesAnswered: 2, gamesExact: 0, gamesTotal: 3,
      rowsAnswered: 2, rowsExact: 0, rowsTotal: 12,
      gpuBasis: 'measured', cpuBasis: 'measured',
      // False here because the fixture's index carries a real figure for this
      // resolution. True means the fit had no data at the requested resolution
      // and carried 1440p over, which the report has to disclose.
      gpuResolutionCopied: false,
    })
  })

  it('stamps the model and dataset versions on the report', () => {
    const report = run()
    expect(report.modelVersion).toBe('1.0.0')
    expect(report.datasetVersion).toBe('2026-08-07')
    expect(report.resolution).toBe('1440p')
    expect(report.presetId).toBe('high')
  })

  it('returns an all-uncovered report against an empty model, and does not throw', () => {
    const empty = { modelVersion: '1.0.0', datasetVersion: '2026-01-01', blendK: 5.1,
                    resCpuScale: { '1440p': 1.012 }, gpuIndex: {}, cpuIndex: {}, gameConst: {} }
    const report = run({ model: empty })
    expect(report.coverage.gamesAnswered).toBe(0)
    expect(report.games.every((g) => g.basis === 'none')).toBe(true)
  })

  it('limits to the requested games', () => {
    const report = run({ gameIds: ['cyberpunk'] })
    expect([...new Set(report.games.map((g) => g.gameId))]).toEqual(['cyberpunk'])
    expect(report.coverage.gamesTotal).toBe(1)
  })

  it('is a pure function — the same input gives an identical result', () => {
    expect(run()).toEqual(run())
  })
})
