// What a row's number is worth, and why — in one place.
//
// A row is only as strong as its WEAKEST input. Spreading that rule across
// estimateGame's branches is how a prior-derived number ends up rendered
// identically to a benchmark: each branch looks locally reasonable and nothing
// owns the composition. This module owns it.
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

  const usedPrior = gpuBasis === 'prior' || cpuBasis === 'prior'

  let basis = 'modelled'
  if (usedPrior) basis = weakest(basis, 'spec-derived')
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

// The filter and the counter live beside the tier definition so a new tier
// cannot be added without both being updated in the same file.
export const onlyRealData = (rows) =>
  rows.filter((r) => r.basis === 'measured' || r.basis === 'modelled')

export function basisMix(rows) {
  const answered = rows.filter((r) => r.avgFps > 0)
  return {
    measured: answered.filter((r) => r.basis === 'measured').length,
    modelled: answered.filter((r) => r.basis === 'modelled').length,
    estimated: answered.filter((r) => r.basis === 'spec-derived' || r.basis === 'ceiling').length,
  }
}
