import * as THREE from 'three'
import useBuilderStore from '../../store/useBuilderStore'
import { caseInterior, CASE } from '../../lib/assemblyGeometry'
import { mm } from '../../lib/pcScale'

// Shell dimensions come from the same interior geometry the parts are placed
// in, so the case always contains what it's supposed to contain.
const inner = caseInterior()
const W = inner.max[0] - inner.min[0]  // front-to-back
const H = inner.max[1] - inner.min[1]  // height
const D = inner.max[2] - inner.min[2]  // side-to-side
const T = mm(7)                        // panel thickness

function Panel({ args, position, color, opacity = 1, glass = false }) {
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        metalness={glass ? 0.0 : 0.75}
        roughness={glass ? 0.12 : 0.42}
        envMapIntensity={glass ? 1.4 : 1.1}
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
        <lineBasicMaterial color="#7c8798" transparent opacity={0.65} />
      </lineSegments>
    )
  }

  // Solid mode: 5 opaque metal panels + 1 tinted tempered-glass front window.
  // Vent grilles sit over the fan mounts (top exhaust row, right intake column,
  // left top-rear exhaust) so fans blow through vents, not blank metal.
  return (
    <group>
      <Panel args={[W, T, D]} position={[0, -H / 2, 0]} color="#1a1c21" />  {/* bottom */}
      <Panel args={[W, T, D]} position={[0,  H / 2, 0]} color="#1a1c21" />  {/* top */}
      <Panel args={[T, H, D]} position={[ W / 2, 0, 0]} color="#22242a" />  {/* right side */}
      <Panel args={[T, H, D]} position={[-W / 2, 0, 0]} color="#22242a" />  {/* left side */}
      <Panel args={[W, H, T]} position={[0, 0, -D / 2]} color="#15171c" />  {/* rear / mobo tray */}

      {/* top vent grille over the exhaust row */}
      <Panel args={[2.7, T, 0.78]} position={[0, H / 2 + 0.006, 0]} color="#0a0b0e" />
      {Array.from({ length: 9 }).map((_, i) => (
        <Panel key={`t${i}`} args={[0.05, T, 0.78]} position={[-1.2 + i * 0.3, H / 2 + 0.012, 0]} color="#22242a" />
      ))}

      {/* right vent grille over the intake column */}
      <Panel args={[T, 2.5, 0.78]} position={[W / 2 + 0.006, 0, 0]} color="#0a0b0e" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Panel key={`r${i}`} args={[T, 0.05, 0.78]} position={[W / 2 + 0.012, -1.05 + i * 0.3, 0]} color="#22242a" />
      ))}

      {/* left vent over the top-rear exhaust fan */}
      <Panel args={[T, 0.78, 0.78]} position={[-W / 2 - 0.006, 1.05, 0]} color="#0a0b0e" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Panel key={`l${i}`} args={[T, 0.05, 0.78]} position={[-W / 2 - 0.012, 0.8 + i * 0.25, 0]} color="#22242a" />
      ))}

      {/* PSU basement shroud — the deck the board sits above */}
      <Panel args={[W, T, D]} position={[0, -H / 2 + mm(CASE.basementMm), 0]} color="#1a1c21" />

      {/* tempered-glass front window — the build is visible through it */}
      <Panel args={[W, H, T]} position={[0, 0, D / 2]} color="#87b3dd" opacity={0.16} glass />
    </group>
  )
}
