const SORTS = {
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  perf: (a, b) => (b.perfScore ?? 0) - (a.perfScore ?? 0),
  name: (a, b) => a.name.localeCompare(b.name),
}

export function browseParts(parts, { category = 'all', query = '', sort = 'price-asc' } = {}) {
  const q = query.trim().toLowerCase()
  const out = parts.filter((p) => {
    if (category !== 'all' && p.category !== category) return false
    if (q && !`${p.name} ${p.brand}`.toLowerCase().includes(q)) return false
    return true
  })
  return out.sort(SORTS[sort] ?? SORTS['price-asc'])
}
