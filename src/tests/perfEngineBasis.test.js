import { describe, it, expect } from 'vitest'
import { estimateBuildPerformance } from '../lib/perfEngine'

// A hand-built model, not the live corpus: this test is about whether
// estimateGame WIRES its inputs into composeBasis, and a fixture is the only
// way to guarantee the interesting cases exist. Against real data the
// assertions would quietly iterate zero rows the day a refit moves coverage
// — green for the wrong reason, which is the exact failure basisMix's own
// comment was written to avoid.
const cpu = { id: 'cpu-x', name: 'Test CPU', perfScore: 70 }
const gpu = { id: 'gpu-x', name: 'Test GPU', perfScore: 50 }
const games = [
  { id: 'g1', name: 'Covered Game', presets: [{ id: 'ultra', label: 'Ultra', tier: 4, upscaling: 'native' }] },
  // No gameConst entry at all below — stays unanswered at any resolution.
  { id: 'g2', name: 'Uncovered Game', presets: [{ id: 'ultra', label: 'Ultra', tier: 4, upscaling: 'native' }] },
]

const model = {
  modelVersion: '1.0.0',
  datasetVersion: 'test',
  blendK: 5.1,
  resCpuScale: { '1440p': 1.0, '4k': 1.03 },
  // gpu-x has a real figure at 1440p; 4k is listed in copiedResolutions, i.e.
  // carried over rather than measured. That is the one input this file exists
  // to prove actually reaches composeBasis and comes back out as a caveat.
  gpuIndex: {
    'gpu-x': { '1440p': 50, '4k': 50, basis: 'measured', anchors: 10, copiedResolutions: ['4k'] },
  },
  cpuIndex: {
    'cpu-x': { value: 60, basis: 'measured', anchors: 10 },
  },
  gameConst: {
    g1: {
      '1440p': { 'ultra|native': { A: 500, B: 400, sources: 3 } },
      '4k': { 'ultra|native': { A: 900, B: 400, sources: 3 } },
    },
  },
  // An exact reading of g1 at 1440p only, so the 4k row has nothing to fall
  // back on but the model — which is what puts it on the copied-index path.
  exact: {
    'cpu-x|gpu-x|g1|1440p|ultra|native': { frameTimeMs: 9.0, sources: 2 },
  },
}

const report = (resolution) => estimateBuildPerformance({
  parts: { cpu, gpu }, resolution, model, games,
})

describe('estimateGame wires its inputs into composeBasis', () => {
  it('flags a resolution-copied caveat on a modelled row', () => {
    // Only correct wiring produces this: a stub that hardcodes basis without
    // consulting composeBasis has no way to know gpu-x's 4k figure was copied,
    // so it cannot put this caveat on the row.
    const row = report('4k').games.find((r) => r.gameId === 'g1')
    expect(row.basis).toBe('modelled')
    expect(row.caveats).toContain('resolution-copied')
  })

  it('carries no resolution-copied caveat where the index was not copied', () => {
    const row = report('1440p').games.find((r) => r.gameId === 'g1')
    expect(row.caveats).not.toContain('resolution-copied')
  })

  it('short-circuits an exact measurement to measured, point, no caveats', () => {
    const row = report('1440p').games.find((r) => r.gameId === 'g1')
    expect(row.basis).toBe('measured')
    expect(row.bound).toBe('point')
    expect(row.caveats).toEqual([])
  })

  it('leaves an unanswered row alone', () => {
    const row = report('1440p').games.find((r) => r.gameId === 'g2')
    expect(row.basis).toBe('none')
    expect(row.avgFps).toBeNull()
    expect(row.bound).toBe('point')
    expect(row.caveats).toEqual([])
  })
})
