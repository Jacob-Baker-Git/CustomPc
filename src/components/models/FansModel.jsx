// One fan unit (white frame + glowing RGB ring + hub + blades), built around
// its own origin and facing +Z. `glow` sets the ring's emissive colour.
function Fan({ glow = '#22d3ee' }) {
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

// A spread of RGB ring colours so a multi-fan pack reads as an RGB build.
const GLOW = ['#22d3ee', '#a855f7', '#ec4899']

export default function FansModel({ part }) {
  const count = Math.max(1, Math.min(3, part?.specs?.count ?? 1))
  const spacing = 0.66
  const startX = -((count - 1) / 2) * spacing

  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <group key={i} position={[startX + i * spacing, 0, 0]}>
          <Fan glow={GLOW[i % GLOW.length]} />
        </group>
      ))}
    </group>
  )
}
