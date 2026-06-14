// One fan unit (frame + hub + blades), built around its own origin.
function Fan() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.6, 0.6, 0.12]} />
        <meshStandardMaterial color="#222222" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 20]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[0, 0, 0.06]} rotation={[0, 0, (i / 7) * Math.PI * 2]}>
          <boxGeometry args={[0.26, 0.08, 0.02]} />
          <meshStandardMaterial color="#5577aa" metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

export default function FansModel({ part }) {
  const count = Math.max(1, Math.min(3, part?.specs?.count ?? 1))
  const spacing = 0.66
  const startX = -((count - 1) / 2) * spacing

  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <group key={i} position={[startX + i * spacing, 0, 0]}>
          <Fan />
        </group>
      ))}
    </group>
  )
}
