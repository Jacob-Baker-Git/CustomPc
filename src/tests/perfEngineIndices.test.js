import { describe, it, expect } from 'vitest'
import { gpuIndexFor, cpuIndexFor, cellFor, exactFor, hasCoverage }
  from '../lib/perfEngine/indices'

const model = {
  modelVersion: '1.0.0',
  gpuIndex: {
    'gpu-rtx-5070': { '1080p': 61.4, '1440p': 62.0, '4k': 60.1, basis: 'measured', anchors: 11 },
    'gpu-rtx-4060': { '1080p': 30.2, '1440p': 30.2, '4k': 30.2, basis: 'measured', anchors: 4, copiedResolutions: ['1080p', '4k'] },
  },
  cpuIndex: { 'cpu-ryzen-5-7600x': { value: 71.2, basis: 'measured', anchors: 9 } },
  gameConst: {
    cyberpunk: { '1440p': { high: { A: 399.0, B: 402.0, sources: 3, cv: 0.052 } } },
  },
  exact: {
    'cpu-ryzen-5-7600x|gpu-rtx-5070|cyberpunk|1440p|high':
      { frameTimeMs: 7.4074, sources: 2, entries: 2 },
  },
}

describe('gpuIndexFor', () => {
  it('returns the measured index for the requested resolution', () => {
    expect(gpuIndexFor(model, { id: 'gpu-rtx-5070' }, '1440p'))
      .toEqual({ value: 62.0, basis: 'measured', anchors: 11, resolutionCopied: false })
  })

  it('flags a resolution that was copied rather than measured', () => {
    const r = gpuIndexFor(model, { id: 'gpu-rtx-4060' }, '4k')
    expect(r.resolutionCopied).toBe(true)
  })

  it('returns basis "none" for an uncovered card — never a guess', () => {
    // Phase 2 replaces this with a perfScore-derived prior. Until then the
    // honest answer is "no data", and the UI says so.
    expect(gpuIndexFor(model, { id: 'gpu-rx-9999', perfScore: 50 }, '1440p'))
      .toEqual({ value: null, basis: 'none', anchors: 0, resolutionCopied: false })
  })

  it('returns basis "none" for a missing part', () => {
    expect(cpuIndexFor(model, null).basis).toBe('none')
  })
})

describe('cellFor', () => {
  it('returns the fitted constants for a covered cell', () => {
    const cell = cellFor(model, { id: 'cyberpunk' }, '1440p', 'high')
    expect(cell).toMatchObject({ A: 399.0, B: 402.0, sources: 3 })
  })

  it('returns null for an uncovered cell', () => {
    expect(cellFor(model, { id: 'cyberpunk' }, '4k', 'high')).toBeNull()
    expect(cellFor(model, { id: 'starfield' }, '1440p', 'high')).toBeNull()
  })

  it('still returns a cell fitted from a GPU-only review, which has no B', () => {
    // B is the CPU-side constant, and a gpu-scaling review cannot produce one —
    // it pins a single CPU on purpose. Requiring B here threw the whole cell
    // away, taking its measured `lowBase` with it, so a 1% low backed by 25
    // measured rows silently became the 1.35 default and rendered under a
    // "measured" badge. B gates the two-way SPLIT, nothing else; the cell's
    // existence is A.
    const gpuOnly = { gameConst: { 'ghost-of-tsushima': { '1440p': {
      'sehr-hoch': { A: 712.25, sources: 1, lowBase: 1.0753, lowSources: 25 } } } } }
    const cell = cellFor(gpuOnly, { id: 'ghost-of-tsushima' }, '1440p', 'sehr-hoch')
    expect(cell).toMatchObject({ A: 712.25, lowBase: 1.0753 })
  })

  it('still returns null when even A is missing', () => {
    const noA = { gameConst: { g: { '1440p': { high: { lowBase: 1.2 } } } } }
    expect(cellFor(noA, { id: 'g' }, '1440p', 'high')).toBeNull()
  })
})

describe('exactFor', () => {
  it('returns the measurement for a combination that was actually tested', () => {
    expect(exactFor(model, {
      cpu: { id: 'cpu-ryzen-5-7600x' }, gpu: { id: 'gpu-rtx-5070' },
      game: { id: 'cyberpunk' }, resolution: '1440p', presetId: 'high',
    })).toEqual({ frameTimeMs: 7.4074, sources: 2, entries: 2 })
  })

  it('returns null when any part of the key differs', () => {
    const base = { cpu: { id: 'cpu-ryzen-5-7600x' }, gpu: { id: 'gpu-rtx-5070' },
                   game: { id: 'cyberpunk' }, resolution: '1440p', presetId: 'high' }
    expect(exactFor(model, { ...base, resolution: '4k' })).toBeNull()
    expect(exactFor(model, { ...base, presetId: 'ultra' })).toBeNull()
    expect(exactFor(model, { ...base, cpu: { id: 'cpu-other' } })).toBeNull()
  })

  it('refuses a key built from a missing part, rather than stringifying it', () => {
    // `${undefined}` is "undefined", so an unguarded key would be
    // "undefined|undefined|cyberpunk|1440p|high" — and a table holding a key of
    // that shape would match it and hand back a frame time for a build that
    // has no parts.
    const booby = {
      exact: { 'undefined|undefined|cyberpunk|1440p|high':
                 { frameTimeMs: 999, sources: 1, entries: 1 } },
    }
    const ctx = { game: { id: 'cyberpunk' }, resolution: '1440p', presetId: 'high' }
    expect(exactFor(booby, { ...ctx, cpu: null, gpu: undefined })).toBeNull()
    expect(exactFor(booby, { ...ctx, cpu: { id: 'cpu-x' }, gpu: null })).toBeNull()
    expect(exactFor(booby, { ...ctx, game: null, cpu: { id: 'a' }, gpu: { id: 'b' } })).toBeNull()
  })

  it('returns null against a model with no exact table', () => {
    expect(exactFor({}, { cpu: { id: 'a' }, gpu: { id: 'b' }, game: { id: 'c' },
                          resolution: '1440p', presetId: 'high' })).toBeNull()
  })
})

describe('hasCoverage', () => {
  it('is true only when both indices and the cell are present', () => {
    const cpu = { id: 'cpu-ryzen-5-7600x' }
    const gpu = { id: 'gpu-rtx-5070' }
    const game = { id: 'cyberpunk' }
    expect(hasCoverage(model, { cpu, gpu, game, resolution: '1440p', presetId: 'high' })).toBe(true)
    expect(hasCoverage(model, { cpu, gpu, game, resolution: '4k', presetId: 'high' })).toBe(false)
    expect(hasCoverage(model, { cpu, gpu: { id: 'gpu-x' }, game, resolution: '1440p', presetId: 'high' }))
      .toBe(false)
  })

  it('is false against an empty model', () => {
    const empty = { gpuIndex: {}, cpuIndex: {}, gameConst: {} }
    expect(hasCoverage(empty, {
      cpu: { id: 'a' }, gpu: { id: 'b' }, game: { id: 'c' },
      resolution: '1440p', presetId: 'high',
    })).toBe(false)
  })
})
