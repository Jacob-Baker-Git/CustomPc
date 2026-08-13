import { describe, it, expect } from 'vitest'
import { composeBasis } from '../lib/perfEngine/rowBasis'

const inputs = (over = {}) => ({
  exactMeasured: false, hasCellB: true,
  gpuBasis: 'measured', cpuBasis: 'measured',
  gpuErrorPct: null, cpuErrorPct: null, resolutionCopied: false,
  ...over,
})

describe('composeBasis', () => {
  it('reports measured only for an exact measurement of this combination', () => {
    expect(composeBasis(inputs({ exactMeasured: true })).basis).toBe('measured')
  })

  it('reports modelled when both constants and both indices are measured', () => {
    expect(composeBasis(inputs()).basis).toBe('modelled')
  })

  it('demotes to spec-derived when ANY index came from a prior', () => {
    expect(composeBasis(inputs({ gpuBasis: 'prior' })).basis).toBe('spec-derived')
    expect(composeBasis(inputs({ cpuBasis: 'prior' })).basis).toBe('spec-derived')
  })

  it('demotes to ceiling when the cell has no CPU constant, prior or not', () => {
    expect(composeBasis(inputs({ hasCellB: false })).basis).toBe('ceiling')
    expect(composeBasis(inputs({ hasCellB: false, gpuBasis: 'prior' })).basis).toBe('ceiling')
  })

  it('NEVER reports measured when an input came from a prior', () => {
    // The founding rule, as an assertion. An exact measurement of this exact
    // combination needs no index at all, so the two cannot legitimately co-occur
    // — but if they ever do, the weaker claim has to win.
    const out = composeBasis(inputs({ exactMeasured: true, gpuBasis: 'prior' }))
    expect(out.basis).not.toBe('measured')
  })

  it('marks only ceiling rows as an upper bound', () => {
    expect(composeBasis(inputs({ hasCellB: false })).bound).toBe('upper')
    expect(composeBasis(inputs()).bound).toBe('point')
  })

  it('names every specific reason in caveats', () => {
    const out = composeBasis(inputs({
      hasCellB: false, gpuBasis: 'prior', cpuBasis: 'prior', resolutionCopied: true,
    }))
    expect([...out.caveats].sort()).toEqual(
      ['cpu-index-prior', 'gpu-index-prior', 'no-cpu-constant', 'resolution-copied'],
    )
  })

  it('says so when a prior was applied outside the range it was fitted over', () => {
    // No catalogue part is outside today. The catalogue grows, and a regression
    // quietly extrapolated is the moment a "data-derived" number stops being one.
    const out = composeBasis(inputs({ gpuBasis: 'prior', gpuExtrapolated: true }))
    expect(out.caveats).toContain('index-extrapolated')
  })

  it('does not cry extrapolation for a measured index', () => {
    expect(composeBasis(inputs({ gpuExtrapolated: true })).caveats).not.toContain('index-extrapolated')
  })

  it('takes the WORST contributing band as errorPct, never a combination', () => {
    // These are held-out prediction errors, not measurement uncertainties.
    // Combining in quadrature would imply they are independent and quantified.
    const out = composeBasis(inputs({
      gpuBasis: 'prior', gpuErrorPct: 35, cpuBasis: 'prior', cpuErrorPct: 5.5,
    }))
    expect(out.errorPct).toBe(35)
  })

  it('gives a ceiling row no errorPct from the missing constant', () => {
    // The missing B is unbounded below, which is WHY the row is an upper bound.
    // Folding it into a percentage would claim a bound it does not have.
    expect(composeBasis(inputs({ hasCellB: false })).errorPct).toBeNull()
  })
})
