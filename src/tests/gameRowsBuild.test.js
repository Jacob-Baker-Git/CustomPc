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

  it('accumulates a candidate’s basis to the weakest of ITS OWN rows before selectPreset runs', () => {
    // One level earlier than the per-cell WEAKEST-basis rule below: before
    // selectPreset ever compares two candidates, each candidate's OWN basis
    // has to already be the weakest thing true of it. `ultra` reads
    // `measured` at 1080p but only `ceiling` at 1440p — without accumulation
    // it would keep whatever its first-seen row set (`measured`) and win the
    // evidence tie-break it should lose.
    //
    // Coverage and tier are pinned equal on both candidates so only the basis
    // tie-break in compareCandidates can decide.
    const out = buildGameRows(reports({
      '1080p': [
        row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, basis: 'measured', avgFps: 200 }),
        row({ rowId: 'g|ultrahoch|native', presetId: 'ultrahoch', presetTier: 4, basis: 'modelled', avgFps: 190 }),
      ],
      '1440p': [
        row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, basis: 'ceiling', avgFps: 150 }),
        row({ rowId: 'g|ultrahoch|native', presetId: 'ultrahoch', presetTier: 4, basis: 'modelled', avgFps: 140 }),
      ],
    }))
    // `ultrahoch` stays `modelled` (rank 2) throughout. `ultra` is weakened
    // to `ceiling` (rank 0) by its 1440p row, so `ultrahoch` has the better
    // evidence once accumulation has actually run.
    expect(out[0].presetId).toBe('ultrahoch')
  })

  it('accumulates a candidate’s avgFps to the lowest of ITS OWN rows before selectPreset runs', () => {
    // Same mechanism, one tie-break level further down: coverage, tier AND
    // basis are pinned equal here so only the accumulated avgFps decides.
    // `dipped`'s FIRST row (300) is not its lowest — the 1440p row (50) is —
    // so this only passes if the candidate's tracked avgFps keeps updating
    // rather than freezing at whatever the first row set.
    const out = buildGameRows(reports({
      '1080p': [
        row({ rowId: 'g|steady|native', presetId: 'steady', presetTier: 4, basis: 'modelled', avgFps: 100 }),
        row({ rowId: 'g|dipped|native', presetId: 'dipped', presetTier: 4, basis: 'modelled', avgFps: 300 }),
      ],
      '1440p': [
        row({ rowId: 'g|steady|native', presetId: 'steady', presetTier: 4, basis: 'modelled', avgFps: 200 }),
        row({ rowId: 'g|dipped|native', presetId: 'dipped', presetTier: 4, basis: 'modelled', avgFps: 50 }),
      ],
    }))
    // `steady`'s lowest row is 100 (its first). `dipped`'s lowest is 50 (its
    // second) — under-promising means the lower accumulated rate wins, so
    // `dipped` should take it, but only once its 1440p row has been folded in.
    expect(out[0].presetId).toBe('dipped')
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

  it('deduplicates a caveat seen on more than one cell', () => {
    // A caveat true at one resolution is still true of the row (see the
    // caveats comment in the implementation) — but true at TWO resolutions,
    // it should still only appear once. No prior fixture ever gave two shown
    // cells an overlapping caveat, so this behaviour was unexercised.
    const out = buildGameRows(reports({
      '1080p': [row({ caveats: ['cpu-index-prior'] })],
      '1440p': [row({ caveats: ['cpu-index-prior'] })],
      '4k': [row({ caveats: ['resolution-copied'] })],
    }))
    // Sorted for comparison — the row isn't contracted to any particular
    // iteration order, only to each caveat appearing exactly once.
    expect([...out[0].caveats].sort()).toEqual(['cpu-index-prior', 'resolution-copied'])
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

  it('orders otherPresets heaviest tier first', () => {
    // The single-entry test above never exercises ordering at all — with one
    // item there's nothing to sort. Insertion order here is deliberately the
    // OPPOSITE of the expected output (`low` is seen before `medium`), so a
    // build with the sort deleted — leaving otherPresets in whatever order
    // the candidates were found — cannot pass by the same insertion-order
    // coincidence that hid the selectPreset bypass in "uses the SAME preset
    // in every cell" above.
    const out = buildGameRows(reports({
      '1080p': [
        row({ rowId: 'g|low|native', presetId: 'low', presetTier: 1, avgFps: 900 }),
        row({ rowId: 'g|medium|native', presetId: 'medium', presetTier: 2, avgFps: 500 }),
        row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, avgFps: 300 }),
      ],
      '1440p': [row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, avgFps: 200 })],
      '4k': [row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, avgFps: 100 })],
    }))
    expect(out[0].presetId).toBe('ultra')
    expect(out[0].otherPresets.map((p) => p.presetId)).toEqual(['medium', 'low'])
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

  it('falls back to gameId so a bestFps tie cannot be decided by array order', () => {
    // Same shape as the otherPresets sort test above: 'zulu' is inserted
    // BEFORE 'alpha', opposing byte order, so a stable sort with the
    // tie-break gutted to a no-op would keep 'zulu' first — the exact
    // "decided by array order" bug this file's own comment at :35-37 cites
    // as a real shipped defect (F1 24, 2.3x difference decided by nothing).
    const out = buildGameRows(reports({
      '1080p': [
        row({ gameId: 'zulu', name: 'Zulu', rowId: 'zulu|ultra|native', avgFps: 200 }),
        row({ gameId: 'alpha', name: 'Alpha', rowId: 'alpha|ultra|native', avgFps: 200 }),
      ],
      '1440p': [], '4k': [],
    }))
    expect(out.map((g) => g.gameId)).toEqual(['alpha', 'zulu'])
  })
})
