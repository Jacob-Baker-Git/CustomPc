import { partSize, rotateExtents, rotateVector, partCentre, partBox, boardFaceZ, caseInterior, CASE } from '../lib/assemblyGeometry'
import { mm, WU_PER_MM, FAN_MM } from '../lib/pcScale'
import { MOUNTS, BOARD } from '../lib/mountPoints'

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

  // Pinned to independently computed millimetres rather than re-deriving from
  // the same anchorOffset that partCentre consumes. A test that recomputes the
  // formula it is checking passes for any offset, including a wrong one — so it
  // would not notice the anchor placement silently breaking.
  //
  // These come from the measured mesh: the pump block sits 54 mm below the
  // assembly's bbox centre, so mounting the block on a socket at (-20, 75) puts
  // the bbox centre up at (28.8, 129.4).
  //
  // Z is 95.9 rather than 93.0 because the block clamps onto the CPU's heat
  // spreader, not onto the PCB: it starts at the CPU's outer face, which is the
  // board face plus the CPU's own 2.9 mm. Seating it on the board instead left
  // the entire CPU inside the pump block.
  it('places the cooler so its pump block meets the socket, on top of the CPU', () => {
    const centreMm = partCentre('cooler').map((v) => +(v / WU_PER_MM).toFixed(1))
    expect(centreMm).toEqual([28.8, 129.4, 95.9])
  })
})

describe('board mesh versus the mount frame', () => {
  // BOARD.widthMm (244) is the ATX reference frame the mount points are measured
  // in. The GLB is squarer than a real ATX board — about 302 mm front-to-back —
  // so the two legitimately differ; the mesh is a generic stand-in, not a
  // dimensionally exact ATX board. What must hold is that the rendered board is
  // never NARROWER than the frame, or a mount point would hang off its edge.
  it('renders a board at least as wide as the mount frame assumes', () => {
    expect(partSize('motherboard')[0]).toBeGreaterThanOrEqual(mm(BOARD.widthMm))
  })

  it('renders a board as tall as the ATX long edge', () => {
    expect(partSize('motherboard')[1]).toBeCloseTo(mm(BOARD.heightMm), 6)
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

describe('case fans', () => {
  it('uses a real 120mm fan', () => {
    expect(FAN_MM).toBe(120)
    expect(mm(FAN_MM)).toBeCloseTo(0.98, 2)
  })
})
