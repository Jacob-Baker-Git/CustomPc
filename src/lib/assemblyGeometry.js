import { mm } from './pcScale'
import { PART_SPECS } from './partSpecs'
import { MOUNTS, BOARD } from './mountPoints'

const HALF_PI = Math.PI / 2
const isQuarterTurn = (a) => Math.abs(Math.abs(a) - HALF_PI) < 1e-6

// Swap extents for a right-angle rotation. Every rotation in PART_SPECS is a
// multiple of 90 degrees, so a rotated box stays axis-aligned and we only need
// to permute its dimensions — no matrix maths, and the result stays exact.
// A half turn leaves extents unchanged, which is why only quarter turns swap.
export function rotateExtents([x, y, z], [rx, ry, rz]) {
  let out = [x, y, z]
  if (isQuarterTurn(rx)) out = [out[0], out[2], out[1]]
  if (isQuarterTurn(ry)) out = [out[2], out[1], out[0]]
  if (isQuarterTurn(rz)) out = [out[1], out[0], out[2]]
  return out
}

// Rotate a SIGNED vector. Extents only need permuting, but an offset must keep
// its direction — getting this wrong would place an anchored part on the wrong
// side of its mount. Applied X then Y then Z, matching three.js's default order.
export function rotateVector([x, y, z], [rx, ry, rz]) {
  let v = [x, y, z]
  const spin = (a, b, angle) => [a * Math.cos(angle) - b * Math.sin(angle), a * Math.sin(angle) + b * Math.cos(angle)]
  if (rx) { const [ny, nz] = spin(v[1], v[2], rx); v = [v[0], ny, nz] }
  if (ry) { const [nz, nx] = spin(v[2], v[0], ry); v = [nx, v[1], nz] }
  if (rz) { const [nx, ny] = spin(v[0], v[1], rz); v = [nx, ny, v[2]] }
  return v
}

// Undo rotateExtents. Each quarter turn permutes two of the three dimensions,
// and a swap is its own inverse — so replaying the swaps in the opposite order
// inverts the whole composition, for any combination of right angles.
export function unrotateExtents([x, y, z], [rx, ry, rz]) {
  let out = [x, y, z]
  if (isQuarterTurn(rz)) out = [out[1], out[0], out[2]]
  if (isQuarterTurn(ry)) out = [out[2], out[1], out[0]]
  if (isQuarterTurn(rx)) out = [out[0], out[2], out[1]]
  return out
}

// The extents `lengthMm` actually refers to. Normally the whole mesh, but a part
// may declare a `body` — the functional component inside a mesh that also draws
// decoration around it. The motherboard's mesh is 14% larger than its PCB, so
// fitting 305 mm to the mesh rendered a 266 mm board. See PART_SPECS.
function fitExtents(spec) {
  return spec.body ?? spec.raw
}

// Uniform scale taking raw model units to world units for a category.
// Meaningless for a spec sized by `sizeMm` — use modelScaleAxes for those.
//
// Always the SPEC's own uniform fit. A size override is not uniform by
// definition — it stretches one axis and leaves the other two alone — so it
// cannot be expressed here; modelScaleAxes is the override-aware path and
// everything that has to respect a selected part's real dimensions goes through
// it. The only callers left on this are the ones fitting a whole mesh uniformly.
export function modelScale(category) {
  const spec = PART_SPECS[category]
  if (!spec) return 0
  const rotated = rotateExtents(fitExtents(spec), spec.rotation)
  const basis = spec.fitAxis === undefined ? Math.max(...rotated) : rotated[spec.fitAxis]
  return mm(spec.lengthMm) / basis
}

// Which of the MODEL's own axes carries the world axis `lengthMm` addresses.
//
// rotateExtents is a pure permutation, so applying it to [0,1,2] says which model
// index landed at each world position — no second convention to keep in step with
// it. Needed because a size override names a WORLD length while the scale is
// applied per model axis, and this file's history is mostly bugs from mixing the
// two conventions by hand.
function lengthModelAxis(spec) {
  const rotated = rotateExtents(fitExtents(spec), spec.rotation)
  const worldAxis = spec.fitAxis === undefined ? rotated.indexOf(Math.max(...rotated)) : spec.fitAxis
  return rotateExtents([0, 1, 2], spec.rotation)[worldAxis]
}

