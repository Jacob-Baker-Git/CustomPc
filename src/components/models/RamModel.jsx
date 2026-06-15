import { RgbBox } from './RgbParts'

export default function RamModel() {
  return (
    <group>
      {[-0.08, 0.08].map((x, i) => (
        <group key={x} position={[x, 0, 0]}>
          {/* PCB */}
          <mesh>
            <boxGeometry args={[0.04, 0.5, 0.9]} />
            <meshStandardMaterial color="#0b0b0e" />
          </mesh>
          {/* heatspreader */}
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.05, 0.35, 0.85]} />
            <meshStandardMaterial color="#1a1a1f" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* cycling RGB diffuser along the top edge */}
          <RgbBox args={[0.05, 0.34, 0.04]} position={[0, 0.1, 0.44]} phase={0.4 + i * 0.25} />
        </group>
      ))}
    </group>
  )
}
