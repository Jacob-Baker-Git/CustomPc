const RAM_GLOW = ['#22d3ee', '#a855f7']

export default function RamModel() {
  return (
    <group>
      {[-0.08, 0.08].map((x, i) => (
        <group key={x} position={[x, 0, 0]}>
          {/* PCB */}
          <mesh>
            <boxGeometry args={[0.04, 0.5, 0.9]} />
            <meshStandardMaterial color="#0b3d2e" />
          </mesh>
          {/* heatspreader */}
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.05, 0.35, 0.85]} />
            <meshStandardMaterial color="#1a1a1f" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* glowing RGB diffuser along the top edge */}
          <mesh position={[0, 0.1, 0.44]}>
            <boxGeometry args={[0.05, 0.34, 0.04]} />
            <meshStandardMaterial color={RAM_GLOW[i]} emissive={RAM_GLOW[i]} emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
