export default function CoolerModel() {
  return (
    <group>
      {/* base block over the CPU */}
      <mesh>
        <boxGeometry args={[0.45, 0.1, 0.45]} />
        <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* fin stack */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[0, 0.18 + i * 0.07, 0]}>
          <boxGeometry args={[0.5, 0.02, 0.45]} />
          <meshStandardMaterial color="#bbbbbb" metalness={0.95} roughness={0.15} />
        </mesh>
      ))}
      {/* fan on the front face, with a glowing RGB ring */}
      <mesh position={[0, 0.45, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.08, 24]} />
        <meshStandardMaterial color="#e8e8ec" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.45, 0.37]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.24, 0.02, 8, 32]} />
        <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
    </group>
  )
}
