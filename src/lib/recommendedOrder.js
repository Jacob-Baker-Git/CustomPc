export const RECOMMENDED_ORDER = [
  'motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case', 'fans', 'paste',
]

// Categories that should never be highlighted as the "next" required pick, and
// never counted against build completeness. Paste is here because virtually
// every cooler ships with paste already applied — an empty slot is correct, not
// a hole, and the UI says so rather than leaving it blank.
const OPTIONAL = new Set(['paste'])

export function isOptional(category) {
  return OPTIONAL.has(category)
}

export const ESSENTIALS = RECOMMENDED_ORDER.filter((c) => !OPTIONAL.has(c))

export function nextRecommended(selectedParts = {}) {
  for (const category of RECOMMENDED_ORDER) {
    if (OPTIONAL.has(category)) continue
    if (!selectedParts[category]) return category
  }
  return null
}

export function countEssentials(selectedParts = {}) {
  const missing = ESSENTIALS.filter((c) => !selectedParts[c])
  return { chosen: ESSENTIALS.length - missing.length, total: ESSENTIALS.length, missing }
}
