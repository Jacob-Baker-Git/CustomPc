import { describe, it, expect } from 'vitest'
import { buildGameRows } from '../lib/perfEngine/gameRows'

const row = (over = {}) => ({
  rowId: 'g|ultra|native', gameId: 'g', name: 'Game', preset: 'Ultra',
  presetId: 'ultra', presetTier: 4, upscaling: 'native',
  avgFps: 100, lowFps: 80, frameTimeMs: 10, basis: 'ceiling', bound: 'upper',
  caveats: [], errorPct: null, cpuShare: null, limitedBy: null,
  ...over,
})

const reports = (byRes) => Object.fromEntries(
  Object.entries(byRes).map(([res, games]) => [res, { games }]),
)

describe('buildGameRows', () => {
  it('produces one entry per game, with a cell per resolution', () => {
    const out = buildGameRows(reports({
      '1080p': [row({ avgFps: 300 })],
      '1440p': [row({ avgFps: 200 })],
      '4k': [row({ avgFps: 100 })],
    }))
    expect(out).toHaveLength(1)
    expect(out[0].gameId).toBe('g')
    expect(out[0].cells['1080p'].avgFps).toBe(300)
    expect(out[0].cells['4k'].avgFps).toBe(100)
  })

  it('leaves a cell null where that resolution has no answer', () => {
    // Must be null, never 0 — the table renders a dash for null and a dash is
    // "no data", while a 0 reads as "zero frames per second".
    const out = buildGameRows(reports({
      '1080p': [row({ avgFps: 300 })],
      '1440p': [row({ avgFps: null, basis: 'none' })],
      '4k': [row({ avgFps: 100 })],
    }))
    expect(out[0].cells['1440p']).toBeNull()
    expect(out[0].cells['1080p'].avgFps).toBe(300)
  })

  it('uses the SAME preset in every cell', () => {
    // The whole point. A 1080p column showing Ultra beside a 4K column showing
    // High is not a comparison, and nothing on the row would say so.
    //
    // Checked in BOTH array orders, the same way gameRows.test.js's presetKey
    // fallback test does. buildGameRows groups candidates into a Map keyed by
    // presetKey, and internally 'high' happens to be the second (last) key
    // inserted for the first ordering below — so a build that quietly dropped
    // the selectPreset() call for "just take the last candidate seen" would
    // pass this test by coincidence in that one order. Running the reverse
    // order too (where 'high' is inserted FIRST) means only the real
    // coverage rule, not insertion order, can satisfy both.
    const ultra = row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, avgFps: 300 })
    const high = row({ rowId: 'g|high|native', presetId: 'high', presetTier: 3, avgFps: 400 })
    const build = (firstResRows) => buildGameRows(reports({
      '1080p': firstResRows,
      '1440p': [row({ rowId: 'g|high|native', presetId: 'high', presetTier: 3, avgFps: 250 })],
      '4k': [row({ rowId: 'g|high|native', presetId: 'high', presetTier: 3, avgFps: 120 })],
    }))

    for (const out of [build([ultra, high]), build([high, ultra])]) {
      // `high` answers at three resolutions, `ultra` at one — coverage wins.
      expect(out[0].presetId).toBe('high')
      for (const res of ['1080p', '1440p', '4k']) {
        expect(out[0].cells[res].presetId, res).toBe('high')
      }
    }
  })

  it('reports the WEAKEST basis across the cells it shows', () => {
    // Matches rowBasis.js: a row is only as strong as its weakest input. The
    // 9800X3D really does read `measured` at 1080p and `ceiling` at 1440p, so
    // this is the live case, not a hypothetical.
    const out = buildGameRows(reports({
      '1080p': [row({ basis: 'measured', bound: 'point' })],
      '1440p': [row({ basis: 'ceiling', bound: 'upper' })],
      '4k': [row({ basis: 'measured', bound: 'point' })],
    }))
    expect(out[0].basis).toBe('ceiling')
  })

  it('takes the WORST error band across the cells, never the average', () => {
    const out = buildGameRows(reports({
      '1080p': [row({ basis: 'spec-derived', errorPct: 6 })],
      '1440p': [row({ basis: 'spec-derived', errorPct: 34 })],
      '4k': [row({ basis: 'spec-derived', errorPct: 8 })],
    }))
    expect(out[0].errorPct).toBe(34)
  })

  it('lists the game’s other presets for the expansion', () => {
    const out = buildGameRows(reports({
      '1080p': [
        row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, avgFps: 300 }),
        row({ rowId: 'g|low|native', presetId: 'low', presetTier: 1, avgFps: 900 }),
      ],
      '1440p': [row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, avgFps: 200 })],
      '4k': [row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, avgFps: 100 })],
    }))
    expect(out[0].presetId).toBe('ultra')
    expect(out[0].otherPresets.map((p) => p.presetId)).toEqual(['low'])
  })

  it('drops a game nothing answered for', () => {
    const out = buildGameRows(reports({
      '1080p': [row({ avgFps: null, basis: 'none' })],
      '1440p': [row({ avgFps: null, basis: 'none' })],
      '4k': [row({ avgFps: null, basis: 'none' })],
    }))
    expect(out).toEqual([])
  })

  it('orders games by their best frame rate, fastest first', () => {
    const out = buildGameRows(reports({
      '1080p': [
        row({ gameId: 'slow', name: 'Slow', rowId: 'slow|ultra|native', avgFps: 40 }),
        row({ gameId: 'fast', name: 'Fast', rowId: 'fast|ultra|native', avgFps: 300 }),
      ],
      '1440p': [], '4k': [],
    }))
    expect(out.map((g) => g.gameId)).toEqual(['fast', 'slow'])
  })
})
