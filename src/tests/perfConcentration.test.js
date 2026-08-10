import { concentration } from '../lib/perfEngine/concentration'

const src = (id, outlet) => ({ id, outlet })
const ent = (sourceId, n) => Array.from({ length: n }, (_, i) => ({ sourceId, id: `${sourceId}-${i}` }))

// The corpus is deliberately allowed to be lopsided while it is being built:
// measurements for individual parts are hard to find, so the rule is take any
// valid data now and dilute later. This module exists so "later" is data-driven
// rather than a memory — it MEASURES the imbalance and never blocks on it.
describe('concentration', () => {
  const sources = [src('a1', 'ComputerBase'), src('a2', 'ComputerBase'), src('b1', 'PC Games Hardware')]
  const entries = [...ent('a1', 160), ...ent('a2', 12), ...ent('b1', 44)]

  it('reports each source as a share of the corpus', () => {
    const r = concentration(entries, sources)
    expect(r.total).toBe(216)
    const a1 = r.bySource.find((s) => s.id === 'a1')
    expect(a1.entries).toBe(160)
    expect(a1.share).toBeCloseTo(0.7407, 4)
  })

  // The reason this module exists at all. The old inline check was per REVIEW
  // while its own comment appealed to not taking one OUTLET's compilation — so
  // two articles from the same outlet read as two independent sources, and
  // ComputerBase's real 80% presented as 74%.
  it('groups sources by outlet, which is what the rationale is actually about', () => {
    const r = concentration(entries, sources)
    const cb = r.byOutlet.find((o) => o.outlet === 'ComputerBase')
    expect(cb.entries).toBe(172)
    expect(cb.share).toBeCloseTo(0.7963, 4)
    expect(cb.sources).toEqual(['a1', 'a2'])
  })

  it('orders both lists heaviest first, so the thing to dilute is the first row', () => {
    const r = concentration(entries, sources)
    expect(r.bySource.map((s) => s.id)).toEqual(['a1', 'b1', 'a2'])
    expect(r.byOutlet.map((o) => o.outlet)).toEqual(['ComputerBase', 'PC Games Hardware'])
  })

  it('names the heaviest outlet and its share directly', () => {
    const r = concentration(entries, sources)
    expect(r.topOutlet).toBe('ComputerBase')
    expect(r.topOutletShare).toBeCloseTo(0.7963, 4)
  })

  it('survives an empty corpus without inventing a share', () => {
    const r = concentration([], sources)
    expect(r.total).toBe(0)
    expect(r.bySource).toEqual([])
    expect(r.byOutlet).toEqual([])
    expect(r.topOutlet).toBeNull()
    expect(r.topOutletShare).toBeNull()
  })

  // An entry whose source is not in sources.json is a real error elsewhere, but
  // this module must not silently drop it from the totals — that would understate
  // exactly the imbalance it exists to measure.
  it('counts an entry whose source is unknown rather than dropping it', () => {
    const r = concentration([...ent('a1', 2), ...ent('ghost', 3)], sources)
    expect(r.total).toBe(5)
    expect(r.byOutlet.find((o) => o.outlet === 'unknown').entries).toBe(3)
  })

  it('ignores superseded entries, matching what the fit actually uses', () => {
    const withDead = [...ent('a1', 2), { sourceId: 'b1', id: 'x', supersededBy: 'y' }]
    expect(concentration(withDead, sources).total).toBe(2)
  })
})
