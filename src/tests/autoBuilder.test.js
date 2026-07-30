import { describe, it, expect } from 'vitest'
import { autoBuild } from '../lib/autoBuilder'
import partsData from '../data/partsData.json'
import { partQuality } from '../lib/partQuality'
import { BUILD_PROFILES } from '../lib/buildProfiles'
import { checkCompatibility } from '../lib/compatibility'
import { rateBuild } from '../lib/partRatings'

const CATS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']
const idMap = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.id]))

// Small seedable PRNG so variety is reproducible in tests.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gamingOpts = (extra) => ({
  weights: BUILD_PROFILES.gaming.weights,
  upgradeOrder: BUILD_PROFILES.gaming.upgradeOrder,
  maximise: true,
  ...extra,
})

describe('autoBuild', () => {
  it('produces a complete, compatible build within budget', () => {
    const build = autoBuild({}, 2000, partsData, '1440p')
    for (const c of CATS) expect(build[c], `missing ${c}`).toBeTruthy()
    expect(build.cpu.socket).toBe(build.motherboard.socket)
    expect(build.ram.ramType).toBe(build.motherboard.ramType)
    expect(build.cooler.sockets).toContain(build.cpu.socket)
    expect(build.case.supportedFormFactors).toContain(build.motherboard.formFactor)
    expect(build.gpu.length).toBeLessThanOrEqual(build.case.maxGpuLength)
    const draw = CATS.reduce((s, c) => s + (build[c].tdp || 0), 0)
    expect(build.psu.wattage).toBeGreaterThanOrEqual(draw)
    const total = CATS.reduce((s, c) => s + build[c].price, 0)
    expect(total).toBeLessThanOrEqual(2000)
  })

  it('keeps an existing pick and matches the rest to it', () => {
    const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x') // AM5
    const build = autoBuild({ cpu }, 1500, partsData, '1440p')
    expect(build.cpu.id).toBe('cpu-ryzen-7-7700x')
    expect(build.motherboard.socket).toBe('AM5')
  })

  it('is deterministic', () => {
    expect(idMap(autoBuild({}, 1500, partsData, '1440p')))
      .toEqual(idMap(autoBuild({}, 1500, partsData, '1440p')))
  })
})

describe('autoBuild options', () => {
  it('default path is unchanged when options are omitted vs explicit gaming defaults', () => {
    const idMap = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.id]))
    const a = autoBuild({}, 1800, partsData, '1440p')
    const b = autoBuild({}, 1800, partsData, '1440p', { upgradeOrder: ['gpu', 'cpu'], maximise: false })
    expect(idMap(a)).toEqual(idMap(b))
  })

  it('maximise spends at least as much as the default pass', () => {
    const total = (b) => Object.values(b).reduce((s, p) => s + (p?.price ?? 0), 0)
    const plain = autoBuild({}, 1800, partsData, '1440p')
    const maxed = autoBuild({}, 1800, partsData, '1440p', { upgradeOrder: ['gpu', 'cpu'], maximise: true })
    expect(total(maxed)).toBeGreaterThanOrEqual(total(plain))
  })

  it('a RAM-heavy profile buys more memory than the default gaming build', () => {
    const ramWeights = { cpu: .18, gpu: .14, motherboard: .11, ram: .22, storage: .1, psu: .07, case: .06, cooler: .06, fans: .03 }
    const heavy = autoBuild({}, 2500, partsData, '1440p', { weights: ramWeights, upgradeOrder: ['ram', 'cpu'], maximise: true })
    const gaming = autoBuild({}, 2500, partsData, '1440p')
    expect(partQuality(heavy.ram)).toBeGreaterThanOrEqual(partQuality(gaming.ram))
  })
})

