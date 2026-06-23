import { checkCompatibility } from './compatibility'

// Returns [{ part, compatible, reason }]. Default view: compatible + within 60%
// of total budget. When a search query is present, returns every name match
// regardless of compatibility/budget (so they're findable, shown marked). An
// optional brand ('all'/falsy = no brand filter) narrows results in both branches.
export function filterParts(parts, selectedParts, budget, query, brand) {
  const q = (query || '').trim().toLowerCase()
  const maxPrice = budget * 0.6
  const brandOk = (part) => !brand || brand === 'all' || part.brand === brand

  const annotated = parts.map((part) => {
    const { compatible, reason } = checkCompatibility(selectedParts, part)
    return { part, compatible, reason }
  })

  if (q) {
    return annotated.filter(({ part }) => part.name.toLowerCase().includes(q) && brandOk(part))
  }

  return annotated.filter(({ part, compatible }) => {
    if (!compatible) return false
    if (budget > 0 && part.price > maxPrice) return false
    return brandOk(part)
  })
}
