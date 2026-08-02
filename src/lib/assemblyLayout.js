// All transforms are relative to the motherboard anchored at the origin.
// The board stands VERTICAL (PCB in the XY plane), components facing the viewer (+Z).

import { partCentre, caseInterior } from './assemblyGeometry'
import { PART_SPECS } from './partSpecs'

// Every part renders at its real assembled position. partCentre derives that
// from fixed references only — the board at the origin, the case interior, the
// CPU socket the cooler sits on — never from what is currently selected. So a
// part appears exactly where it belongs the instant it is picked, alone or in a
// full build, and nothing already placed moves when another part is added or
// removed. There is deliberately no "scatter until a motherboard exists" mode:
// that snap-into-place was the jump this change removes.
const MOUNTED_CATEGORIES = ['motherboard', 'cpu', 'cooler', 'ram', 'storage', 'gpu', 'psu']

const DEFAULT_TRANSFORM = { position: [0, 0, 0], rotation: [0, 0, 0] }

// `category` is all this needs — no selection argument. Callers may still pass
// one (it is ignored), which is what proves the result is selection-independent.
export function assemblyLayout(category) {
  if (MOUNTED_CATEGORIES.includes(category)) {
    return {
      position: partCentre(category),
      rotation: PART_SPECS[category]?.rotation ?? [0, 0, 0],
    }
  }

  if (category === 'case') {
    const inner = caseInterior()
    return {
      position: inner.min.map((v, i) => (v + inner.max[i]) / 2),
      rotation: [0, 0, 0],
    }
  }

  return DEFAULT_TRANSFORM
}
