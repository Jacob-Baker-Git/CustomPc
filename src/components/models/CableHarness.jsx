import * as THREE from 'three'
import { useMemo } from 'react'

// A single braided cable drawn as a smooth tube through the given world points.
function Cable({ points, radius = 0.04, color = '#e9e9ed' }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(curve, 40, radius, 8, false)
  }, [points, radius])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} metalness={0.1} roughness={0.7} />
    </mesh>
  )
}

// Decorative cabling routed in the assembly's world frame (board at the origin,
// shroud below). Only the cables whose endpoints exist are drawn.
export default function CableHarness({ selectedParts = {} }) {
  if (!selectedParts.motherboard) return null

  return (
    <group>
      {/* 24-pin ATX cable: shroud → up the right edge → into the board */}
      {selectedParts.psu && (
        <Cable
          points={[
            [1.22, -1.15, 0.18],
            [1.28, -0.55, 0.12],
            [1.2, 0.15, 0.1],
            [1.02, 0.35, 0.08],
          ]}
        />
      )}
      {/* PCIe power: shroud → up to the GPU */}
      {selectedParts.psu && selectedParts.gpu && (
        <Cable
          radius={0.035}
          points={[
            [0.25, -1.15, 0.38],
            [0.18, -0.98, 0.46],
            [0.05, -0.82, 0.5],
          ]}
        />
      )}
    </group>
  )
}
