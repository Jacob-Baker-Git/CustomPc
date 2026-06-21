import { MODEL_REGISTRY } from './models/partModelRegistry'
import { assemblyLayout } from '../lib/assemblyLayout'

export default function PartModel({ part, selectedParts }) {
  // Fans are rendered by FanSystem (mounts + empty slots), not per-part here.
  if (part.category === 'fans' || part.category === 'paste') return null

  const ModelComponent = MODEL_REGISTRY[part.category]
  const { position, rotation } = assemblyLayout(part.category, selectedParts)

  return (
    <group position={position} rotation={rotation}>
      {ModelComponent ? (
        <ModelComponent part={part} />
      ) : (
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
        </mesh>
      )}
    </group>
  )
}
