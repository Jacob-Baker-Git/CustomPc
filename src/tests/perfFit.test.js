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
