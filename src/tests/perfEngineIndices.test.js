import { describe, it, expect } from 'vitest'
import { gpuIndexFor, cpuIndexFor, cellFor, cellKeyFor, exactFor, exactKey, hasCoverage }
  from '../lib/perfEngine/indices'

const model = {
  modelVersion: '1.0.0',
  gpuIndex: {
    'gpu-rtx-5070': { '1080p': 61.4, '1440p': 62.0, '4k': 60.1, basis: 'measured', anchors: 11 },
    'gpu-rtx-4060': { '1080p': 30.2, '1440p': 30.2, '4k': 30.2, basis: 'measured', anchors: 4, copiedResolutions: ['1080p', '4k'] },
  },
  cpuIndex: { 'cpu-ryzen-5-7600x': { value: 71.2, basis: 'measured', anchors: 9 } },
  gameConst: {
    cyberpunk: { '1440p': { 'high|native': { A: 399.0, B: 402.0, sources: 3, cv: 0.052 } } },
  },
  exact: {
    'cpu-ryzen-5-7600x|gpu-rtx-5070|cyberpunk|1440p|high|native':
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
    const cell = cellFor(model, { id: 'cyberpunk' }, '1440p', 'high', 'native')
    expect(cell).toMatchObject({ A: 399.0, B: 402.0, sources: 3 })
  })

  it('returns null for an uncovered cell', () => {
    expect(cellFor(model, { id: 'cyberpunk' }, '4k', 'high', 'native')).toBeNull()
    expect(cellFor(model, { id: 'starfield' }, '1440p', 'high', 'native')).toBeNull()
  })

  it('still returns a cell fitted from a GPU-only review, which has no B', () => {
    // B is the CPU-side constant, and a gpu-scaling review cannot produce one —
    // it pins a single CPU on purpose. Requiring B here threw the whole cell
    // away, taking its measured `lowBase` with it, so a 1% low backed by 25
    // measured rows silently became the 1.35 default and rendered under a
    // "measured" badge. B gates the two-way SPLIT, nothing else; the cell's
    // existence is A.
    const gpuOnly = { gameConst: { 'ghost-of-tsushima': { '1440p': {
      'sehr-hoch|native': { A: 712.25, sources: 1, lowBase: 1.0753, lowSources: 25 } } } } }
    const cell = cellFor(gpuOnly, { id: 'ghost-of-tsushima' }, '1440p', 'sehr-hoch', 'native')
    expect(cell).toMatchObject({ A: 712.25, lowBase: 1.0753 })
  })

  it('still returns null when even A is missing', () => {
    const noA = { gameConst: { g: { '1440p': { 'high|native': { lowBase: 1.2 } } } } }
    expect(cellFor(noA, { id: 'g' }, '1440p', 'high', 'native')).toBeNull()
  })
})

