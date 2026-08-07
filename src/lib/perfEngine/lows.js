// The 1% low: the frame time that only 1% of frames are worse than.
//
// It is the number that decides whether a build FEELS smooth. Two machines can
// both average 120 fps and feel completely different — one holding 100 at its
// worst, the other dropping to 45 in a firefight. Quoting only the average is
// the standard way frame-rate figures mislead, so this sits beside it at equal
// weight rather than in a footnote.
//
// Modelled as a multiplier on the average frame time, because that is the shape
// the measurements come in: reviews publish avg and 1% low together, and their
// RATIO is far more stable across hardware than either number alone.

// Fallback when a cell has no measured lows of its own. 1.35 in frame-time
// terms means the 1% low lands around 74% of the average frame rate, which is
// the middle of the range published results occupy. Cells using it are marked,
// because a default is not a measurement.
export const DEFAULT_LOW_BASE = 1.35

// How much harder lows degrade when the CPU is the limiter. A GPU running out
// of headroom slows down smoothly; a CPU missing its deadline stutters, because
// the stall lands on one frame rather than being spread over all of them.
// Squared so it stays near zero for a comfortably GPU-led build and only bites
// once the CPU is genuinely setting the pace.
export const DEFAULT_HEADROOM_COEF = 0.24

// Returns { lowMs, basis } — basis is 'measured' when the ratio came from
// measured lows for this cell, 'default' when it fell back.
export function lowFrameTime(avgMs, { cell, cpuShare, model }) {
  if (!(avgMs > 0)) return { lowMs: null, basis: 'none' }

  const measuredBase = cell?.lowBase
  const base = measuredBase > 0 ? measuredBase : DEFAULT_LOW_BASE
  const coef = model?.lowsHeadroomCoef ?? DEFAULT_HEADROOM_COEF

  // No split means no headroom term — a measured frame time with an unfitted
  // cell tells us the duration and nothing about what caused it.
  const share = cpuShare == null ? 0 : cpuShare
  const ratio = base * (1 + coef * share * share)

  return {
    lowMs: avgMs * ratio,
    basis: measuredBase > 0 ? 'measured' : 'default',
  }
}
