import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { cableRoutes } from '../../lib/cableRoutes'
import { loomFrames } from '../../lib/cableLoom'
import { mm } from '../../lib/pcScale'

const SAMPLES = 96
// Samples over which each wire fans in from its own PSU socket to its place in
// the ribbon — about the first 6 cm of the run.
const FAN_IN = 14
const smooth = (u) => u * u * (3 - 2 * u)
// The PSU face points +X; its sockets lie along Z (width) and Y (height).
const PSU_FRAME = { t: new THREE.Vector3(1, 0, 0), w: new THREE.Vector3(0, 0, 1), h: new THREE.Vector3(0, 1, 0) }

// One ribbon of individually sleeved wires following a route, merged into a
// single geometry so a 24-wire loom is still one draw call. Each wire is the
// route's centreline pushed out along the ribbon's own frame, so the bundle
// keeps its shape round every bend instead of twisting.
function Loom({ route }) {
  const { geometry, partFrame } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(route.points.map((p) => new THREE.Vector3(...p)))
    const { points, tangents, widths, heights } = loomFrames(curve.getPoints(SAMPLES), route.widthAxis)
    const { cols, rows, pitchMm, wireMm } = route.loom
    // Which PSU plug each ribbon column leaves from (a 24-pin is 18 + 10).
    const plugOfCol = []
    route.psuPlugs.forEach((plug) => {
      for (let k = 0; k < plug.cols; k++) plugOfCol.push({ plug, k })
    })
    const tubes = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = mm((c - (cols - 1) / 2) * pitchMm)
        const b = mm((r - (rows - 1) / 2) * pitchMm)
        const wire = points.map((p, i) => p.clone().addScaledVector(widths[i], a).addScaledVector(heights[i], b))
        // Start in this wire's own pin of its PSU socket, then ease into the ribbon.
        const { plug, k } = plugOfCol[c]
        const pin = new THREE.Vector3(...plug.position)
          .addScaledVector(PSU_FRAME.t, -mm(4))
          .addScaledVector(PSU_FRAME.w, mm((k - (plug.cols - 1) / 2) * pitchMm))
          .addScaledVector(PSU_FRAME.h, b)
        const lead = pin.sub(wire[0])
        for (let i = 0; i < FAN_IN; i++) wire[i].addScaledVector(lead, 1 - smooth(i / FAN_IN))
        tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wire), SAMPLES, mm(wireMm) / 2, 6, false))
      }
    }
    const geometry = mergeGeometries(tubes)
    tubes.forEach((t) => t.dispose())
    const end = points.length - 1
    return { geometry, partFrame: { t: tangents[end], w: widths[end], h: heights[end] } }
  }, [route])
  useEffect(() => () => geometry.dispose(), [geometry])

  const { len, wid, hei } = route.loom.plug
  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#121318" metalness={0.15} roughness={0.55} />
      </mesh>
      <Plug position={route.plug.position} frame={partFrame} size={[wid, hei, len]} />
      {/* One per PSU socket, seated in the socket the PSU mesh draws and
          standing proud of the face with the wires leaving its front. */}
      {route.psuPlugs.map((p, i) => (
        <Plug
          key={i}
          position={new THREE.Vector3(...p.position).addScaledVector(PSU_FRAME.t, mm(len / 2 - 4)).toArray()}
          frame={PSU_FRAME}
          wiresFrom="front"
          size={[p.wid, p.hei, len]}
        />
      ))}
    </group>
  )
}

// A connector housing: a glossy black body, the latch on its long side, and a
// shallow lip where the wires enter. Oriented by the cable's own frame so it
// sits square to the wires going into it.
// `wiresFrom` says which end the wires enter: behind (the part end, wires
// arriving along the tangent) or in front (the PSU end, wires leaving along it).
function Plug({ position, frame, size, wiresFrom = 'back' }) {
  const quaternion = useMemo(() => {
    const flip = wiresFrom === 'front' ? -1 : 1
    const m = new THREE.Matrix4().makeBasis(frame.w.clone().multiplyScalar(flip), frame.h, frame.t.clone().multiplyScalar(flip))
    return new THREE.Quaternion().setFromRotationMatrix(m)
  }, [frame, wiresFrom])
  const [w, h, l] = size.map(mm)
  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <boxGeometry args={[w, h, l]} />
        <meshStandardMaterial color="#0b0c0f" metalness={0.1} roughness={0.35} />
      </mesh>
      {/* latch */}
      <mesh position={[0, h / 2 + mm(1), -l * 0.15]}>
        <boxGeometry args={[mm(4), mm(2), l * 0.6]} />
        <meshStandardMaterial color="#0b0c0f" metalness={0.1} roughness={0.35} />
      </mesh>
      {/* wire-entry lip, slightly wider than the body */}
      <mesh position={[0, 0, -l / 2 + mm(1.5)]}>
        <boxGeometry args={[w + mm(1.5), h + mm(1.5), mm(3)]} />
        <meshStandardMaterial color="#17181d" metalness={0.1} roughness={0.5} />
      </mesh>
    </group>
  )
}

// Cabling routed in the assembly's world frame. Every coordinate comes from
// cableRoutes, which derives them from the parts themselves — this file used to
// carry hand-typed constants that had drifted a whole rework out of date.
export default function CableHarness({ selectedParts = {} }) {
  // Memoised: each loom is dozens of tubes, rebuilt only when the build changes.
  const routes = useMemo(() => cableRoutes(selectedParts), [selectedParts])
  if (!routes.length) return null
  return (
    <group>
      {routes.map((route) => <Loom key={route.id} route={route} />)}
    </group>
  )
}