describe('autoBuild rateFor (score-greedy maximise)', () => {
  const spend = (b) => Object.values(b).reduce((s, p) => s + (p?.price ?? 0), 0)

  it('beats the quality-stepping pass on the score it is spending against', () => {
    for (const useCase of ['gaming', 'creation', 'programming', 'streaming']) {
      const p = BUILD_PROFILES[useCase]
      const opts = { weights: p.weights, upgradeOrder: p.upgradeOrder, maximise: true }
      const plain = autoBuild({}, 1700, partsData, p.resolution, opts)
      const scored = autoBuild({}, 1700, partsData, p.resolution, { ...opts, rateFor: useCase })
      expect(
        rateBuild(scored, useCase, partsData).overall,
        `${useCase} got no better`,
      ).toBeGreaterThan(rateBuild(plain, useCase, partsData).overall)
    }
  })

  it('stops pouring a gaming budget into the CPU', () => {
    // The old pass walked ['gpu','cpu',...] taking the cheapest step in each,
    // and landed a £650 i9 in a £1700 gaming build while the GPU stayed mid.
    const p = BUILD_PROFILES.gaming
    const build = autoBuild({}, 1700, partsData, p.resolution, {
      weights: p.weights, upgradeOrder: p.upgradeOrder, maximise: true, rateFor: 'gaming',
    })
    expect(build.gpu.price).toBeGreaterThan(build.cpu.price)
  })

  it('still respects the budget and the parts the user chose', () => {
    const p = BUILD_PROFILES.gaming
    const mine = { gpu: partsData.find((x) => x.category === 'gpu' && x.price < 300) }
    const build = autoBuild(mine, 1700, partsData, p.resolution, {
      weights: p.weights, upgradeOrder: p.upgradeOrder, maximise: true, rateFor: 'gaming',
    })
    expect(build.gpu.id).toBe(mine.gpu.id)
    expect(spend(build)).toBeLessThanOrEqual(1700)
  })

  it('is deterministic without an rng', () => {
    const p = BUILD_PROFILES.gaming
    const opts = { weights: p.weights, upgradeOrder: p.upgradeOrder, maximise: true, rateFor: 'gaming' }
    expect(idMap(autoBuild({}, 1500, partsData, p.resolution, opts)))
      .toEqual(idMap(autoBuild({}, 1500, partsData, p.resolution, opts)))
  })
})

describe('autoBuild variety + lockExisting', () => {
  it('a seeded build is complete, compatible and within budget', () => {
    const b = autoBuild({}, 1800, partsData, '1440p', gamingOpts({ rng: mulberry32(1) }))
    for (const c of CATS) expect(b[c], `missing ${c}`).toBeTruthy()
    expect(CATS.reduce((s, c) => s + b[c].price, 0)).toBeLessThanOrEqual(1800)
    for (const c of CATS) {
      const others = { ...b }; delete others[c]
      expect(checkCompatibility(others, b[c]).compatible).toBe(true)
    }
  })

  it('the same seed reproduces the same build', () => {
    expect(idMap(autoBuild({}, 1800, partsData, '1440p', gamingOpts({ rng: mulberry32(7) }))))
      .toEqual(idMap(autoBuild({}, 1800, partsData, '1440p', gamingOpts({ rng: mulberry32(7) }))))
  })

  it('different seeds can produce different builds', () => {
    const variants = new Set([1, 2, 3, 4, 5].map((s) =>
      JSON.stringify(idMap(autoBuild({}, 1800, partsData, '1440p', gamingOpts({ rng: mulberry32(s) }))))))
    expect(variants.size).toBeGreaterThan(1)
  })

  it('lockExisting:false steps up a passed-in part; default keeps it', () => {
    const cheapCpu = [...partsData.filter((p) => p.category === 'cpu')].sort((a, b) => a.price - b.price)[0]
    const seed = { cpu: cheapCpu }
    const opts = { weights: BUILD_PROFILES.gaming.weights, upgradeOrder: ['cpu'], maximise: true }
    const locked = autoBuild(seed, 2500, partsData, '1440p', { ...opts, lockExisting: true })
    const unlocked = autoBuild(seed, 2500, partsData, '1440p', { ...opts, lockExisting: false })
    expect(locked.cpu.id).toBe(cheapCpu.id)
    expect(partQuality(unlocked.cpu)).toBeGreaterThan(partQuality(cheapCpu))
  })
})
