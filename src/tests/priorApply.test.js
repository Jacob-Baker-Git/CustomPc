import { describe, it, expect } from 'vitest'
import { applyPrior } from '../lib/perfEngine/prior'

const linear = {
  form: 'linear', slope: 0.52, intercept: 34.04, n: 24, domain: [40, 106],
  bands: [{ minPerfScore: 0, maxPerfScore: null, looMedianPct: 5.5, looP90Pct: 13.5, parts: 24 }],
}
const loglog = {
  form: 'loglog', slope: 1.2, intercept: -1.0, n: 40, domain: [15, 132],
  bands: [
    { minPerfScore: 0, maxPerfScore: 40, looMedianPct: 34.2, looP90Pct: 89.6, parts: 8 },
    { minPerfScore: 40, maxPerfScore: null, looMedianPct: 6.7, looP90Pct: 13.5, parts: 32 },
  ],
}

// ⚠️ Modelled on the REAL cpu prior, whose lowest band is [40, 60) — bands 0-25
// and 25-40 came back empty because no catalogue CPU scores that low, and the
// fit publishes only the bands it populated. So a fit's first band does NOT
// start at zero in general, and a part below it must still get an answer.
//
// The fixtures above both start at 0, which makes "below every band" unreachable
// through them: a lookup that also demanded `perfScore >= minPerfScore` passed
// every assertion in this file until this fit existed. Verified by mutation.
// The two band errors are deliberately DIFFERENT. The live cpu prior happens to
// carry 7.8% in both, because its lower band is thin and inherited the upper
// one's figure — which would make "which band was chosen" unobservable and turn
// the selection assertions below into decoration.
const sparse = {
  form: 'linear', slope: 0.52, intercept: 34.04, n: 24, domain: [40, 106],
  bands: [
    { minPerfScore: 40, maxPerfScore: 60, looMedianPct: 12.4, looP90Pct: 21.0, parts: 5 },
    { minPerfScore: 60, maxPerfScore: null, looMedianPct: 7.8, looP90Pct: 15.3, parts: 22 },
  ],
}

describe('applyPrior', () => {
  it('predicts from a linear fit and reports the band error', () => {
    const out = applyPrior(linear, 78)
    expect(out.value).toBeCloseTo(0.52 * 78 + 34.04, 5)
    expect(out.errorPct).toBe(5.5)
    expect(out.basis).toBe('prior')
  })

  it('predicts from a log-log fit', () => {
    const out = applyPrior(loglog, 50)
    expect(out.value).toBeCloseTo(Math.exp(1.2 * Math.log(50) - 1.0), 5)
  })

  it('picks the band the part falls in, not the average', () => {
    // A weak card must carry the weak band's error, or the number claims a
    // precision the fit does not have for it.
    expect(applyPrior(loglog, 30).errorPct).toBe(34.2)
    expect(applyPrior(loglog, 80).errorPct).toBe(6.7)
  })

  it('refuses a part with no perfScore rather than inventing one', () => {
    expect(applyPrior(linear, null)).toBeNull()
    expect(applyPrior(linear, 0)).toBeNull()
    expect(applyPrior(linear, undefined)).toBeNull()
  })

  it('refuses when there is no fitted prior at all', () => {
    expect(applyPrior(null, 60)).toBeNull()
    expect(applyPrior(undefined, 60)).toBeNull()
  })

  it('flags a part outside the fitted domain as extrapolation', () => {
    // No catalogue CPU is outside today, but the catalogue grows, and silently
    // extrapolating a regression is how a prior stops being data-derived.
    expect(applyPrior(linear, 120).extrapolated).toBe(true)
    expect(applyPrior(linear, 12).extrapolated).toBe(true)
    expect(applyPrior(linear, 78).extrapolated).toBe(false)
  })

  it('treats the domain edges as inside it, not outside', () => {
    // A part exactly at the boundary was fitted ON, not beyond. Off-by-one here
    // would put the best-attested parts in the corpus under an extrapolation
    // warning they do not deserve.
    expect(applyPrior(linear, 40).extrapolated).toBe(false)
    expect(applyPrior(linear, 106).extrapolated).toBe(false)
  })

  it('never returns a non-positive index', () => {
    expect(applyPrior({ ...linear, slope: 0, intercept: -5 }, 50)).toBeNull()
  })

  it('never reports anything but prior, whatever it is handed', () => {
    // The founding rule at this level: this module cannot produce a number that
    // presents itself as measured. Nothing downstream should have to re-check.
    for (const score of [1, 25, 39.9, 40, 60, 132, 500]) {
      for (const fit of [linear, loglog]) {
        const out = applyPrior(fit, score)
        if (out) expect(out.basis, `${fit.form} @ ${score}`).toBe('prior')
      }
    }
  })

  it('answers for a part below every band rather than refusing it', () => {
    // The signed-off call is that every part gets an estimate, weak ones
    // included, carrying a wide stated band — not a refusal. A part under the
    // lowest band still gets that band's error, and the extrapolation flag
    // carries the rest of the warning.
    //
    // Uses `sparse`, whose lowest band starts at 40, because that is the only
    // fixture here where "below every band" is reachable at all.
    const out = applyPrior(sparse, 30)
    expect(out.value).toBeGreaterThan(0)
    expect(out.errorPct).toBe(12.4)
    expect(out.extrapolated).toBe(true)
  })

  it('gives a part inside a sparse fit the band it falls in', () => {
    // Pairs with the test above: without this one, an implementation that
    // returned the FIRST band unconditionally would also pass.
    expect(applyPrior(sparse, 50).errorPct).toBe(12.4)
    expect(applyPrior(sparse, 90).errorPct).toBe(7.8)
    expect(applyPrior(sparse, 50).extrapolated).toBe(false)
  })
})
