// All transforms are relative to the motherboard anchored at the origin.
// The board lies flat: PCB in the XZ plane, components facing up (+Y).

const MOUNTED = {
  // Board anchored at origin, stood up vertical; components face the viewer (+Z).
  motherboard: { position: [0, 0, 0],       rotation: [Math.PI / 2, 0, 0] },
  // Mounted on the board face, just in front of it, sharing its vertical rotation.
  cpu:         { position: [0, 0.4, 0.1],    rotation: [Math.PI / 2, 0, 0] },
  cooler:      { position: [0, 0.4, 0.4],    rotation: [Math.PI / 2, 0, 0] },
  ram:         { position: [0.7, 0.4, 0.1],  rotation: [0, Math.PI / 2, 0] },
  storage:     { position: [-0.7, 0.0, 0.1], rotation: [Math.PI / 2, 0, 0] },
  // Horizontal graphics card in the lower PCIe slot, extending toward the front.
  gpu:         { position: [0, -0.35, 0.5],  rotation: [0, 0, 0] },
  // Power supply in the bottom basement of the case.
  psu:         { position: [0, -1.15, 0.0],  rotation: [0, 0, 0] },
  case:        { position: [0, 0, 0],        rotation: [0, 0, 0] },
  // Intake fans at the front of the case, facing the viewer.
  fans:        { position: [0, 0, 1.35],     rotation: [0, 0, 0] },
}

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
  if (category === 'motherboard') return MOUNTED.motherboard

  const hasMotherboard = Boolean(selectedParts && selectedParts.motherboard)
  if (!hasMotherboard) {
    const position = FALLBACK[category]
    return position ? { position, rotation: [0, 0, 0] } : DEFAULT_TRANSFORM
  }

  return MOUNTED[category] ?? DEFAULT_TRANSFORM
}
