import { PART_SPECS } from './partSpecs'
import { modelScale, meshLocalSize, bodyShiftLocal } from './assemblyGeometry'
import { mm } from './pcScale'
import { MOUNTS } from './mountPoints'

// Categories backed by a real GLB in /public/models. Size and orientation come
// from PART_SPECS so the render and the geometry tests can never disagree. Any
// category missing here keeps its procedural model, and a GLB that fails to load
// falls back to the primitive — so adding an entry is always safe.
const FILES = {
  motherboard: 'motherboard.glb',
  cpu: 'cpu.glb',
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
      // GltfPart fits the WHOLE mesh's bounding box, so both branches hand over
      // whole-mesh sizes — `meshLocalSize`, not `partLocalSize`. Handing it the
      // body's size instead would shrink the mesh until the *body* was smaller
      // than intended by however much stray geometry the box carries.
      targetSize: spec.sizeMm ? meshLocalSize(cat) : Math.max(...spec.raw) * modelScale(cat),
      // Nodes that draw geometry belonging to no real component. Hidden after the
      // fit is measured, so the scale still derives from `raw` exactly.
      ...(spec.hideNodes ? { hideNodes: spec.hideNodes } : {}),
      // Deliberately NO rotation here. PartModel's placement group already
      // applies spec.rotation (via assemblyLayout), and it has to — the
      // procedural fallback models and the hover highlight live in that same
      // group and are authored in mesh convention. Passing it here too rotated
      // every GLB twice: the board's PI/2 became PI, laying it flat, while
      // assemblyGeometry kept rotating once and "proving" a scene that never
      // rendered. Covered by assemblyRenderRotation.test.js.
      // Shifts the mesh so its functional body — not its bounding box — sits on
      // the group origin, which is the point MOUNTS measures from. Zero for every
      // part whose mesh is the component.
      position: bodyShiftLocal(cat),
      ...(cat === 'ram' ? { instances: ramOffsets() } : {}),
    }]
  })
)
