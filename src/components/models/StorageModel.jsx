export default function StorageModel() {
  return (
    <group>
      {/* M.2 PCB */}
      <mesh>
        <boxGeometry args={[0.7, 0.03, 0.18]} />
        <meshStandardMaterial color="#0b3d2e" />
      </mesh>
      {/* controller + NAND chips */}
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} position={[x, 0.03, 0]}>
          <boxGeometry args={[0.18, 0.03, 0.14]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      ))}
    </group>
  )
}
