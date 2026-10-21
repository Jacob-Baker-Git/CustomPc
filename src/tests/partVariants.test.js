import * as THREE from 'three'
import { partBox, caseInterior } from '../lib/assemblyGeometry'
import { sizeOverrides } from '../lib/partOverrides'
import { assemblyLayout } from '../lib/assemblyLayout'
import { gltfModelFor } from '../lib/gltfModels'
import { cableRoutes } from '../lib/cableRoutes'
import { FAN_MOUNTS, FAN_HALF_DEPTH, fittedFanMounts } from '../lib/fanMounts'
import { mm, FAN_MM } from '../lib/pcScale'
import parts from '../data/partsData.json'

// The 3D used to draw a 240 mm AIO, an M.2 stick and four fans whatever was
// picked. These pin the parts that now follow the selection: an air tower sized
// to the cooler's height, a 2.5"/3.5" drive in the basement, and the case's own
// fan count.

const of = (cat) => parts.filter((p) => p.category === cat)
const longestGpu = of('gpu').reduce((a, b) => (b.length > a.length ? b : a))

// Smallest per-axis overlap in mm; <= 0 means clear.
const overlapMm = (a, b) =>
  Math.min(...[0, 1, 2].map((i) => Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]))) / mm(1)

const fanBox = ({ position }) => {
  const half = [FAN_HALF_DEPTH, mm(FAN_MM) / 2, mm(FAN_MM) / 2]
  return { min: position.map((v, i) => v - half[i]), max: position.map((v, i) => v + half[i]) }
}

const cablePoints = cableRoutes({ motherboard: {}, psu: {}, cpu: {}, gpu: longestGpu }).flatMap((r) =>
  new THREE.CatmullRomCurve3(r.points.map((p) => new THREE.Vector3(...p))).getPoints(300).map((v) => v.toArray()),
)
const holds = (box, p) => p.every((v, i) => v > box.min[i] && v < box.max[i])

describe('sizeOverrides picks the right stand-in', () => {
  it('gives an air cooler a tower box from its height, and leaves an AIO on its mesh', () => {
    const d15 = of('cooler').find((p) => p.name === 'Noctua NH-D15')
    expect(sizeOverrides({ cooler: d15 }).cooler.boxMm).toEqual([80, 125, 168])
    expect(sizeOverrides({ cooler: of('cooler').find((p) => p.specs.type === 'AIO') }).cooler).toBeUndefined()
  })

  it('lays a low-profile cooler flat', () => {
    const l9 = of('cooler').find((p) => p.specs.type === 'Air' && p.specs.height < 80)
    expect(sizeOverrides({ cooler: l9 }).cooler).toMatchObject({ lowProfile: true, boxMm: [95, 95, l9.specs.height] })
  })

  it('gives HDDs and SATA SSDs a drive box, and leaves NVMe on the M.2 mesh', () => {
    expect(sizeOverrides({ storage: { storageType: 'HDD' } }).storage.boxMm).toEqual([147, 26.1, 101.6])
    expect(sizeOverrides({ storage: { storageType: 'SATA SSD' } }).storage.boxMm).toEqual([100, 7, 69.85])
    expect(sizeOverrides({ storage: { storageType: 'NVMe SSD' } }).storage).toBeUndefined()
  })

  it('draws a box part procedurally, unrotated', () => {
    const o = sizeOverrides({ storage: { storageType: 'HDD' } })
    expect(gltfModelFor('storage', o)).toBeUndefined()
    expect(assemblyLayout('storage', o).rotation).toEqual([0, 0, 0])
  })
})

describe('every catalogue air cooler and drive fits the build', () => {
  const variants = [...of('cooler'), ...of('storage')]
    .map((p) => ({ p, o: { ...sizeOverrides({ [p.category]: p, gpu: longestGpu }) } }))
    .filter(({ p, o }) => o[p.category])
  const inner = caseInterior()

  it('covers every air cooler and SATA drive', () => {
    const want = of('cooler').filter((p) => p.specs.type === 'Air').length +
      of('storage').filter((p) => p.storageType !== 'NVMe SSD').length
    expect(variants).toHaveLength(want)
  })

  it.each(variants.map(({ p, o }) => [p.name, p.category, o]))('%s', (_, cat, o) => {
    const box = partBox(cat, o)
    for (let i = 0; i < 3; i++) {
      expect(box.min[i]).toBeGreaterThan(inner.min[i])
      expect(box.max[i]).toBeLessThan(inner.max[i])
    }
    for (const other of ['ram', 'gpu', 'psu']) {
      expect(overlapMm(box, partBox(other, o)), other).toBeLessThanOrEqual(0)
    }
    for (const f of FAN_MOUNTS) expect(overlapMm(box, fanBox(f))).toBeLessThanOrEqual(0)
    expect(cablePoints.some((pt) => holds(box, pt))).toBe(false)
    // A cooler sits on the CPU, not in the air above it.
    if (cat === 'cooler') expect(box.min[2]).toBeCloseTo(partBox('cpu').max[2], 9)
  })
})

describe('fittedFanMounts', () => {
  const caseWith = (n) => ({ specs: { includedFans: n } })

  it('fills the case\'s own fans, rear exhaust first', () => {
    expect([...fittedFanMounts({ case: caseWith(0) })]).toEqual([])
    expect([...fittedFanMounts({ case: caseWith(1) })].map((i) => FAN_MOUNTS[i].wall)).toEqual(['rear'])
    expect(fittedFanMounts({ case: caseWith(3) }).size).toBe(3)
  })

  it('adds a fan pack on top, capped at the mounts there are', () => {
    expect(fittedFanMounts({ case: caseWith(1), fans: { specs: { count: 2 } } }).size).toBe(3)
    expect(fittedFanMounts({ case: caseWith(6) }).size).toBe(FAN_MOUNTS.length)
    expect(fittedFanMounts({ fans: { specs: { count: 3 } } }).size).toBe(3)
  })
})
