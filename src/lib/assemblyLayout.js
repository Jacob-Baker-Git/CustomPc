// All transforms are relative to the motherboard anchored at the origin.
// The board lies flat: PCB in the XZ plane, components facing up (+Y).

const MOUNTED = {
  motherboard: { position: [0, 0, 0],        rotation: [0, 0, 0] },
  cpu:         { position: [0, 0.09, -0.5],   rotation: [0, 0, 0] },
  cooler:      { position: [0, 0.35, -0.5],   rotation: [0, 0, 0] },
  ram:         { position: [0.75, 0.3, -0.4], rotation: [0, 0, 0] },
  gpu:         { position: [0, 0.22, 0.55],   rotation: [0, 0, 0] },
  storage:     { position: [-0.5, 0.06, 0.2], rotation: [0, 0, 0] },
  psu:         { position: [0, -1.1, -0.6],   rotation: [0, 0, 0] },
  case:        { position: [0, -0.3, 0],      rotation: [0, 0, 0] },
  fans:        { position: [0, 0.7, 1.25],    rotation: [0, 0, 0] },
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
