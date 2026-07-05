import { checkCompatibility, getLockedReasons } from '../lib/compatibility'
import partsData from '../data/partsData.json'

const mbAM5   = partsData.find(p => p.id === 'mb-asus-x670e')
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

  it('treats case fans as always compatible', () => {
    const fan = { id: 'fan-x', category: 'fans', price: 20, tdp: 4 }
    expect(checkCompatibility({ motherboard: mbAM5, cpu: cpuAM5 }, fan).compatible).toBe(true)
    expect(checkCompatibility({}, fan).compatible).toBe(true)
  })

  it('case incompatible when the selected GPU does not fit it', () => {
    const r = checkCompatibility({ gpu: gpuLong }, caseSmall)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/clearance/i)
    expect(checkCompatibility({ gpu: gpuLong }, caseLarge).compatible).toBe(true)
  })

  it('air cooler incompatible when taller than the case limit', () => {
    // Noctua NH-D15 is 165mm; the Lian Li A4-H2O tops out at 67mm.
    const tinyCase = partsData.find((p) => p.id === 'case-lian-li-a4-h2o')
    const r = checkCompatibility({ case: tinyCase }, cooler)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/mm/)
  })

  it('AIO coolers have no height limit', () => {
    const tinyCase = partsData.find((p) => p.id === 'case-lian-li-a4-h2o')
    const aio = partsData.find((p) => p.id === 'cooler-arctic-lf2-240')
    expect(checkCompatibility({ case: tinyCase }, aio).compatible).toBe(true)
  })

  it('case incompatible when the selected air cooler is too tall for it', () => {
    const tinyCase = partsData.find((p) => p.id === 'case-lian-li-a4-h2o')
    const r = checkCompatibility({ cooler }, tinyCase)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/cooler/i)
  })

  it('DDR4 RAM incompatible with a DDR5-only CPU even before a board is picked', () => {
    const r = checkCompatibility({ cpu: cpuAM5 }, ramDDR4)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/DDR5-only/i)
    // Intel LGA1700 boards come in both flavours, so no lock without a board.
    expect(checkCompatibility({ cpu: cpuIntel }, ramDDR4).compatible).toBe(true)
  })

  it('DDR5-only CPU incompatible with selected DDR4 RAM before a board is picked', () => {
    const r = checkCompatibility({ ram: ramDDR4 }, cpuAM5)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/DDR4/i)
    expect(checkCompatibility({ ram: ramDDR5 }, cpuAM5).compatible).toBe(true)
  })

  it('PSU incompatible when smaller than the current build draw', () => {
    const psuSmall = partsData.find((p) => p.id === 'psu-thermaltake-smart-500')
    const hungry = { cpu: { ...cpuAM5, tdp: 170 }, gpu: { ...gpuLong, tdp: 450 } }
    const r = checkCompatibility(hungry, psuSmall)
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/draw/i)
  })

  it('part incompatible when it would push the draw past the selected PSU', () => {
    const psuSmall = partsData.find((p) => p.id === 'psu-thermaltake-smart-500') // 500W
    const build = { psu: psuSmall, cpu: { ...cpuAM5, tdp: 170 } }
    const r = checkCompatibility(build, gpuLong) // 450W GPU → 620W total
    expect(r.compatible).toBe(false)
    expect(r.reason).toMatch(/PSU/i)
  })

  it('swapping a part credits its own draw before the PSU check', () => {
    const psuSmall = partsData.find((p) => p.id === 'psu-thermaltake-smart-500') // 500W
    const gpuMid = partsData.find((p) => p.id === 'gpu-rtx-4060') // 115W
    const gpuNext = partsData.find((p) => p.id === 'gpu-rtx-4070') // 200W
    const build = { psu: psuSmall, cpu: { ...cpuAM5, tdp: 105 }, gpu: gpuMid }
    // 105 + 200 = 305W < 500W — fine once the old GPU's 115W is credited back.
    expect(checkCompatibility(build, gpuNext).compatible).toBe(true)
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
