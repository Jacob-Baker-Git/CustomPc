export default function PsuModel() {
  return (
    <group>
      {/* PSU body — sits flat: wider than tall, like a real ATX unit. All black. */}
      <mesh>
        <boxGeometry args={[0.95, 0.48, 0.72]} />
        <meshStandardMaterial color="#111114" metalness={0.7} roughness={0.45} />
      </mesh>
      {/* intake fan grille, centred on top */}
      <mesh position={[0, 0.245, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 24]} />
        <meshStandardMaterial color="#0c0c0e" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  )
}
