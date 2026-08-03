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

// Refresh rate, as buckets rather than the ten discrete values in the
// catalogue — nobody wants "170Hz" as a separate choice from "165Hz". The
// earlier note that refresh is meaningless without the panel held while
// resolution was the only other filter; now that both can be set at once, the
// pair is exactly how people shop for a gaming monitor.
// Ranges are half-open and non-overlapping so a monitor lands in exactly one.
export const REFRESH_BANDS = [
  { id: 'to-99', label: 'Up to 99Hz', min: 0, max: 100 },
  { id: '100-143', label: '100–143Hz', min: 100, max: 144 },
  { id: '144-164', label: '144–164Hz', min: 144, max: 165 },
  { id: '165-239', label: '165–239Hz', min: 165, max: 240 },
  { id: '240-plus', label: '240Hz+', min: 240, max: Infinity },
]

export function inRefreshBand(hz, band) {
  return Number.isFinite(hz) && hz >= band.min && hz < band.max
}

// Only the buckets something actually falls into — an empty chip is noise.
export function refreshBandsFor(items) {
  return REFRESH_BANDS.filter((b) => items.some((p) => inRefreshBand(p.refresh, b)))
}

// Brands present, alphabetical. Unlike spec values (kept in catalogue order so
// they read low-to-high) a brand list has no meaningful order but its own.
export function brandValues(items) {
  return [...new Set(items.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

// The filter panel's state, flat and covering the whole tab. Lives here rather
// than beside the component so it can be tested directly, and because a file
// that exports both a component and constants breaks React fast refresh.
export const EMPTY_FILTERS = {
  priceMin: '',
  priceMax: '',
  brands: [],
  resolution: [],
  refresh: [],
  switch: [],
  type: [],
}

// How many distinct things the user has narrowed by — drives the badge on the
// Filters button. A price range counts once however many ends are filled.
export function activeFilterCount(f = {}) {
  let n = 0
  if (f.priceMin !== '' && f.priceMin != null) n += 1
  else if (f.priceMax !== '' && f.priceMax != null) n += 1
  for (const key of ['brands', 'resolution', 'refresh', 'switch', 'type']) {
    if (f[key]?.length) n += 1
  }
  return n
}

// Which key in the filter-panel state holds this category's spec choices. The
// panel is one flat object covering the whole tab, so this is the only place
// that knows a monitor's spec list lives under `resolution` and a headset's
// under `type`.
const PANEL_KEY_OF = { monitor: 'resolution', keyboard: 'switch', headset: 'type' }

// Turn the panel's flat state into the options one category's list needs.
// Blank price inputs become null (no bound) rather than 0, which would filter
// everything out at the bottom end.
export function toFilterOptions(category, filters = {}, { query = '', sort = DEFAULT_SORT } = {}) {
  const key = PANEL_KEY_OF[category]
  const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))
  return {
    category,
    specs: key ? filters[key] ?? null : null,
    brands: filters.brands ?? null,
    // Refresh only means anything for monitors; passing it elsewhere would
    // filter every keyboard out, since none of them have a refresh rate.
    refresh: category === 'monitor' ? filters.refresh ?? null : null,
    priceMin: num(filters.priceMin),
    priceMax: num(filters.priceMax),
    query,
    sort,
  }
}

// `spec` (one value or 'all') is kept alongside `specs` (an array) so existing
// callers and tests keep working; when both are given the array wins.
export function filterPeripherals(items, {
  band = null,
  spec = 'all',
  specs = null,
  brands = null,
  refresh = null,
  priceMin = null,
  priceMax = null,
  query = '',
  sort = DEFAULT_SORT,
  category,
} = {}) {
  const q = query.trim().toLowerCase()
  const get = SPEC_OF[category]
  // An empty array means "no constraint", not "match nothing" — otherwise
  // opening the filter panel and applying it immediately would empty the tab.
  const specList = specs?.length ? specs.map(String) : null
  const brandList = brands?.length ? brands : null
  const refreshList = refresh?.length ? REFRESH_BANDS.filter((b) => refresh.includes(b.id)) : null

  const out = items.filter((p) => {
    if (band && !inBand(p.price, band)) return false
    if (Number.isFinite(priceMin) && p.price < priceMin) return false
    if (Number.isFinite(priceMax) && p.price > priceMax) return false
    if (brandList && !brandList.includes(p.brand)) return false
    if (get) {
      const v = String(get(p))
      if (specList) {
        if (!specList.includes(v)) return false
      } else if (spec && spec !== 'all' && v !== String(spec)) return false
    }
    if (refreshList && !refreshList.some((b) => inRefreshBand(p.refresh, b))) return false
    if (q && !`${p.name} ${p.brand ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })

  return out.sort((SORTS[sort] ?? SORTS[DEFAULT_SORT]).cmp)
}
