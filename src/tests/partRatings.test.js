import { describe, it, expect } from 'vitest'
import { partLevel, rateBuild, partUpgradeOptions } from '../lib/partRatings'

const cpuLo = { id: 'cpu-lo', category: 'cpu', perfScore: 50 }
const cpuMid = { id: 'cpu-mid', category: 'cpu', perfScore: 150 }
const cpuHi = { id: 'cpu-hi', category: 'cpu', perfScore: 250 }
const gpu = { id: 'g', category: 'gpu', perfScore: 300 }
const catalog = [cpuLo, cpuMid, cpuHi, gpu]

describe('partLevel', () => {
  it('scales the weakest to 0 and strongest to 100 within a category', () => {
    expect(partLevel(cpuLo, catalog)).toBe(0)
    expect(partLevel(cpuHi, catalog)).toBe(100)
    expect(partLevel(cpuMid, catalog)).toBe(50)
  })
  it('a lone part in its category is 100', () => {
    expect(partLevel(gpu, catalog)).toBe(100)
  })
  it('null part is 0', () => {
    expect(partLevel(null, catalog)).toBe(0)
  })
})

// Three levels per category so partLevel gives 0 / ~50 / 100.
const cW = { id: 'cw', category: 'cpu', perfScore: 60,  price: 100, tdp: 65,  socket: 'AM5' }
const cM = { id: 'cm', category: 'cpu', perfScore: 160, price: 220, tdp: 88,  socket: 'AM5' }
const cS = { id: 'cs', category: 'cpu', perfScore: 260, price: 340, tdp: 120, socket: 'AM5' }
const gW = { id: 'gw', category: 'gpu', perfScore: 120, price: 200, tdp: 150, length: 260 }
const gM = { id: 'gm', category: 'gpu', perfScore: 260, price: 420, tdp: 220, length: 280 }
const gS = { id: 'gs', category: 'gpu', perfScore: 400, price: 800, tdp: 300, length: 300 }
const rW = { id: 'rw', category: 'ram', capacityGb: 8,  price: 30,  ramType: 'DDR5', speed: 5200 }
const rS = { id: 'rs', category: 'ram', capacityGb: 64, price: 200, ramType: 'DDR5', speed: 6000 }
const ratingCatalog = [cW, cM, cS, gW, gM, gS, rW, rS]

describe('rateBuild', () => {
  it('scores a weak CPU behind a strong GPU below the GPU (gaming)', () => {
    const r = rateBuild({ cpu: cW, gpu: gS }, 'gaming', ratingCatalog)
    expect(r.parts.cpu.score).toBeLessThan(r.parts.gpu.score)
    expect(r.parts.gpu.score).toBeGreaterThanOrEqual(80)
  })
  it('rates a mid build higher for office than for gaming', () => {
    const build = { cpu: cM, gpu: gM, ram: rS }
    expect(rateBuild(build, 'office', ratingCatalog).overall)
      .toBeGreaterThan(rateBuild(build, 'gaming', ratingCatalog).overall)
  })
  it('flags low RAM as a weak link for content creation', () => {
    const r = rateBuild({ cpu: cS, gpu: gS, ram: rW }, 'creation', ratingCatalog)
    expect(r.parts.ram.isWeakLink).toBe(true)
    expect(r.parts.ram.score).toBeLessThan(r.parts.gpu.score)
  })
  it('rates a strong balanced build highly', () => {
    const r = rateBuild({ cpu: cS, gpu: gS, ram: rS }, 'gaming', ratingCatalog)
    expect(r.overall).toBeGreaterThanOrEqual(70)
    expect(r.verdict).toMatch(/gaming/i)
  })
  it('returns overall 0 without a CPU or GPU', () => {
    expect(rateBuild({ cpu: cS }, 'gaming', ratingCatalog)).toEqual({ overall: 0, verdict: expect.any(String), parts: {} })
  })
  it('surfaces a synergy reason on a held-back part', () => {
    const gVram = { id: 'gv', category: 'gpu', perfScore: 400, price: 900, tdp: 300, length: 300, specs: { vram: 8 } }
    const cat = [cW, cM, cS, gW, gM, gVram, rS]
    const r = rateBuild({ cpu: cS, gpu: gVram, ram: rS }, 'creation', cat)
    expect(r.parts.gpu.reason).toMatch(/vram/i)
    expect(r.parts.gpu.score).toBeLessThan(80)
  })
  it('softens a severe CPU bottleneck instead of zeroing balance', () => {
    // cM has a non-zero level, so its score reflects the softened balance floor.
    const r = rateBuild({ cpu: cM, gpu: gS }, 'gaming', ratingCatalog)
    expect(r.parts.cpu.score).toBeGreaterThan(0)
    expect(r.parts.cpu.score).toBeLessThan(r.parts.gpu.score)
  })
})

const game = { id: 'fortnite', name: 'Fortnite', fpsFactor: 1, cpuFactor: 1 }

describe('partUpgradeOptions', () => {
  it('offers cheaper-first, higher-scoring, compatible upgrades with newScore', () => {
    const opts = partUpgradeOptions({ cpu: cW, gpu: gS }, 'gaming', 'cpu', ratingCatalog, { game })
    expect(opts.length).toBeGreaterThan(0)
    expect(opts[0].toPart.id).toBe('cm') // cheapest CPU stronger than cW
    expect(opts[0].extraCost).toBe(120)
    expect(opts[0].newScore).toBeGreaterThan(0)
  })
  it('adds an fps gain for gaming cpu/gpu, none for office', () => {
    const g = partUpgradeOptions({ cpu: cW, gpu: gS }, 'gaming', 'cpu', ratingCatalog, { game })
    expect(g[0].fpsGain).toBeGreaterThan(0)
    const o = partUpgradeOptions({ cpu: cW, gpu: gS }, 'office', 'cpu', ratingCatalog, { game })
    expect(o[0]?.fpsGain).toBeUndefined()
  })
  it('is empty when the part is already the best in its category', () => {
    expect(partUpgradeOptions({ cpu: cS, gpu: gS }, 'gaming', 'cpu', ratingCatalog, { game })).toEqual([])
  })
})
