import { Suspense } from 'react'
import { MODEL_REGISTRY } from './models/partModelRegistry'
import { GLTF_MODELS } from '../lib/gltfModels'
import GltfPart from './models/GltfPart'
import ModelErrorBoundary from './models/ModelErrorBoundary'
import { assemblyLayout } from '../lib/assemblyLayout'

// Hovering a part in the list used to draw a translucent orange box around it in
// the scene. It was removed on request: an inflated AABB around a non-boxy part
// reads as a smear over the model rather than a highlight of it. The store's
// `hoveredCategory` and CategoryList's hover handlers went with it — they had no
// other reader, and a write-only store field is how the last dead branch hid.
export default function PartModel({ part }) {
  // Fans are rendered by FanSystem (mounts + empty slots), not per-part here.
  if (part.category === 'fans' || part.category === 'paste') return null

  const ModelComponent = MODEL_REGISTRY[part.category]
  const { position, rotation } = assemblyLayout(part.category)
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
    </group>
  )
}
