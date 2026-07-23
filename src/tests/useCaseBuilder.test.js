import { describe, it, expect } from 'vitest'
import { buildForUseCase } from '../lib/useCaseBuilder'
import { autoBuild } from '../lib/autoBuilder'
import { checkCompatibility } from '../lib/compatibility'
import partsData from '../data/partsData.json'

const CATS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']
const total = (b) => CATS.reduce((s, c) => s + (b[c]?.price ?? 0), 0)

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('buildForUseCase', () => {
  it('builds a complete, compatible build within budget', () => {
    const b = buildForUseCase(1800, 'gaming', partsData)
    for (const c of CATS) expect(b[c], `missing ${c}`).toBeTruthy()
    for (const part of Object.values(b)) {
      const others = { ...b }; delete others[part.category]
      expect(checkCompatibility(others, part).compatible).toBe(true)
    }
    expect(total(b)).toBeLessThanOrEqual(1800)
  })

  it('spends at least as much as a non-maximising build', () => {
    const plain = autoBuild({}, 1800, partsData, '1440p')
    expect(total(buildForUseCase(1800, 'gaming', partsData))).toBeGreaterThanOrEqual(total(plain))
  })

  it('use case shifts the build: gaming favours GPU, programming favours RAM', () => {
    const g = buildForUseCase(2500, 'gaming', partsData)
    const p = buildForUseCase(2500, 'programming', partsData)
    expect(g.gpu.perfScore).toBeGreaterThanOrEqual(p.gpu.perfScore)
    expect(p.ram.capacityGb).toBeGreaterThanOrEqual(g.ram.capacityGb)
  })

  it('is deterministic', () => {
    const idMap = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.id]))
    expect(idMap(buildForUseCase(1500, 'office', partsData))).toEqual(idMap(buildForUseCase(1500, 'office', partsData)))
  })

  it('falls back to the gaming profile for an unknown use case', () => {
    const b = buildForUseCase(1500, 'nonsense', partsData)
    for (const c of CATS) expect(b[c]).toBeTruthy()
  })

  it('threads an rng so seeds vary, each build complete/compatible/within budget', () => {
    const build = (seed) => buildForUseCase(1800, 'gaming', partsData, { rng: mulberry32(seed) })
    const b = build(3)
    for (const c of CATS) expect(b[c], `missing ${c}`).toBeTruthy()
    for (const part of Object.values(b)) {
      const others = { ...b }; delete others[part.category]
      expect(checkCompatibility(others, part).compatible).toBe(true)
    }
    expect(total(b)).toBeLessThanOrEqual(1800)
    const variants = new Set([1, 2, 3, 4, 5].map((s) =>
      JSON.stringify(Object.fromEntries(CATS.map((c) => [c, build(s)[c]?.id])))))
    expect(variants.size).toBeGreaterThan(1)
  })
})
