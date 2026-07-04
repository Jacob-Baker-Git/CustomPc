import * as THREE from 'three'
import useBuilderStore from '../../store/useBuilderStore'

// Tower proportions: taller than wide (reads as a tower, not a cube). Depth is
// kept shallow so the motherboard sits close to the glass, like a real case.
const W = 3.0   // width  (X)
const H = 3.7   // height (Y) — trimmed so the PSU sits on the floor and there's
                // ~3 fan-thicknesses of clearance above the motherboard
const D = 1.2   // depth  (Z)
const T = 0.06  // panel thickness

function Panel({ args, position, color, opacity = 1, glass = false }) {
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        metalness={glass ? 0.0 : 0.6}
        roughness={glass ? 0.25 : 0.55}
        side={2}
      />
    </mesh>
  )
}

export default function CaseModel() {
  const transparent = useBuilderStore((s) => s.caseTransparent)

  // Open mode: panels removed — a clean edge frame only (no triangulated
  // wireframe diagonals), so parts are fully visible.
  if (transparent) {
    return (
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(W, H, D)]} />
        <lineBasicMaterial color="#4a6a94" transparent opacity={0.7} />
      </lineSegments>
    )
  }

  // Solid mode: 5 opaque metal panels + 1 tinted tempered-glass front window.
  return (
    <group>
      <Panel args={[W, T, D]} position={[0, -H / 2, 0]} color="#15161a" />  {/* bottom */}
      <Panel args={[W, T, D]} position={[0,  H / 2, 0]} color="#15161a" />  {/* top */}
      <Panel args={[T, H, D]} position={[ W / 2, 0, 0]} color="#1b1c21" />  {/* right side */}
      <Panel args={[T, H, D]} position={[-W / 2, 0, 0]} color="#1b1c21" />  {/* left side */}
      <Panel args={[W, H, T]} position={[0, 0, -D / 2]} color="#101116" />  {/* rear / mobo tray */}
      {/* tempered-glass front window — the build is visible through it */}
      <Panel args={[W, H, T]} position={[0, 0, D / 2]} color="#87b3dd" opacity={0.16} glass />
    </group>
  )
}
