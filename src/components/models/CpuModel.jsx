export default function CpuModel() {
  return (
    <group>
      {/* substrate */}
      <mesh>
        <boxGeometry args={[0.5, 0.03, 0.5]} />
        <meshStandardMaterial color="#0b3d2e" />
      </mesh>
      {/* integrated heat spreader (IHS) */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.38, 0.05, 0.38]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  )
}
