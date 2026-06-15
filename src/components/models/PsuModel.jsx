export default function PsuModel() {
  return (
    <group>
      {/* PSU box — fairly cubey */}
      <mesh>
        <boxGeometry args={[0.8, 0.7, 0.7]} />
        <meshStandardMaterial color="#1c1c1c" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* fan grille on the side facing the window (+Z) */}
      <mesh position={[0, 0, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.02, 24]} />
        <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  )
}
