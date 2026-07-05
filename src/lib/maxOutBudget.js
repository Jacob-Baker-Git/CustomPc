import { suggestUpgrade } from './upgradeAdvisor'

// Repeatedly apply the best single CPU/GPU upgrade until nothing affordable
// improves FPS. Bounded so a pathological catalog can't loop forever.
export function maxOutBudget(selectedParts, budget, catalog, resolution = '1440p') {
  let parts = { ...selectedParts }
  for (let i = 0; i < 12; i++) {
    const s = suggestUpgrade(parts, budget, catalog, resolution)
    if (!s) break
    parts = { ...parts, [s.category]: s.toPart }
  }
  return parts
}
