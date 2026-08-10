import { fitArchEfficiency, MIN_PARTS_TO_CALIBRATE } from '../lib/perfEngine/archEfficiency'
import { gpuCapability, teraflops } from '../lib/perfEngine/capability'
import perfModel from '../data/perfModel.json'
import realGpuSpecs from '../../data/specs/gpuSpecs.json'

// Two architectures, three parts each, built so the arithmetic is checkable by
// hand: the "measured" index of every B part is exactly twice what its specs
// predict relative to the A parts.
const specs = {
  gpus: {
    a1: { shaders: 1000, boostMhz: 1000, bandwidthGbs: 500, architecture: 'A' },
    a2: { shaders: 2000, boostMhz: 1000, bandwidthGbs: 500, architecture: 'A' },
    a3: { shaders: 3000, boostMhz: 1000, bandwidthGbs: 500, architecture: 'A' },
    b1: { shaders: 1000, boostMhz: 1000, bandwidthGbs: 500, architecture: 'B' },
    b2: { shaders: 2000, boostMhz: 1000, bandwidthGbs: 500, architecture: 'B' },
    b3: { shaders: 3000, boostMhz: 1000, bandwidthGbs: 500, architecture: 'B' },
    lonely: { shaders: 1000, boostMhz: 1000, bandwidthGbs: 500, architecture: 'Lonely' },
    noSpecs: { shaders: 0, boostMhz: 0, bandwidthGbs: 0, architecture: 'Broken' },
  },
}

// specIndex is monotonic in shaders, so a measured index proportional to it
// gives a flat ratio within an architecture.
const idxFor = (shaders, k) => ({ '1440p': k * (shaders / 1000) ** 0.65 })
const gpuIndex = {
  a1: idxFor(1000, 10), a2: idxFor(2000, 10), a3: idxFor(3000, 10),
  b1: idxFor(1000, 20), b2: idxFor(2000, 20), b3: idxFor(3000, 20),
  lonely: idxFor(1000, 50),
  noSpecs: idxFor(1000, 10),
}

describe('fitArchEfficiency', () => {
  const fit = () => fitArchEfficiency({ gpuIndex, gpuSpecs: specs, minParts: 3 })

  it('anchors the most-measured architecture at exactly 1.0', () => {
    const r = fit()
    expect(r.reference).toBe('A')
    expect(r.byArch.A.efficiency).toBe(1)
  })

  it('recovers the ratio between two architectures', () => {
    // Every B part measures twice what an A part of the same specs does.
    expect(fit().byArch.B.efficiency).toBeCloseTo(2, 6)
  })

  // The index and the spec formula are in different units, so only ratios carry
  // meaning. Rescaling every measurement must therefore change nothing.
  it('is invariant to the scale of the measured index', () => {
    const scaled = Object.fromEntries(
      Object.entries(gpuIndex).map(([id, v]) => [id, { '1440p': v['1440p'] * 37.5 }]),
    )
    const a = fit().byArch
    const b = fitArchEfficiency({ gpuIndex: scaled, gpuSpecs: specs, minParts: 3 }).byArch
    for (const arch of Object.keys(a)) expect(b[arch].efficiency).toBeCloseTo(a[arch].efficiency, 9)
  })

  // The whole discipline of this module. A ratio from one card is a point
  // estimate dressed as a fit, and an architecture with no measured part at all
  // has nothing behind it — both stay at 1.0 and say so, rather than shipping a
  // number nobody can defend.
  it('refuses to calibrate an architecture with too few measured parts', () => {
    const r = fit()
    expect(r.byArch.Lonely.parts).toBe(1)
    expect(r.byArch.Lonely.calibrated).toBe(false)
    expect(r.byArch.Lonely.efficiency).toBe(1)
    expect(r.uncalibrated).toContain('Lonely')
    expect(r.calibrated).toEqual(['A', 'B'])
  })

  it('records how many parts and how wide the spread is, so a weak fit is visible', () => {
    const r = fit()
    expect(r.byArch.A.parts).toBe(3)
    // Constructed flat, so the spread is zero.
    expect(r.byArch.A.spreadPct).toBeCloseTo(0, 6)
  })

  it('reports a real spread where one exists', () => {
    const noisy = { ...gpuIndex, b3: { '1440p': idxFor(3000, 20)['1440p'] * 1.5 } }
    const r = fitArchEfficiency({ gpuIndex: noisy, gpuSpecs: specs, minParts: 3 })
    expect(r.byArch.B.spreadPct).toBeGreaterThan(20)
  })

  it('skips a part whose specs cannot produce an index, rather than counting it', () => {
    expect(fit().byArch.Broken).toBeUndefined()
  })

  it('skips a measured part with no spec row at all', () => {
    const r = fitArchEfficiency({
      gpuIndex: { ...gpuIndex, ghost: { '1440p': 99 } }, gpuSpecs: specs, minParts: 3,
    })
    expect(Object.values(r.byArch).reduce((s, a) => s + a.parts, 0)).toBe(7)
  })

  it('survives an empty corpus without calibrating anything', () => {
    const r = fitArchEfficiency({ gpuIndex: {}, gpuSpecs: specs, minParts: 3 })
    expect(r.calibrated).toEqual([])
    expect(r.reference).toBeNull()
    expect(r.byArch).toEqual({})
  })

  it('is deterministic', () => {
    expect(JSON.stringify(fit())).toBe(JSON.stringify(fit()))
  })
})

