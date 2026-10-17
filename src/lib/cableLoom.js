import * as THREE from 'three'

const Z = new THREE.Vector3(0, 0, 1)
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const SMOOTH_PASSES = 12

// The orientation of a flat ribbon cable along its sampled centreline.
//
// A real ribbon lies FLAT against whatever it runs along, and everything here
// runs along a plane parallel to the board (behind it, up the glass side, out of
// the PSU face). So the ribbon's thickness wants to point across the case (world
// Z) and its width along `Z × tangent`. That only fails where the cable runs
// straight in or out of the board — into a connector — and there the width
// follows the socket's long side (`widthAxis`) instead, blended in smoothly.
//
// A pure rotation-minimising frame was tried first and let the 24-pin arrive
// behind the board standing on its EDGE: its outer wires went 9.6 mm through
// the tray, visible from outside as a stray line.
//
// Returns per-sample `tangents` (PSU → part), `widths` and `heights`, all unit.
export function loomFrames(points, widthAxis = [0, 1, 0]) {
  const n = points.length
  const tangents = points.map((p, i) => {
    const a = points[Math.max(i - 1, 0)]
    const b = points[Math.min(i + 1, n - 1)]
    return b.clone().sub(a).normalize()
  })
  const axis = new THREE.Vector3(...widthAxis)
  const widths = new Array(n)
  const heights = new Array(n)
  let prev = null
  for (let i = n - 1; i >= 0; i--) {
    const t = tangents[i]
    const flat = Z.clone().cross(t)
    const s = clamp01((flat.length() - 0.2) / 0.4)
    const socket = axis.clone().addScaledVector(t, -axis.dot(t))
    if (socket.lengthSq() > 1e-8) socket.normalize()
    if (flat.lengthSq() > 1e-8) flat.normalize()
    // Pick the flat direction's sign that continues the previous frame (or the
    // socket axis at the connector), so the ribbon never flips over.
    const ref = prev ?? socket
    if (flat.dot(ref) < 0) flat.negate()
    let w = socket.multiplyScalar(1 - s).addScaledVector(flat, s)
    w.addScaledVector(t, -w.dot(t))
    if (w.lengthSq() < 1e-8) w = prev ? prev.clone() : new THREE.Vector3(1, 0, 0).cross(t)
    w.normalize()
    if (prev && w.dot(prev) < 0) w.negate()
    widths[i] = w
    prev = w
  }
  // Ease the hand-off between the flat rule and the socket axis: a few passes of
  // neighbour averaging turn a sharp twist into a gradual one. The connector end
  // stays pinned so the ribbon still meets its socket square.
  for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
    const next = widths.map((w, i) => {
      if (i === n - 1) return w
      const v = w.clone().multiplyScalar(2).add(widths[Math.max(i - 1, 0)]).add(widths[i + 1])
      v.addScaledVector(tangents[i], -v.dot(tangents[i]))
      return v.lengthSq() > 1e-8 ? v.normalize() : w
    })
    next.forEach((w, i) => { widths[i] = w })
  }
  for (let i = 0; i < n; i++) heights[i] = tangents[i].clone().cross(widths[i]).normalize()
  return { points, tangents, widths, heights }
}
