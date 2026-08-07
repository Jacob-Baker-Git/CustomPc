import { describe, it, expect } from 'vitest'
import { fitTwoWay } from '../lib/perfEngine/fitTwoWay'
import { makeObservations, TRUE_INDEX, TRUE_CELL } from './fixtures/syntheticCorpus'

const worstError = (fitted, truth) =>
  Math.max(...Object.entries(truth).map(([k, v]) => Math.abs(fitted.get(k) - v) / v))

describe('fitTwoWay', () => {
  it('recovers known indices exactly from a complete, noise-free corpus', () => {
    const fit = fitTwoWay(makeObservations(), { anchorPartKey: 'a', anchorValue: 100 })
    expect(fit.converged).toBe(true)
    expect(worstError(fit.index, TRUE_INDEX)).toBeLessThan(1e-6)
    expect(worstError(fit.cellConst, TRUE_CELL)).toBeLessThan(1e-6)
  })

  it('recovers them from a sparse corpus with 1% noise to within 3%', () => {
    // 35% of cells missing, +/-1% measurement noise — roughly what hand
    // curation from real reviews looks like.
    const fit = fitTwoWay(makeObservations({ dropRate: 0.35, noise: 0.02 }),
                          { anchorPartKey: 'a', anchorValue: 100 })
    expect(fit.converged).toBe(true)
    expect(worstError(fit.index, TRUE_INDEX)).toBeLessThan(0.03)
  })

  it('pins the anchor part to the anchor value exactly', () => {
    const fit = fitTwoWay(makeObservations({ dropRate: 0.3 }),
                          { anchorPartKey: 'c', anchorValue: 100 })
    expect(fit.index.get('c')).toBeCloseTo(100, 9)
    expect(fit.anchorPartKey).toBe('c')
  })

  it('re-anchoring rescales indices without changing their ratios', () => {
    const a = fitTwoWay(makeObservations(), { anchorPartKey: 'a' })
    const c = fitTwoWay(makeObservations(), { anchorPartKey: 'c' })
    expect(a.index.get('b') / a.index.get('d'))
      .toBeCloseTo(c.index.get('b') / c.index.get('d'), 6)
  })

  it('falls back to the most-observed part when the named anchor is absent', () => {
    const obs = makeObservations().filter((o) => o.partKey !== 'a')
    const fit = fitTwoWay(obs, { anchorPartKey: 'a', anchorValue: 100 })
    expect(fit.anchorPartKey).not.toBe('a')
    expect(fit.index.get(fit.anchorPartKey)).toBeCloseTo(100, 9)
  })

  it('handles an empty corpus without throwing', () => {
    const fit = fitTwoWay([], { anchorPartKey: 'a' })
    expect(fit.index.size).toBe(0)
    expect(fit.cellConst.size).toBe(0)
    expect(fit.converged).toBe(true)
  })

  it('reports every part as connected when the corpus is one component', () => {
    const fit = fitTwoWay(makeObservations({ dropRate: 0.3 }), { anchorPartKey: 'a' })
    expect(fit.disconnected).toEqual([])
    expect(fit.connected.size).toBe(Object.keys(TRUE_INDEX).length)
  })

  it('names the parts whose scale the data cannot relate to the anchor', () => {
    // Two reviews sharing no hardware AND no game. The fit converges happily
    // and produces a cross-cluster ratio that is an artefact of both clusters
    // starting from the same initialisation — a number nobody measured,
    // indistinguishable from one that was. This is the case that has to be
    // caught, because the fit itself gives no hint of it.
    const twoClusters = [
      { cellKey: 'g1', partKey: 'a', logT: Math.log(4) },
      { cellKey: 'g1', partKey: 'b', logT: Math.log(8) },
      { cellKey: 'g2', partKey: 'a', logT: Math.log(6) },
      { cellKey: 'g2', partKey: 'b', logT: Math.log(12) },
      { cellKey: 'g3', partKey: 'c', logT: Math.log(5) },
      { cellKey: 'g3', partKey: 'd', logT: Math.log(400) },
      { cellKey: 'g4', partKey: 'c', logT: Math.log(7) },
      { cellKey: 'g4', partKey: 'd', logT: Math.log(560) },
    ]
    const fit = fitTwoWay(twoClusters, { anchorPartKey: 'a', anchorValue: 100 })
    expect(fit.converged).toBe(true)          // it does NOT fail loudly on its own
    expect([...fit.connected].sort()).toEqual(['a', 'b'])
    expect(fit.disconnected.sort()).toEqual(['c', 'd'])

    // Ratios WITHIN a component are still sound — b is half of a in both.
    expect(fit.index.get('a') / fit.index.get('b')).toBeCloseTo(2, 6)
    expect(fit.index.get('c') / fit.index.get('d')).toBeCloseTo(80, 6)
  })

  it('one shared cell is enough to connect two otherwise separate reviews', () => {
    const bridged = [
      { cellKey: 'g1', partKey: 'a', logT: Math.log(4) },
      { cellKey: 'g1', partKey: 'b', logT: Math.log(8) },
      { cellKey: 'g2', partKey: 'b', logT: Math.log(12) },
      { cellKey: 'g2', partKey: 'c', logT: Math.log(6) },
    ]
    const fit = fitTwoWay(bridged, { anchorPartKey: 'a', anchorValue: 100 })
    expect(fit.disconnected).toEqual([])
    // a:b = 2 from g1, b:c = 1:2 from g2, so a:c = 1:1 through the bridge.
    expect(fit.index.get('a') / fit.index.get('c')).toBeCloseTo(1, 6)
  })

  it('honours weights — a downweighted outlier moves the fit less', () => {
    const clean = makeObservations()
    const withOutlier = [...clean,
      { cellKey: 'g1', partKey: 'b', logT: Math.log(1000), weight: 1 }]
    const withDownweighted = [...clean,
      { cellKey: 'g1', partKey: 'b', logT: Math.log(1000), weight: 0.05 }]
    const errFull = Math.abs(fitTwoWay(withOutlier, { anchorPartKey: 'a' }).index.get('b')
      - TRUE_INDEX.b)
    const errDown = Math.abs(fitTwoWay(withDownweighted, { anchorPartKey: 'a' }).index.get('b')
      - TRUE_INDEX.b)
    expect(errDown).toBeLessThan(errFull)
  })
})