// The overridden length for a category, or undefined to use the spec's own.
//
// Overrides are keyed BY CATEGORY rather than passed as a bare length because a
// part's placement can depend on another part's box — a cooler stacks on the CPU
// — and a bare length would leak onto whatever category that lookup landed on.
//
// A `sizeMm` part throws rather than being silently left at its default. Half the
// bugs this scene has produced were a value that was quietly ignored while
// everything around it looked consistent, so an override that cannot be honoured
// has to say so.
function overriddenLengthMm(category, overrides) {
  const named = overrides?.[category]?.lengthMm
  if (named === undefined) return undefined
  const spec = PART_SPECS[category]
  if (!spec) return undefined
  if (spec.sizeMm) {
    throw new Error(`${category} is sized per-axis by sizeMm and has no single length to override`)
  }
  return named
}

// Per-axis scale from raw model units to world units, in the MODEL's own axes.
//
// Uniform for every part whose mesh has the real thing's proportions. `sizeMm`
// is the escape hatch for one that does not: it names all three world-space
// dimensions and is un-rotated back into model axes here, so a stylised mesh can
// still occupy the volume the real component does. Authored in world axes on
// purpose — a case is reasoned about as depth/height/width, and this file has a
// long history of bugs from mixing the two conventions.
export function modelScaleAxes(category, overrides) {
  const spec = PART_SPECS[category]
  if (!spec) return [0, 0, 0]
  // Resolved before the branch, so a `sizeMm` part carrying an override throws
  // here rather than falling through to the per-axis path and quietly ignoring it.
  const lengthMm = overriddenLengthMm(category, overrides)
  if (!spec.sizeMm) {
    const s = modelScale(category)
    if (lengthMm === undefined) return [s, s, s]
    // ONE axis moves. A uniform rescale would drag the other two with it, and for
    // a graphics card that is plainly wrong: the PCIe bracket height and the slot
    // thickness are fixed by the standard, so a 145 mm card is as tall and as
    // thick as a 357 mm one, just shorter. Scaling all three rendered a compact
    // card as a 21 mm-thick scale model of a big one. Round nine learned the same
    // lesson from the other side, when filling the M.2 slot lengthways also
    // widened the stick into the graphics card's box.
    //
    // Expressed as a ratio off the uniform scale so an override equal to the
    // spec's own length is exactly, bit-for-bit, no change at all.
    const axes = [s, s, s]
    axes[lengthModelAxis(spec)] = s * (lengthMm / spec.lengthMm)
    return axes
  }
  // Against the BODY, not the raw box — same reason modelScale() fits the body.
  // Dividing by `raw` sized the whole mesh to sizeMm, so any stray geometry
  // inflating the bounding box shrank the actual component by the same factor.
  // The PSU mesh carries a lone cube floating well above the unit that more than
  // doubles its height, so an 86 mm supply rendered about 41 mm tall inside an
  // 86 mm hitbox — parts anchored to that box then looked detached from it.
  const local = unrotateExtents(spec.sizeMm.map(mm), spec.rotation)
  return local.map((v, i) => v / fitExtents(spec)[i])
}

// World-space size of a part, in world units, after its model rotation.
export function partSize(category, overrides) {
  const spec = PART_SPECS[category]
  if (!spec) return [0, 0, 0]
  return rotateExtents(partLocalSize(category, overrides), spec.rotation)
}

// Size in the MODEL's own axes — i.e. before the placement group applies
// spec.rotation. Anything rendered as a CHILD of that group needs these, not
// partSize(), or it comes out rotated twice. Returns null for categories with
// no measured model (the case is procedural).
//
// Reports the BODY where one is declared: layout and collision care about the
// board, not about the shroud and stray geometry drawn around it. The renderer
// needs the whole mesh instead — that is meshLocalSize.
export function partLocalSize(category, overrides) {
  const spec = PART_SPECS[category]
  if (!spec) return null
  const axes = modelScaleAxes(category, overrides)
  return fitExtents(spec).map((v, i) => v * axes[i])
}

