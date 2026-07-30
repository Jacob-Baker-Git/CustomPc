import { partSize, partLocalSize, rotateExtents, unrotateExtents, rotateVector, partCentre, partBox, boardFaceZ, caseInterior, CASE } from '../lib/assemblyGeometry'
import { mm, WU_PER_MM, FAN_MM } from '../lib/pcScale'
import { MOUNTS, BOARD } from '../lib/mountPoints'
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

// The hover highlight is a CHILD of the placement group, so it is authored in
// the model's own axes while partSize() is world-space. Rotating one must give
// the other — the previous highlight constants were world-ish and came out
// rotated twice, drawing the GPU's shell as a tall slab beside the card.
describe('partLocalSize', () => {
  it('rotates into partSize for every measured part', () => {
    for (const category of Object.keys(PART_SPECS)) {
      const rotated = rotateExtents(partLocalSize(category), PART_SPECS[category].rotation)
      rotated.forEach((v, i) => expect(v).toBeCloseTo(partSize(category)[i], 9))
    }
  })

  it('differs from partSize wherever the model is rotated a quarter turn', () => {
    // If these ever matched, the two conventions would have collapsed and the
    // double-rotation bug could return unnoticed.
    expect(partLocalSize('gpu')).not.toEqual(partSize('gpu'))
  })

  it('is null for categories with no measured model, so no box is drawn', () => {
    expect(partLocalSize('case')).toBeNull()
    expect(partLocalSize('paste')).toBeNull()
  })
})

// unrotateExtents is what lets a spec name its size in world axes; if it were
// not a true inverse the PSU would be stretched along the wrong axes, which is
// exactly the class of convention bug this file keeps producing.
describe('unrotateExtents', () => {
  it('inverts rotateExtents for every rotation in use', () => {
    const dims = [3, 5, 7]
    for (const [cat, spec] of Object.entries(PART_SPECS)) {
      expect(unrotateExtents(rotateExtents(dims, spec.rotation), spec.rotation), cat).toEqual(dims)
    }
  })

  it('inverts a compound rotation, where a naive re-apply would not', () => {
    const r = [Math.PI / 2, Math.PI / 2, 0]
    const dims = [3, 5, 7]
    expect(unrotateExtents(rotateExtents(dims, r), r)).toEqual(dims)
    // The 3-cycle is the case that catches a "just call rotateExtents again" fix.
    expect(rotateExtents(rotateExtents(dims, r), r)).not.toEqual(dims)
  })
})

describe('partSize', () => {
  it('sizes the motherboard as a 305mm ATX board standing vertical', () => {
    near(partSize('motherboard')[1], 305)
  })

  it('gives the PSU a real ATX unit\'s three dimensions, not a cube', () => {
    const [depth, height, width] = partSize('psu')
    near(depth, 160)
    near(height, 86)
    near(width, 150)
  })

  it('stands the PSU on the basement floor against the rear wall', () => {
    const psu = partBox('psu')
    const interior = caseInterior()
    // Clearances stay small on the three faces it is pushed against, and it now
    // fills most of the basement instead of sitting in a corner of it.
    expect(psu.min[0] - interior.min[0]).toBeLessThan(mm(12))
    expect(psu.min[1] - interior.min[1]).toBeLessThan(mm(12))
    expect(psu.max[2] - psu.min[2]).toBeGreaterThan(mm(140))
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
  // Z is built up from the PCB surface rather than the board's bounding box:
  // boardFaceZ() is -17.1 mm (the PCB's component face, 41.6 mm behind the top
  // of the I/O shroud), plus the CPU's own 2.9 mm because the pump block clamps
  // onto the heat spreader, plus the block's half depth and anchor offset.
  it('places the cooler so its pump block meets the socket, on top of the CPU', () => {
    const centreMm = partCentre('cooler').map((v) => +(v / WU_PER_MM).toFixed(1))
    expect(centreMm).toEqual([28.8, 129.4, 54.3])
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

  // Case height, the PSU's seat and its rotation were all changed at once
  // without a single test failing, because "everything is inside the box" is
  // the only thing that was pinned. These pin the intent instead.

  it('brings the roof down to meet the AIO radiator', () => {
    // The mesh locks pump-to-radiator, and we mount by the pump, so the roof
    // has to come to the radiator rather than the other way round. Touching,
    // but never intersecting.
    const gap = caseInterior().max[1] - partBox('cooler').max[1]
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThanOrEqual(mm(2))
  })

  it('stands the PSU on the basement floor, against the rear wall', () => {
    const inner = caseInterior()
    const psu = partBox('psu')
    expect(psu.min[0] - inner.min[0]).toBeCloseTo(mm(8), 6)
    expect(psu.min[1] - inner.min[1]).toBeCloseTo(mm(8), 6)
  })

  it('aims the PSU socket at the back of the case', () => {
    // The mesh's I/O face is -Z (see partSpecs). After the spec rotation it has
    // to point at world -X, the case rear, or the mains cable has nowhere to go.
    // Rounded, and -0 folded to 0, so signed-zero noise from the rotation
    // doesn't fail a direction that is otherwise exactly right.
    const facing = rotateVector([0, 0, -1], PART_SPECS.psu.rotation)
      .map((v) => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(6)))
    expect(facing).toEqual([-1, 0, 0])
  })
})

describe('case fans', () => {
  it('uses a real 120mm fan', () => {
    expect(FAN_MM).toBe(120)
    expect(mm(FAN_MM)).toBeCloseTo(0.98, 2)
  })
})
