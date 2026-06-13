export default function MotherboardModel() {
  return (
    <group>
      {/* PCB */}
      <mesh>
        <boxGeometry args={[2.4, 0.06, 2.4]} />
        <meshStandardMaterial color="#0f5132" metalness={0.2} roughness={0.7} />
      </mesh>
      {/* CPU socket */}
      <mesh position={[0, 0.05, -0.5]}>
        <boxGeometry args={[0.55, 0.04, 0.55]} />
        <meshStandardMaterial color="#222" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* RAM slots */}
      {[0.55, 0.7, 0.85, 1.0].map((x) => (
        <mesh key={x} position={[x, 0.05, -0.4]}>
          <boxGeometry args={[0.05, 0.05, 1.0]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}
      {/* PCIe slot */}
      <mesh position={[0, 0.05, 0.3]}>
        <boxGeometry args={[1.4, 0.05, 0.12]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      {/* Chipset heatsink */}
      <mesh position={[0.2, 0.07, 0.7]}>
        <boxGeometry args={[0.5, 0.08, 0.5]} />
        <meshStandardMaterial color="#444" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Rear I/O shroud */}
      <mesh position={[-0.9, 0.12, -1.0]}>
        <boxGeometry args={[0.5, 0.25, 0.3]} />
        <meshStandardMaterial color="#555" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* 24-pin power connector */}
      <mesh position={[1.1, 0.08, 0.2]}>
        <boxGeometry args={[0.12, 0.1, 0.5]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>
    </group>
  )
}