// The whole mesh's size in model axes, decoration included. Only the renderer
// wants this — it has to fit the actual GLB, not the functional body inside it.
export function meshLocalSize(category, overrides) {
  const spec = PART_SPECS[category]
  if (!spec) return null
  const axes = modelScaleAxes(category, overrides)
  return spec.raw.map((v, i) => v * axes[i])
}

// How far the mesh must shift so its BODY lands on the group origin, in model
// axes. Without it the board's PCB sits ~30 mm from the origin that MOUNTS
// measures from, and every mounted part inherits the error.
export function bodyShiftLocal(category, overrides) {
  const spec = PART_SPECS[category]
  if (!spec?.bodyOffset) return [0, 0, 0]
  const axes = modelScaleAxes(category, overrides)
  return spec.bodyOffset.map((v, i) => -v * axes[i])
}

// The PCB's component-side face — the plane parts actually plug into, and where
// everything mounted on the board begins.
//
// Deliberately NOT half the board's bounding box. That box is 49 mm deep because
// the mesh includes the VRM heatsinks and the I/O shroud, which stand 41.6 mm
// proud of the PCB; using it mounted every part on top of the shroud, floating
// clear of the board with nothing touching it. `surfaceOffset` carries the real
// plane, measured from the mesh (see partSpecs.js).
export function boardFaceZ() {
  const spec = PART_SPECS.motherboard
  if (!spec?.surfaceOffset) return partSize('motherboard')[2] / 2
  return rotateVector(spec.surfaceOffset, spec.rotation)[2] * modelScale('motherboard')
}

// A named sub-feature of a part, in world units. Both features recorded so far
// — the board's rear I/O stack and the PSU's mains inlet — are things the case's
// back panel has to be cut for, and both are stored as an offset from the part's
// own centre plus a size, in raw model units.
function featureBox(category, feature, overrides) {
  const spec = PART_SPECS[category]
  const f = spec?.[feature]
  if (!f) return null
  const axes = modelScaleAxes(category, overrides)
  const offset = rotateVector(f.offset.map((v, i) => v * axes[i]), spec.rotation)
  const size = rotateExtents(f.size.map((v, i) => v * axes[i]), spec.rotation)
  const centre = partCentre(category, overrides).map((c, i) => c + offset[i])
  return {
    min: centre.map((c, i) => c - size[i] / 2),
    max: centre.map((c, i) => c + size[i] / 2),
  }
}

// The port cluster that reaches through the case's back panel. Also what the
// rear exhaust fan has to be placed clear of (see fanMounts).
export const ioBlockBox = () => featureBox('motherboard', 'ioBlock')

// The PSU's mains inlet and switch. It sits low on the unit and toward the
// window — NOT in the middle of its face, which is where the rear panel's
// cut-out used to be, putting the hole on the wrong side of the PSU entirely.
export const psuSocketBox = () => featureBox('psu', 'ioSocket')

// Offset from a part's bbox centre to its anchor node, in world units and world
// axes. Zero for parts that mount by their body rather than a named connector.
function anchorOffsetWorld(category, overrides) {
  const spec = PART_SPECS[category]
  if (!spec?.anchorOffset) return [0, 0, 0]
  const axes = modelScaleAxes(category, overrides)
  // Scale in model axes first, then rotate — the scale is per-model-axis, so
  // applying it after the rotation would stretch the wrong component.
  const scaled = spec.anchorOffset.map((v, i) => v * axes[i])
  return rotateVector(scaled, spec.rotation)
}

// Offset from a part's bbox centre to its own PCB plane, in world units. Zero
// for a part with no separately measured board.
//
// An expansion card is held by its PCB, but a triple-slot cooler's bounding box
// is dominated by the heatsink hanging off it — so the PCB sits ~13 mm off the
// box centre and seating the box on the slot leaves the card hovering above it.
function pcbPlaneOffset(category, overrides) {
  const spec = PART_SPECS[category]
  if (!spec?.pcbOffset) return [0, 0, 0]
  const axes = modelScaleAxes(category, overrides)
  return rotateVector(spec.pcbOffset.map((v, i) => v * axes[i]), spec.rotation)
}

