import { RgbRing } from './RgbParts'

// AIO-style CPU cooler: a square pump block sitting on the CPU with a bright
// RGB-lit round face and an infinity-mirror centre, plus two tubes sweeping off
// toward the radiator. The round face points at the glass once the assembly
// rotation is applied. (The old plain cylinder read as a floating dark ball.)
export default function CoolerModel() {
  return (
    <group>
      {/* CPU cold-plate / mount */}
      <mesh>
        <boxGeometry args={[0.58, 0.12, 0.58]} />
        <meshStandardMaterial color="#161619" metalness={0.6} roughness={0.45} />
      </mesh>
      {/* square pump housing */}
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.5, 0.18, 0.5]} />
        <meshStandardMaterial color="#1a1a20" metalness={0.7} roughness={0.33} envMapIntensity={1.1} />
      </mesh>
      {/* glossy round pump face (points at the glass) */}
      <mesh position={[0, 0.245, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.02, 40]} />
        <meshStandardMaterial color="#0b0b0e" metalness={0.45} roughness={0.25} envMapIntensity={1.2} />
      </mesh>
      {/* RGB ring on the pump face */}
      <RgbRing radius={0.23} tube={0.03} phase={0.6} position={[0, 0.255, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {/* bright infinity-mirror centre so the pump reads as lit, not a dark ball */}
      <mesh position={[0, 0.256, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.014, 32]} />
        <meshStandardMaterial color="#160a16" emissive="#63164a" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      {/* two AIO tubes sweeping away toward the radiator */}
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.16, -0.34]} rotation={[Math.PI / 2.2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.7, 12]} />
          <meshStandardMaterial color="#0c0c0f" metalness={0.2} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}
