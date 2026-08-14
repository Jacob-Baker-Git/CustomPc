// Applies the prior that scripts/fit-perf-model.mjs fitted. NEVER fits.
//
// One definition, two readers — the same split the rest of this artefact uses.
// The browser must not refit: the corpus is not shipped, and a second
// implementation of the regression is a second thing to drift.
//
// Every return carries `basis: 'prior'` and the error of the BAND this part
// falls in, not the fit's average. A weak card's estimate is much rougher than a
// strong one's, and reporting one number for both would overstate the weak case
// exactly where it is already worst.

export function applyPrior(fit, perfScore) {
  if (!fit || !(perfScore > 0)) return null

  const value = fit.form === 'loglog'
    ? Math.exp(fit.slope * Math.log(Math.max(perfScore, 0.5)) + fit.intercept)
    : fit.slope * perfScore + fit.intercept
  if (!(value > 0)) return null

  // Bands are ordered ascending with a null upper bound last. A part below the
  // lowest band still matches the first one rather than falling through: the
  // signed-off call is that a weak part gets a wide estimate, not a refusal, and
  // `extrapolated` below carries the rest of that warning.
  const band = fit.bands.find((b) => b.maxPerfScore == null || perfScore < b.maxPerfScore)

  return {
    value,
    basis: 'prior',
    errorPct: band?.looMedianPct ?? null,
    // Inclusive at both edges: a part sitting exactly on the boundary was
    // fitted ON, not beyond it.
    extrapolated: perfScore < fit.domain[0] || perfScore > fit.domain[1],
  }
}
