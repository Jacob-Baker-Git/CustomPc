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

// `overrides` (see partOverrides) carries the selected part's real dimensions.
// The mesh has to be stretched by exactly the figure assemblyGeometry placed the
// part with, so this asks the geometry for it rather than recomputing — a mesh
// drawn one length while the mounts, cable ends and collision boxes were solved
// for another is the single bug this scene has produced most often.
function descriptorFor(cat, file, overrides) {
  const spec = PART_SPECS[cat]
  // A uniform fit stays a scalar so nothing about the untouched parts changes;
  // an overridden part needs all three axes, because only one of them moved.
  const stretched = overrides?.[cat] !== undefined
  return {
    url: `/models/${file}`,
    // GltfPart fits the WHOLE mesh's bounding box, so every branch hands over
    // whole-mesh sizes — `meshLocalSize`, not `partLocalSize`. Handing it the
    // body's size instead would shrink the mesh until the *body* was smaller
    // than intended by however much stray geometry the box carries.
    targetSize: spec.sizeMm || stretched
      ? meshLocalSize(cat, overrides)
      : Math.max(...spec.raw) * modelScale(cat),
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
    position: bodyShiftLocal(cat, overrides),
    ...(cat === 'ram' ? { instances: ramOffsets() } : {}),
  }
}

// The default map, with every part at its spec's own size. Still the whole story
// for six of the seven meshes — only the graphics card has a real dimension in
// the catalogue that varies per part.
export const GLTF_MODELS = Object.fromEntries(
  Object.entries(FILES).map(([cat, file]) => [cat, descriptorFor(cat, file, undefined)]),
)

// What the renderer asks for once a part is actually selected. Falls back to the
// shared default descriptor when nothing about this part is overridden, so the
// six untouched meshes keep a stable object identity and GltfPart's useMemo does
// not re-fit them on every render.
export function gltfModelFor(category, overrides) {
  const file = FILES[category]
  if (!file) return undefined
  if (overrides?.[category] === undefined) return GLTF_MODELS[category]
  return descriptorFor(category, file, overrides)
}
