export default function CaseModel() {
  return (
    <group>
      {/* semi-transparent shell */}
      <mesh>
        <boxGeometry args={[3.2, 3.0, 3.2]} />
        <meshStandardMaterial
          color="#88aadd"
          transparent
          opacity={0.12}
          metalness={0.3}
          roughness={0.1}
          side={2}
        />
      </mesh>
      {/* wireframe edges for definition */}
      <mesh>
        <boxGeometry args={[3.2, 3.0, 3.2]} />
        <meshBasicMaterial color="#5577aa" wireframe />
      </mesh>
    </group>
  )
}
