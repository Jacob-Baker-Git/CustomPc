import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import model from '../data/perfModel.json'

// resolve off cwd, not import.meta.url: under jsdom the latter is an http:// URL
// that readFileSync rejects. Same approach as sitemap.test.js.
const read = (p) => JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))

describe('the published prior', () => {
  it('carries a CPU regression with its held-out error', () => {
    const p = model.prior?.cpu
    expect(p?.form).toBe('linear')
    expect(p.n).toBeGreaterThan(10)
    expect(p.bands.at(-1).looMedianPct).toBeGreaterThan(0)
    expect(p.bands.at(-1).looMedianPct).toBeLessThan(15)
  })

  it('carries a GPU regression per fitted resolution', () => {
    for (const res of ['1080p', '1440p', '4k']) {
      expect(model.prior?.gpu?.[res]?.form, res).toBe('loglog')
      expect(model.prior.gpu[res].bands.length, res).toBeGreaterThan(1)
    }
  })

  it('states a WORSE error for the low perfScore bands than the high ones', () => {
    // The whole case for shipping a low-end estimate is that its band says how
    // rough it is. If the bands were flat, the number would be lying.
    const bands = model.prior.gpu['1440p'].bands
    const low = bands.find((b) => b.maxPerfScore === 40)
    const high = bands.at(-1)
    expect(low.looMedianPct).toBeGreaterThan(high.looMedianPct)
  })

  it('declares the domain it was fitted over', () => {
    expect(model.prior.cpu.domain[0]).toBeGreaterThan(0)
    expect(model.prior.cpu.domain[1]).toBeGreaterThan(model.prior.cpu.domain[0])
  })

  it('gives every band BOTH its edges, so a reader can say what it covers', () => {
    // A band stating only its upper edge is ambiguous the moment an inner band
    // comes back empty: the one below it is then not the one before it in the
    // list, and nothing in the artefact says so. The recomputation below needs
    // the real lower edge, and so does anybody auditing the number by hand.
    for (const fit of [model.prior.cpu, ...Object.values(model.prior.gpu)]) {
      for (const b of fit.bands) {
        expect(typeof b.minPerfScore, JSON.stringify(b)).toBe('number')
        if (b.maxPerfScore != null) expect(b.maxPerfScore).toBeGreaterThan(b.minPerfScore)
      }
    }
  })

  it('publishes an error that is ACTUALLY TRUE of the shipped coefficients', () => {
    // The entire claim of this feature is "an estimate, and here is how wrong it
    // usually is". A published figure nobody checks is worse than none: it reads
    // as rigour while being decoration. Recompute leave-one-out here from the
    // shipped cpuIndex and assert the artefact agrees.
    //
    // Recomputed WITHIN the band, not across all parts. The published figure is
    // the median error of the parts in that band; comparing it against the
    // median over every part would be comparing two different numbers and would
    // pass or fail on how similar they happened to be.
    const partsData = read('src/data/partsData.json')
    const list = Array.isArray(partsData) ? partsData : partsData.parts
    const byId = new Map(list.map((p) => [p.id, p]))

    const pairs = Object.entries(model.cpuIndex)
      .map(([id, row]) => ({ x: byId.get(id)?.perfScore, y: row?.value }))
      .filter((p) => p.x > 0 && p.y > 0)
    expect(pairs.length).toBeGreaterThan(10)

    const solve = (rows) => {
      const n = rows.length
      const mx = rows.reduce((a, r) => a + r.x, 0) / n
      const my = rows.reduce((a, r) => a + r.y, 0) / n
      const sxx = rows.reduce((a, r) => a + (r.x - mx) ** 2, 0)
      const slope = rows.reduce((a, r) => a + (r.x - mx) * (r.y - my), 0) / sxx
      return { slope, intercept: my - slope * mx }
    }
    const errs = pairs.map((p, i) => {
      const f = solve(pairs.filter((_, j) => j !== i))
      return { x: p.x, err: Math.abs(f.slope * p.x + f.intercept - p.y) / p.y * 100 }
    })

    let checked = 0
    for (const band of model.prior.cpu.bands) {
      const inBand = errs
        .filter((e) => e.x >= band.minPerfScore &&
                       (band.maxPerfScore == null || e.x < band.maxPerfScore))
        .map((e) => e.err)
        .sort((a, b) => a - b)
      expect(inBand.length, `band ${band.minPerfScore}-${band.maxPerfScore}`).toBeGreaterThan(0)
      const recomputed = inBand[Math.floor(inBand.length / 2)]
      // A thin band publishes a substituted figure on purpose; what must be
      // recomputable is the one its own parts produced, kept as
      // measuredMedianPct precisely so the substitution stays auditable.
      const claimed = band.thin ? band.measuredMedianPct : band.looMedianPct
      expect(claimed, `band ${band.minPerfScore}-${band.maxPerfScore}`).toBeDefined()
      expect(recomputed, `band ${band.minPerfScore}-${band.maxPerfScore}`)
        .toBeCloseTo(claimed, 1)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('never lets a band of one or two parts claim a tight error', () => {
    // The 4K fit measured "±3.2%" for perfScore 25-40 from two held-out parts,
    // while 1440p measured ±34% for the same cards from four. Shipping the 3.2%
    // would read as precision and be noise, and it would break the signed-off
    // call that a weak card gets a WIDE band rather than a refusal.
    const fits = [model.prior.cpu, ...Object.values(model.prior.gpu)]
    const thin = fits.flatMap((f) => f.bands.filter((b) => b.thin))
    expect(thin.length, 'no thin band in the corpus — this test proves nothing')
      .toBeGreaterThan(0)

    for (const f of fits) {
      const solid = f.bands.filter((b) => !b.thin)
      if (!solid.length) continue
      const worst = Math.max(...solid.map((b) => b.looMedianPct))
      for (const b of f.bands.filter((x) => x.thin)) {
        expect(b.parts, JSON.stringify(b)).toBeLessThan(4)
        expect(b.looMedianPct, JSON.stringify(b)).toBeGreaterThanOrEqual(worst)
        // and the raw figure is still there to audit
        expect(typeof b.measuredMedianPct, JSON.stringify(b)).toBe('number')
      }
    }
  })

  it('marks a band as thin only when it really is', () => {
    for (const f of [model.prior.cpu, ...Object.values(model.prior.gpu)]) {
      for (const b of f.bands) {
        if (b.thin) expect(b.parts, JSON.stringify(b)).toBeLessThan(4)
        else expect(b.parts, JSON.stringify(b)).toBeGreaterThanOrEqual(4)
      }
    }
  })

  it('fits the CPU prior against the shipped slope and intercept, not just its error', () => {
    // The error check above would still pass if the coefficients were refitted
    // and the bands recomputed together from some OTHER index table. This pins
    // the published line itself to the published cpuIndex.
    const partsData = read('src/data/partsData.json')
    const list = Array.isArray(partsData) ? partsData : partsData.parts
    const byId = new Map(list.map((p) => [p.id, p]))
    const pairs = Object.entries(model.cpuIndex)
      .map(([id, row]) => ({ x: byId.get(id)?.perfScore, y: row?.value }))
      .filter((p) => p.x > 0 && p.y > 0)

    const n = pairs.length
    const mx = pairs.reduce((a, r) => a + r.x, 0) / n
    const my = pairs.reduce((a, r) => a + r.y, 0) / n
    const sxx = pairs.reduce((a, r) => a + (r.x - mx) ** 2, 0)
    const slope = pairs.reduce((a, r) => a + (r.x - mx) * (r.y - my), 0) / sxx

    expect(model.prior.cpu.slope).toBeCloseTo(slope, 3)
    expect(model.prior.cpu.intercept).toBeCloseTo(my - slope * mx, 3)
    expect(model.prior.cpu.n).toBe(n)
  })

  it('does not fit a GPU resolution from indices that were copied into it', () => {
    // A copied 4K index IS the 1440p one. Fitting it as though it were a 4K
    // measurement would feed the regression the same observation twice under two
    // names, and tighten the published error by inventing agreement.
    const copiedAt4k = Object.entries(model.gpuIndex)
      .filter(([, row]) => row.copiedResolutions?.includes('4k'))
    expect(copiedAt4k.length).toBeGreaterThan(0)      // else this proves nothing
    const measuredAt4k = Object.entries(model.gpuIndex)
      .filter(([, row]) => row['4k'] > 0 && !row.copiedResolutions?.includes('4k'))
    expect(model.prior.gpu['4k'].n).toBeLessThanOrEqual(measuredAt4k.length)
    expect(model.prior.gpu['4k'].n).toBeLessThan(Object.keys(model.gpuIndex).length)
  })
})
