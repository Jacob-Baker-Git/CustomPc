// Where the PSU loom runs, in the assembly's world frame.
//
// Pure geometry, like every other module the scene is built from. The harness
// used to be hand-typed world coordinates living in the JSX — the only part of
// the 3D with no geometry behind it and no test — and it had drifted a whole
// rework out of date: the 24-pin ran straight THROUGH the graphics card and the
// PCIe lead stopped 34 mm short of it, plugged into nothing. Deriving the
// endpoints from partBox() means a longer card or a re-seated board takes its
// cables with it.
import { mm } from './pcScale'
import { partBox, partCentre, boardFaceZ, caseInterior, modelScale, rotateVector } from './assemblyGeometry'
import { FAN_MOUNTS, FAN_HALF_DEPTH } from './fanMounts'
import { PART_SPECS } from './partSpecs'

// Offsets are millimetres from the part's own box, measured off a real ATX
// board and a real dual-8-pin card.
const ATX = {
  edgeInsetMm: 7,       // socket body sits this far in from the board's front edge
  heightMm: 20,         // up from board centre — mid-right, clear of the cooler
  plugMm: [13, 58, 16], // 24-pin socket: long axis runs up the board's edge
}

// The card's own power socket, measured from the mesh (PART_SPECS.gpu.powerInlet).
// Its plug body matches the node's size: 10 x 19 x 10 mm in world axes.
const PCIE = { plugMm: [12, 21, 12] }

// The PSU's modular sockets are on the face opposite the IEC inlet. The spec
// rotation aims the inlet at world -X (see partSpecs), so the sockets face +X.
//
// The cable begins INSIDE the unit and a socket body straddles the face it
// comes out of, so the loom is unambiguously attached however the mesh sits in
// its box. Starting it exactly on the face left a hairline between tube and
// PSU; starting it inside with no socket read as a cable merely passing by.
const PSU_OUTLET = { insetMm: 26, dropMm: 22, plugMm: [26, 30, 34] }

const CABLE = {
  atxRadiusMm: 9,       // a 24-pin loom is a thick flat bundle, not a wire
  pcieRadiusMm: 6,
}

// (the front cable lane is derived from the parts and the fan wall — see below)

// A connector body sits ON the surface it plugs into, so its centre stands half
// its own depth proud of that surface.
const atxProud = () => mm(ATX.plugMm[2]) / 2

export function atxConnector() {
  const board = partBox('motherboard')
  return [board.max[0] - mm(ATX.edgeInsetMm), mm(ATX.heightMm), boardFaceZ() + atxProud()]
}

// The card's power socket, derived from the measured mesh node rather than
// guessed at from the bounding box.
export function pcieConnector() {
  const spec = PART_SPECS.gpu
  const s = modelScale('gpu')
  const offset = rotateVector(spec.powerInlet.map((v) => v * s), spec.rotation)
  return partCentre('gpu').map((c, i) => c + offset[i])
}

function psuOutlet(zFromTrayMm) {
  const psu = partBox('psu')
  return [
    psu.max[0] - mm(PSU_OUTLET.insetMm),
    psu.max[1] - mm(PSU_OUTLET.dropMm),
    psu.min[2] + mm(zFromTrayMm),
  ]
}

// The lane cables climb, in the channel between whatever reaches furthest
// forward and the intake fans.
//
// A connector on top of the graphics card cannot be reached by climbing beside
// the board: the card spans the whole width from the PCB face to well past
// halfway across the case, so anything rising there passes through it — which
// is exactly what the old harness did. Real builds either go behind the tray
// (invisible here, and the standoff gap is 8 mm) or up the front of the case.
// This takes the front, which stays clear of the side window so the loom never
// hangs between the camera and the build.
// Sits midway between whatever reaches furthest forward and the intake fans'
// inner face, so the channel stays centred however either end moves. A fixed
// gap ahead of the parts did not: re-measuring the CPU socket pushed the AIO
// radiator 34 mm forward and squeezed the lane to within a millimetre of the
// fan blades.
function frontLaneX() {
  // Only the card constrains it. The AIO radiator reaches further forward, but
  // it lives above Y=25 and the loom never climbs past the 24-pin at Y=20 —
  // including it squeezed the lane to within a millimetre of the fan blades,
  // because a CatmullRom bows well past its control points.
  const furthest = partBox('gpu').max[0]
  const front = FAN_MOUNTS.filter((m) => m.wall === 'front')
  const fanFace = front.length
    ? Math.min(...front.map((m) => m.position[0])) - FAN_HALF_DEPTH
    : caseInterior().max[0]
  // A third of the way across, not half: the tube bows ~16 mm forward of its
  // control points, so a lane on the centreline puts the cable itself into the
  // blades. Hug the parts and let the bow take up the rest of the channel.
  return furthest + (fanFace - furthest) / 3
}

// Threads the gap between the top of the PSU and the bottom edge of the board,
// which is where a basement loom actually emerges.
function basementExitY() {
  const psu = partBox('psu')
  const board = partBox('motherboard')
  return (psu.max[1] + board.min[1]) / 2
}

// A socket body straddling the PSU's own face, so the loom visibly comes OUT of
// the unit rather than appearing beside it.
const psuSocket = (outlet) => ({
  position: [partBox('psu').max[0], outlet[1], outlet[2]],
  size: PSU_OUTLET.plugMm.map(mm),
})

// One route per cable. `points` are CatmullRom control points; `plug` is the
// connector body drawn where the cable lands and `socket` the one it leaves
// from — a bare tube ending near a part reads as passing it, not plugged in.
export function cableRoutes(selectedParts = {}) {
  if (!selectedParts.motherboard || !selectedParts.psu) return []

  const board = partBox('motherboard')
  const gpu = partBox('gpu')
  const psu = partBox('psu')
  const lane = frontLaneX()
  const exitY = basementExitY()
  const routes = []

  const atx = atxConnector()
  routes.push({
    id: 'atx',
    radiusMm: CABLE.atxRadiusMm,
    points: [
      psuOutlet(60),
      [psu.max[0] + mm(40), exitY, psuOutlet(60)[2]],
      [lane, gpu.min[1] - mm(30), boardFaceZ() + mm(35)],
      [lane + mm(5), atx[1], boardFaceZ() + mm(30)],
      [board.max[0] + mm(25), atx[1], boardFaceZ() + mm(20)],
      atx,
    ],
    plug: { position: atx, size: ATX.plugMm.map(mm) },
    socket: psuSocket(psuOutlet(60)),
  })

  if (selectedParts.gpu) {
    const pcie = pcieConnector()
    // The inlet is on the card's OUTER edge, so the lead comes up the gap
    // between that edge and the side window and drops straight onto it — which
    // is how a 12-pin actually plugs into this card. Approaching from anywhere
    // else means crossing the card.
    const outside = gpu.max[2] + mm(28)
    routes.push({
      id: 'pcie',
      radiusMm: CABLE.pcieRadiusMm,
      points: [
        psuOutlet(105),
        [psu.max[0] + mm(40), exitY, psuOutlet(105)[2]],
        [pcie[0] - mm(55), gpu.min[1] - mm(15), outside],
        [pcie[0] - mm(15), pcie[1], outside],
        pcie,
      ],
      plug: { position: pcie, size: PCIE.plugMm.map(mm) },
      socket: psuSocket(psuOutlet(105)),
    })
  }

  return routes
}
