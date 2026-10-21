// 3D-only showroom maths (three.js, assemblyGeometry). Import this ONLY from
// the lazy BuildCanvas chunk; page code uses ./showroomSlots.js.
import * as THREE from 'three'
import { partCentre, caseInterior } from './assemblyGeometry'
import { sizeOverrides } from './partOverrides'

export function projectAnchor(world, camera) {
  const v = new THREE.Vector3(...world).project(camera)
  const x = (v.x * 0.5 + 0.5) * 100
  const y = (-v.y * 0.5 + 0.5) * 100
  return { x, y, visible: v.z <= 1 && x >= 0 && x <= 100 && y >= 0 && y <= 100 }
}

// World-unit nudges from partCentre onto a face the camera can see (1 wu =
// 122 mm). The bbox centre of these three sits somewhere you cannot point at:
// the AIO's box spans pump to roof radiator, so its centre is empty air; the
// card's and the PSU's centres are buried mid-body. Picked by eye in the
// browser from the default and orbited views — see the Task 4 report.
export const ANCHOR_OFFSET = {
  cooler: [0, 0.55, 0],
  gpu: [0, 0, 0.4],
  psu: [0, 0, 0.55],
}

export function anchorWorldPoint(id, parts) {
  const overrides = sizeOverrides(parts)
  // A procedurally drawn part (an air tower, a SATA drive) is solid to its
  // centre, so the nudge meant for the AIO's empty box would point past it.
  const off = (!overrides[id]?.boxMm && ANCHOR_OFFSET[id]) || [0, 0, 0]
  return partCentre(id, overrides).map((v, i) => v + off[i])
}

// Whether the sight line from `eye` to `point` (inside the case) comes in
// through the glass side (+Z, the interior's max Z face). Every other face is
// a solid panel, roof vents included. The face a ray enters an axis-aligned
// box by is the axis with the LATEST slab entry. An eye inside the box sees
// everything.
export function seenThroughGlass(eye, point, box = caseInterior()) {
  let tEnter = -Infinity
  let entry = null
  for (let i = 0; i < 3; i++) {
    const below = eye[i] < box.min[i]
    if (!below && eye[i] <= box.max[i]) continue
    const d = point[i] - eye[i]
    if (d === 0) return false // outside this slab and never entering it
    const t = ((below ? box.min[i] : box.max[i]) - eye[i]) / d
    if (t > tEnter) { tEnter = t; entry = [i, below] }
  }
  return !entry || (entry[0] === 2 && !entry[1])
}
