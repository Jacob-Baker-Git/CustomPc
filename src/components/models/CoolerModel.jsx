import { RgbRing } from './RgbParts'

// AIO-style CPU cooler: a round pump block sitting on the CPU with a cycling
// RGB ring, like the coolers in the reference builds. Modelled so its round
// face points toward the glass once the assembly rotation is applied.
export default function CoolerModel() {
  return (
    <group>
      {/* mounting plate on the CPU */}
      <mesh>
        <boxGeometry args={[0.5, 0.12, 0.5]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* round pump block */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.18, 32]} />
        <meshStandardMaterial color="#15151a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* cycling RGB ring on the pump face */}
      <RgbRing radius={0.24} tube={0.028} phase={0.6} position={[0, 0.23, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {/* infinity-mirror centre cap */}
      <mesh position={[0, 0.23, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 28]} />
        <meshStandardMaterial color="#0c0c10" metalness={0.5} roughness={0.4} emissive="#3a0d2a" emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      {/* two AIO tubes curving away toward the radiator */}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, 0.18, -0.28]} rotation={[Math.PI / 2.4, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.5, 12]} />
          <meshStandardMaterial color="#0d0d0d" metalness={0.2} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}
