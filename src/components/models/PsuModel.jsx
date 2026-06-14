export default function PsuModel() {
  return (
    <group>
      {/* PSU box */}
      <mesh>
        <boxGeometry args={[1.0, 0.55, 0.7]} />
        <meshStandardMaterial color="#1c1c1c" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* fan grille on top */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 24]} />
        <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  )
}
