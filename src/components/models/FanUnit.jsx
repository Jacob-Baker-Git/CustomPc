// A single fan unit (white frame + glowing RGB ring + hub + blades) and an
// empty fan slot (a bare square mount frame). Both are modelled facing +Z so a
// mount's rotation can aim them at the right wall.

export function Fan({ glow = '#22d3ee' }) {
  return (
    <group>
      {/* white frame */}
      <mesh>
        <boxGeometry args={[0.6, 0.6, 0.12]} />
        <meshStandardMaterial color="#e8e8ec" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* glowing RGB ring */}
      <mesh position={[0, 0, 0.065]}>
        <torusGeometry args={[0.25, 0.025, 10, 36]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      {/* hub */}
      <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 20]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {/* blades */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[0, 0, 0.05]} rotation={[0, 0, (i / 7) * Math.PI * 2]}>
          <boxGeometry args={[0.22, 0.08, 0.02]} />
          <meshStandardMaterial color="#f0f0f3" metalness={0.2} roughness={0.5} />
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
      <meshStandardMaterial color="#363a42" metalness={0.3} roughness={0.7} />
    </mesh>
  )
}

export function EmptyFanSlot() {
  return (
    <group>
      <SlotBar position={[0, SLOT / 2, 0]} args={[SLOT, BAR, BAR]} />
      <SlotBar position={[0, -SLOT / 2, 0]} args={[SLOT, BAR, BAR]} />
      <SlotBar position={[SLOT / 2, 0, 0]} args={[BAR, SLOT, BAR]} />
      <SlotBar position={[-SLOT / 2, 0, 0]} args={[BAR, SLOT, BAR]} />
    </group>
  )
}
