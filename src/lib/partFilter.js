import { checkCompatibility } from './compatibility'

// Returns [{ part, compatible, reason }]. Default view: compatible + within 70%
// of total budget. When a search query is present, returns every name match
// regardless of compatibility/budget (so they're findable, shown marked).
export function filterParts(parts, selectedParts, budget, query) {
  const q = (query || '').trim().toLowerCase()
  const maxPrice = budget * 0.7

  const annotated = parts.map((part) => {
    const { compatible, reason } = checkCompatibility(selectedParts, part)
    return { part, compatible, reason }
  })

  if (q) {
    return annotated.filter(({ part }) => part.name.toLowerCase().includes(q))
  }

  return annotated.filter(({ part, compatible }) => {
    if (!compatible) return false
    if (budget > 0 && part.price > maxPrice) return false
    return true
  })
}
