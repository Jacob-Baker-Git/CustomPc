import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'
import {
  partStats, gpuFpsCeiling, fpsPerPound, perfPerPound, perfPerWatt,
  pricePerGb, pricePer100W, psuEfficiency, fanArea, coolerCapacity,
} from '../lib/partStats'
import { coolerCapacityW } from '../lib/partSynergy'
import { estimateFps } from '../lib/fpsEstimate'

const byId = (id) => partsData.find((p) => p.id === id)
const ofCat = (c) => partsData.filter((p) => p.category === c)

describe('derived part stats', () => {
  it('agrees with the FPS model about a GPU ceiling', () => {
    // The stat must never drift from the number the site shows elsewhere: pair
    // the GPU with an overwhelming CPU so the GPU is definitively the limit.
    const gpu = byId('gpu-rtx-4090')
    const monsterCpu = { perfScore: 10000 }
    for (const res of ['1080p', '1440p', '4k']) {
      expect(gpuFpsCeiling(gpu, res)).toBe(estimateFps(monsterCpu, gpu, res))
    }
  })

  it('scales the FPS ceiling down as resolution rises', () => {
    const gpu = byId('gpu-rtx-4090')
    expect(gpuFpsCeiling(gpu, '1080p')).toBeGreaterThan(gpuFpsCeiling(gpu, '1440p'))
    expect(gpuFpsCeiling(gpu, '1440p')).toBeGreaterThan(gpuFpsCeiling(gpu, '4k'))
  })

  it('rates a cheap card as better value per pound than a flagship', () => {
    const budget = byId('gpu-rtx-5060')
    const flagship = byId('gpu-rtx-5090')
    expect(fpsPerPound(budget)).toBeGreaterThan(fpsPerPound(flagship))
  })

  it('returns null rather than nonsense for the wrong category', () => {
    const ram = ofCat('ram')[0]
    expect(gpuFpsCeiling(ram)).toBeNull()
    expect(fpsPerPound(ram)).toBeNull()
    expect(perfPerWatt(ram)).toBeNull()
    expect(pricePer100W(ram)).toBeNull()
  })

  it('computes efficiency, and ranks a modern card above an old one', () => {
    const modern = byId('gpu-rtx-5070')
    const old = byId('gpu-gtx-1080-ti')
    expect(perfPerWatt(modern)).toBeGreaterThan(perfPerWatt(old))
  })

  it('computes price per GB for memory and storage', () => {
    for (const p of [...ofCat('ram'), ...ofCat('storage')]) {
      const v = pricePerGb(p)
      expect(v, p.id).toBeGreaterThan(0)
      expect(v, p.id).toBeLessThan(50)
    }
  })

  it('ranks PSU efficiency tiers in the right order', () => {
    const tiers = ofCat('psu').map((p) => [p.specs?.rating, psuEfficiency(p)]).filter(([, v]) => v != null)
    expect(tiers.length).toBeGreaterThan(0)
    const gold = ofCat('psu').find((p) => /gold/i.test(p.specs?.rating ?? ''))
    const bronze = ofCat('psu').find((p) => /bronze/i.test(p.specs?.rating ?? ''))
    if (gold && bronze) expect(psuEfficiency(gold)).toBeGreaterThan(psuEfficiency(bronze))
  })

  it('gives more fan area to more or bigger fans', () => {
    const one120 = { category: 'fans', price: 10, specs: { size: '120mm', count: 1 } }
    const three120 = { category: 'fans', price: 30, specs: { size: '120mm', count: 3 } }
    const one140 = { category: 'fans', price: 15, specs: { size: '140mm', count: 1 } }
    expect(fanArea(three120)).toBeGreaterThan(fanArea(one140))
    expect(fanArea(one140)).toBeGreaterThan(fanArea(one120))
  })

  it('rates a bigger radiator as more cooling capacity than a short tower', () => {
    const aio360 = { category: 'cooler', price: 90, specs: { type: 'AIO', radiator: '360mm' } }
    const lowTower = { category: 'cooler', price: 20, specs: { type: 'Air', height: 120 } }
    expect(coolerCapacity(aio360)).toBeGreaterThan(coolerCapacity(lowTower))
  })

  // The number under "Cooling capacity" on a cooler's info sheet and the number
  // the Performance tab prints as "Cooler capacity" are the same claim about the
  // same object, so they have to be the same number. They were not: two
  // independent formulas had grown up, a continuous one here and a stepped
  // ladder in partSynergy, and a 420mm AIO read 483 W on one screen and 320 W
  // on the other. Comparing them across the real catalogue is what makes this a
  // check rather than a restatement of one of them.
  it('reports one cooling capacity per cooler, whichever screen asks', () => {
    const coolers = ofCat('cooler')
    expect(coolers.length).toBeGreaterThan(0)
    for (const c of coolers) {
      expect(coolerCapacity(c), `${c.id} (${c.specs.type} ${c.specs.radiator ?? c.specs.height})`)
        .toBe(coolerCapacityW(c))
    }
  })

  // The ladder used to flatten everything at or above 360mm into one rung, so
  // the largest radiator in the catalogue claimed no more cooling than a 360.
  it('does not flatten a 420mm radiator into the 360mm rung', () => {
    const aio420 = { category: 'cooler', price: 150, specs: { type: 'AIO', radiator: '420mm' } }
    const aio360 = { category: 'cooler', price: 90, specs: { type: 'AIO', radiator: '360mm' } }
    expect(coolerCapacity(aio420)).toBeGreaterThan(coolerCapacity(aio360))
  })

  it('produces printable stats for every part in the catalogue', () => {
    for (const p of partsData) {
      const stats = partStats(p)
      expect(Array.isArray(stats), p.id).toBe(true)
      for (const s of stats) {
        expect(s.label, p.id).toBeTruthy()
        expect(s.value, `${p.id} / ${s.label}`).not.toBe(null)
        expect(String(s.value), `${p.id} / ${s.label}`).not.toContain('NaN')
        expect(String(s.value), `${p.id} / ${s.label}`).not.toContain('undefined')
      }
    }
  })

  it('gives every non-paste category at least two stats', () => {
    for (const cat of ['cpu', 'gpu', 'ram', 'storage', 'psu', 'motherboard', 'case', 'cooler', 'fans']) {
      const sample = ofCat(cat)[0]
      expect(partStats(sample).length, cat).toBeGreaterThanOrEqual(2)
    }
  })

  it('separates computed stats from raw ones', () => {
    // The spec sheet prints derived stats in their own block and raw fields via
    // specSheetContent, so anything marked derived must genuinely be computed.
    const gpu = partStats(byId('gpu-rtx-4090'))
    const derivedLabels = gpu.filter((s) => s.derived).map((s) => s.label)
    expect(derivedLabels).toContain('FPS per £100')
    expect(derivedLabels).toContain('Efficiency')
    // VRAM and length are read straight off the part — not derived.
    expect(gpu.find((s) => s.label === 'VRAM').derived).toBe(false)
    expect(gpu.find((s) => s.label === 'Length').derived).toBe(false)
  })

  it('does not repeat the per-resolution FPS the spec sheet already shows', () => {
    const labels = partStats(byId('gpu-rtx-4090')).map((s) => s.label)
    expect(labels).not.toContain('FPS ceiling')
  })

  it('has no perf-per-pound for parts with no perfScore', () => {
    expect(perfPerPound(ofCat('case')[0])).toBeNull()
  })
})
