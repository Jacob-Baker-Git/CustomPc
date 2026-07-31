import * as THREE from 'three'
import { useMemo } from 'react'
import { cableRoutes } from '../../lib/cableRoutes'
import { mm } from '../../lib/pcScale'

// A single braided cable drawn as a smooth tube through the given world points.
// Dark sleeved black — matte, like real sleeved PSU cables (the old off-white
// read as loose noodles).
function Cable({ points, radius }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(curve, 64, radius, 10, false)
  }, [points, radius])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#15171c" metalness={0.1} roughness={0.72} />
    </mesh>
  )
}

// The connector body where a cable lands. Without it a tube merely ends near a
// part; with it the loom reads as plugged in.
function Plug({ position, size }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#0d0e12" metalness={0.25} roughness={0.55} />
    </mesh>
  )
}

// Cabling routed in the assembly's world frame. Every coordinate comes from
// cableRoutes, which derives them from the parts themselves — this file used to
// carry hand-typed constants that had drifted a whole rework out of date.
export default function CableHarness({ selectedParts = {} }) {
  const routes = cableRoutes(selectedParts)
  if (!routes.length) return null

  return (
    <group>
      {routes.map((route) => (
        <group key={route.id}>
          <Cable points={route.points} radius={mm(route.radiusMm)} />
          <Plug position={route.plug.position} size={route.plug.size} />
          {route.socket && <Plug position={route.socket.position} size={route.socket.size} />}
        </group>
      ))}
    </group>
  )
}
