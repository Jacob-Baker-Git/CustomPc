export default function PsuModel() {
  return (
    <group>
      {/* PSU body — sits flat: wider than tall, like a real ATX unit */}
      <mesh>
        <boxGeometry args={[0.95, 0.48, 0.72]} />
        <meshStandardMaterial color="#161618" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* intake fan grille on top */}
      <mesh position={[0, 0.245, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 24]} />
        <meshStandardMaterial color="#2b2b30" metalness={0.5} roughness={0.6} />
      </mesh>
      {/* label patch on the window-facing side */}
      <mesh position={[0, 0, 0.37]}>
        <boxGeometry args={[0.5, 0.3, 0.01]} />
        <meshStandardMaterial color="#3a3a40" metalness={0.3} roughness={0.7} />
      </mesh>
    </group>
  )
}
