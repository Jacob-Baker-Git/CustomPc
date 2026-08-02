import * as THREE from 'three'
import useBuilderStore from '../../store/useBuilderStore'
import { caseInterior, CASE } from '../../lib/assemblyGeometry'
import { panelApertures, panelStrips } from '../../lib/caseApertures'
import { mm } from '../../lib/pcScale'

// Shell dimensions come from the same interior geometry the parts are placed
// in, so the case always contains what it's supposed to contain.
const inner = caseInterior()
const W = inner.max[0] - inner.min[0]  // front-to-back
const H = inner.max[1] - inner.min[1]  // height
const D = inner.max[2] - inner.min[2]  // side-to-side
const T = mm(CASE.panelMm)             // panel thickness

// Panels sit OUTSIDE the interior, touching it. Centring them on the interior
// boundary (at +-W/2) put half of every panel inside the volume, which shrank
// the usable interior by T on each axis and left wall-mounted fans overlapping
// their panel by T/2. Offsetting by half a thickness makes caseInterior() mean
// exactly what it says.
const OX = (W + T) / 2
const OY = (H + T) / 2
const OZ = (D + T) / 2

// Cut-outs in each panel's own frame. End walls are indexed on (Y, Z); the roof
// on (X, Z).
const APERTURES = panelApertures()

const GRILLE_PITCH = mm(16)
const GRILLE_BAR = mm(3)

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

// Slats across a cut-out, standing just proud of the panel's outer face so
// there are no coplanar surfaces to z-fight with whatever sits in the hole.
// Only vented holes get them — you don't put bars over the USB ports.
function Slats({ holes, axis, offset, sign }) {
  // `hi` is part of the key because these are flatMapped into ONE sibling list:
  // every vented hole restarts `i` at 0, so a panel with three fan cut-outs
  // emitted fan0..fanN three times over. React logged a duplicate-key error on
  // every frame and is free to drop or reorder the duplicates.
  return holes.filter((h) => h.kind === 'fan' || h.kind === 'radiator').flatMap((h, hi) => {
    const span = h.a1 - h.a0
    const count = Math.max(1, Math.round(span / GRILLE_PITCH) - 1)
    const step = span / (count + 1)
    const midB = (h.b0 + h.b1) / 2
    const depth = h.b1 - h.b0
    return Array.from({ length: count }).map((_, i) => {
      const a = h.a0 + step * (i + 1)
      const at = offset + sign * (T / 2 + GRILLE_BAR / 2)
      // axis 0 = roof (bars run across Z, stepped along X); 1 = end wall.
      const position = axis === 0 ? [a, at, midB] : [at, a, midB]
      const args = axis === 0 ? [GRILLE_BAR, GRILLE_BAR, depth] : [GRILLE_BAR, GRILLE_BAR, depth]
      return <Panel key={`${h.kind}${hi}-${i}`} args={args} position={position} color="#2a2d34" />
    })
  })
}

// A panel built as solid rectangles around its cut-outs, so parts sit IN holes
// rather than against blank metal. It used to be one solid box per wall with a
// hand-placed decorative grille painted on top — which is why the fans looked
// glued on, the USB ports faced sheet steel and the PSU's mains lead had
// nowhere to go.
function CutPanel({ holes, axis, offset, thickness, aSize, bSize, color }) {
  const strips = panelStrips(holes, aSize, bSize)
  return (
    <group>
      {strips.map((s, i) => {
        const a = (s.a0 + s.a1) / 2
        const b = (s.b0 + s.b1) / 2
        const aLen = s.a1 - s.a0
        const bLen = s.b1 - s.b0
        const position = axis === 0 ? [a, offset, b] : [offset, a, b]
        const args = axis === 0 ? [aLen, thickness, bLen] : [thickness, aLen, bLen]
        return <Panel key={i} args={args} position={position} color={color} />
      })}
    </group>
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

  // Solid mode: 5 opaque metal panels + 1 tinted tempered-glass side window.
  return (
    <group>
      <Panel args={[W, T, D]} position={[0, -OY, 0]} color="#1a1c21" />  {/* bottom */}

      {/* roof, cut and slatted over the AIO radiator */}
      <CutPanel holes={APERTURES.top} axis={0} offset={OY} thickness={T} aSize={W} bSize={D} color="#1a1c21" />
      <Slats holes={APERTURES.top} axis={0} offset={OY} sign={1} />

      {/* front intake column */}
      <CutPanel holes={APERTURES.front} axis={1} offset={OX} thickness={T} aSize={H} bSize={D} color="#22242a" />
      <Slats holes={APERTURES.front} axis={1} offset={OX} sign={1} />

      {/* rear: exhaust fan, the board's I/O stack and the PSU's socket */}
      <CutPanel holes={APERTURES.rear} axis={1} offset={-OX} thickness={T} aSize={H} bSize={D} color="#22242a" />
      <Slats holes={APERTURES.rear} axis={1} offset={-OX} sign={-1} />

      <Panel args={[W, H, T]} position={[0, 0, -OZ]} color="#15171c" />  {/* mobo tray side */}

      {/* tempered-glass side window — the build is visible through it */}
      <Panel args={[W, H, T]} position={[0, 0, OZ]} color="#87b3dd" opacity={0.16} glass />
    </group>
  )
}
