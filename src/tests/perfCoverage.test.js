import { describe, it, expect } from 'vitest'
import { estimateBuildPerformance } from '../lib/perfEngine'
import model from '../data/perfModel.json'
import games from '../data/perfGames.json'
import parts from '../data/partsData.json'

const list = Array.isArray(parts) ? parts : parts.parts
const pick = (id) => list.find((p) => p.id === id)
const gameList = Array.isArray(games) ? games : games.games
const answered = (cpuId, gpuId, resolution) => estimateBuildPerformance({
  parts: { cpu: pick(cpuId), gpu: pick(gpuId) }, resolution, model, games: gameList,
}).games.filter((r) => r.avgFps > 0)

describe('coverage after the widening', () => {
  it('answers for a CPU no review ever charted', () => {
    // Before this work, an i5-13600K build answered ZERO rows at every
    // resolution — a completely blank tab for 54 of 80 catalogue chips.
    expect(answered('cpu-i5-13600k', 'gpu-rtx-4070', '1440p').length).toBeGreaterThan(20)
  })

  it('answers at 1080p, which used to answer nothing', () => {
    expect(answered('cpu-ryzen-5-7600', 'gpu-rtx-4070', '1080p').length).toBeGreaterThan(20)
  })

  it('answers far more games than the 5 the two-way cells allowed', () => {
    expect(answered('cpu-ryzen-5-7600', 'gpu-rtx-4070', '1440p').length).toBeGreaterThan(20)
  })

  it('marks every ceiling row as an upper bound and none as measured', () => {
    for (const r of answered('cpu-i5-13600k', 'gpu-rtx-4070', '1440p')) {
      if (r.basis === 'ceiling') expect(r.bound, r.rowId).toBe('upper')
      if (r.caveats.length) expect(r.basis, r.rowId).not.toBe('measured')
    }
  })

  it('produces ceiling rows at all, so the assertion above is not vacuous', () => {
    // A-only cells outnumber two-way cells 12 to 1 in this corpus. If none
    // reached the report, the widening did not happen and the test above passed
    // by iterating over nothing.
    const rows = answered('cpu-i5-13600k', 'gpu-rtx-4070', '1440p')
    expect(rows.filter((r) => r.basis === 'ceiling').length).toBeGreaterThan(10)
  })

  it('still short-circuits to a real measurement where one exists', () => {
    // The widening must not cost the exact rows their precedence.
    const rows = answered('cpu-ryzen-7-9800x3d', 'gpu-rtx-4070', '1080p')
    expect(rows.some((r) => r.basis === 'measured')).toBe(true)
  })

  it('reports no split for a ceiling row rather than inventing one', () => {
    // With no CPU constant there is nothing to attribute the frame time with.
    // A share of 0.5 would look exactly like a measured balanced build.
    const ceilings = answered('cpu-i5-13600k', 'gpu-rtx-4070', '1440p')
      .filter((r) => r.basis === 'ceiling')
    expect(ceilings.length).toBeGreaterThan(0)
    for (const r of ceilings) {
      expect(r.cpuShare, r.rowId).toBeNull()
      expect(r.limitedBy, r.rowId).toBeNull()
      expect(r.cpuOnlyFps, r.rowId).toBeNull()
      // but the GPU side IS known — that is the whole basis of the ceiling
      expect(r.gpuOnlyFps, r.rowId).toBeGreaterThan(0)
    }
  })

  it('never reports measured for a row the corpus did not benchmark exactly', () => {
    // The founding rule, at the level of a whole real report rather than one
    // composeBasis call. Every 'measured' row must have an exact table entry.
    for (const res of ['1080p', '1440p', '4k']) {
      for (const r of answered('cpu-i5-13600k', 'gpu-rtx-4070', res)) {
        // The 13600K is not in the exact table at all, so nothing here may
        // claim to be measured.
        expect(r.basis, `${res} ${r.rowId}`).not.toBe('measured')
      }
    }
  })

  it('keeps a two-way row a point estimate, not a ceiling', () => {
    // The widening adds a weaker tier; it must not demote the rows that already
    // had both constants.
    //
    // NOT the anchor pair. 9800X3D + 4070 has both constants on five 1440p
    // cells and is in the exact table for every one of them, so it short-
    // circuits to `measured` and yields no `modelled` row at all — this test
    // failed against a correct implementation until the fixture changed. An
    // indexed non-anchor chip is what exercises the two-way path.
    const rows = answered('cpu-ryzen-5-7600', 'gpu-rtx-4070', '1440p')
    const twoWay = rows.filter((r) => r.basis === 'modelled')
    expect(twoWay.length).toBeGreaterThan(0)
    for (const r of twoWay) {
      expect(r.bound, r.rowId).toBe('point')
      expect(r.cpuShare, r.rowId).not.toBeNull()
      expect(r.cpuOnlyFps, r.rowId).toBeGreaterThan(0)
    }
  })

  it('does not cost a measurement its precedence', () => {
    // The 9800X3D + 4070 pair answered 77 exact rows at 1080p before any of
    // this. Widening must only ADD weaker rows beneath them; a drop here would
    // mean a real benchmark had been displaced by a model of it.
    const rows = answered('cpu-ryzen-7-9800x3d', 'gpu-rtx-4070', '1080p')
    expect(rows.filter((r) => r.basis === 'measured').length).toBeGreaterThanOrEqual(77)
    expect(rows.length).toBeGreaterThan(77)
  })
})
