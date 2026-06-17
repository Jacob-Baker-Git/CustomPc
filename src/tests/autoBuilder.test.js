import { describe, it, expect } from 'vitest'
import { autoBuild } from '../lib/autoBuilder'
import partsData from '../data/partsData.json'

const CATS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']
const idMap = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.id]))

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
