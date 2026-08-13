// What a row's number is worth, and why — in one place.
//
// A row is only as strong as its WEAKEST input. Spreading that rule across
// estimateGame's branches is how a prior-derived number ends up rendered
// identically to a benchmark: each branch looks locally reasonable and nothing
// owns the composition. This module owns it. Tier and caveats are related but
// separate axes, though: resolution-copied and index-extrapolated flag a
// specific concern without demoting the tier, so both must be read.
//
// Tier names are the ones the codebase already uses. `spec-derived` is not new
// — FpsCard.jsx has carried it in BASIS_LABEL against a tier the engine never
// produced. `ceiling` is the only genuinely new one.

// Strongest to weakest. A row lands on the weakest tier any input justifies.
const ORDER = ['measured', 'modelled', 'spec-derived', 'ceiling']
const weakest = (a, b) => (ORDER.indexOf(a) > ORDER.indexOf(b) ? a : b)

export function composeBasis({
  exactMeasured, hasCellB, gpuBasis, cpuBasis, gpuErrorPct, cpuErrorPct, resolutionCopied,
  gpuExtrapolated = false, cpuExtrapolated = false,
}) {
  // An exact benchmark of THIS combination is a reading, not a derivation. The
  // indices feed the split and nothing else, so neither a prior index nor a
  // missing CPU constant changes what the frame time is worth — and every
  // caveat below describes a derivation that did not happen here. Demoting
  // would hide a real measurement behind the "only show real data" filter,
  // which understates the evidence exactly as badly as overstating it.
  if (exactMeasured) {
    return { basis: 'measured', bound: 'point', caveats: [], errorPct: null }
  }

  const caveats = []
  if (gpuBasis === 'prior') caveats.push('gpu-index-prior')
  if (cpuBasis === 'prior') caveats.push('cpu-index-prior')
  if (!hasCellB) caveats.push('no-cpu-constant')
  if (resolutionCopied) caveats.push('resolution-copied')
  // Only meaningful for a prior — a measured index was not extrapolated from
  // anything, so the flag is ignored unless it came from the regression.
  if ((gpuBasis === 'prior' && gpuExtrapolated) || (cpuBasis === 'prior' && cpuExtrapolated)) {
    caveats.push('index-extrapolated')
  }

  // Anything that is not an outright measurement is treated as derived. Not a
  // defensive flourish: indices.js returns basis 'none' for a part with no
  // coverage, and a `=== 'prior'` test would wave that through as if it were a
  // benchmark. This module is meant to be the one place the rule cannot be
  // bypassed, so it fails closed rather than trusting its caller to pre-filter.
  const derivedIndex = gpuBasis !== 'measured' || cpuBasis !== 'measured'

  let basis = 'modelled'
  if (derivedIndex) basis = weakest(basis, 'spec-derived')
  if (!hasCellB) basis = weakest(basis, 'ceiling')

  // The worst contributing band, NOT a combination. See the test.
  const bandErrors = [
    gpuBasis === 'prior' ? gpuErrorPct : null,
    cpuBasis === 'prior' ? cpuErrorPct : null,
  ].filter((v) => v != null)

  return {
    basis,
    bound: basis === 'ceiling' ? 'upper' : 'point',
    caveats,
    errorPct: bandErrors.length ? Math.max(...bandErrors) : null,
  }
}

// The filter and the counter live beside the tier definition, but neither
// depends on an exhaustive list of tier names to stay correct: onlyRealData
// keeps only the two strong tiers by name, and basisMix's `estimated` bucket
// below is everything answered that is not one of those two — not a named
// list of the weak tiers. A tier added later without this file being touched
// is excluded from "real data" (the safe direction for a filter) and still
// counted somewhere in the mix (the safe direction for a total), rather than
// silently vanishing from either.
export const onlyRealData = (rows) =>
  rows.filter((r) => r.basis === 'measured' || r.basis === 'modelled')

export function basisMix(rows) {
  const answered = rows.filter((r) => r.avgFps > 0)
  const measured = answered.filter((r) => r.basis === 'measured').length
  const modelled = answered.filter((r) => r.basis === 'modelled').length
  return {
    measured,
    modelled,
    // By subtraction, not by naming 'spec-derived' and 'ceiling': an
    // unrecognised basis must still land here rather than making the three
    // buckets undercount the answered total.
    estimated: answered.length - measured - modelled,
  }
}
