import { RgbRing, RgbBox } from './RgbParts'

export default function GpuModel() {
  return (
    <group>
      {/* shroud body */}
      <mesh>
        <boxGeometry args={[2.0, 0.25, 0.9]} />
        <meshStandardMaterial color="#17181c" metalness={0.5} roughness={0.45} />
      </mesh>
      {/* cycling RGB accent strip along the shroud edge */}
      <RgbBox args={[1.9, 0.04, 0.02]} position={[0, 0.13, 0.46]} phase={0.2} />
      {/* two fans, each with a cycling RGB ring */}
      {[-0.5, 0.5].map((x, i) => (
        <group key={x} position={[x, 0.14, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.05, 24]} />
            <meshStandardMaterial color="#202024" />
          </mesh>
          <RgbRing radius={0.27} tube={0.02} phase={0.3 + i * 0.2} position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
      {/* backplate */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[2.0, 0.03, 0.9]} />
        <meshStandardMaterial color="#101013" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}
