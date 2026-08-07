// Everything in the engine is a frame time in milliseconds.
//
// Frame times add and average linearly; frame RATES do not. Halfway between 60
// and 120 fps is 80, not 90 — a model that interpolates fps is wrong in a way
// that stays invisible until someone checks it. Conversion to fps happens once,
// at the boundary, on the way to the UI.

export const msToFps = (ms) => (ms > 0 ? 1000 / ms : 0)
export const fpsToMs = (fps) => (fps > 0 ? 1000 / fps : Infinity)

// The GPU and CPU pipelines overlap, but imperfectly. Taking max() assumes
// perfect overlap and so under-states the frame time whenever the two terms are
// close — which is exactly where most real builds sit. A p-norm interpolates
// between the two extremes: k -> infinity is max() (perfect overlap), k = 1 is
// addition (no overlap at all). The excess over max() at parity is exactly
// 2^(1/k) - 1, so k is a directly interpretable knob — and it is FITTED against
// the crossover measurements, never chosen by hand.
export function blendFrameTime(tGpu, tCpu, k) {
  if (!(tGpu > 0)) return tCpu > 0 ? tCpu : 0
  if (!(tCpu > 0)) return tGpu
  return Math.pow(Math.pow(tGpu, k) + Math.pow(tCpu, k), 1 / k)
}

// How much of the frame the CPU is responsible for: 0 = purely GPU-bound,
// 1 = purely CPU-bound. It falls out of the same p-norm as the frame time, so
// the bottleneck verdict and the frame rate can never contradict each other.
// ⚠️ With BOTH terms absent this returns 0, which limitedBy() reads as
// "GPU-led" — it cannot distinguish no data from a confirmed GPU bound. Every
// caller is expected to establish coverage before asking, the way
// estimateBuildPerformance checks both indices are > 0 first. Do not call it
// to find out whether you have data; call it once you know you do.
export function cpuShare(tGpu, tCpu, k) {
  if (!(tGpu > 0)) return tCpu > 0 ? 1 : 0
  if (!(tCpu > 0)) return 0
  const g = Math.pow(tGpu, k)
  const c = Math.pow(tCpu, k)
  return c / (g + c)
}

// A mildly GPU-led frame is the healthy normal state, so the middle band is
// wide and only a real imbalance gets named.
export const CPU_LED_ABOVE = 0.62
export const GPU_LED_BELOW = 0.38

export function limitedBy(share) {
  if (share > CPU_LED_ABOVE) return 'cpu'
  if (share < GPU_LED_BELOW) return 'gpu'
  return 'balanced'
}

// An engine frame cap is a ceiling on fps, which is a FLOOR on frame time.
export function applyFpsCap(ms, fpsCap) {
  return fpsCap > 0 ? Math.max(ms, fpsToMs(fpsCap)) : ms
}
