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

  it('does not treat an unrecognised index basis as a measurement', () => {
    // indices.js returns 'none' for a part with no coverage. Reading that as
    // strong as 'measured' would be the exact failure this module prevents.
    expect(composeBasis(inputs({ gpuBasis: 'none' })).basis).toBe('spec-derived')
    expect(composeBasis(inputs({ cpuBasis: 'none' })).basis).toBe('spec-derived')
  })

  it('demotes to ceiling when the cell has no CPU constant, prior or not', () => {
    expect(composeBasis(inputs({ hasCellB: false })).basis).toBe('ceiling')
    expect(composeBasis(inputs({ hasCellB: false, gpuBasis: 'prior' })).basis).toBe('ceiling')
  })

  it('NEVER reports measured for a row that was not exactly measured', () => {
    // The founding rule, as an assertion: the only route to `measured` is an
    // exact benchmark of this combination.
    for (const over of [{ gpuBasis: 'prior' }, { cpuBasis: 'prior' }, { hasCellB: false }, {}]) {
      expect(composeBasis(inputs(over)).basis).not.toBe('measured')
    }
  })

  it('keeps an exact measurement measured however its indices were obtained', () => {
    // The indices feed the SPLIT, never the frame time. exactFor does not
    // require a part to be indexed, so a benchmark of an unindexed chip is
    // reachable — and demoting it would hide a real reading behind the "only
    // show real data" filter.
    const out = composeBasis(inputs({
      exactMeasured: true, gpuBasis: 'prior', cpuBasis: 'prior', hasCellB: false,
    }))
    expect(out.basis).toBe('measured')
    expect(out.bound).toBe('point')
  })

  it('puts no caveats on an exact measurement', () => {
    // Every caveat describes how a number was DERIVED. On a measured row they
    // would all be false — "this is the graphics card's ceiling" is simply
    // untrue of a reading somebody took.
    expect(composeBasis(inputs({
      exactMeasured: true, gpuBasis: 'prior', hasCellB: false, resolutionCopied: true,
    })).caveats).toEqual([])
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

  it('says so when a prior was applied outside the range it was fitted over, on the CPU side', () => {
    // The GPU and CPU sides are handled by the same condition in the
    // implementation — mirrored here so a copy-paste that only wired up GPU
    // would be caught.
    const out = composeBasis(inputs({ cpuBasis: 'prior', cpuExtrapolated: true }))
    expect(out.caveats).toContain('index-extrapolated')
  })

  it('does not cry extrapolation for a measured CPU index', () => {
    expect(composeBasis(inputs({ cpuExtrapolated: true })).caveats).not.toContain('index-extrapolated')
  })

  it('takes the WORST contributing band as errorPct, never a combination', () => {
    // These are held-out prediction errors, not measurement uncertainties.
    // Combining in quadrature would imply they are independent and quantified.
    const out = composeBasis(inputs({
      gpuBasis: 'prior', gpuErrorPct: 35, cpuBasis: 'prior', cpuErrorPct: 5.5,
    }))
    expect(out.errorPct).toBe(35)
  })

  it('ignores the error of a side that did not use a prior', () => {
    // Deliberately puts the LARGER number on the measured side: a max() over
    // both regardless of provenance would return 99 and pass a laxer test.
    expect(composeBasis(inputs({
      cpuBasis: 'prior', cpuErrorPct: 22, gpuErrorPct: 99,
    })).errorPct).toBe(22)
  })

  it('does not put the CPU prior’s error on a row the CPU never entered', () => {
    // A ceiling row's frame time is cell.A / gpuIndex. The CPU index is not an
    // input to it at all — there is no B to pair it with, which is the whole
    // reason the row is a ceiling. So the CPU prior's held-out error describes
    // nothing about this number, and printing "up to 258 ±8%" attributes a band
    // to an input that did not contribute.
    //
    // Caught in the browser, not by a test: every ceiling row on an unindexed
    // chip was rendering the CPU band. The pre-existing assertion below passes
    // because its indices are both measured, so it never reached this case.
    const out = composeBasis(inputs({
      hasCellB: false, cpuBasis: 'prior', cpuErrorPct: 7.8,
    }))
    expect(out.basis).toBe('ceiling')
    expect(out.errorPct).toBeNull()
    // the caveat still says the CPU index was a prior — that remains true of
    // the row, it just does not bound the number
    expect(out.caveats).toContain('cpu-index-prior')
  })

  it('still reports the GPU prior’s error on a ceiling row', () => {
    // The GPU index IS the ceiling row's only numeric input, so its band is
    // exactly the right thing to publish. Pairs with the test above: without
    // this one, dropping errorPct for every ceiling row would also pass.
    const out = composeBasis(inputs({
      hasCellB: false, gpuBasis: 'prior', gpuErrorPct: 34.1,
    }))
    expect(out.basis).toBe('ceiling')
    expect(out.errorPct).toBe(34.1)
  })

  it('takes the GPU band when a ceiling row has both indices from priors', () => {
    const out = composeBasis(inputs({
      hasCellB: false, gpuBasis: 'prior', gpuErrorPct: 6.6,
      cpuBasis: 'prior', cpuErrorPct: 34.1,
    }))
    // 34.1 is the larger, and would win a naive `max` — but it is the CPU's,
    // and the CPU did not contribute to this number.
    expect(out.errorPct).toBe(6.6)
  })

  it('gives a ceiling row no errorPct from the missing constant', () => {
    // The missing B is unbounded below, which is WHY the row is an upper bound.
    // Folding it into a percentage would claim a bound it does not have.
    expect(composeBasis(inputs({ hasCellB: false })).errorPct).toBeNull()
  })
})
