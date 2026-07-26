// All transforms are relative to the motherboard anchored at the origin.
// The board stands VERTICAL (PCB in the XY plane), components facing the viewer (+Z).

const MOUNTED = {
  // Board anchored at origin, stood up vertical; components face the viewer (+Z).
  motherboard: { position: [0, 0, 0],         rotation: [Math.PI / 2, 0, 0] },
  // Mounted on the board face, just in front of it, sharing its vertical rotation.
  cpu:         { position: [0, 0.45, 0.08],    rotation: [Math.PI / 2, 0, 0] },
  cooler:      { position: [0, 0.45, 0.2],     rotation: [Math.PI / 2, 0, 0] },
  // Vertical RAM sticks standing side-by-side, to the right of the CPU.
  ram:         { position: [0.75, 0.45, 0.08], rotation: [-Math.PI / 2, 0, 0] },
  // Flat M.2 stick lying on the board face. The board model is 0.4 deep and
  // centred on the origin, so it fills z -0.2..0.2 — anything at z 0.08 sits
  // buried inside it. Park the stick just clear of the board's front face.
  storage:     { position: [-0.8, 0.05, 0.23], rotation: [Math.PI / 2, 0, 0] },
  // Horizontal graphics card hanging from the PCIe slot toward the glass.
  gpu:         { position: [0, -0.85, 0.28],   rotation: [0, 0, 0] },
  // Power supply sitting flat on the case floor, bottom-left, centred
  // front-to-back in the shell (case spans z -0.25..0.95).
  psu:         { position: [-0.75, -1.66, 0.35], rotation: [0, 0, 0] },
  // Shallow tower shell: rear wall hugs the board, glass sits close in front.
  case:        { position: [0, -0.1, 0.35],   rotation: [0, 0, 0] },
  // Representative mount point (FanSystem draws the actual fans).
  fans:        { position: [0, 1.55, 0.05],   rotation: [0, 0, 0] },
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
