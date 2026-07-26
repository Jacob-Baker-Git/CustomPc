import { partSize, rotateExtents, rotateVector, partCentre, partBox, boardFaceZ, caseInterior, CASE, modelScale } from '../lib/assemblyGeometry'
import { mm } from '../lib/pcScale'
import { MOUNTS } from '../lib/mountPoints'
import { PART_SPECS } from '../lib/partSpecs'

const near = (v, expectedMm) => expect(v).toBeCloseTo(mm(expectedMm), 2)

describe('rotateExtents', () => {
  it('swaps Y and Z for a quarter turn about X', () => {
    expect(rotateExtents([1, 2, 3], [Math.PI / 2, 0, 0])).toEqual([1, 3, 2])
  })

  it('leaves extents untouched for a half turn', () => {
    expect(rotateExtents([1, 2, 3], [Math.PI, 0, 0])).toEqual([1, 2, 3])
  })
})

describe('rotateVector', () => {
  // Unlike extents, a signed offset must keep its direction. Right-hand rule
  // about X, matching three.js: +Y goes to +Z, and +Z goes to -Y.
  it('rotates a signed offset about X', () => {
    const [x, y, z] = rotateVector([0, 0, 1], [Math.PI / 2, 0, 0])
    expect([x, +y.toFixed(6), +z.toFixed(6)]).toEqual([0, -1, 0])
  })

  it('flips a vector under a half turn, where extents would not change', () => {
    const [, y] = rotateVector([0, 1, 0], [Math.PI, 0, 0])
    expect(+y.toFixed(6)).toBe(-1)
  })
})

describe('partSize', () => {
  it('sizes the motherboard as a 305mm ATX board standing vertical', () => {
    near(partSize('motherboard')[1], 305)
  })

  it('lays the GPU horizontal, 285mm front-to-back', () => {
    near(partSize('gpu')[0], 285)
  })

  it('stands a DIMM edge-on: 133mm tall, thin across the board', () => {
    const [x, y, z] = partSize('ram')
    near(y, 133)
    expect(x).toBeLessThan(z)
    expect(x).toBeLessThan(mm(15))
  })

  it('lays the M.2 flat against the board', () => {
    const [x, , z] = partSize('storage')
    near(x, 80)
    expect(z).toBeLessThan(mm(5))
  })

  it('runs the AIO radiator front-to-back rather than tipping it over', () => {
    const [x, y] = partSize('cooler')
    expect(x).toBeGreaterThan(y)
  })

  it('pins the PSU to a real 86mm height via fitAxis', () => {
    near(partSize('psu')[1], 86)
  })

  it('returns a zero-size box for an unknown category', () => {
    expect(partSize('banana')).toEqual([0, 0, 0])
  })
})

describe('partCentre', () => {
  it('centres the motherboard on the origin', () => {
    expect(partCentre('motherboard')).toEqual([0, 0, 0])
  })

  it('mounts RAM, GPU and M.2 in front of the board face, never inside it', () => {
    for (const cat of ['ram', 'gpu', 'storage']) {
      expect(partBox(cat).min[2], cat).toBeGreaterThanOrEqual(boardFaceZ() - 1e-6)
    }
  })

  it('lands the cooler pump block on the socket, not the mesh centre', () => {
    // The radiator hangs well above the socket, so the bbox centre must sit
    // higher than the mount point it is anchored by.
    expect(partCentre('cooler')[1]).toBeGreaterThan(mm(MOUNTS.cooler.yMm))
  })

  it('sits the GPU below the cooler', () => {
    expect(partCentre('gpu')[1]).toBeLessThan(partCentre('cooler')[1])
  })

  it('sits the cooler pump block flush on the board face', () => {
    const { anchorOffset, anchorSize, rotation } = PART_SPECS.cooler
    const scale = modelScale('cooler')
    const blockZ = partCentre('cooler')[2] + rotateVector(anchorOffset, rotation)[2] * scale
    const blockDepth = rotateExtents(anchorSize, rotation)[2] * scale
    expect(blockZ - blockDepth / 2).toBeCloseTo(boardFaceZ(), 6)
  })
})

describe('partBox', () => {
  it('returns a box consistent with the part size', () => {
    const box = partBox('gpu')
    expect(box.max[0] - box.min[0]).toBeCloseTo(partSize('gpu')[0], 6)
  })
})

describe('caseInterior', () => {
  it('is a real tower, deep enough for a board plus cooler clearance', () => {
    expect(CASE.depthMm).toBe(450)
    expect(CASE.widthMm).toBe(210)
    expect(CASE.heightMm).toBeGreaterThanOrEqual(450)
  })

  it('contains every part', () => {
    const inner = caseInterior()
    for (const cat of ['motherboard', 'gpu', 'ram', 'storage', 'psu', 'cooler']) {
      const box = partBox(cat)
      for (let i = 0; i < 3; i++) {
        expect(box.min[i], `${cat} axis ${i} min`).toBeGreaterThanOrEqual(inner.min[i] - 1e-6)
        expect(box.max[i], `${cat} axis ${i} max`).toBeLessThanOrEqual(inner.max[i] + 1e-6)
      }
    }
  })

  it('sits the PSU in the basement, entirely below the board', () => {
    expect(partBox('psu').max[1]).toBeLessThanOrEqual(partBox('motherboard').min[1] + 1e-6)
  })

  it('gives the basement room for the PSU', () => {
    const [, psuHeight] = partSize('psu')
    expect(mm(CASE.basementMm)).toBeGreaterThan(psuHeight)
  })
})
