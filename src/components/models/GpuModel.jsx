export default function GpuModel() {
  return (
    <group>
      {/* shroud body */}
      <mesh>
        <boxGeometry args={[2.0, 0.25, 0.9]} />
        <meshStandardMaterial color="#e8e8ec" metalness={0.4} roughness={0.45} />
      </mesh>
      {/* glowing accent strip along the shroud edge */}
      <mesh position={[0, 0.13, 0.46]}>
        <boxGeometry args={[1.9, 0.04, 0.02]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      {/* two fans, each with a glowing RGB ring */}
      {[-0.5, 0.5].map((x) => (
        <group key={x} position={[x, 0.14, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.05, 24]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
          <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.27, 0.02, 8, 32]} />
            <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* backplate */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[2.0, 0.03, 0.9]} />
        <meshStandardMaterial color="#cfd2d7" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}