// How far the PCB's edge sinks into its slot. A couple of millimetres so the
// card visibly engages rather than resting on the board's surface.
const SLOT_SEAT_MM = 2

// A card's own PCB size in world axes.
function pcbWorldSize(category, overrides) {
  const spec = PART_SPECS[category]
  if (!spec?.pcbSize) return [0, 0, 0]
  const axes = modelScaleAxes(category, overrides)
  return rotateExtents(spec.pcbSize.map((v, i) => v * axes[i]), spec.rotation)
}

// Where the PCB's leading edge sits relative to the card's bbox centre — the end
// that goes into the slot.
const pcbLeadX = (category, overrides) =>
  pcbPlaneOffset(category, overrides)[0] - pcbWorldSize(category, overrides)[0] / 2

// Where a card's centre must sit for its PCB's lower edge to meet the slot.
//
// Seating a card by its BOUNDING BOX seats the wrong thing: on a triple-slot
// cooler the box's lower face is the bracket, which reaches ~10 mm below the
// PCB to bolt to the case. So the box met the board while the PCB — the part
// that actually goes in the slot — hovered 10 mm above it with nothing bridging
// the gap. The bracket now reaches back past the board plane instead, which is
// what it does in a real machine.
function pcbSeatZ(category, overrides) {
  const half = pcbWorldSize(category, overrides)[2] / 2
  return boardFaceZ() + mm(SLOT_SEAT_MM) + half - pcbPlaneOffset(category, overrides)[2]
}

// A card's own PCB in world space — the sheet that goes in the slot, as opposed
// to the bounding box, which on a triple-slot cooler is mostly heatsink and
// bracket. This is what "seated" has to be judged against.
export function pcbBox(category, overrides) {
  if (!PART_SPECS[category]?.pcbSize) return null
  const size = pcbWorldSize(category, overrides)
  const offset = pcbPlaneOffset(category, overrides)
  const centre = partCentre(category, overrides).map((c, i) => c + offset[i])
  return {
    min: centre.map((c, i) => c - size[i] / 2),
    max: centre.map((c, i) => c + size[i] / 2),
  }
}

// The world box covering the radiator's own fans — what the roof vent is cut
// over. Null for a cooler with no measured fans.
export function radiatorFanBox() {
  const spec = PART_SPECS.cooler
  if (!spec?.radiatorFans) return null
  const axes = modelScaleAxes('cooler')
  const size = rotateExtents(spec.radiatorFans.size.map((v, i) => v * axes[i]), spec.rotation)
  const centre = partCentre('cooler')
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const raw of spec.radiatorFans.offsets) {
    const off = rotateVector(raw.map((v, i) => v * axes[i]), spec.rotation)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], centre[i] + off[i] - size[i] / 2)
      max[i] = Math.max(max[i], centre[i] + off[i] + size[i] / 2)
    }
  }
  return { min, max }
}

// Depth of the part's mounting face along world Z. For an anchored part that is
// the connector's own depth — an AIO touches the board only at its pump block,
// so placing its whole bounding box against the face would shove the radiator
// through the side panel.
function mountDepth(category, overrides) {
  const spec = PART_SPECS[category]
  const [, , depth] = partSize(category, overrides)
  if (!spec?.anchorSize) return depth
  const axes = modelScaleAxes(category, overrides)
  return rotateExtents(spec.anchorSize.map((v, i) => v * axes[i]), spec.rotation)[2]
}

