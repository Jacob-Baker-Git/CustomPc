// All transforms are relative to the motherboard anchored at the origin.
// The board stands VERTICAL (PCB in the XY plane), components facing the viewer (+Z).

const MOUNTED = {
  // Board anchored at origin, stood up vertical; components face the viewer (+Z).
  motherboard: { position: [0, 0, 0],         rotation: [Math.PI / 2, 0, 0] },
  // Mounted on the board face, just in front of it, sharing its vertical rotation.
  cpu:         { position: [0, 0.45, 0.12],    rotation: [Math.PI / 2, 0, 0] },
  cooler:      { position: [0, 0.45, 0.38],    rotation: [Math.PI / 2, 0, 0] },
  // Vertical RAM sticks standing side-by-side, to the right of the CPU.
  ram:         { position: [0.75, 0.45, 0.12], rotation: [-Math.PI / 2, 0, 0] },
  storage:     { position: [-0.8, 0.05, 0.12], rotation: [Math.PI / 2, 0, 0] },
  // Horizontal graphics card hanging from the PCIe slot, resting above the
  // PSU shroud and extending toward the front glass.
  gpu:         { position: [0, -0.85, 0.5],   rotation: [0, 0, 0] },
  // Power supply hidden in the basement, beneath the shroud, toward the rear.
  psu:         { position: [0, -1.9, -0.3],   rotation: [0, 0, 0] },
  // Tower shell recentered so the rear wall hugs the board and the glass
  // front clears the build; sits with even headroom.
  case:        { position: [0, -0.1, 0.9],   rotation: [0, 0, 0] },
  // Top-mounted exhaust fans, lying flat (facing up) in a row.
  fans:        { position: [0, 1.55, 0.15],   rotation: [-Math.PI / 2, 0, 0] },
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
