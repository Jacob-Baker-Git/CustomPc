// Part capability, derived from published specifications.
//
// This is the third tier of the engine. Where the corpus has a measurement of
// an exact combination it wins; where the fit can interpolate one it goes
// next; this is what answers when neither can, and it needs no benchmark data
// at all — only specs, which are published facts.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE ONE THING TO UNDERSTAND BEFORE TRUSTING A NUMBER OUT OF HERE
//
// Theoretical throughput is a FACT: shaders x clock x 2 is arithmetic over
// published figures. How much of it a game actually realises is NOT a fact —
// it varies by architecture, and nothing on a spec sheet tells you it.
//
// The gap is not small. NVIDIA's Ada counts a shared FP32/INT32 datapath in its
// CUDA-core total, so its theoretical figure assumes work real shader mixes do
// not contain. AMD's RDNA3 dual-issue has the same property. The concrete
// result: an RTX 4070 Ti computes 40.1 TFLOPS against an RX 7900 XTX's 30.7,
// and the 7900 XTX is the faster card in rasterised games. Ranking on raw
// throughput gets that pair BACKWARDS.
//
// So ARCH_EFFICIENCY below is the correction — and it is a fitted model
// parameter, not a specification. It ships at 1.0 for everything, which means
// this module currently ranks correctly WITHIN an architecture and is
// explicitly uncalibrated ACROSS architectures. Callers are told which, via
// `comparable`. Do not quietly set these to guessed values: the whole point of
// the number is that it says when it does not know.
// ─────────────────────────────────────────────────────────────────────────────

// Per-architecture realised fraction of theoretical throughput, relative to
// each other. 1.0 everywhere = uncalibrated, and every architecture is listed
// explicitly so that fitting one later is an obvious, reviewable diff rather
// than a new key appearing.
export const ARCH_EFFICIENCY = {
  Blackwell: 1.0,
  'Ada Lovelace': 1.0,
  Ampere: 1.0,
  Turing: 1.0,
  Pascal: 1.0,
  'RDNA 4': 1.0,
  'RDNA 3': 1.0,
  'RDNA 2': 1.0,
  RDNA: 1.0,
  'Xe2 Battlemage': 1.0,
  'Xe Alchemist': 1.0,
}

export const ARCH_CALIBRATED = false

// Games are limited by compute AND by memory bandwidth, never purely by one.
// A weighted geometric mean is the standard way to combine two limits that
// neither add nor simply max: the exponents sum to 1 so the result stays in
// throughput-like units.
//
// 0.65/0.35 reflects that raster performance tracks compute more closely than
// bandwidth at the resolutions people play at — but these are ALSO parameters
// awaiting calibration, not measurements.
const COMPUTE_WEIGHT = 0.65
const BANDWIDTH_WEIGHT = 0.35

// Reference points, so the index reads as a percentage of a card people know
// rather than an abstract magnitude. Purely a display scale — it cancels out
// of every ratio.
const GPU_REFERENCE_TFLOPS = 82.6      // RTX 4090: 16384 x 2520 x 2
const GPU_REFERENCE_BANDWIDTH = 1008

export function teraflops(spec) {
  if (!(spec?.shaders > 0) || !(spec?.boostMhz > 0)) return null
  // x2 because a fused multiply-add counts as two operations, the industry
  // convention every published FLOPS figure uses.
  return (spec.shaders * spec.boostMhz * 2) / 1e6
}

// { index, basis, comparable, tflops, bandwidthGbs, vramGb, architecture }
//
// `basis` is 'spec-derived' when specs were found and 'none' when not — never
// a silent fallback. `comparable` is 'within-architecture' while
// ARCH_CALIBRATED is false, which is the caller's signal not to rank a GeForce
// against a Radeon on this number alone.
export function gpuCapability(gpu, gpuSpecs) {
  const spec = gpu?.id ? gpuSpecs?.gpus?.[gpu.id] : null
  const none = {
    index: null, basis: 'none', comparable: null, tflops: null,
    bandwidthGbs: null, vramGb: null, architecture: null,
  }
  if (!spec) return none

  const tf = teraflops(spec)
  if (!(tf > 0) || !(spec.bandwidthGbs > 0)) return none

  const efficiency = ARCH_EFFICIENCY[spec.architecture] ?? 1.0
  const computeTerm = (tf * efficiency) / GPU_REFERENCE_TFLOPS
  const bandwidthTerm = spec.bandwidthGbs / GPU_REFERENCE_BANDWIDTH

  const index = 100 * (computeTerm ** COMPUTE_WEIGHT) * (bandwidthTerm ** BANDWIDTH_WEIGHT)

  return {
    index: Number(index.toFixed(1)),
    basis: 'spec-derived',
    comparable: ARCH_CALIBRATED ? 'all' : 'within-architecture',
    tflops: Number(tf.toFixed(1)),
    bandwidthGbs: spec.bandwidthGbs,
    vramGb: spec.vramGb,
    architecture: spec.architecture,
    shaderUnit: spec.shaderUnit,
    vendor: spec.vendor,
  }
}

