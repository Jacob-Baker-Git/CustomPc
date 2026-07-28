import { Suspense } from 'react'
import { MODEL_REGISTRY } from './models/partModelRegistry'
import { GLTF_MODELS } from '../lib/gltfModels'
import GltfPart from './models/GltfPart'
import ModelErrorBoundary from './models/ModelErrorBoundary'
import { assemblyLayout } from '../lib/assemblyLayout'
import { partLocalSize } from '../lib/assemblyGeometry'
import useBuilderStore from '../store/useBuilderStore'

// A little larger than the part, so the shell reads as a glow around it rather
// than z-fighting with the surface.
const HIGHLIGHT_INFLATE = 1.08

export default function PartModel({ part, selectedParts }) {
  const hovered = useBuilderStore((s) => s.hoveredCategory) === part.category

  // Fans are rendered by FanSystem (mounts + empty slots), not per-part here.
  if (part.category === 'fans' || part.category === 'paste') return null

  const ModelComponent = MODEL_REGISTRY[part.category]
  const { position, rotation } = assemblyLayout(part.category, selectedParts)
  const gltf = GLTF_MODELS[part.category]

  // Derived from the same measured model dimensions that place the part, so it
  // can't drift out of step with the assembly the way hand-tuned constants did.
  const localSize = partLocalSize(part.category)
  const highlightSize = localSize && localSize.map((v) => v * HIGHLIGHT_INFLATE)

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
      {hovered && highlightSize && (
        <mesh>
          <boxGeometry args={highlightSize} />
          <meshBasicMaterial color="#F26B3A" transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
