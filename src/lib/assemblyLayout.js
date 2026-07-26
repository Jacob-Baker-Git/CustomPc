// All transforms are relative to the motherboard anchored at the origin.
// The board stands VERTICAL (PCB in the XY plane), components facing the viewer (+Z).

import { partCentre, caseInterior } from './assemblyGeometry'
import { PART_SPECS } from './partSpecs'

// Positions come from assemblyGeometry so the render matches what the geometry
// tests prove. Rotation is the part's model rotation — PART_SPECS already
// orients each mesh into scene convention, so there is no second rotation to
// compose here.
const MOUNTED_CATEGORIES = ['motherboard', 'cpu', 'cooler', 'ram', 'storage', 'gpu', 'psu']

const mountedTransform = (category) => ({
  position: partCentre(category),
  rotation: PART_SPECS[category]?.rotation ?? [0, 0, 0],
})

// Standalone positions used until a motherboard exists to mount onto.
const FALLBACK = {
  motherboard: [0, 0, 0],
  cpu:     [0, 0, 0],
  cooler:  [0, 1.2, 0],
  ram:     [1.4, 0, 0],
  gpu:     [0, -1.4, 0],
  storage: [-1.4, 0, 0],
  psu:     [0, -2.4, 0],
  case:    [0, 0, 0],
  fans:    [1.4, 1.2, 0],
}

const DEFAULT_TRANSFORM = { position: [0, 0, 0], rotation: [0, 0, 0] }

export function assemblyLayout(category, selectedParts = {}) {
  if (category === 'motherboard') return mountedTransform('motherboard')

  const hasMotherboard = Boolean(selectedParts && selectedParts.motherboard)
  if (!hasMotherboard) {
    const position = FALLBACK[category]
    return position ? { position, rotation: [0, 0, 0] } : DEFAULT_TRANSFORM
  }

  if (MOUNTED_CATEGORIES.includes(category)) return mountedTransform(category)

  if (category === 'case') {
    const inner = caseInterior()
    return {
      position: inner.min.map((v, i) => (v + inner.max[i]) / 2),
      rotation: [0, 0, 0],
    }
  }

  if (category === 'fans') return { position: [0, 1.55, 0.05], rotation: [0, 0, 0] }

  return DEFAULT_TRANSFORM
}
