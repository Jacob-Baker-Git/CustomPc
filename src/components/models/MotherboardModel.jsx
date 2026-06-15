import { RgbBox } from './RgbParts'

// A more detailed ATX board: dark PCB, socket + IHS, VRM/chipset/M.2 heatsinks,
// a rear I/O shroud, RAM slots, PCIe slots, and cycling-RGB accents. Modelled in
// the local frame (features on +Y); the assembly stands it vertical.
export default function MotherboardModel() {
  return (
    <group>
      {/* PCB (narrow ATX so there's room for the front fan column) */}
      <mesh>
        <boxGeometry args={[1.8, 0.06, 2.5]} />
        <meshStandardMaterial color="#16171c" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* CPU socket + IHS (upper-centre) */}
      <mesh position={[0, 0.05, -0.55]}>
        <boxGeometry args={[0.62, 0.05, 0.62]} />
        <meshStandardMaterial color="#0b0b0e" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.085, -0.55]}>
        <boxGeometry args={[0.46, 0.04, 0.46]} />
        <meshStandardMaterial color="#c8c8cc" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* VRM heatsinks (above and left of the socket) */}
      <mesh position={[0, 0.12, -1.02]}>
        <boxGeometry args={[0.95, 0.18, 0.26]} />
        <meshStandardMaterial color="#2a2c31" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[-0.62, 0.12, -0.55]}>
        <boxGeometry args={[0.22, 0.18, 0.58]} />
        <meshStandardMaterial color="#2a2c31" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* Rear I/O shroud (top-left) with an RGB strip */}
      <mesh position={[-0.6, 0.14, -1.08]}>
        <boxGeometry args={[0.52, 0.3, 0.3]} />
        <meshStandardMaterial color="#191a1f" metalness={0.6} roughness={0.4} />
      </mesh>
      <RgbBox args={[0.4, 0.035, 0.035]} position={[-0.6, 0.3, -0.93]} phase={0.1} />

      {/* RAM slots (right of socket) */}
      {[0.46, 0.58, 0.7, 0.82].map((x) => (
        <mesh key={x} position={[x, 0.05, -0.45]}>
          <boxGeometry args={[0.035, 0.05, 1.0]} />
          <meshStandardMaterial color="#0b0b0e" />
        </mesh>
      ))}

      {/* PCIe slots (lower) */}
      {[0.2, 0.55].map((z) => (
        <mesh key={z} position={[-0.05, 0.05, z]}>
          <boxGeometry args={[1.0, 0.05, 0.09]} />
          <meshStandardMaterial color="#24252b" />
        </mesh>
      ))}

      {/* M.2 heatsink */}
      <mesh position={[-0.05, 0.07, 0.38]}>
        <boxGeometry args={[0.85, 0.05, 0.16]} />
        <meshStandardMaterial color="#34363c" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Chipset heatsink (lower-right) with an RGB logo */}
      <mesh position={[0.5, 0.08, 0.92]}>
        <boxGeometry args={[0.5, 0.1, 0.5]} />
        <meshStandardMaterial color="#191a1f" metalness={0.7} roughness={0.35} />
      </mesh>
      <RgbBox args={[0.2, 0.02, 0.2]} position={[0.5, 0.14, 0.92]} phase={0.5} />

      {/* 24-pin power header (right edge) */}
      <mesh position={[0.84, 0.08, 0.05]}>
        <boxGeometry args={[0.08, 0.1, 0.5]} />
        <meshStandardMaterial color="#d8d8dc" />
      </mesh>
    </group>
  )
}
