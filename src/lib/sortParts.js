export const SORT_OPTIONS = [
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
  { key: 'brand-asc', label: 'Brand (A-Z)' },
  { key: 'tdp-desc', label: 'Power Draw (TDP)' },
]

export function sortParts(list, key) {
  const arr = [...list]
  switch (key) {
    case 'price-desc': return arr.sort((a, b) => b.price - a.price)
    case 'brand-asc': return arr.sort((a, b) => (a.brand ?? a.name).localeCompare(b.brand ?? b.name))
    case 'tdp-desc': return arr.sort((a, b) => (b.tdp ?? 0) - (a.tdp ?? 0))
    case 'price-asc':
    default: return arr.sort((a, b) => a.price - b.price)
  }
}
