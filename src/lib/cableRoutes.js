// Where the PSU loom runs, in the assembly's world frame.
//
// Pure geometry, like every other module the scene is built from. The harness
// used to be hand-typed world coordinates living in the JSX — the only part of
// the 3D with no geometry behind it and no test — and it had drifted a whole
// rework out of date: the 24-pin ran straight THROUGH the graphics card and the
// PCIe lead stopped 34 mm short of it, plugged into nothing. Deriving the
// endpoints from partBox() means a longer card or a re-seated board takes its
// cables with it.
import { mm, FAN_MM } from './pcScale'
import { partBox, partCentre, boardFaceZ, caseInterior, modelScaleAxes, rotateVector } from './assemblyGeometry'
import { FAN_MOUNTS, FAN_HALF_DEPTH } from './fanMounts'
import { PART_SPECS } from './partSpecs'
import { sizeOverrides } from './partOverrides'

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

// How far a CatmullRom bows forward of its control points on these routes,
// measured off the sampled curve rather than assumed. Already the reason the
// front lane hugs the parts at a third of the channel instead of running down
// its centre; named here because the clamp below needs the same figure.
const BOW_MM = 16

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
//
// Scaled PER AXIS, not by the uniform fit. While every part was sized uniformly
// the two were the same number and this was right by coincidence; once a card's
// length can be stretched on its own axis they diverge, and using the uniform
// scale would leave the socket at the 300 mm card's position while the card it is
// drawn on had moved. The inlet is a measured node, so it travels with the mesh.
export function pcieConnector(overrides) {
  const spec = PART_SPECS.gpu
  const axes = modelScaleAxes('gpu', overrides)
  const offset = rotateVector(spec.powerInlet.map((v, i) => v * axes[i]), spec.rotation)
  return partCentre('gpu', overrides).map((c, i) => c + offset[i])
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
function frontLaneX(overrides) {
  // Only the card constrains it. The AIO radiator reaches further forward, but
  // it lives above Y=25 and the loom never climbs past the 24-pin at Y=20 —
  // including it squeezed the lane to within a millimetre of the fan blades,
  // because a CatmullRom bows well past its control points.
  const furthest = partBox('gpu', overrides).max[0]
  const front = FAN_MOUNTS.filter((m) => m.wall === 'front')
  const fanFace = front.length
    ? Math.min(...front.map((m) => m.position[0])) - FAN_HALF_DEPTH
    : caseInterior().max[0]
  // A third of the way across, not half: the tube bows forward of its control
  // points, so a lane on the centreline puts the cable itself into the blades.
  // Hug the parts and let the bow take up the rest of the channel.
  const lane = furthest + (fanFace - furthest) / 3
  // Never past the last position whose TUBE clears the blades. A 336 mm card
  // leaves a 29 mm channel, and a third of it is still inside an 18 mm bundle's
  // own bow — so the lane has to be capped, not scaled.
  return Math.min(lane, fanFace - mm(CABLE.atxRadiusMm) - mm(BOW_MM))
}

// Whether the channel ahead of the card can actually take the 24-pin bundle.
//
// It cannot for the longest cards in the catalogue: a 357 mm card stops 27 mm
// short of the front wall, the intake fans take 18 mm of that, and what is left
// is thinner than the cable. Capping the lane then puts it INSIDE the card,
// which is worse than the problem — a loom lying on a card is realistic, a loom
// running through one is the exact defect cableRoutes was written to end.
function frontChannelFits(overrides) {
  return frontLaneX(overrides) > partBox('gpu', overrides).max[0] + mm(CABLE.atxRadiusMm)
}

// The Z the loom climbs at. Normally just off the board, where it is tucked
// behind the card and away from the side window.
//
// When a very long card shuts the front channel it climbs OUTBOARD instead,
// past the card's outer edge and past the intake fans' span, then crosses back
// over the card's top edge to reach the socket. That is further toward the glass
// than this scene likes — the front lane was chosen precisely so the loom never
// hangs between the camera and the build — but it is the only way round a card
// that fills the case, and it is what the cable does in a real cramped build.
function climbZ(overrides) {
  const near = boardFaceZ() + mm(35)
  if (frontChannelFits(overrides)) return near
  const fanSpan = Math.max(...FAN_MOUNTS.filter((m) => m.wall === 'front').map((m) => m.position[2])) + mm(FAN_MM) / 2
  const outboard = Math.max(
    partBox('gpu', overrides).max[2] + mm(CABLE.atxRadiusMm) + mm(BOW_MM),
    fanSpan + mm(CABLE.atxRadiusMm) + mm(BOW_MM),
  )
  // Never through the side panel, whatever the card does.
  return Math.min(outboard, caseInterior().max[2] - mm(CABLE.atxRadiusMm) - mm(BOW_MM))
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

  // The selected card's real length, so the loom is drawn against the card that
  // is actually in the machine rather than against the spec's representative one.
  const overrides = sizeOverrides(selectedParts)

  const board = partBox('motherboard')
  const gpu = partBox('gpu', overrides)
  const psu = partBox('psu')
  const lane = frontLaneX(overrides)
  const climb = climbZ(overrides)
  const exitY = basementExitY()
  const routes = []

  const atx = atxConnector()
  routes.push({
    id: 'atx',
    radiusMm: CABLE.atxRadiusMm,
    points: [
      psuOutlet(60),
      [psu.max[0] + mm(40), exitY, psuOutlet(60)[2]],
      [lane, gpu.min[1] - mm(30), climb],
      [lane + mm(5), atx[1], climb],
      [board.max[0] + mm(25), atx[1], boardFaceZ() + mm(20)],
      atx,
    ],
    plug: { position: atx, size: ATX.plugMm.map(mm) },
    socket: psuSocket(psuOutlet(60)),
  })

  if (selectedParts.gpu) {
    const pcie = pcieConnector(overrides)
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
