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
    cyberpunk: { '1440p': { high: { A: 399.0, B: 402.0, sources: 3, cv: 0.052 } } },
    'elden-ring': { '1440p': { high: { A: 200.0, B: 200.0, sources: 2, cv: 0.03 } } },
  },
}

const run = (over = {}) => estimateBuildPerformance({
  parts: { cpu, gpu }, resolution: '1440p', presetId: 'high',
  model, games, ...over,
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
      exact: { 'cpu-ryzen-5-7600x|gpu-rtx-5070|cyberpunk|1440p|high':
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
      exact: { 'cpu-ryzen-5-7600x|gpu-rtx-5070|cyberpunk|1440p|high':
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

  it('reports no data rather than guessing for an uncovered game', () => {
    const row = run().games.find((g) => g.gameId === 'starfield')
    expect(row.basis).toBe('none')
    expect(row.avgFps).toBeNull()
  })

  it('sorts covered games above uncovered ones, fastest first', () => {
    // cyberpunk 143, elden-ring capped at 60, starfield uncovered.
    const ids = run().games.map((g) => g.gameId)
    expect(ids).toEqual(['cyberpunk', 'elden-ring', 'starfield'])
  })

  it('summarises coverage across the selected games', () => {
    const report = run()
    expect(report.coverage).toEqual({
      gamesAnswered: 2, gamesExact: 0, gamesTotal: 3,
      gpuBasis: 'measured', cpuBasis: 'measured',
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
    expect(run({ gameIds: ['cyberpunk'] }).games.map((g) => g.gameId)).toEqual(['cyberpunk'])
  })

  it('is a pure function — the same input gives an identical result', () => {
    expect(run()).toEqual(run())
  })
})
