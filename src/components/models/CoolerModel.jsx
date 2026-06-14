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
      {/* fan on the front face */}
      <mesh position={[0, 0.45, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.08, 24]} />
        <meshStandardMaterial color="#222222" metalness={0.4} roughness={0.6} />
      </mesh>
    </group>
  )
}
