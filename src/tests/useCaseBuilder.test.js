import { describe, it, expect } from 'vitest'
import { useCaseBuild } from '../lib/useCaseBuilder'
import { autoBuild } from '../lib/autoBuilder'
import { checkCompatibility } from '../lib/compatibility'
import partsData from '../data/partsData.json'

const CATS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']
const total = (b) => CATS.reduce((s, c) => s + (b[c]?.price ?? 0), 0)

describe('useCaseBuild', () => {
  it('builds a complete, compatible build within budget', () => {
    const b = useCaseBuild(1800, 'gaming', partsData)
    for (const c of CATS) expect(b[c], `missing ${c}`).toBeTruthy()
    for (const part of Object.values(b)) {
      const others = { ...b }; delete others[part.category]
      expect(checkCompatibility(others, part).compatible).toBe(true)
    }
    expect(total(b)).toBeLessThanOrEqual(1800)
  })

  it('spends at least as much as a non-maximising build', () => {
    const plain = autoBuild({}, 1800, partsData, '1440p')
    expect(total(useCaseBuild(1800, 'gaming', partsData))).toBeGreaterThanOrEqual(total(plain))
  })

  it('use case shifts the build: gaming favours GPU, programming favours RAM', () => {
    const g = useCaseBuild(2500, 'gaming', partsData)
    const p = useCaseBuild(2500, 'programming', partsData)
    expect(g.gpu.perfScore).toBeGreaterThanOrEqual(p.gpu.perfScore)
    expect(p.ram.capacityGb).toBeGreaterThanOrEqual(g.ram.capacityGb)
  })

  it('is deterministic', () => {
    const idMap = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.id]))
    expect(idMap(useCaseBuild(1500, 'everyday', partsData))).toEqual(idMap(useCaseBuild(1500, 'everyday', partsData)))
  })

  it('falls back to the gaming profile for an unknown use case', () => {
    const b = useCaseBuild(1500, 'nonsense', partsData)
    for (const c of CATS) expect(b[c]).toBeTruthy()
  })
})
