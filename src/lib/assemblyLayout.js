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

// `category` decides WHERE a part goes — no selection argument, which is what
// keeps the layout selection-independent: nothing already placed moves when
// another part is added or removed.
//
// `overrides` is a different thing and does not reopen that. It carries the real
// dimensions of the part in this slot (a card's own length, see partOverrides),
// so it changes how big THIS part is drawn, never where any other part sits.
// Only the card's own forward extent moves with it; its edge connector, the case
// and every other mount stay exactly where they were.
export function assemblyLayout(category, overrides) {
  if (MOUNTED_CATEGORIES.includes(category)) {
    return {
      position: partCentre(category, overrides),
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