// Against the real corpus and the real specs — the assertions that would catch a
// calibration that had drifted into nonsense.
describe('against the shipped corpus', () => {
  it('produces efficiencies in a physically sensible band', async () => {
    const model = (await import('../data/perfModel.json')).default
    const gpuSpecs = (await import('../../data/specs/gpuSpecs.json')).default
    const r = fitArchEfficiency({ gpuIndex: model.gpuIndex, gpuSpecs, minParts: 3 })

    expect(r.calibrated.length).toBeGreaterThanOrEqual(4)
    for (const arch of r.calibrated) {
      const e = r.byArch[arch].efficiency
      // A correction outside this band would mean the index formula, not the
      // architecture, is wrong — and quietly absorbing that into a per-arch
      // scalar is how a model stops describing anything.
      expect(e, `${arch} efficiency ${e}`).toBeGreaterThan(0.4)
      expect(e, `${arch} efficiency ${e}`).toBeLessThan(2.5)
    }
  })

  // The documented reason ARCH_EFFICIENCY exists: AMD's RDNA 3 realises more of
  // its published throughput than NVIDIA's Ada does, because both inflate their
  // shader counts but not equally. If this ever inverts, the fit is wrong.
  it('puts RDNA 3 above Ada Lovelace, which is the effect it exists to correct', async () => {
    const model = (await import('../data/perfModel.json')).default
    const gpuSpecs = (await import('../../data/specs/gpuSpecs.json')).default
    const r = fitArchEfficiency({ gpuIndex: model.gpuIndex, gpuSpecs, minParts: 3 })
    expect(r.byArch['RDNA 3'].efficiency).toBeGreaterThan(r.byArch['Ada Lovelace'].efficiency)
  })

  // The fit is written into perfModel.json by perf:fit. If the shipped artefact
  // and a fresh fit over the same corpus disagree, the artefact is stale and the
  // UI is rendering a correction that no longer follows from the data.
  it('matches what perf:fit wrote into the shipped model', () => {
    const fresh = fitArchEfficiency({ gpuIndex: perfModel.gpuIndex, gpuSpecs: realGpuSpecs })
    expect(perfModel.archEfficiency).toEqual(JSON.parse(JSON.stringify(fresh)))
  })
})

// The formula lives in two modules — archEfficiency.js has to be loadable by a
// plain-Node script, capability.js is not. Duplicated constants are a drift
// hazard, so this ties them together: if either changes, the ratio a fresh fit
// produces stops reproducing the shipped index and this fails.
describe('the fit and the capability index agree on the formula', () => {
  it('reproduces capability.js\'s own index for an uncalibrated card', () => {
    const id = 'gpu-rtx-4090'
    const spec = realGpuSpecs.gpus[id]
    const plain = gpuCapability({ id }, realGpuSpecs).index
    const expected = 100
      * (((teraflops(spec) * 1.0) / 82.6) ** 0.65)
      * ((spec.bandwidthGbs / 1008) ** 0.35)
    expect(plain).toBeCloseTo(Number(expected.toFixed(1)), 1)
  })

  it('applies the fitted correction when it is handed one, and not otherwise', () => {
    const id = 'gpu-rx-7900xtx'
    const bare = gpuCapability({ id }, realGpuSpecs)
    const calibrated = gpuCapability({ id }, realGpuSpecs, { archEfficiency: perfModel.archEfficiency })
    expect(bare.archCalibrated).toBe(false)
    expect(bare.comparable).toBe('within-architecture')
    expect(calibrated.archCalibrated).toBe(true)
    expect(calibrated.comparable).toBe('all')
    // RDNA 3's correction is above 1, so the index has to rise.
    expect(calibrated.index).toBeGreaterThan(bare.index)
  })

  // An architecture with too little data must not start claiming comparability
  // just because a fitted map was supplied.
  it('still refuses to compare an architecture the corpus barely covers', () => {
    const thin = Object.entries(perfModel.archEfficiency.byArch)
      .find(([, v]) => !v.calibrated)
    expect(thin, 'the corpus should still have an under-covered architecture').toBeTruthy()
    const id = Object.keys(realGpuSpecs.gpus).find(
      (k) => realGpuSpecs.gpus[k].architecture === thin[0],
    )
    const cap = gpuCapability({ id }, realGpuSpecs, { archEfficiency: perfModel.archEfficiency })
    expect(cap.comparable).toBe('within-architecture')
    expect(cap.archEfficiency).toBe(1)
  })

  it('reports the evidence behind the correction, not just the number', () => {
    const cap = gpuCapability({ id: 'gpu-rx-7900xtx' }, realGpuSpecs, { archEfficiency: perfModel.archEfficiency })
    expect(cap.archParts).toBeGreaterThanOrEqual(MIN_PARTS_TO_CALIBRATE)
    expect(cap.archSpreadPct).toBeGreaterThan(0)
  })
})
