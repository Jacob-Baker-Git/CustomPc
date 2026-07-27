import { Suspense } from 'react'
import GltfPart from './GltfPart'
import ModelErrorBoundary from './ModelErrorBoundary'
import { mm, FAN_MM } from '../../lib/pcScale'

// A single case fan and an empty fan slot. Both face +Z so a mount's rotation
// can aim them at the right wall (see fanMounts.js).

// The real fan mesh is square across X/Y with the 120 mm frame as its largest
// dimension, so handing GltfPart the world size of that axis scales the whole
// model correctly — no measured constant to drift. Verified by modelBounds.test.js.
const FAN_URL = '/models/fan.glb'

// Deliberately unlit: the model is a plain black fan and stays that way. The
// glowing RGB ring that used to sit here read as a neon torus next to the real
// GPU and cooler meshes, which is the opposite of what the 3D view is for.
export function Fan() {
  return (
    <ModelErrorBoundary fallback={<ProceduralFan />}>
      <Suspense fallback={<ProceduralFan />}>
        <GltfPart url={FAN_URL} targetSize={mm(FAN_MM)} />
      </Suspense>
    </ModelErrorBoundary>
  )
}

// Fallback for a missing/broken fan model. Authored 0.6 units across and scaled
// to a real 120 mm like everything else in the scene.
const FAN_SCALE = mm(FAN_MM) / 0.6

function ProceduralFan() {
  return (
    <group scale={FAN_SCALE}>
      {/* frame */}
      <mesh>
        <boxGeometry args={[0.6, 0.6, 0.12]} />
        <meshStandardMaterial color="#23252b" metalness={0.4} roughness={0.55} />
      </mesh>
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
