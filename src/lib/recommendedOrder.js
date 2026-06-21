export const RECOMMENDED_ORDER = [
  'motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case', 'fans', 'paste',
]

// Categories that should never be highlighted as the "next" required pick.
const OPTIONAL = new Set(['paste'])

export function nextRecommended(selectedParts = {}) {
  for (const category of RECOMMENDED_ORDER) {
    if (OPTIONAL.has(category)) continue
    if (!selectedParts[category]) return category
  }
  return null
}
