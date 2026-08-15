import { describe, it, expect } from 'vitest'
import { estimateBuildPerformance } from '../lib/perfEngine'
import { buildGameRows, RESOLUTIONS, BASIS_RANK } from '../lib/perfEngine/gameRows'
import model from '../data/perfModel.json'
import games from '../data/perfGames.json'
import parts from '../data/partsData.json'

const list = Array.isArray(parts) ? parts : parts.parts
const pick = (id) => list.find((p) => p.id === id)
const gameList = Array.isArray(games) ? games : games.games

const reportsFor = (cpuId, gpuId) => Object.fromEntries(RESOLUTIONS.map((res) => [
  res,
  estimateBuildPerformance({
    parts: { cpu: pick(cpuId), gpu: pick(gpuId) }, resolution: res, model, games: gameList,
  }),
]))

describe('the grouped rows against the committed corpus', () => {
  const rows = buildGameRows(reportsFor('cpu-i5-13600k', 'gpu-rtx-4070'))

  it('produces a row for most of the game list', () => {
    expect(rows.length).toBeGreaterThan(40)
  })

  it('fills close to 90% of the grid', () => {
    // The case for three columns at all. Measured at 89.9% against the
    // committed implementation: 41 of 56 games fill all three, 13 fill two, 2
    // fill one. If this collapses, the columns are mostly dashes and the design
    // needs revisiting rather than the threshold lowering.
    const filled = rows.reduce(
      (n, g) => n + RESOLUTIONS.filter((res) => g.cells[res]).length, 0)
    const pct = filled / (rows.length * RESOLUTIONS.length) * 100
    expect(pct).toBeGreaterThan(80)
    expect(pct).toBeLessThanOrEqual(100)
  })

  it('shows the heaviest preset except in a handful of games', () => {
    // Coverage outranks tier, which can demote a game to lighter settings.
    //
    // ⚠️ Two different numbers get confused here. SIX of 56 games pick a
    // different preset than "heaviest" would — but five of those are the same
    // TIER (the German/English and DLSS label pairs), so they are not
    // demotions at all. Measured against the committed implementation, exactly
    // ONE game is a real tier drop: Dragon's Dogma 2 shows High (3
    // resolutions) instead of Grafik priorisieren (2).
    //
    // This counts tier drops, so the live figure is 1. The bound is loose on
    // purpose — it is a drift alarm, not a pin.
    let demoted = 0
    for (const g of rows) {
      const heaviest = Math.max(g.presetTier ?? 0,
        ...g.otherPresets.map((p) => p.presetTier ?? 0))
      if ((g.presetTier ?? 0) < heaviest) demoted++
    }
    expect(demoted).toBeLessThan(6)
  })

  it('never shows a cell whose preset differs from the row’s', () => {
    // The invariant the three columns depend on, asserted over the real corpus
    // rather than a fixture. A 1080p column showing Ultra beside a 4K column
    // showing High is not a comparison, and nothing on the row would say so.
    let checked = 0
    for (const g of rows) {
      for (const res of RESOLUTIONS) {
        if (!g.cells[res]) continue
        expect(g.cells[res].presetId, `${g.gameId} ${res}`).toBe(g.presetId)
        expect(g.cells[res].upscaling, `${g.gameId} ${res}`).toBe(g.upscaling)
        checked++
      }
    }
    // Guards against the loop above iterating zero times and passing vacuously.
    expect(checked).toBeGreaterThan(100)
  })

  it('never reports a basis stronger than any cell it shows', () => {
    // ⚠️ Runs against the ANCHOR build, not the unindexed one. Every row of the
    // i5-13600K build has the same basis in all three of its cells, so weakest
    // and strongest coincide and the assertion cannot tell them apart — the
    // first draft of this test used that build and passed happily against an
    // implementation that took the STRONGEST cell. Verified by mutation.
    //
    // The 9800X3D genuinely has mixed rows: `measured` at 1080p where a review
    // benchmarked that exact combination, `ceiling` at 1440p where none did.
    const anchor = buildGameRows(reportsFor('cpu-ryzen-7-9800x3d', 'gpu-rtx-4070'))

    let mixed = 0
    for (const g of anchor) {
      const shown = RESOLUTIONS.map((r) => g.cells[r]).filter(Boolean)
      const ranks = shown.map((r) => BASIS_RANK[r.basis] ?? -1)
      if (new Set(ranks).size > 1) mixed++
      expect(BASIS_RANK[g.basis], g.gameId).toBe(Math.min(...ranks))
    }

    // Without this the test silently reverts to vacuous the day the corpus
    // stops producing mixed-basis rows.
    expect(mixed, 'no row has cells of differing basis — assertion is vacuous')
      .toBeGreaterThan(0)
  })

  it('keeps a measured game measured for the build that has measurements', () => {
    // The 9800X3D + 4070 pair has 77 exact ROWS at 1080p; after grouping it has
    // 78 measured CELLS across all three resolutions. Different units — do not
    // "correct" one to the other. Grouping must not cost a measurement its
    // tier, but it MAY weaken the ROW whose 1440p cell is a ceiling, which is
    // why this counts cells rather than rows.
    const anchor = buildGameRows(reportsFor('cpu-ryzen-7-9800x3d', 'gpu-rtx-4070'))
    const measuredCells = anchor.reduce(
      (n, g) => n + RESOLUTIONS.filter((r) => g.cells[r]?.basis === 'measured').length, 0)
    expect(measuredCells).toBeGreaterThan(30)
  })

  it('answers for an unindexed chip exactly as widely as for the anchor', () => {
    // The i5-13600K is one of the ~54 catalogue CPUs no review has charted.
    //
    // ⚠️ What makes it answer is the CEILING row, not the spec-derived prior.
    // Verified by mutation: killing the CPU prior fallback in indices.js
    // entirely leaves this whole file green, because a ceiling row needs only a
    // fitted cell constant and a GPU index, and the RTX 4070 has both. The
    // prior upgrades roughly five rows per build from `ceiling` to
    // `spec-derived`; it does not create coverage. An earlier version of this
    // comment claimed the opposite.
    //
    // So coverage is decided by which cells the corpus fits and which GPU is
    // fitted — never by which CPU is. The two builds therefore cover the SAME
    // games at the SAME resolutions on the SAME preset, differing only in what
    // each cell is worth. Measured: 0 games differ.
    //
    // ⚠️ Compared PER GAME, not positionally. Rows are sorted by bestFps, and
    // the anchor's measured figures order them differently, so comparing the
    // two lists index-by-index fails on identical data. The first draft of this
    // test did exactly that and looked like a real coverage regression.
    const anchor = buildGameRows(reportsFor('cpu-ryzen-7-9800x3d', 'gpu-rtx-4070'))
    expect(rows.length).toBe(anchor.length)

    const byId = (rs) => new Map(rs.map((g) => [g.gameId, g]))
    const mine = byId(rows)
    const theirs = byId(anchor)
    expect([...mine.keys()].sort()).toEqual([...theirs.keys()].sort())

    for (const [gameId, g] of mine) {
      const other = theirs.get(gameId)
      expect(g.presetId, gameId).toBe(other.presetId)
      for (const res of RESOLUTIONS) {
        expect(Boolean(g.cells[res]), `${gameId} ${res}`).toBe(Boolean(other.cells[res]))
      }
    }

    // ...and the two builds genuinely differ in EVIDENCE, or everything above
    // is comparing a build with itself and proves nothing.
    const measured = (rs) => rs.filter((g) => g.basis === 'measured').length
    expect(measured(rows)).toBe(0)
    expect(measured(anchor)).toBeGreaterThan(0)
  })
})
