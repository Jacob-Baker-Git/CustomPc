import useBuilderStore from '../../store/useBuilderStore'

// Tower proportions: taller than wide (reads as a tower, not a cube).
const W = 3.0   // width  (X)
const H = 4.4   // height (Y)
const D = 2.6   // depth  (Z)
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

// PSU shroud / basement cover at the bottom of the case — hides the PSU and
// gives the GPU something to sit above, like a real modern build. Shown in both
// modes since it's part of the chassis. Coords are local to the case group.
function Shroud() {
  return (
    <group>
      {/* top cover */}
      <mesh position={[0, -1.2, 0]}>
        <boxGeometry args={[W - 0.12, 0.08, D - 0.12]} />
        <meshStandardMaterial color="#e4e6ea" metalness={0.3} roughness={0.55} />
      </mesh>
      {/* front face */}
      <mesh position={[0, -1.62, D / 2 - 0.12]}>
        <boxGeometry args={[W - 0.12, 0.85, 0.06]} />
        <meshStandardMaterial color="#dadce1" metalness={0.3} roughness={0.55} />
      </mesh>
    </group>
  )
}

export default function CaseModel() {
  const transparent = useBuilderStore((s) => s.caseTransparent)

  // Open mode: panels removed — faint frame only, so parts are fully visible.
  if (transparent) {
    return (
      <group>
        <mesh>
          <boxGeometry args={[W, H, D]} />
          <meshBasicMaterial color="#3a567d" wireframe transparent opacity={0.5} />
        </mesh>
        <Shroud />
      </group>
    )
  }

  // Solid mode: 5 opaque metal panels + 1 tinted tempered-glass front window.
  return (
    <group>
      <Panel args={[W, T, D]} position={[0, -H / 2, 0]} color="#d7dade" />  {/* bottom */}
      <Panel args={[W, T, D]} position={[0,  H / 2, 0]} color="#d7dade" />  {/* top */}
      <Panel args={[T, H, D]} position={[ W / 2, 0, 0]} color="#cdd0d6" />  {/* right side */}
      <Panel args={[T, H, D]} position={[-W / 2, 0, 0]} color="#cdd0d6" />  {/* left side */}
      <Panel args={[W, H, T]} position={[0, 0, -D / 2]} color="#c4c7cd" />  {/* rear / mobo tray */}
      {/* tempered-glass front window — the build is visible through it */}
      <Panel args={[W, H, T]} position={[0, 0, D / 2]} color="#9fc6ee" opacity={0.1} glass />
      <Shroud />
    </group>
  )
}
