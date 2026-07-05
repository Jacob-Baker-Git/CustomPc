import { RgbBox } from './RgbParts'

// A detailed ATX board at the original footprint (2.4 x 2.4): green PCB, socket +
// IHS, VRM/chipset/M.2 heatsinks, a rear I/O shroud, RAM/PCIe slots, and
// cycling-RGB accents. Modelled in the local frame (features on +Y); the
// assembly stands it vertical.
export default function MotherboardModel() {
  return (
    <group>
      {/* PCB — dark blue-grey like modern boards; light enough to read as a board */}
      <mesh>
        <boxGeometry args={[2.4, 0.06, 2.4]} />
        <meshStandardMaterial color="#1c2029" metalness={0.25} roughness={0.7} />
      </mesh>

      {/* CPU socket + IHS (upper-centre) */}
      <mesh position={[0, 0.05, -0.5]}>
        <boxGeometry args={[0.64, 0.05, 0.64]} />
        <meshStandardMaterial color="#0b0b0e" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.085, -0.5]}>
        <boxGeometry args={[0.48, 0.04, 0.48]} />
        <meshStandardMaterial color="#c8c8cc" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* VRM heatsinks (above and left of the socket) */}
      <mesh position={[0, 0.12, -1.0]}>
        <boxGeometry args={[1.1, 0.18, 0.28]} />
        <meshStandardMaterial color="#2a2c31" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[-0.7, 0.12, -0.5]}>
        <boxGeometry args={[0.26, 0.18, 0.62]} />
        <meshStandardMaterial color="#2a2c31" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* Rear I/O shroud (top-left) with an RGB strip */}
      <mesh position={[-0.78, 0.14, -1.05]}>
        <boxGeometry args={[0.6, 0.3, 0.32]} />
        <meshStandardMaterial color="#191a1f" metalness={0.6} roughness={0.4} />
      </mesh>
      <RgbBox args={[0.5, 0.04, 0.04]} position={[-0.78, 0.31, -0.9]} phase={0.1} />

      {/* RAM slots (right of socket) */}
      {[0.55, 0.7, 0.85, 1.0].map((x) => (
        <mesh key={x} position={[x, 0.05, -0.4]}>
          <boxGeometry args={[0.04, 0.05, 1.0]} />
          <meshStandardMaterial color="#0b0b0e" />
        </mesh>
      ))}

      {/* PCIe slots (lower) */}
      {[0.25, 0.65].map((z) => (
        <mesh key={z} position={[-0.1, 0.05, z]}>
          <boxGeometry args={[1.3, 0.05, 0.1]} />
          <meshStandardMaterial color="#24252b" />
        </mesh>
      ))}

      {/* M.2 heatsink */}
      <mesh position={[-0.1, 0.07, 0.46]}>
        <boxGeometry args={[1.1, 0.05, 0.16]} />
        <meshStandardMaterial color="#34363c" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Chipset heatsink (lower-right) with an RGB logo */}
      <mesh position={[0.65, 0.08, 0.95]}>
        <boxGeometry args={[0.55, 0.1, 0.55]} />
        <meshStandardMaterial color="#191a1f" metalness={0.7} roughness={0.35} />
      </mesh>
      <RgbBox args={[0.22, 0.02, 0.22]} position={[0.65, 0.14, 0.95]} phase={0.5} />

      {/* 24-pin power header (right edge) */}
      <mesh position={[1.05, 0.08, 0.1]}>
        <boxGeometry args={[0.08, 0.1, 0.5]} />
        <meshStandardMaterial color="#d8d8dc" />
      </mesh>
    </group>
  )
}
