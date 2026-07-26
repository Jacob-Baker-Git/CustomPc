import { RgbRing } from './RgbParts'
import { mm, FAN_MM } from '../../lib/pcScale'

// A single fan unit (dark frame + cycling RGB ring + hub + blades) and an empty
// fan slot (a bare square mount frame). Both face +Z so a mount's rotation can
// aim them at the right wall.

// Both the fan and the empty slot are authored 0.6 units across. Scale them to a
// real 120 mm fan so they match the rest of the scene, which is now built to a
// single physical scale. Authoring proportions stay untouched.
const FAN_SCALE = mm(FAN_MM) / 0.6

export function Fan({ phase = 0 }) {
  return (
    <group scale={FAN_SCALE}>
      {/* frame */}
      <mesh>
        <boxGeometry args={[0.6, 0.6, 0.12]} />
        <meshStandardMaterial color="#23252b" metalness={0.4} roughness={0.55} />
      </mesh>
      {/* cycling RGB ring */}
      <RgbRing radius={0.25} tube={0.028} phase={phase} position={[0, 0, 0.065]} />
      {/* hub */}
      <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 20]} />
        <meshStandardMaterial color="#222226" />
      </mesh>
      {/* blades */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[0, 0, 0.05]} rotation={[0, 0, (i / 7) * Math.PI * 2]}>
          <boxGeometry args={[0.22, 0.08, 0.02]} />
          <meshStandardMaterial color="#2b2b30" metalness={0.2} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// An empty mount: a square frame outline showing where a fan would go.
const SLOT = 0.58 // outer size
const BAR = 0.04  // bar thickness

function SlotBar({ position, args }) {
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshStandardMaterial color="#3a3f47" metalness={0.3} roughness={0.7} />
    </mesh>
  )
}

export function EmptyFanSlot() {
  return (
    <group scale={FAN_SCALE}>
      <SlotBar position={[0, SLOT / 2, 0]} args={[SLOT, BAR, BAR]} />
      <SlotBar position={[0, -SLOT / 2, 0]} args={[SLOT, BAR, BAR]} />
      <SlotBar position={[SLOT / 2, 0, 0]} args={[BAR, SLOT, BAR]} />
      <SlotBar position={[-SLOT / 2, 0, 0]} args={[BAR, SLOT, BAR]} />
    </group>
  )
}
