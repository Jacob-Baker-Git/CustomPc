// Where the PSU loom runs, in the assembly's world frame.
//
// Pure geometry, like every other module the scene is built from. The harness
// used to be hand-typed world coordinates living in the JSX — the only part of
// the 3D with no geometry behind it and no test — and it had drifted a whole
// rework out of date: the 24-pin ran straight THROUGH the graphics card and the
// PCIe lead stopped 34 mm short of it, plugged into nothing. Deriving the
// endpoints from partBox() means a longer card or a re-seated board takes its
// cables with it.
//
// 2026-10-17: each cable is a flat ribbon of individual wires ending in a real
// connector body (`loom`), not one thick tube between two black boxes — the
// user's "just black blocks, not actually connecting". The 24-pin and the CPU
// 8-pin now run BEHIND the board, in the standoff gap, and come round its edge
// into their sockets, which is how a real build reads through the glass. The
// old front-lane 24-pin looped across the open case like a hose.
import { mm } from './pcScale'
import { partBox, partCentre, boardFaceZ, caseInterior, modelScaleAxes, rotateVector } from './assemblyGeometry'
import { PART_SPECS } from './partSpecs'
import { sizeOverrides } from './partOverrides'

// A connector's real shape. `cols` x `rows` wires on `pitchMm`; `plug` is the
// connector body in its own frame: `len` along the cable where it enters,
// `wid` across the wire columns, `hei` across the rows. Mini-Fit Jr (ATX, EPS)
// is a 4.2 mm pitch; 12V-2x6 is 3.0 mm. Wires are drawn on ~3 mm centres — a
// sleeved 18 AWG lead — so the run reads as separate wires, not a slab.
const LOOMS = {
  atx:  { cols: 12, rows: 2, pitchMm: 2.7, wireMm: 2.5, plug: { len: 16, wid: 52, hei: 11 } },
  eps:  { cols: 4,  rows: 2, pitchMm: 2.7, wireMm: 2.5, plug: { len: 16, wid: 19, hei: 10 } },
  pcie: { cols: 6,  rows: 2, pitchMm: 3, wireMm: 2.4, plug: { len: 14, wid: 20, hei: 8 } },
}

// Half the ribbon's widest extent: the radius the clearance tests treat the
// cable as. A flat 12-wide ribbon is 36 mm across, not the old 18 mm tube.
const halfWidthMm = (loom) => (loom.cols * loom.pitchMm) / 2

// 24-pin: on the front edge. Read off a face-on render of the board mesh with a
// 10 mm ladder beside it (2026-10-17): the drawn socket spans +24..+76 mm, 9 mm
// wide against the edge. The old guess (20 mm up, 7 in) plugged the cable in
// 30 mm below the socket the board actually draws.
const ATX = { edgeInsetMm: 5, heightMm: 50 }
// CPU 8-pin (EPS): on the top edge. This mesh draws no EPS socket, and the
// usual corner is filled by the I/O shroud and the VRM heatsink (both tall
// enough to bury a plug), so it sits on the open strip between the heatsink's
// end (+40 mm) and the RAM (+67 mm), measured off the face-on render.
const EPS = { xFromRearMm: 172, topInsetMm: 8 }

// The PSU's modular sockets are on the face opposite the IEC inlet. The spec
// rotation aims the inlet at world -X (see partSpecs), so the sockets face +X.
//
// MEASURED off an orthographic render of that face at 5 px/mm (2026-10-17) —
// the mesh draws a labelled panel: "18M M/B" and "10P M/B" (the two halves of a
// modular 24-pin), a CPU socket, and a row of PCIe/peripheral sockets. Plugging
// into blank face beside them is what the user saw as "not connecting to the
// PSU". `z` is mm from the unit's tray-side face, `y` mm down from its top;
// `wid` runs along the face (world Z), `hei` up it.
const PSU_SOCKETS = {
  m18:  { z: 124.4, y: 31,   wid: 36, hei: 14 },
  m10:  { z: 128.2, y: 55.2, wid: 30, hei: 10 },
  cpu:  { z: 77.8,  y: 31,   wid: 16, hei: 14 },
  pcie: { z: 40.0,  y: 31,   wid: 17, hei: 14 },
}
// Where the wires leave the unit: just inside the socket, so every wire starts
// in the PSU however the mesh sits in its box.
const INSIDE_MM = 6

// In the gap between the board and the tray (BOARD.standoffMm = 8), where a
// ribbon two wires thick (6 mm) lies flat against the back of the board. 3 mm
// off the board rather than mid-gap: the curve bows toward the tray coming up
// out of the basement, and mid-gap let it poke ~2 mm through the tray.
const behindBoardZ = () => partBox('motherboard').min[2] - mm(3)

// A connector body sits ON the surface it plugs into, so its centre stands half
// its own length proud of that surface.
const proud = (loom) => mm(loom.plug.len) / 2

export function atxConnector() {
  const board = partBox('motherboard')
  return [board.max[0] - mm(ATX.edgeInsetMm), mm(ATX.heightMm), boardFaceZ() + proud(LOOMS.atx)]
}

