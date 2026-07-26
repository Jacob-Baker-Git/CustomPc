import { PART_SPECS } from './partSpecs'
import { modelScale } from './assemblyGeometry'
import { mm } from './pcScale'
import { MOUNTS } from './mountPoints'

// Categories backed by a real GLB in /public/models. Size and orientation come
// from PART_SPECS so the render and the geometry tests can never disagree. Any
// category missing here keeps its procedural model, and a GLB that fails to load
// falls back to the primitive — so adding an entry is always safe.
const FILES = {
  motherboard: 'motherboard.glb',
  gpu: 'gpu.glb',
  cooler: 'cooler.glb',
  ram: 'ram.glb',
  storage: 'storage.glb',
  psu: 'psu.glb',
}

// Two DIMMs, spaced along the board's front-to-back axis by the slot pitch.
const ramOffsets = () => {
  const half = mm(MOUNTS.ram.pitchMm) / 2
  return [[-half, 0, 0], [half, 0, 0]]
}

export const GLTF_MODELS = Object.fromEntries(
  Object.entries(FILES).map(([cat, file]) => {
    const spec = PART_SPECS[cat]
    return [cat, {
      url: `/models/${file}`,
      // GltfPart scales by the mesh's largest raw dimension, so hand it the
      // world size of that same axis.
      targetSize: Math.max(...spec.raw) * modelScale(cat),
      rotation: spec.rotation,
      position: [0, 0, 0],
      ...(cat === 'ram' ? { instances: ramOffsets() } : {}),
    }]
  })
)
