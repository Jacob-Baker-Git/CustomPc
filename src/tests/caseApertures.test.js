import { caseApertures, panelApertures, panelStrips } from '../lib/caseApertures'
import { caseInterior, ioBlockBox, partBox, radiatorFanBox } from '../lib/assemblyGeometry'
import { FAN_MOUNTS } from '../lib/fanMounts'
import { mm, FAN_MM } from '../lib/pcScale'

const holes = caseApertures()
const inner = caseInterior()
const HALF = mm(FAN_MM) / 2

const covers = (h, a0, a1, b0, b1) =>
  h.a0 <= a0 + 1e-9 && h.a1 >= a1 - 1e-9 && h.b0 <= b0 + 1e-9 && h.b1 >= b1 - 1e-9

describe('caseApertures', () => {
  it('cuts a hole for every fan, on the wall that fan hangs on', () => {
    for (const { wall, position: [, y, z] } of FAN_MOUNTS) {
      const found = holes[wall].some((h) => covers(h, y - HALF, y + HALF, z - HALF, z + HALF))
      expect(found, `${wall} fan at ${y},${z}`).toBe(true)
    }
  })

  // The defect the user could see: the rear panel was solid where the board's
  // USB ports are, so the I/O stack faced sheet steel.
  it('opens the rear panel for the board\'s I/O stack', () => {
    const io = ioBlockBox()
    const hole = holes.rear.find((h) => h.kind === 'io')
    expect(hole).toBeDefined()
    expect(covers(hole, io.min[1], io.max[1], io.min[2], io.max[2])).toBe(true)
  })

  // Likewise the PSU: its socket faces this wall, and the mains lead has to get
  // out of the case.
  it('opens the rear panel for the PSU\'s socket', () => {
    const psu = partBox('psu')
    const hole = holes.rear.find((h) => h.kind === 'psu')
    expect(hole).toBeDefined()
    expect(hole.a0).toBeGreaterThan(psu.min[1])
    expect(hole.a1).toBeLessThan(psu.max[1])
    expect(hole.b0).toBeGreaterThan(psu.min[2])
    expect(hole.b1).toBeLessThan(psu.max[2])
  })

  // Cut over the radiator's FANS, not the whole AIO's bounding box — the box
  // also spans the pump and tubes, so its centre is 13 mm forward of the blades
  // and the vent visibly sat off them.
  it('vents the roof over the radiator\'s fans', () => {
    const fans = radiatorFanBox()
    const hole = holes.top.find((h) => h.kind === 'radiator')
    expect(hole).toBeDefined()
    expect(hole.a0).toBeLessThanOrEqual(fans.min[0])
    expect(hole.a1).toBeGreaterThanOrEqual(fans.max[0])
    // Snug: a vent much wider than the fans is what "too far along" looked like.
    expect(hole.a0).toBeGreaterThan(fans.min[0] - mm(20))
    expect(hole.a1).toBeLessThan(fans.max[0] + mm(20))
  })

  it('centres the roof vent on the fans, not on the AIO\'s bounding box', () => {
    const fans = radiatorFanBox()
    const hole = holes.top.find((h) => h.kind === 'radiator')
    const fanMid = (fans.min[0] + fans.max[0]) / 2
    expect((hole.a0 + hole.a1) / 2).toBeCloseTo(fanMid, 6)
    // The box's centre is a good 10 mm away from that — the bug this pins.
    const boxMid = (partBox('cooler').min[0] + partBox('cooler').max[0]) / 2
    expect(Math.abs(boxMid - fanMid)).toBeGreaterThan(mm(8))
  })

  it('keeps every hole inside the panel it is cut from', () => {
    const axes = { front: 1, rear: 1, top: 0 }
    for (const [wall, list] of Object.entries(holes)) {
      const ai = axes[wall]
      for (const h of list) {
        expect(h.a0, `${wall} ${h.kind} a0`).toBeGreaterThanOrEqual(inner.min[ai] - 1e-9)
        expect(h.a1, `${wall} ${h.kind} a1`).toBeLessThanOrEqual(inner.max[ai] + 1e-9)
        expect(h.b0, `${wall} ${h.kind} b0`).toBeGreaterThanOrEqual(inner.min[2] - 1e-9)
        expect(h.b1, `${wall} ${h.kind} b1`).toBeLessThanOrEqual(inner.max[2] + 1e-9)
      }
    }
  })

  it('never overlaps two holes on the same wall', () => {
    for (const [wall, list] of Object.entries(holes)) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const A = list[i]
          const B = list[j]
          const a = Math.min(A.a1, B.a1) - Math.max(A.a0, B.a0)
          const b = Math.min(A.b1, B.b1) - Math.max(A.b0, B.b0)
          expect(Math.min(a, b), `${wall}: ${A.kind} vs ${B.kind}`).toBeLessThanOrEqual(1e-9)
        }
      }
    }
  })
})

