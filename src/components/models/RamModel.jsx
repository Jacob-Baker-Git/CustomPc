export default function RamModel() {
  return (
    <group>
      {[-0.08, 0.08].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {/* PCB */}
          <mesh>
            <boxGeometry args={[0.04, 0.5, 0.9]} />
            <meshStandardMaterial color="#0b3d2e" />
          </mesh>
          {/* heatspreader */}
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.05, 0.35, 0.85]} />
            <meshStandardMaterial color="#b00000" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