// The surface a part mounts against, along world Z. Normally that is the board's
// front face, but a part can declare it stacks on another (`mountsOn`) — a cooler
// clamps onto the CPU's heat spreader, not onto the PCB. Without this every part
// started at the board face, so the pump block and the CPU both began at the same
// Z and the pump simply swallowed the whole CPU.
// `overrides` carries through to the part underneath because it is keyed by
// category: a cooler stacking on the CPU looks up the CPU's own entry, not the
// cooler's, so a card's length can never leak onto the part it stacks against.
function mountBaseZ(category, overrides) {
  const on = PART_SPECS[category]?.mountsOn
  return on ? partBox(on, overrides).max[2] : boardFaceZ()
}

// The PSU is the one part with no board connector, so it cannot come from
// MOUNTS. It sits in the basement instead, pushed back against the case's rear
// wall so its IEC socket reaches the outside — a PSU floating mid-basement has
// nowhere for the mains cable to go. `clearanceMm` is the gap it keeps from the
// basement floor, the rear wall and the motherboard tray.
//
// All three come from caseInterior() rather than being rebuilt here. This used
// to recompute the floor and tray planes itself and derive the rear wall from
// `-CASE.depthMm/2` — a duplicate of a constant caseInterior() no longer uses,
// which is how the PSU ended up correctly against the rear panel while the
// board floated 102.7 mm inside it.
// Three separate gaps, because they answer to different things.
//
// `rearGapMm` pushes it up against the wall its mains socket comes through,
// `trayGapMm` against the motherboard tray, and `floorGapMm` is the only space
// under it — trimmed with
// CASE.basementMm so the case's floor rises with the unit. The basement went
// 110 → 95 → 90 that way. **The PSU is now at its ceiling**: its top sits 2 mm
// below the board's lower edge, so it cannot rise further without eating the
// board, and any more height has to come out of the floor.
// rearGapMm is 0 so the unit is FLUSH with the panel its mains socket comes
// through. At 2 mm the socket sat just behind its own cut-out and you could see
// daylight round it — a real supply bolts hard against that wall.
const PSU_BAY = { rearGapMm: 0, trayGapMm: 2, floorGapMm: 2 }

// Centre of a part in world units, derived from its mount point. Mounted parts
// sit against the board's +Z face and extend outward by half their mounting
// depth; anchored parts are shifted so their connector, not their centre, lands
// on the mount point.
export function partCentre(category, overrides) {
  if (category === 'motherboard') return [0, 0, 0]

  if (category === 'psu') {
    const inner = caseInterior()
    const size = partSize('psu', overrides)
    // Sits in the basement, against the rear wall (so the socket is reachable),
    // up against the motherboard tray, on a small gap off the floor.
    return [
      inner.min[0] + size[0] / 2 + mm(PSU_BAY.rearGapMm),
      inner.min[1] + size[1] / 2 + mm(PSU_BAY.floorGapMm),
      inner.min[2] + size[2] / 2 + mm(PSU_BAY.trayGapMm),
    ]
  }

  const mount = MOUNTS[category]
  if (!mount) return [0, 0, 0]

  const offset = anchorOffsetWorld(category, overrides)
  // A card declaring `rearInsetMm` is placed by its rear (bracket) edge against
  // the board's, rather than by its centre — see MOUNTS.gpu.
  // `pcbRearMm` places a card by the LEADING EDGE OF ITS PCB — the end that
  // goes into the slot — so making the card longer stretches it forward and the
  // connector stays exactly where it is. Anchoring on the bracket (rearInsetMm)
  // could not do that: this mesh starts its PCB 17 mm in from the bracket, and
  // that gap scales with the card, so every length change dragged the connector
  // out of the slot.
  const x = mount.pcbRearMm !== undefined
    ? mm(mount.pcbRearMm) - pcbLeadX(category, overrides)
    : mount.rearInsetMm === undefined
      ? mm(mount.xMm)
      : caseInterior().min[0] + partSize(category, overrides)[0] / 2 + mm(mount.rearInsetMm)

  // A card declaring `slotYMm` is seated by its PCB on the slot's centreline;
  // everything else is placed by its own centre.
  const y = mount.slotYMm === undefined
    ? mm(mount.yMm)
    : mm(mount.slotYMm) - pcbPlaneOffset(category, overrides)[1]

  // `zLiftMm` stands a part proud of its mounting face, toward the glass. The
  // M.2 lies flush on the PCB by default (it is ~0 mm thick), which tucks it
  // behind the board's drawn heatsink where it barely shows; lifting it a few mm
  // seats it visibly in its slot. Absent, it is 0, so nothing else is affected.
  const z = PART_SPECS[category]?.pcbSize
    ? pcbSeatZ(category, overrides)
    : mountBaseZ(category, overrides) + mountDepth(category, overrides) / 2 - offset[2] + mm(mount.zLiftMm ?? 0)

  return [x - offset[0], y - offset[1], z]
}

