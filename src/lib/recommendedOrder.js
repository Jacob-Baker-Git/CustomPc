export const RECOMMENDED_ORDER = [
  'motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case', 'fans',
]

export function nextRecommended(selectedParts = {}) {
  for (const category of RECOMMENDED_ORDER) {
    if (!selectedParts[category]) return category
  }
  return null
}
