import { describe, it, expect } from 'vitest'
import { getBuildWarnings } from '../lib/buildWarnings'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x') // 105W
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')      // 450W
const smallPsu = partsData.find((p) => p.id === 'psu-corsair-cv550')   // 550W
const bigPsu = partsData.find((p) => p.id === 'psu-corsair-rm1000x')   // 1000W

describe('getBuildWarnings', () => {
  it('flags a missing PSU as critical when the build draws power', () => {
    const w = getBuildWarnings({ cpu, gpu })
    expect(w.some((x) => x.level === 'critical' && /PSU/i.test(x.message))).toBe(true)
  })

  it('flags an under-sized PSU as critical', () => {
    const w = getBuildWarnings({ cpu, gpu, psu: smallPsu }) // 555W >= 550W
    expect(w.some((x) => x.level === 'critical' && /too small/i.test(x.message))).toBe(true)
  })

  it('warns to add a cooler when a CPU is present', () => {
    const w = getBuildWarnings({ cpu })
    expect(w.some((x) => /cooler/i.test(x.message))).toBe(true)
  })

  it('has no critical warnings for a powered build with an ample PSU', () => {
    const w = getBuildWarnings({ cpu, gpu, psu: bigPsu }) // 555W of 1000W
    expect(w.some((x) => x.level === 'critical')).toBe(false)
  })

  it('warns on thin PSU headroom (under ~30% spare)', () => {
    const w = getBuildWarnings({ cpu: { tdp: 100 }, gpu: { tdp: 300 }, psu: { wattage: 500 } })
    expect(w.some((x) => x.level === 'warning' && /headroom/i.test(x.message))).toBe(true)
    expect(w.some((x) => x.level === 'critical')).toBe(false)
  })

  it('gives no headroom warning when the PSU has ample spare', () => {
    const w = getBuildWarnings({ cpu: { tdp: 100 }, gpu: { tdp: 300 }, psu: { wattage: 800 } })
    expect(w.some((x) => /headroom/i.test(x.message))).toBe(false)
  })
})

describe('cooler thermal headroom', () => {
  it('warns when the cooler is rated below the CPU TDP', () => {
    const cpu = { id: 'c', category: 'cpu', socket: 'AM5', tdp: 170, specs: {} }
    const cooler = { id: 'k', category: 'cooler', sockets: ['AM5'], tdp: 5, specs: { type: 'Air', height: 150, ratedTdpW: 95 } }
    const w = getBuildWarnings({ cpu, cooler })
    expect(w.some((x) => x.level === 'warning' && /cooler/i.test(x.message))).toBe(true)
  })

  it('says nothing when the cooler is rated above the CPU TDP', () => {
    const cpu = { id: 'c', category: 'cpu', socket: 'AM5', tdp: 105, specs: {} }
    const cooler = { id: 'k', category: 'cooler', sockets: ['AM5'], tdp: 5, specs: { type: 'Air', height: 150, ratedTdpW: 250 } }
    const w = getBuildWarnings({ cpu, cooler })
    expect(w.some((x) => /rated for/i.test(x.message))).toBe(false)
  })

  // ⚠️ Most coolers publish no rating at all. Silence, not a warning.
  it('says nothing when the cooler publishes no rating', () => {
    const cpu = { id: 'c', category: 'cpu', socket: 'AM5', tdp: 170, specs: {} }
    const cooler = { id: 'k', category: 'cooler', sockets: ['AM5'], tdp: 5, specs: { type: 'Air', height: 150 } }
    const w = getBuildWarnings({ cpu, cooler })
    expect(w.some((x) => /rated for/i.test(x.message))).toBe(false)
  })
})

describe('advisories', () => {
  // ⚠️ PCIe is backward compatible. Blocking here would invent an
  // incompatibility that does not exist.
  it('notes a Gen5 GPU in a Gen4 board without warning or blocking', () => {
    const mb = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { pcieGen: 4 } }
    const gpu = { id: 'g', category: 'gpu', tdp: 300, specs: { pcieGen: 5 } }
    const w = getBuildWarnings({ motherboard: mb, gpu })
    const note = w.find((x) => /PCIe/i.test(x.message))
    expect(note).toBeDefined()
    expect(note.level).toBe('note')
  })

  it('notes RAM faster than the board is rated for', () => {
    const mb = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { maxRamSpeed: 5600 } }
    const ram = { id: 'r', category: 'ram', ramType: 'DDR5', speed: 8000, capacityGb: 32, specs: { sticks: 2 } }
    const w = getBuildWarnings({ motherboard: mb, ram })
    expect(w.find((x) => /8000/.test(x.message))?.level).toBe('note')
  })

  it('sorts notes below warnings and criticals', () => {
    const mb = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { pcieGen: 4 } }
    const gpu = { id: 'g', category: 'gpu', tdp: 300, specs: { pcieGen: 5 } }
    const w = getBuildWarnings({ motherboard: mb, gpu })
    const levels = w.map((x) => x.level)
    expect(levels.indexOf('note')).toBe(levels.length - 1)
  })
})