export function partBox(category, overrides) {
  const size = partSize(category, overrides)
  const centre = partCentre(category, overrides)
  return {
    min: centre.map((c, i) => c - size[i] / 2),
    max: centre.map((c, i) => c + size[i] / 2),
  }
}

// Tower interior. Height carries a PSU basement below the board and a
// top-mounted radiator above it, so it runs taller than the board alone needs.
//
// 482 rather than a round 500 so the AIO's radiator meets the roof. The mesh
// locks the pump and radiator a fixed distance apart and we mount by the pump
// (a block clamps to the CPU, not to the case), so the radiator's height is
// decided by the socket — the roof has to come to it. A real build takes up the
// slack in the tubes, which a rigid mesh cannot. assemblyGeometry.test.js pins
// the resulting clearance so a new cooler mesh reopening the gap fails loudly.
export const CASE = {
  // Follows the radiator: the mesh locks pump-to-radiator and we mount by the
  // pump, so the roof has to come to wherever the socket puts it. 482 against
  // the old guessed socket, then 467 → 452 → 447 as the basement was trimmed —
  // the floor rose each time, so the roof came with it to hold the same
  // roofline over the radiator.
  heightMm: 447,
  depthMm: 380,    // front-to-back, world X
  widthMm: 210,    // side-to-side, world Z
  basementMm: 90,  // PSU compartment below the board: 2 + 86 + 2 of clearance
  panelMm: 7,      // wall thickness, shared with CaseModel and fanMounts
  // Board's rear edge to the rear panel's inner face — the depth of the I/O
  // shield frame, which is what fills it in a real tower.
  //
  // 15 rather than the 6 it started at, because the card is anchored by its
  // PCB's leading edge and this GPU mesh sits its bracket ~19 mm behind that
  // edge (further than a real card). Aligning the connector with the slot
  // therefore puts the bracket ~144 mm back, and the panel has to be there to
  // meet it — otherwise the bracket hangs outside the case. Widening this is
  // the honest fix; the alternative is a mis-seated connector.
  rearGapMm: 15,
}

// Interior bounds in world units, anchored off the board on ALL THREE axes: the
// rear tray sits one standoff behind the board, the basement hangs below the
// board's lower edge, and the rear panel comes up to the board's rear edge.
//
// That last one was missing. X was hard-centred on the origin (`±depthMm/2`),
// which is a statement about the *board's* position, not the case's — so the
// board sat 102.7 mm forward of a rear panel the PSU was already against, and
// the GPU's bracket bolted to thin air. Depth went 450 → 380 at the same time:
// with the void behind the board closed, 450 just moved that void in front of
// the card. See assemblyGeometry.test.js.
//
// Takes NO size overrides, deliberately. The case is one fixed tower, and a
// selected card must not be able to resize the machine around it — every other
// part is positioned off this box, so a case that grew with the graphics card
// would move the PSU, the fans and every panel cut-out whenever the card
// changed. A card too long for the tower is a compatibility question, answered
// in the catalogue rules, not something the geometry silently accommodates.
export function caseInterior() {
  const board = partBox('motherboard')
  const rearX = board.min[0] - mm(CASE.rearGapMm)
  const rearZ = board.min[2] - mm(BOARD.standoffMm)
  const floorY = board.min[1] - mm(CASE.basementMm)
  return {
    min: [rearX, floorY, rearZ],
    max: [rearX + mm(CASE.depthMm), floorY + mm(CASE.heightMm), rearZ + mm(CASE.widthMm)],
  }
}
