import { Suspense } from 'react'
import { MODEL_REGISTRY } from './models/partModelRegistry'
import { GLTF_MODELS } from '../lib/gltfModels'
import GltfPart from './models/GltfPart'
import ModelErrorBoundary from './models/ModelErrorBoundary'
import { assemblyLayout } from '../lib/assemblyLayout'
import useBuilderStore from '../store/useBuilderStore'

// Approximate model-local bounds for the hover highlight shell per category.
const HIGHLIGHT_SIZE = {
  motherboard: [2.6, 0.5, 2.6],
  cpu:         [0.8, 0.25, 0.8],
  cooler:      [1.0, 0.6, 1.0],
  ram:         [0.35, 0.7, 1.05],
  gpu:         [2.15, 0.5, 1.05],
  storage:     [0.95, 0.3, 1.05],
  psu:         [1.15, 0.7, 0.9],
  case:        [3.15, 3.85, 1.35],
}

export default function PartModel({ part, selectedParts }) {
  const hovered = useBuilderStore((s) => s.hoveredCategory) === part.category

  // Fans are rendered by FanSystem (mounts + empty slots), not per-part here.
  if (part.category === 'fans' || part.category === 'paste') return null

  const ModelComponent = MODEL_REGISTRY[part.category]
  const { position, rotation } = assemblyLayout(part.category, selectedParts)
  const gltf = GLTF_MODELS[part.category]

  // The procedural (primitive) model — also the fallback when a GLTF is missing
  // or fails to load.
  const primitive = ModelComponent ? (
    <ModelComponent part={part} />
  ) : (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
    </mesh>
  )

  return (
    <group position={position} rotation={rotation}>
      {gltf ? (
        <ModelErrorBoundary fallback={primitive}>
          <Suspense fallback={primitive}>
            {gltf.instances
              ? gltf.instances.map((offset, i) => (
                  <GltfPart key={i} {...gltf} position={offset} />
                ))
              : <GltfPart {...gltf} />}
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        primitive
      )}
      {hovered && (
        <mesh>
          <boxGeometry args={HIGHLIGHT_SIZE[part.category] ?? [1, 1, 1]} />
          <meshBasicMaterial color="#F26B3A" transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
