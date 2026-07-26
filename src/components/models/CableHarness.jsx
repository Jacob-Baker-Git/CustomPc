import * as THREE from 'three'
import { useMemo } from 'react'

// A single braided cable drawn as a smooth tube through the given world points.
// Dark sleeved black — matte, like real sleeved PSU cables (the old off-white
// read as loose noodles).
function Cable({ points, radius = 0.028, color = '#141519' }) {
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
      {/* 24-pin ATX cable: bottom-left PSU → sweeping up to the board's right edge */}
      {selectedParts.psu && (
        <Cable
          points={[
            [-0.6, -1.45, 0.18],
            [0.2, -1.0, 0.14],
            [1.0, -0.2, 0.1],
            [1.0, 0.35, 0.06],
          ]}
        />
      )}
      {/* PCIe power: bottom-left PSU → up to the GPU */}
      {selectedParts.psu && selectedParts.gpu && (
        <Cable
          radius={0.024}
          points={[
            [-0.6, -1.45, 0.22],
            [-0.35, -1.05, 0.28],
            [-0.1, -0.9, 0.32],
          ]}
        />
      )}
    </group>
  )
}
