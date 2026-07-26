import { mm } from './pcScale'
import { PART_SPECS } from './partSpecs'
import { MOUNTS } from './mountPoints'

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

// The board's front face — where mounted components begin.
export function boardFaceZ() {
  return partSize('motherboard')[2] / 2
}

// Offset from a part's bbox centre to its anchor node, in world units and world
// axes. Zero for parts that mount by their body rather than a named connector.
function anchorOffsetWorld(category) {
  const spec = PART_SPECS[category]
  if (!spec?.anchorOffset) return [0, 0, 0]
  const scale = modelScale(category)
  return rotateVector(spec.anchorOffset, spec.rotation).map((v) => v * scale)
}

// Centre of a part in world units, derived from its mount point. Mounted parts
// sit against the board's +Z face and extend outward by half their own depth;
// anchored parts are shifted so their connector, not their centre, lands on the
// mount point.
export function partCentre(category) {
  if (category === 'motherboard') return [0, 0, 0]

  const mount = MOUNTS[category]
  if (!mount) return [0, 0, 0]

  const [, , depth] = partSize(category)
  const offset = anchorOffsetWorld(category)
  return [
    mm(mount.xMm) - offset[0],
    mm(mount.yMm) - offset[1],
    boardFaceZ() + depth / 2 - offset[2],
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
