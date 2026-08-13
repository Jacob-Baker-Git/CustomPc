// "Did the GPU set this frame rate?" — the question a 1080p GPU fit must ask of
// every row before using it.
//
// fit-perf-model.mjs used to answer it by excluding the whole 1080p resolution,
// on the grounds that the CPU limits there. Sound in principle and far too
// broad for this corpus: 1080p is the LARGEST bucket (1058 rows, 47 games) and
// is mostly mid-range cards on fast test CPUs, where the GPU really is the
// limiter. Measured across 30 cells and 176 card-observations, only 8 (4.5%)
// are held down by anything else. The blanket rule threw away ~95% good data to
// avoid ~5% bad.
//
// ⚠️ THE CAUSE MUST NOT BE GUESSED AT. The peer test below was written for CPU
// walls and immediately flagged elden-ring, where rx-6800 and rtx-2060-super
// both sit at ratio exactly 1.00 — that is the game's hard 60 fps engine cap,
// not a processor. A CPU wall, an engine cap and a vsync are equally
// disqualifying for fitting a GPU index and equally indistinguishable in the
// data. So this module asks only whether the GPU set the rate, and never why
// it did not.

// A row within this margin of a DECLARED cap is measuring the cap. Reviewers
// benchmarking a rock-solid 60 fps lock record 59.x as often as 60.0.
const CAP_MARGIN = 0.02

// How far below its peers a card's 1080p/1440p ratio must fall to be rejected.
export const GPU_BOUND_SHORTFALL_PCT = 12

// Fewer than this and the "peers" are not a peer group — with three cards, one
// outlier drags the median far enough to hide itself.
const MIN_PEERS = 4

export function atDeclaredCap(row, game) {
  const cap = game?.fpsCap
  if (!(cap > 0)) return false
  return row.avgFps >= cap * (1 - CAP_MARGIN)
}

const median = (values) => {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

// `cell` is every card measured at BOTH resolutions for one
// cpu|game|preset|upscaling. Returns the gpuIds to exclude from the 1080p fit.
export function peerRatioOutliers(cell) {
  const usable = cell.filter((c) => c.fps1080 > 0 && c.fps1440 > 0)
  if (usable.length < MIN_PEERS) return []
  const ratios = usable.map((c) => ({ gpuId: c.gpuId, ratio: c.fps1080 / c.fps1440 }))
  const med = median(ratios.map((r) => r.ratio))
  return ratios
    .filter((r) => (med - r.ratio) / med * 100 > GPU_BOUND_SHORTFALL_PCT)
    .map((r) => r.gpuId)
}

// The other 880 rows. peerRatioOutliers needs the same card measured at both
// resolutions, which only 176 of the 1058 1080p rows have. This one needs only
// a fitted prediction, so it reaches every row — used as a second pass after an
// initial fit, then the fit is repeated without the rejects.
//
// ONE-SIDED on purpose. A row far BELOW the GPU-only prediction was held back by
// something. A row above it is noise or a kind test bench, and is never evidence
// the card was capped — rejecting those would trim the fit toward its own
// starting guess.
export function residualOutlier(measuredFps, predictedFps) {
  if (!(predictedFps > 0) || !(measuredFps > 0)) return false
  return measuredFps < predictedFps * (1 - GPU_BOUND_SHORTFALL_PCT / 100)
}
