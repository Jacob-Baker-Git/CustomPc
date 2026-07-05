import { RgbRing, RgbBox } from './RgbParts'

// Modelled the way a real card hangs from the PCIe slot: backplate on top,
// axial fans on the UNDERSIDE blowing up through the heatsink, RGB accent
// strip along the front (window-facing) edge.
export default function GpuModel() {
  return (
    <group>
      {/* shroud body */}
      <mesh>
        <boxGeometry args={[2.0, 0.25, 0.9]} />
        <meshStandardMaterial color="#23252b" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* cycling RGB accent strip along the front shroud edge */}
      <RgbBox args={[1.9, 0.04, 0.02]} position={[0, -0.02, 0.46]} phase={0.2} />
      {/* two fans on the underside, rings facing down */}
      {[-0.5, 0.5].map((x, i) => (
        <group key={x} position={[x, -0.14, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.05, 24]} />
            <meshStandardMaterial color="#2a2c32" />
          </mesh>
          <RgbRing radius={0.27} tube={0.02} phase={0.3 + i * 0.2} position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
      {/* backplate on top */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[2.0, 0.03, 0.9]} />
        <meshStandardMaterial color="#191b20" metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  )
}
