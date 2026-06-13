import { checkCompatibility, getLockedReasons } from '../lib/compatibility'
import partsData from '../data/partsData.json'

const mbAM5   = partsData.find(p => p.id === 'mb-asus-x670e')
const mbDDR4  = partsData.find(p => p.id === 'mb-gigabyte-b760m')
const cpuAM5  = partsData.find(p => p.id === 'cpu-ryzen-7-7700x')
const cpuIntel = partsData.find(p => p.id === 'cpu-i7-13700k')
const ramDDR5 = partsData.find(p => p.id === 'ram-corsair-ddr5-32')
const ramDDR4 = partsData.find(p => p.id === 'ram-corsair-ddr4-32')
const gpuLong = partsData.find(p => p.id === 'gpu-rtx-4090')
const caseSmall = partsData.find(p => p.id === 'case-cm-q300l')
const caseLarge = partsData.find(p => p.id === 'case-fractal-torrent')
const cooler  = partsData.find(p => p.id === 'cooler-noctua-d15')

describe('checkCompatibility', () => {
  it('returns compatible when no parts selected', () => {
    expect(checkCompatibility({}, cpuAM5).compatible).toBe(true)
  })

  it('CPU compatible when socket matches motherboard', () => {
    expect(checkCompatibility({ motherboard: mbAM5 }, cpuAM5).compatible).toBe(true)
  })

  it('CPU incompatible when socket mismatches motherboard', () => {
    const r = checkCompatibility({ motherboard: mbAM5 }, cpuIntel)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/socket/i)
  })

  it('RAM incompatible when type mismatches motherboard', () => {
    const r = checkCompatibility({ motherboard: mbAM5 }, ramDDR4)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/DDR/i)
  })

  it('RAM compatible when type matches motherboard', () => {
    expect(checkCompatibility({ motherboard: mbAM5 }, ramDDR5).compatible).toBe(true)
  })

  it('GPU incompatible when longer than case clearance', () => {
    const r = checkCompatibility({ case: caseSmall }, gpuLong)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/length|clearance/i)
  })

  it('GPU compatible when shorter than case clearance', () => {
    expect(checkCompatibility({ case: caseLarge }, gpuLong).compatible).toBe(true)
  })

  it('case incompatible when form factor not supported', () => {
    const r = checkCompatibility({ case: caseSmall }, mbAM5)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/form factor/i)
  })

  it('cooler incompatible when socket not in cooler sockets list', () => {
    const weirdMb = { ...mbAM5, socket: 'TR4' }
    const r = checkCompatibility({ motherboard: weirdMb }, cooler)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/socket/i)
  })

  it('CPU incompatible when selected cooler does not support its socket', () => {
    const coolerAM5Only = { ...cooler, sockets: ['AM5'] }
    const r = checkCompatibility({ cooler: coolerAM5Only }, cpuIntel)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/cooler.*socket/i)
  })

  it('CPU compatible when selected cooler supports its socket', () => {
    const coolerAM5Only = { ...cooler, sockets: ['AM5'] }
    expect(checkCompatibility({ cooler: coolerAM5Only }, cpuAM5).compatible).toBe(true)
  })

  it('motherboard incompatible when selected cooler does not support its socket', () => {
    const coolerAM5Only = { ...cooler, sockets: ['AM5'] }
    const r = checkCompatibility({ cooler: coolerAM5Only }, mbAM5)
    expect(r.compatible).toBe(true) // mbAM5 is AM5, cooler supports AM5
    const mbIntel = partsData.find(p => p.id === 'mb-asus-z790')
    const r2 = checkCompatibility({ cooler: coolerAM5Only }, mbIntel)
    expect(r2.compatible).toBe(false)
    expect(r2.reason).toMatch(/cooler.*socket/i)
  })
})

describe('getLockedReasons', () => {
  it('returns empty object when no parts selected', () => {
    expect(getLockedReasons({}, partsData)).toEqual({})
  })

  it('locks Intel CPU when AM5 motherboard selected', () => {
    const reasons = getLockedReasons({ motherboard: mbAM5 }, partsData)
    expect(reasons['cpu-i7-13700k']).toMatch(/socket/i)
  })
})
