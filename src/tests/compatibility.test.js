import { checkCompatibility, getLockedReasons } from '../lib/compatibility'
import { getBuildWarnings } from '../lib/buildWarnings'
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

// ⚠️ SYNTHETIC, and it has to be. Since the case research corrected the Q300L
// from a bogus 270 mm to Cooler Master's stated 360 mm, NO catalogue case
// rejects any catalogue GPU on length: the longest card is 320 mm and the
// tightest case clears 320 mm. Pinning this rule to real rows made the test
// pass only because the data was wrong. The rule still has to work, so it is
// tested against a fixture the catalogue cannot invalidate.
const caseTight = { ...caseSmall, id: 'case-test-tight', name: 'Test Tight Case', maxGpuLength: 200 }

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
    const r = checkCompatibility({ case: caseTight }, gpuLong)
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
    const r = checkCompatibility({ gpu: gpuLong }, caseTight)
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

// A supply is not viable at exactly 100% of its rating, and the codebase said
// so in two of three places. Picking the PSU used `wattage < draw` (equality
// ALLOWED); re-picking any other part used `draw >= wattage` (equality
// BLOCKED); getBuildWarnings agreed with the second. The result was a build you
// could assemble and then be told was critically underpowered — and whose
// graphics card you could no longer reselect.
describe('the PSU headroom boundary', () => {
  // 105W CPU + 295W GPU = 400W exactly.
  const cpu = { ...cpuAM5, tdp: 105 }
  const gpu = { ...gpuLong, tdp: 295 }
  const psu400 = { id: 'psu-test-400', category: 'psu', name: 'Test 400W', price: 40, wattage: 400, tdp: 0 }

  it('will not let you pick a supply rated exactly at the build draw', () => {
    expect(checkCompatibility({ cpu, gpu }, psu400).compatible).toBe(false)
  })

  it('agrees with itself about the same build from the other direction', () => {
    // Re-selecting the graphics card already in the build must give the same
    // verdict as selecting the supply did.
    const fromPsuSide = checkCompatibility({ cpu, gpu }, psu400).compatible
    const fromPartSide = checkCompatibility({ cpu, gpu, psu: psu400 }, gpu).compatible
    expect(fromPsuSide).toBe(fromPartSide)
  })

  it('agrees with the build warnings about the same build', () => {
    const blocked = !checkCompatibility({ cpu, gpu }, psu400).compatible
    const critical = getBuildWarnings({ cpu, gpu, psu: psu400 })
      .some((w) => w.level === 'critical' && /PSU too small/i.test(w.message))
    expect(blocked).toBe(critical)
  })

  it('still allows a supply with genuine headroom over the same draw', () => {
    const psu650 = { ...psu400, id: 'psu-test-650', wattage: 650 }
    expect(checkCompatibility({ cpu, gpu }, psu650).compatible).toBe(true)
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

describe('three-state verdict', () => {
  it('reports status ok when nothing blocks', () => {
    const r = checkCompatibility({ motherboard: mbAM5 }, cpuAM5)
    expect(r.status).toBe('ok')
    expect(r.compatible).toBe(true)
  })

  it('reports status blocked when a check fails, and keeps compatible false', () => {
    const r = checkCompatibility({ motherboard: mbAM5 }, cpuIntel)
    expect(r.status).toBe('blocked')
    expect(r.compatible).toBe(false)
  })

  it('derives compatible from status rather than carrying an independent flag', () => {
    // compatible must never disagree with status, for every part in the
    // catalogue against a realistic build.
    for (const part of partsData) {
      const r = checkCompatibility({ motherboard: mbAM5, cpu: cpuAM5 }, part)
      expect(r.compatible).toBe(r.status !== 'blocked')
    }
  })
})

describe('getLockedReasons', () => {
  // ⚠️ If this ever fails, the catalogue has become unusable: no part carries
  // the researched specs yet, so locking on unverified would lock everything.
  it('locks on blocked but never on unverified', () => {
    const boardNoSlots = { ...mbAM5, specs: { ...mbAM5.specs } }
    const locked = getLockedReasons({ motherboard: boardNoSlots }, partsData)
    for (const part of partsData) {
      const { status } = checkCompatibility({ motherboard: boardNoSlots }, part)
      if (status === 'unverified') expect(locked[part.id]).toBeUndefined()
    }
  })
})