export function epsConnector() {
  const board = partBox('motherboard')
  return [board.min[0] + mm(EPS.xFromRearMm), board.max[1] - mm(EPS.topInsetMm), boardFaceZ() + proud(LOOMS.eps)]
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

// A PSU-end plug: its socket on the face, and how many of the ribbon's wire
// columns it takes (a 24-pin leaves the unit as an 18-pin plus a 10-pin).
function psuPlug(key, cols) {
  const psu = partBox('psu')
  const sock = PSU_SOCKETS[key]
  return { position: [psu.max[0], psu.max[1] - mm(sock.y), psu.min[2] + mm(sock.z)], cols, wid: sock.wid, hei: sock.hei }
}

// The ribbon's own start: inside the unit, behind the middle of its plugs.
function outletOf(plugs) {
  const avg = (k) => plugs.reduce((a, p) => a + p.position[k], 0) / plugs.length
  return [plugs[0].position[0] - mm(INSIDE_MM), avg(1), avg(2)]
}

// Leaves the PSU face heading forward, then rises in front of the unit and slips
// into the gap behind the board's lower edge. The PSU tops out 2 mm under the
// board, so the only way up is in front of it.
function upBehindBoard(outlet, riseX) {
  const psu = partBox('psu')
  const board = partBox('motherboard')
  const z = behindBoardZ()
  return [
    outlet,
    [psu.max[0] + mm(18), outlet[1], outlet[2]],
    // Across the basement floor toward the tray first, then up: a cable leaving
    // the glass-side 24-pin sockets and rising in one move twists hard enough
    // to put its outer wires through the tray.
    [(psu.max[0] + mm(18) + riseX) / 2, outlet[1] - mm(4), (outlet[2] + z) / 2],
    [riseX, board.min[1] - mm(30), z + mm(8)],
    // Already behind the board BEFORE passing its lower edge, or the spline
    // cuts through the PCB corner on the way in.
    [riseX, board.min[1] - mm(6), z],
    [riseX, board.min[1] + mm(25), z],
  ]
}

// One route per cable. `points` are CatmullRom control points running PSU →
// part; `plug` is where the cable lands, `psuPlugs` the PSU socket(s) it leaves
// from (`socket` is the first of them);
// `loom` is how the renderer draws the wires and both connector bodies, and
// `widthAxis` the world direction the plug's long side lies along.
export function cableRoutes(selectedParts = {}) {
  if (!selectedParts.motherboard || !selectedParts.psu) return []

  // The selected card's real length, so the loom is drawn against the card that
  // is actually in the machine rather than against the spec's representative one.
  const overrides = sizeOverrides(selectedParts)

  const board = partBox('motherboard')
  const psu = partBox('psu')
  const z = behindBoardZ()
  const face = boardFaceZ()
  const routes = []

  // 24-pin: up behind the board, out round its front edge, down into the socket.
  const atx = atxConnector()
  const atxPlugs = [psuPlug('m18', 7), psuPlug('m10', 5)]
  const atxOut = outletOf(atxPlugs)
  routes.push({
    id: 'atx',
    radiusMm: halfWidthMm(LOOMS.atx),
    loom: LOOMS.atx,
    widthAxis: [0, 1, 0], // the socket's long side runs up the board edge
    points: [
      ...upBehindBoard(atxOut, psu.max[0] + mm(42)),
      [board.max[0] - mm(30), atx[1] - mm(25), z],
      // Clear of the board's edge while still behind it, THEN forward — a
      // spline straight from behind to in front cuts through the PCB corner.
      [board.max[0] + mm(10), atx[1] - mm(8), z],
      [board.max[0] + mm(14), atx[1], face + mm(6)],
      [atx[0] + mm(4), atx[1], atx[2] + mm(26)],
      atx,
    ],
    plug: { position: atx },
    socket: atxPlugs[0],
    psuPlugs: atxPlugs,
  })

  // CPU 8-pin: up behind the board to its top edge, over it, down into the socket.
  const eps = epsConnector()
  const epsPlugs = [psuPlug('cpu', 4)]
  const epsOut = outletOf(epsPlugs)
  routes.push({
    id: 'eps',
    radiusMm: halfWidthMm(LOOMS.eps),
    loom: LOOMS.eps,
    widthAxis: [1, 0, 0], // along the top edge
    points: [
      ...upBehindBoard(epsOut, psu.max[0] + mm(12)),
      [eps[0] + mm(12), board.max[1] - mm(40), z],
      [eps[0] + mm(4), board.max[1] + mm(8), z + mm(2)],
      [eps[0], board.max[1] + mm(12), face + mm(6)],
      [eps[0], eps[1] + mm(2), eps[2] + mm(24)],
      eps,
    ],
    plug: { position: eps },
    socket: epsPlugs[0],
    psuPlugs: epsPlugs,
  })

  if (selectedParts.gpu) {
    const gpu = partBox('gpu', overrides)
    const pcie = pcieConnector(overrides)
    // The inlet is on the card's OUTER edge, so the lead comes up the gap
    // between that edge and the side window and drops straight onto it — which
    // is how a 12-pin actually plugs into this card. Approaching from anywhere
    // else means crossing the card.
    const outside = Math.min(gpu.max[2] + mm(28), caseInterior().max[2] - mm(halfWidthMm(LOOMS.pcie)))
    const exitY = (psu.max[1] + board.min[1]) / 2
    const pciePlugs = [psuPlug('pcie', 6)]
    const pcieOut = outletOf(pciePlugs)
    routes.push({
      id: 'pcie',
      radiusMm: halfWidthMm(LOOMS.pcie),
      loom: LOOMS.pcie,
      widthAxis: [1, 0, 0], // along the card's length
      points: [
        pcieOut,
        [psu.max[0] + mm(40), exitY, pcieOut[2]],
        [pcie[0] - mm(55), gpu.min[1] - mm(15), outside],
        [pcie[0] - mm(15), pcie[1], outside],
        pcie,
      ],
      plug: { position: pcie },
      socket: pciePlugs[0],
      psuPlugs: pciePlugs,
    })
  }

  return routes
}
