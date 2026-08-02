import { inBand } from './priceBands'

// Filtering/sorting for the peripherals tab, kept out of the component so it can
// be tested directly. The tab previously offered price bands and nothing else,
// which is thin for ~120 items you cannot search.

export const SORTS = {
  'price-asc': { label: 'Price ↑', cmp: (a, b) => a.price - b.price },
  'price-desc': { label: 'Price ↓', cmp: (a, b) => b.price - a.price },
  name: { label: 'Name', cmp: (a, b) => a.name.localeCompare(b.name) },
}

export const DEFAULT_SORT = 'price-asc'

// The one spec per category that people actually choose on. Monitors get
// resolution (not refresh — refresh is meaningless without knowing the panel),
// keyboards their switch, headsets wired vs wireless. Mice have only DPI, which
// is a marketing number rather than a decision, so they get no spec filter.
const SPEC_OF = {
  monitor: (p) => p.resolution,
  keyboard: (p) => p.switch,
  headset: (p) => p.type,
}

export function specLabel(category) {
  return { monitor: 'Resolution', keyboard: 'Switch', headset: 'Type' }[category] ?? null
}

// Distinct spec values present in this category, in catalogue order so the list
// is stable rather than reordering as prices change.
export function specValues(items, category) {
  const get = SPEC_OF[category]
  if (!get) return []
  const seen = []
  for (const p of items) {
    const v = get(p)
    if (v != null && v !== '' && !seen.includes(v)) seen.push(v)
  }
  return seen
}

export function filterPeripherals(items, { band = null, spec = 'all', query = '', sort = DEFAULT_SORT, category } = {}) {
  const q = query.trim().toLowerCase()
  const get = SPEC_OF[category]

  const out = items.filter((p) => {
    if (band && !inBand(p.price, band)) return false
    if (spec && spec !== 'all' && get && String(get(p)) !== String(spec)) return false
    if (q && !`${p.name} ${p.brand ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })

  return out.sort((SORTS[sort] ?? SORTS[DEFAULT_SORT]).cmp)
}
