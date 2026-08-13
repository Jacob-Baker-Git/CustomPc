import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { peerRatioOutliers } from '../lib/perfEngine/gpuBound'

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