// The sweep that replaced "four strips around one hole" — the rear wall now
// carries three unrelated cut-outs, which four strips cannot express.
describe('panelStrips', () => {
  const area = (strips) => strips.reduce((sum, s) => sum + (s.a1 - s.a0) * (s.b1 - s.b0), 0)

  it('returns the whole panel when there are no holes', () => {
    const strips = panelStrips([], 10, 6)
    expect(area(strips)).toBeCloseTo(60, 9)
  })

  it('leaves exactly the hole open', () => {
    const strips = panelStrips([{ a0: -1, a1: 1, b0: -2, b1: 2 }], 10, 6)
    expect(area(strips)).toBeCloseTo(60 - 8, 9)
  })

  it('handles several disjoint holes', () => {
    const strips = panelStrips([
      { a0: -4, a1: -2, b0: -2, b1: 0 },
      { a0: 1, a1: 3, b0: 1, b1: 2 },
    ], 10, 6)
    expect(area(strips)).toBeCloseTo(60 - 4 - 2, 9)
  })

  it('emits no zero-width pieces between holes that touch', () => {
    const strips = panelStrips([
      { a0: -2, a1: 0, b0: -1, b1: 1 },
      { a0: 0, a1: 2, b0: -1, b1: 1 },
    ], 10, 6)
    for (const s of strips) {
      expect(s.a1 - s.a0).toBeGreaterThan(1e-9)
      expect(s.b1 - s.b0).toBeGreaterThan(1e-9)
    }
    expect(area(strips)).toBeCloseTo(60 - 8, 9)
  })

  it('never produces overlapping strips', () => {
    const strips = panelStrips([{ a0: -1, a1: 1, b0: -2, b1: 2 }], 10, 6)
    for (let i = 0; i < strips.length; i++) {
      for (let j = i + 1; j < strips.length; j++) {
        const A = strips[i]
        const B = strips[j]
        const a = Math.min(A.a1, B.a1) - Math.max(A.a0, B.a0)
        const b = Math.min(A.b1, B.b1) - Math.max(A.b0, B.b0)
        expect(Math.min(a, b)).toBeLessThanOrEqual(1e-9)
      }
    }
  })

  // Deliberately fed panelApertures(), not caseApertures(): the strips are cut
  // in the panel's own frame, and passing world coordinates silently clips the
  // holes against the panel edge instead of failing. That is exactly the bug
  // this assertion caught the first time it ran.
  it('covers the real case walls without overlap', () => {
    const local = panelApertures()
    const H = inner.max[1] - inner.min[1]
    const D = inner.max[2] - inner.min[2]
    for (const wall of ['front', 'rear']) {
      const strips = panelStrips(local[wall], H, D)
      const holeArea = local[wall].reduce((s, h) => s + (h.a1 - h.a0) * (h.b1 - h.b0), 0)
      expect(area(strips), wall).toBeCloseTo(H * D - holeArea, 6)
    }
  })

  it('cuts the roof without overlap too', () => {
    const local = panelApertures()
    const W = inner.max[0] - inner.min[0]
    const D = inner.max[2] - inner.min[2]
    const strips = panelStrips(local.top, W, D)
    const holeArea = local.top.reduce((s, h) => s + (h.a1 - h.a0) * (h.b1 - h.b0), 0)
    expect(area(strips)).toBeCloseTo(W * D - holeArea, 6)
  })
})
