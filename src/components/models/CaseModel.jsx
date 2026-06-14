import useBuilderStore from '../../store/useBuilderStore'

export default function CaseModel() {
  const transparent = useBuilderStore((s) => s.caseTransparent)

  return (
    <group>
      <mesh>
        <boxGeometry args={[3.2, 3.0, 3.2]} />
        <meshStandardMaterial
          color={transparent ? '#88aadd' : '#2b2f36'}
          transparent
          opacity={transparent ? 0.12 : 0.95}
          metalness={0.4}
          roughness={transparent ? 0.1 : 0.5}
          side={2}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[3.2, 3.0, 3.2]} />
        <meshBasicMaterial color="#5577aa" wireframe />
      </mesh>
    </group>
  )
}
