// Every cut-out in the case's shell, per panel, in world units.
//
// A panel is not a solid slab. The fans blow through holes, the board's I/O
// stack pokes through one so you can reach the USB ports, the PSU's mains
// socket through another, and the AIO exhausts through the roof. Deriving all
// of them from the parts is what stops a hole drifting away from the thing that
// needs it — which is exactly what the old hand-placed vent grilles did.
//
// Each hole is (a0,a1) x (b0,b1) in the panel's own two axes: for the end walls
// that is Y x Z, for the roof X x Z.
import { caseInterior, ioBlockBox, psuSocketBox, radiatorFanBox } from './assemblyGeometry'
import { FAN_MOUNTS } from './fanMounts'
import { mm, FAN_MM } from './pcScale'

const HALF = mm(FAN_MM) / 2

// Clearance cut around a component's own box.
// Room around the port stack so nothing clips its edge. 4 mm cut a visible ring
// of daylight all round the USB block — the stack's outer face also stops 5.4 mm
// short of the panel, so that ring looked into the case. 1.5 mm is enough
// clearance for a measured box and reads as a panel seam instead of a gap.
const IO_MARGIN_MM = 1.5
const RAD_MARGIN_MM = 6  // a little air around the radiator's fans

// The mains inlet only needs a socket-sized hole, not the PSU's whole face — a
// full-face opening read as a hole punched in the back of the case. Cut over
// the mesh's ACTUAL inlet, which sits low and toward the window; centring it on
// the PSU's face put it on the wrong side of the unit.
const PSU_SOCKET_MARGIN_MM = 5

export function caseApertures() {
  const inner = caseInterior()
  const walls = { front: [], rear: [], top: [] }

  for (const { wall, position: [, y, z] } of FAN_MOUNTS) {
    walls[wall].push({ kind: 'fan', a0: y - HALF, a1: y + HALF, b0: z - HALF, b1: z + HALF })
  }

  // The rear I/O stack — without this the USB ports face blank metal.
  const io = ioBlockBox()
  if (io) {
    const m = mm(IO_MARGIN_MM)
    walls.rear.push({ kind: 'io', a0: io.min[1] - m, a1: io.max[1] + m, b0: io.min[2] - m, b1: io.max[2] + m })
  }

  // The PSU's mains inlet, so the power lead has somewhere to go. Its socket
  // faces world -X (see partSpecs.psu), which is this wall.
  const socket = psuSocketBox()
  if (socket) {
    const s = mm(PSU_SOCKET_MARGIN_MM)
    walls.rear.push({
      kind: 'psu',
      a0: socket.min[1] - s, a1: socket.max[1] + s,
      b0: socket.min[2] - s, b1: socket.max[2] + s,
    })
  }

  // The roof, over the radiator's FANS — not over the whole AIO's bounding box,
  // whose centre is 13 mm forward of the blades because it also spans the pump
  // and the tubes. Cutting on the box put the vent noticeably off the fans.
  const rad = radiatorFanBox()
  if (rad) {
    const r = mm(RAD_MARGIN_MM)
    walls.top.push({ kind: 'radiator', a0: rad.min[0] - r, a1: rad.max[0] + r, b0: rad.min[2] - r, b1: rad.max[2] + r })
  }

  // Clamp every hole to its panel so one can never run off the edge.
  const limits = {
    front: [1, 2], rear: [1, 2], top: [0, 2],
  }
  for (const [wall, list] of Object.entries(walls)) {
    const [ai, bi] = limits[wall]
    for (const h of list) {
      h.a0 = Math.max(h.a0, inner.min[ai])
      h.a1 = Math.min(h.a1, inner.max[ai])
      h.b0 = Math.max(h.b0, inner.min[bi])
      h.b1 = Math.min(h.b1, inner.max[bi])
    }
    walls[wall] = list.filter((h) => h.a1 > h.a0 && h.b1 > h.b0)
  }

  return walls
}

// The same holes in each panel's OWN frame.
//
// The case group sits at the interior's centre (see assemblyLayout), so a world
// point becomes panel-local by subtracting that centre. Lives here rather than
// in CaseModel so the renderer and the tests cannot disagree about the frame —
// getting that wrong silently clips holes against the panel's edge instead of
// failing, which is precisely the kind of quiet error this scene specialises in.
export function panelApertures() {
  const inner = caseInterior()
  const centre = inner.min.map((v, i) => (v + inner.max[i]) / 2)
  const axes = { front: 1, rear: 1, top: 0 }
  const walls = caseApertures()
  return Object.fromEntries(
    Object.entries(walls).map(([wall, list]) => [wall, list.map((h) => ({
      ...h,
      a0: h.a0 - centre[axes[wall]],
      a1: h.a1 - centre[axes[wall]],
      b0: h.b0 - centre[2],
      b1: h.b1 - centre[2],
    }))]),
  )
}

// Decompose a panel into solid rectangles around its holes.
//
// A sweep rather than the four-strips-around-one-hole special case it replaces:
// the rear wall now carries a fan, the I/O stack and the PSU face, which four
// strips cannot express. Bands are cut at every hole edge along `a`, then each
// band is filled along `b` between whatever holes cross it. Zero-width pieces
// (two holes that touch, like the stacked intake fans) fall out naturally.
export function panelStrips(holes, aSize, bSize) {
  const EPS = 1e-9
  const edges = [-aSize / 2, aSize / 2]
  for (const h of holes) edges.push(h.a0, h.a1)
  const bounds = [...new Set(edges)].sort((x, y) => x - y)
    .filter((v) => v >= -aSize / 2 - EPS && v <= aSize / 2 + EPS)

  const strips = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const a0 = bounds[i]
    const a1 = bounds[i + 1]
    if (a1 - a0 < EPS) continue
    const mid = (a0 + a1) / 2
    const crossing = holes
      .filter((h) => h.a0 < mid && h.a1 > mid)
      .sort((p, q) => p.b0 - q.b0)

    let b = -bSize / 2
    for (const h of crossing) {
      if (h.b0 - b > EPS) strips.push({ a0, a1, b0: b, b1: h.b0 })
      b = Math.max(b, h.b1)
    }
    if (bSize / 2 - b > EPS) strips.push({ a0, a1, b0: b, b1: bSize / 2 })
  }
  return strips
}