describe('exactFor', () => {
  it('returns the measurement for a combination that was actually tested', () => {
    expect(exactFor(model, {
      cpu: { id: 'cpu-ryzen-5-7600x' }, gpu: { id: 'gpu-rtx-5070' },
      game: { id: 'cyberpunk' }, resolution: '1440p', presetId: 'high', upscaling: 'native',
    })).toEqual({ frameTimeMs: 7.4074, sources: 2, entries: 2 })
  })

  it('returns null when any part of the key differs', () => {
    const base = { cpu: { id: 'cpu-ryzen-5-7600x' }, gpu: { id: 'gpu-rtx-5070' },
                   game: { id: 'cyberpunk' }, resolution: '1440p', presetId: 'high',
                   upscaling: 'native' }
    expect(exactFor(model, { ...base, resolution: '4k' })).toBeNull()
    expect(exactFor(model, { ...base, presetId: 'ultra' })).toBeNull()
    expect(exactFor(model, { ...base, cpu: { id: 'cpu-other' } })).toBeNull()
    // The render scale is part of the key: the same hardware measured with
    // upscaling on is a different measurement, not the same one.
    expect(exactFor(model, { ...base, upscaling: 'quality' })).toBeNull()
  })

  it('refuses a key built from a missing part, rather than stringifying it', () => {
    // `${undefined}` is "undefined", so an unguarded key would be
    // "undefined|undefined|cyberpunk|1440p|high" — and a table holding a key of
    // that shape would match it and hand back a frame time for a build that
    // has no parts.
    const booby = {
      exact: { 'undefined|undefined|cyberpunk|1440p|high|native':
                 { frameTimeMs: 999, sources: 1, entries: 1 } },
    }
    const ctx = { game: { id: 'cyberpunk' }, resolution: '1440p', presetId: 'high',
                  upscaling: 'native' }
    expect(exactFor(booby, { ...ctx, cpu: null, gpu: undefined })).toBeNull()
    expect(exactFor(booby, { ...ctx, cpu: { id: 'cpu-x' }, gpu: null })).toBeNull()
    expect(exactFor(booby, { ...ctx, game: null, cpu: { id: 'a' }, gpu: { id: 'b' } })).toBeNull()
  })

  it('returns null against a model with no exact table', () => {
    expect(exactFor({}, { cpu: { id: 'a' }, gpu: { id: 'b' }, game: { id: 'c' },
                          resolution: '1440p', presetId: 'high',
                          upscaling: 'native' })).toBeNull()
  })
})

describe('cell keys carry upscaling', () => {
  // An upscaled frame rate is not a native one, and the two are
  // indistinguishable once they share a cell. Pairing an A fitted from
  // DLSS-Quality rows with a B fitted from native rows produces a blended frame
  // time that describes neither measurement.
  const scaled = {
    gameConst: {
      wukong: {
        '1440p': {
          'kino|native': { A: 100, B: 50 },
          'kino|quality': { A: 160, B: 50 },
        },
      },
    },
  }

  it('separates the same preset measured at different render scales', () => {
    expect(cellFor(scaled, { id: 'wukong' }, '1440p', 'kino', 'native').A).toBe(100)
    expect(cellFor(scaled, { id: 'wukong' }, '1440p', 'kino', 'quality').A).toBe(160)
  })

  it('returns null for an upscaling mode nobody measured', () => {
    expect(cellFor(scaled, { id: 'wukong' }, '1440p', 'kino', 'performance')).toBeNull()
  })

  it('builds the composite key in one place', () => {
    expect(cellKeyFor('kino', 'native')).toBe('kino|native')
  })

  it('keys the exact table on upscaling too', () => {
    expect(exactKey({
      cpu: { id: 'c' }, gpu: { id: 'g' }, game: { id: 'wukong' },
      resolution: '1440p', presetId: 'kino', upscaling: 'quality',
    })).toBe('c|g|wukong|1440p|kino|quality')
  })
})

describe('hasCoverage', () => {
  it('is true only when both indices and the cell are present', () => {
    const cpu = { id: 'cpu-ryzen-5-7600x' }
    const gpu = { id: 'gpu-rtx-5070' }
    const game = { id: 'cyberpunk' }
    const at = (over) => hasCoverage(model, {
      cpu, gpu, game, resolution: '1440p', presetId: 'high', upscaling: 'native', ...over,
    })
    expect(at()).toBe(true)
    expect(at({ resolution: '4k' })).toBe(false)
    expect(at({ gpu: { id: 'gpu-x' } })).toBe(false)
    expect(at({ upscaling: 'quality' })).toBe(false)
  })

  it('is false against an empty model', () => {
    const empty = { gpuIndex: {}, cpuIndex: {}, gameConst: {} }
    expect(hasCoverage(empty, {
      cpu: { id: 'a' }, gpu: { id: 'b' }, game: { id: 'c' },
      resolution: '1440p', presetId: 'high', upscaling: 'native',
    })).toBe(false)
  })
})
