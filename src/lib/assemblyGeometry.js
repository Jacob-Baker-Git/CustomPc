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

// Uniform scale taking raw model units to world units for a category.
export function modelScale(category) {
  const spec = PART_SPECS[category]
  if (!spec) return 0
  const rotated = rotateExtents(spec.raw, spec.rotation)
  const basis = spec.fitAxis === undefined ? Math.max(...rotated) : rotated[spec.fitAxis]
  return mm(spec.lengthMm) / basis
}

// World-space size of a part, in world units, after its model rotation.
export function partSize(category) {
  const spec = PART_SPECS[category]
  if (!spec) return [0, 0, 0]
  const scale = modelScale(category)
  return rotateExtents(spec.raw, spec.rotation).map((v) => v * scale)
}

// Size in the MODEL's own axes — i.e. before the placement group applies
// spec.rotation. Anything rendered as a CHILD of that group needs these, not
// partSize(), or it comes out rotated twice. Returns null for categories with
// no measured model (the case is procedural).
export function partLocalSize(category) {
  const spec = PART_SPECS[category]
  if (!spec) return null
  const scale = modelScale(category)
  return spec.raw.map((v) => v * scale)
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

// Offset from a part's bbox centre to its anchor node, in world units and world
// axes. Zero for parts that mount by their body rather than a named connector.
function anchorOffsetWorld(category) {
  const spec = PART_SPECS[category]
  if (!spec?.anchorOffset) return [0, 0, 0]
  const scale = modelScale(category)
  return rotateVector(spec.anchorOffset, spec.rotation).map((v) => v * scale)
}

// Depth of the part's mounting face along world Z. For an anchored part that is
// the connector's own depth — an AIO touches the board only at its pump block,
// so placing its whole bounding box against the face would shove the radiator
// through the side panel.
function mountDepth(category) {
  const spec = PART_SPECS[category]
  const [, , depth] = partSize(category)
  if (!spec?.anchorSize) return depth
  return rotateExtents(spec.anchorSize, spec.rotation)[2] * modelScale(category)
}

// The surface a part mounts against, along world Z. Normally that is the board's
// front face, but a part can declare it stacks on another (`mountsOn`) — a cooler
// clamps onto the CPU's heat spreader, not onto the PCB. Without this every part
// started at the board face, so the pump block and the CPU both began at the same
// Z and the pump simply swallowed the whole CPU.
function mountBaseZ(category) {
  const on = PART_SPECS[category]?.mountsOn
  return on ? partBox(on).max[2] : boardFaceZ()
}

// The PSU is the one part with no board connector, so it cannot come from
// MOUNTS. It sits in the basement instead, and these are its only placement
// figures: how far back along the case it sits, and the gap it keeps from the
// basement floor and rear tray.
const PSU_BAY = { offsetMm: -30, clearanceMm: 8 }

// Centre of a part in world units, derived from its mount point. Mounted parts
// sit against the board's +Z face and extend outward by half their mounting
// depth; anchored parts are shifted so their connector, not their centre, lands
// on the mount point.
export function partCentre(category) {
  if (category === 'motherboard') return [0, 0, 0]

  if (category === 'psu') {
    const board = partBox('motherboard')
    const [, height, depth] = partSize('psu')
    const floorY = board.min[1] - mm(CASE.basementMm)
    const rearZ = board.min[2] - mm(BOARD.standoffMm)
    // Stands on the basement floor, pushed back against the rear tray.
    return [
      mm(PSU_BAY.offsetMm),
      floorY + height / 2 + mm(PSU_BAY.clearanceMm),
      rearZ + depth / 2 + mm(PSU_BAY.clearanceMm),
    ]
  }

  const mount = MOUNTS[category]
  if (!mount) return [0, 0, 0]

  const offset = anchorOffsetWorld(category)
  return [
    mm(mount.xMm) - offset[0],
    mm(mount.yMm) - offset[1],
    mountBaseZ(category) + mountDepth(category) / 2 - offset[2],
  ]
}

export function partBox(category) {
  const size = partSize(category)
  const centre = partCentre(category)
  return {
    min: centre.map((c, i) => c - size[i] / 2),
    max: centre.map((c, i) => c + size[i] / 2),
  }
}

// Tower interior. Height carries a PSU basement below the board and a
// top-mounted radiator above it, so it runs taller than the board alone needs.
export const CASE = {
  heightMm: 500,
  depthMm: 450,    // front-to-back, world X
  widthMm: 210,    // side-to-side, world Z
  basementMm: 110, // PSU compartment below the board
}

// Interior bounds in world units, anchored off the board: the rear tray sits one
// standoff behind the board, and the basement hangs below the board's lower edge.
export function caseInterior() {
  const board = partBox('motherboard')
  const rearZ = board.min[2] - mm(BOARD.standoffMm)
  const floorY = board.min[1] - mm(CASE.basementMm)
  return {
    min: [-mm(CASE.depthMm) / 2, floorY, rearZ],
    max: [mm(CASE.depthMm) / 2, floorY + mm(CASE.heightMm), rearZ + mm(CASE.widthMm)],
  }
}
