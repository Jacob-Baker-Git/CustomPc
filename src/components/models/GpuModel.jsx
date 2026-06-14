export default function GpuModel() {
  return (
    <group>
      {/* shroud body */}
      <mesh>
        <boxGeometry args={[2.0, 0.25, 0.9]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* two fans */}
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.05, 24]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}
      {/* backplate */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[2.0, 0.03, 0.9]} />
        <meshStandardMaterial color="#444444" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}
