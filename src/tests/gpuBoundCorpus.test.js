import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { atDeclaredCap, peerRatioOutliers } from '../lib/perfEngine/gpuBound'

// resolve off cwd, not import.meta.url: under jsdom that is an http:// URL and
// readFileSync rejects it. Same approach as sitemap.test.js.
const read = (p) => JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))

describe('the rejection rule against the committed corpus', () => {
  const entries = read('data/benchmarks/entries.json')
  const rows = Array.isArray(entries) ? entries : entries.entries
  const sources = read('data/benchmarks/sources.json')
  const srcList = Array.isArray(sources) ? sources : sources.sources
  const kindOf = new Map(srcList.map((s) => [s.id, s.kind]))

  // Grouped by the TEST CPU, not by review: Notebookcheck publishes one review
  // per GPU, so a review is a single card and would never form a peer group.
  // The CPU is what sets the ceiling, so it is what defines the peers.
  const cells = new Map()
  for (const r of rows) {
    if (kindOf.get(r.sourceId) !== 'gpu-scaling') continue
    if (!['1080p', '1440p'].includes(r.resolution) || !(r.avgFps > 0)) continue
    const k = `${r.cpuId}|${r.gameId}|${r.presetId}|${r.upscaling}`
    cells.set(k, cells.get(k) ?? new Map())
    const g = cells.get(k)
    const cur = g.get(r.gpuId) ?? { gpuId: r.gpuId }
    g.set(r.gpuId, { ...cur, [r.resolution === '1080p' ? 'fps1080' : 'fps1440']: r.avgFps })
  }

  let judged = 0, rejected = 0
  for (const g of cells.values()) {
    const cell = [...g.values()].filter((c) => c.fps1080 > 0 && c.fps1440 > 0)
    if (cell.length < 4) continue
    judged += cell.length
    rejected += peerRatioOutliers(cell).length
  }

  it('judges a meaningful number of observations', () => {
    expect(judged).toBeGreaterThan(100)
  })

  it('rejects roughly 5%, not most of the corpus and not none of it', () => {
    // The whole case for fitting 1080p is that the bad rows are RARE. If this
    // moves a long way, either the detector broke or the corpus changed shape,
    // and the 1080p fit needs re-justifying before it ships.
    const pct = rejected / judged * 100
    expect(pct).toBeGreaterThan(1)
    expect(pct).toBeLessThan(12)
  })
})

describe('the declared-cap rule reaches beyond 1080p, and barely', () => {
  // This is the ONLY reason a 1440p or 4K constant moved when 1080p joined the
  // fit, and the plan's gate said none should. The gate's intent was "the
  // rejection must not be filtering rows it should not"; three elden-ring rows
  // pinned at that game's hard 60 fps cap is precisely a row it SHOULD filter —
  // a card sitting on an engine lock at 4K measured the lock, not the card, by
  // exactly the argument that justifies rejecting it at 1080p.
  //
  // So the movement is a correction, not a regression. What matters is that it
  // stays a handful of rows: if a future corpus adds a low-capped game that many
  // cards reach, this rule would start reshaping 1440p wholesale and that needs
  // a decision, not a silent refit.
  const entries = read('data/benchmarks/entries.json')
  const rows = Array.isArray(entries) ? entries : entries.entries
  const sources = read('data/benchmarks/sources.json')
  const srcList = Array.isArray(sources) ? sources : sources.sources
  const kindOf = new Map(srcList.map((s) => [s.id, s.kind]))
  const games = read('src/data/perfGames.json')
  const gameById = new Map((Array.isArray(games) ? games : games.games).map((g) => [g.id, g]))

  const gpuRows = rows.filter((r) => kindOf.get(r.sourceId) === 'gpu-scaling' &&
    ['1080p', '1440p', '4k'].includes(r.resolution) && r.avgFps > 0)
  const outside1080 = gpuRows.filter((r) => r.resolution !== '1080p')
  const cappedOutside = outside1080.filter((r) => atDeclaredCap(r, gameById.get(r.gameId)))

  it('has rows to judge outside 1080p, so the bound below is not vacuous', () => {
    expect(outside1080.length).toBeGreaterThan(500)
  })

  it('catches at least one, or the 1440p/4K movement had no explanation', () => {
    // If this ever hits zero, the constants stopped moving for a reason nobody
    // recorded — which is a worse state than them moving for a reason we did.
    expect(cappedOutside.length).toBeGreaterThan(0)
  })

  it('touches well under 1% of the rows outside 1080p', () => {
    expect(cappedOutside.length / outside1080.length).toBeLessThan(0.01)
  })

  it('only ever fires on a game that declares a cap', () => {
    for (const r of cappedOutside) {
      expect(gameById.get(r.gameId)?.fpsCap, r.gameId).toBeGreaterThan(0)
    }
  })
})
