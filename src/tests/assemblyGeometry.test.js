import { partSize, partLocalSize, rotateExtents, unrotateExtents, rotateVector, partCentre, partBox, pcbBox, boardFaceZ, caseInterior, CASE } from '../lib/assemblyGeometry'
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

  it('stands the PSU in the basement against the rear wall', () => {
    const psu = partBox('psu')
    const interior = caseInterior()
    // Clearance stays small on the rear face it is pushed against, it sits on
    // its rails rather than flat on the floor, and it fills most of the
    // basement instead of sitting in a corner of it.
    expect(psu.min[0] - interior.min[0]).toBeLessThan(mm(12))
    expect(psu.min[1] - interior.min[1]).toBeLessThan(mm(24))
    expect(psu.max[2] - psu.min[2]).toBeGreaterThan(mm(140))
  })

  it('lays the GPU horizontal, full-length front-to-back', () => {
    near(partSize('gpu')[0], 300)
  })

  it('stands a DIMM edge-on, tall and thin across the board', () => {
    const [x, y, z] = partSize('ram')
    near(y, 142)
    expect(x).toBeLessThan(z)
    expect(x).toBeLessThan(mm(15))
  })

  it('lays the M.2 flat against the board', () => {
    const [x, , z] = partSize('storage')
    near(x, 100)
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

  // The GPU is excluded: its bracket reaches back PAST the board plane to bolt
  // to the case, which is what a bracket does. Its seating is judged on the PCB
  // instead — see 'seats the GPU's PCB in the slot' below.
  it('mounts RAM and M.2 in front of the board face, never inside it', () => {
    for (const cat of ['ram', 'storage']) {
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
  // assembly's bbox centre, so mounting the block on a socket at (14, 60) puts
  // the bbox centre up at (62.8, 114.4).
  //
  // Z is built up from the PCB surface: boardFaceZ() is +4.2 mm, half the
  // rendered PCB's thickness out from its centre, plus the CPU's own 2.9 mm
  // because the pump block clamps onto the heat spreader, plus the block's half
  // depth and anchor offset.
  //
  // X and Y moved with the socket when it was finally measured off the board
  // mesh rather than guessed — it was (-20, 75), which put the pump block beside
  // the CPU instead of on it. See mountPoints.js.
  it('places the cooler so its pump block meets the socket, on top of the CPU', () => {
    const centreMm = partCentre('cooler').map((v) => +(v / WU_PER_MM).toFixed(1))
    expect(centreMm).toEqual([62.8, 114.4, 75.6])
  })

  // The defect the user could see: the pump block sat up and to the left of the
  // socket, so the AIO covered the VRM heatsink and left the CPU in the open.
  it('covers the CPU with the cooler\'s pump block', () => {
    const cpu = partBox('cpu')
    const cooler = partBox('cooler')
    for (const axis of [0, 1]) {
      expect(cooler.min[axis], `axis ${axis}`).toBeLessThanOrEqual(cpu.min[axis] + 1e-9)
      expect(cooler.max[axis], `axis ${axis}`).toBeGreaterThanOrEqual(cpu.max[axis] - 1e-9)
    }
  })
})

// The assertion that was missing while BOTH of this scene's seating bugs were
// live: the board rendered 13% undersized because it was scaled by its mesh
// bounding box rather than its PCB, and the GPU straddled its mount point so
// 90 mm of card hung off the back of the board. Every number involved was
// self-consistent; nothing compared a part's position to the board it sits on.
describe('board-mounted parts actually sit on the board', () => {
  const board = () => partBox('motherboard')
  const EPS = 1e-9

  // The GPU is excluded from the rear-edge rule only: its bracket bolts to the
  // CASE's rear panel, which sits behind the board's rear edge, so a correctly
  // placed card legitimately starts behind the board. Pinned against the panel
  // instead, below.
  for (const category of ['cpu', 'ram', 'storage']) {
    it(`${category} starts on the board rather than behind its rear edge`, () => {
      expect(partBox(category).min[0]).toBeGreaterThanOrEqual(board().min[0] - EPS)
    })
  }

  for (const category of ['cpu', 'ram', 'gpu', 'storage']) {
    it(`${category} stays within the board's height`, () => {
      expect(partBox(category).min[1]).toBeGreaterThanOrEqual(board().min[1] - EPS)
      expect(partBox(category).max[1]).toBeLessThanOrEqual(board().max[1] + EPS)
    })
  }

  for (const category of ['cpu', 'ram', 'storage']) {
    it(`${category} sits on the PCB face, not inside the board`, () => {
      expect(partBox(category).min[2]).toBeGreaterThanOrEqual(boardFaceZ() - EPS)
    })
  }

  // The defect the user drew arrows on: the card's edge connector stopped ~10 mm
  // short of the slot, because the card was seated by its bounding box and the
  // box's lower face is the BRACKET, not the PCB.
  it('seats the GPU\'s PCB in the slot rather than hovering above it', () => {
    const pcb = pcbBox('gpu')
    expect(pcb.min[2]).toBeGreaterThan(boardFaceZ() - EPS)
    expect(pcb.min[2] - boardFaceZ()).toBeLessThan(mm(4))
  })

  it('puts the GPU\'s PCB on the slot\'s centreline', () => {
    const pcb = pcbBox('gpu')
    const plane = (pcb.min[1] + pcb.max[1]) / 2
    expect(plane).toBeCloseTo(mm(MOUNTS.gpu.slotYMm), 6)
  })

  it('lets the GPU bracket reach back past the board plane, as a bracket does', () => {
    expect(partBox('gpu').min[2]).toBeLessThan(boardFaceZ())
  })

  // What the user could see: the card's end stopped short of the back of the
  // case rather than bolting to it. It now reaches the rear panel and sits in
  // it — a real bracket passes through, so a millimetre or two proud of the
  // outside is right, but it must never float in the case's interior.
  it('lands the GPU bracket in the case\'s rear panel', () => {
    const inner = caseInterior()
    const bracket = partBox('gpu').min[0]
    expect(bracket).toBeLessThanOrEqual(inner.min[0])
    expect(bracket).toBeGreaterThanOrEqual(inner.min[0] - mm(CASE.panelMm) - mm(4))
  })

  // A long card legitimately runs past the board's FRONT edge into the case —
  // that is what makes the rear edge the one that has to be pinned.
  it('lets a long GPU overhang the front edge, which is real', () => {
    expect(partBox('gpu').max[0]).toBeGreaterThan(board().max[0])
  })
})

describe('board mesh versus the mount frame', () => {
  // BOARD.widthMm (244) is the ATX reference frame the mount points are measured
  // in. Now that the board is sized on its PCB rather than the mesh bounding box,
  // the rendered board is 244.5 x 305 mm — the PCB's own aspect happens to be
  // ATX's to within half a millimetre. It used to render 302 mm front-to-back,
  // which is why this only ever asserted "not narrower than the frame".
  // What must hold is that the board is never NARROWER than the frame, or a
  // mount point would hang off its edge.
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

// The board's rear edge is a mounting plane, not just an edge: the I/O shield
// sits in the rear panel and the GPU's bracket bolts to it (which is the whole
// reason MOUNTS.gpu places the card by `rearInsetMm`). caseInterior() anchored
// Y off the board's bottom edge and Z off its back face, but left X centred on
// the origin — so the board floated 102.7 mm inside a rear panel the PSU was
// already pushed up against. Two parts that share one plane in reality sat
// 94.7 mm apart, and nothing compared them because nothing tested the X axis.
describe('the case is built around the board, not centred on it', () => {
  // Was 102.7 mm. Now the depth of an I/O shield frame — enough for the GPU's
  // bracket to reach the panel, nowhere near the void it used to be.
  it('brings the rear panel up to the board\'s rear edge', () => {
    const gap = partBox('motherboard').min[0] - caseInterior().min[0]
    expect(gap).toBeGreaterThan(0)
    expect(gap).toBeLessThanOrEqual(mm(20))
  })

  // Both are up against it — the board one I/O-shield depth back, the PSU almost
  // touching. What matters is that neither is adrift: this was 94.7 mm apart.
  it('seats the board and the PSU against the same rear panel', () => {
    const inner = caseInterior()
    const boardGap = partBox('motherboard').min[0] - inner.min[0]
    const psuGap = partBox('psu').min[0] - inner.min[0]
    expect(Math.abs(boardGap - psuGap)).toBeLessThanOrEqual(mm(16))
  })

  it('puts the GPU bracket within bolting distance of the rear panel', () => {
    expect(partBox('gpu').min[0] - caseInterior().min[0]).toBeLessThanOrEqual(mm(10))
  })

  // The front wall has to clear whatever reaches furthest forward — today the
  // AIO radiator, tomorrow a longer card — with room for the intake fans.
  it('leaves room for the intake fans ahead of the longest part', () => {
    const furthest = Math.max(...['gpu', 'cooler', 'motherboard'].map((c) => partBox(c).max[0]))
    const clearance = caseInterior().max[0] - furthest
    expect(clearance).toBeGreaterThan(mm(25))
    // Snug on purpose: a wide gap here is what read as "the case is too big".
    expect(clearance).toBeLessThan(mm(120))
  })
})

describe('caseInterior', () => {
  it('is a real tower, deep enough for a board plus cooler clearance', () => {
    expect(CASE.depthMm).toBe(380)
    expect(CASE.widthMm).toBe(210)
    expect(CASE.heightMm).toBeGreaterThanOrEqual(430)
  })

  // The GPU is measured against the SHELL, not the interior: its bracket passes
  // through the rear panel, which is the one part of a build that is meant to.
  it('contains every part', () => {
    const inner = caseInterior()
    const panel = mm(CASE.panelMm)
    for (const cat of ['motherboard', 'gpu', 'ram', 'storage', 'psu', 'cooler']) {
      const slack = cat === 'gpu' ? panel + mm(4) : 0
      const box = partBox(cat)
      for (let i = 0; i < 3; i++) {
        expect(box.min[i], `${cat} axis ${i} min`).toBeGreaterThanOrEqual(inner.min[i] - slack - 1e-6)
        expect(box.max[i], `${cat} axis ${i} max`).toBeLessThanOrEqual(inner.max[i] + slack + 1e-6)
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

  it('seats the PSU against the rear wall, the tray and the basement floor', () => {
    const inner = caseInterior()
    const psu = partBox('psu')
    expect(psu.min[0] - inner.min[0]).toBeCloseTo(mm(2), 6)
    expect(psu.min[1] - inner.min[1]).toBeCloseTo(mm(2), 6)
    expect(psu.min[2] - inner.min[2]).toBeCloseTo(mm(2), 6)
  })

  // It cannot go higher than this: the board's lower edge is directly above.
  it('raises the PSU as far as the board above it allows', () => {
    const gap = partBox('motherboard').min[1] - partBox('psu').max[1]
    expect(gap).toBeGreaterThan(0)
    expect(gap).toBeLessThanOrEqual(mm(4))
  })

  // The basement exists to hold the PSU and nothing else. Dead air under it is
  // what left the unit looking low in the case.
  it('gives the basement no more room than the PSU needs', () => {
    const [, psuHeight] = partSize('psu')
    expect(mm(CASE.basementMm) - psuHeight).toBeLessThan(mm(12))
  })

  // The lift is bounded by the gap to the board: raising it far enough to meet
  // its own loom would otherwise drive it straight through the board's lower
  // edge, which is what a first attempt at 26 mm did.
  it('keeps a gap between the PSU and the board above it', () => {
    const gap = partBox('motherboard').min[1] - partBox('psu').max[1]
    expect(gap).toBeGreaterThan(0)
    expect(gap).toBeLessThan(mm(20))
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