// ── CPUs ────────────────────────────────────────────────────────────────────
// Gaming is overwhelmingly a single-thread latency problem, so clock leads,
// core count saturates early, and cache matters far more than its size
// suggests — the reason an 8-core X3D chip beats a 16-core one without the
// stacked cache. Same caveat as above: the shape is defensible, the constants
// are awaiting calibration.

// Beyond this, extra cores buy a game almost nothing. Reflects how few threads
// a game engine can usefully saturate, not how many the chip has.
const CORE_SATURATION = 8
const CORE_WEIGHT = 0.18

// Cache per core, against a plain non-stacked baseline. Logarithmic because
// the benefit is hit-rate, which has diminishing returns.
const CACHE_BASELINE_MB_PER_CORE = 4
const CACHE_WEIGHT = 0.22

const CPU_REFERENCE_GHZ = 5.7

// L3 is private to a CCD. On AMD's chiplet parts the package total is a number
// no single core can reach: a 7950X's 64 MB is two separate 32 MB pools, and a
// 7900X3D's 128 MB is 96 MB on the chiplet carrying the stacked cache plus 32
// on the other. Dividing the package total by the cores a game uses credits
// every dual-CCD part with cache that is architecturally out of reach — which
// is what `l3MaxCcdMb` in cpuSpecs.json exists to correct. It is a published
// fact, not a fitted one.
const usableL3Mb = (spec) => (spec.ccds > 1 ? spec.l3MaxCcdMb : spec.l3Mb)

// ⚠️ KNOWN LIMITATION, and it is still visible in the output today.
//
// Per-CCD cache fixes the dual-CCD parts as a family, but it does NOT reorder
// the pair this note was originally written about. A 7900X3D's cache chiplet
// holds 96 MB across 6 cores — 16 MB per core, MORE than the 9800X3D's 96 MB
// across 8 — and it clocks 400 MHz higher, so it still ranks above a chip that
// beats it in every real game. What is missing is the Zen 4 to Zen 5 IPC gap,
// and that is calibration: no spec sheet states it, and the corpus cannot yet
// yield it either, because the one CPU-scaling review in it fields no Zen 4
// part at all. Recorded rather than patched around — a constant chosen to fix
// this pair would silently break others.
export const KNOWN_LIMITATIONS = [
  'Zen 4 vs Zen 5 IPC is uncalibrated, so a 7900X3D still ranks above a 9800X3D on clock and cache-per-core alone.',
  'Cross-architecture comparison is uncalibrated while ARCH_EFFICIENCY is 1.0 — see the note at the top of this file.',
]

export function cpuCapability(cpu, cpuSpecs) {
  const spec = cpu?.id ? cpuSpecs?.cpus?.[cpu.id] : null
  const cores = cpu?.specs?.cores
  const none = {
    index: null, basis: 'none', comparable: null,
    boostGhz: null, l3Mb: null, cores: cores ?? null, cacheBasis: null,
  }
  if (!spec || !(spec.boostGhz > 0) || !(cores > 0)) return none

  const clockTerm = spec.boostGhz / CPU_REFERENCE_GHZ
  // Effective cores saturate: a 16-core chip is not twice the gaming machine
  // an 8-core one is.
  const effectiveCores = Math.min(cores, CORE_SATURATION)
  const coreTerm = (effectiveCores / CORE_SATURATION) ** CORE_WEIGHT

  const l3Mb = usableL3Mb(spec)
  let cacheTerm = 1
  let cacheBasis = 'absent'
  if (l3Mb > 0) {
    // Divided by the cores that SHARE this pool, not every core on the die.
    // Dividing by all of them punishes Intel for its E-cores — an i9-14900K's
    // 36 MB looks thin across 24 cores and generous across the 8 a game
    // actually runs on, and the second reading is the one that describes the
    // frame. On a chiplet part the pool is one CCD's, so the divisor is that
    // CCD's cores rather than the package's.
    const coresSharing = spec.ccds > 1
      ? Math.min(cores / spec.ccds, CORE_SATURATION)
      : effectiveCores
    const perCore = l3Mb / coresSharing
    cacheTerm = (perCore / CACHE_BASELINE_MB_PER_CORE) ** CACHE_WEIGHT
    // Single-sourced: the catalogue has no cache field to corroborate it.
    cacheBasis = 'single-sourced'
  }

  return {
    index: Number((100 * clockTerm * coreTerm * cacheTerm).toFixed(1)),
    basis: 'spec-derived',
    comparable: ARCH_CALIBRATED ? 'all' : 'within-architecture',
    boostGhz: spec.boostGhz,
    // The cache a core can actually reach, not the package total — quoting 128
    // MB for a 7900X3D would overstate it by a third.
    l3Mb: l3Mb ?? null,
    l3PackageMb: spec.l3Mb ?? null,
    cores,
    cacheBasis,
  }
}
