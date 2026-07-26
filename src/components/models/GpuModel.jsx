import { RgbRing, RgbBox } from './RgbParts'

// Modelled the way a real card looks through a side window: a chunky 2.5-slot
// shroud, a brushed backplate on top (the face you actually see), an RGB accent
// bar along the front edge, and axial fans on the underside blowing down.
export default function GpuModel() {
  return (
    <group>
      {/* main shroud body — thick, like a real 2.5-slot card (not a thin plank) */}
      <mesh castShadow>
        <boxGeometry args={[2.05, 0.42, 0.92]} />
        <meshStandardMaterial color="#202228" metalness={0.55} roughness={0.45} envMapIntensity={1.1} />
      </mesh>

      {/* brushed-metal backplate on top — the surface seen through the glass */}
      <mesh position={[0, 0.225, 0]}>
        <boxGeometry args={[2.08, 0.05, 0.95]} />
        <meshStandardMaterial color="#191b20" metalness={0.85} roughness={0.3} envMapIntensity={1.3} />
      </mesh>
      {/* recessed brand plate on the backplate */}
      <mesh position={[0.4, 0.255, 0]}>
        <boxGeometry args={[0.66, 0.02, 0.48]} />
        <meshStandardMaterial color="#0e0f12" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* subtle vent cut-outs on the backplate */}
      {[-0.75, -0.55, -0.35].map((x) => (
        <mesh key={x} position={[x, 0.255, 0]}>
          <boxGeometry args={[0.06, 0.02, 0.6]} />
          <meshStandardMaterial color="#0b0c0f" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}

      {/* prominent RGB accent bar along the top front edge (the lit logo strip) */}
      <RgbBox args={[1.92, 0.07, 0.03]} position={[0, 0.14, 0.475]} phase={0.2} />
      {/* etched model-name bar just below the RGB */}
      <mesh position={[0, -0.02, 0.465]}>
        <boxGeometry args={[1.5, 0.06, 0.02]} />
        <meshStandardMaterial color="#2b2d34" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* two axial fans on the underside, rings facing down */}
      {[-0.52, 0.52].map((x, i) => (
        <group key={x} position={[x, -0.2, 0.02]}>
          {/* fan housing */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.08, 28]} />
            <meshStandardMaterial color="#26282e" metalness={0.4} roughness={0.5} />
          </mesh>
          {/* hub */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.09, 20]} />
            <meshStandardMaterial color="#0e0f12" metalness={0.5} roughness={0.5} />
          </mesh>
          <RgbRing radius={0.3} tube={0.022} phase={0.3 + i * 0.2} position={[0, -0.045, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
    </group>
  )
}
