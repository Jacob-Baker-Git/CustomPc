import { describe, it, expect } from 'vitest'
import peripheralsData from '../data/peripheralsData.json'
import {
  filterPeripherals, specValues, specLabel, SORTS,
  brandValues, refreshBandsFor, inRefreshBand, REFRESH_BANDS,
} from '../lib/peripheralFilter'
import { priceBands } from '../lib/priceBands'

const monitors = peripheralsData.filter((p) => p.category === 'monitor')
const mice = peripheralsData.filter((p) => p.category === 'mouse')

describe('peripheral filtering', () => {
  it('returns everything when nothing is applied', () => {
    expect(filterPeripherals(monitors, { category: 'monitor' })).toHaveLength(monitors.length)
  })

  it('searches name and brand, case-insensitively', () => {
    const target = monitors[0]
    const hits = filterPeripherals(monitors, { category: 'monitor', query: target.name.slice(0, 6).toUpperCase() })
    expect(hits.map((p) => p.id)).toContain(target.id)
  })

  it('narrows to a single spec value', () => {
    const values = specValues(monitors, 'monitor')
    expect(values.length).toBeGreaterThan(1)
    const hits = filterPeripherals(monitors, { category: 'monitor', spec: values[0] })
    expect(hits.length).toBeGreaterThan(0)
    for (const p of hits) expect(p.resolution).toBe(values[0])
  })

  it('offers no spec filter for mice, which only have a DPI number', () => {
    expect(specValues(mice, 'mouse')).toEqual([])
    expect(specLabel('mouse')).toBeNull()
    // ...and asking for one anyway must not silently empty the list.
    expect(filterPeripherals(mice, { category: 'mouse', spec: 'anything' })).toHaveLength(mice.length)
  })

  it('sorts by each available order', () => {
    const asc = filterPeripherals(monitors, { category: 'monitor', sort: 'price-asc' })
    const desc = filterPeripherals(monitors, { category: 'monitor', sort: 'price-desc' })
    expect(asc[0].price).toBeLessThanOrEqual(asc[asc.length - 1].price)
    expect(desc[0].price).toBeGreaterThanOrEqual(desc[desc.length - 1].price)
    const byName = filterPeripherals(monitors, { category: 'monitor', sort: 'name' })
    expect(byName.map((p) => p.name)).toEqual([...byName.map((p) => p.name)].sort((a, b) => a.localeCompare(b)))
  })

  it('falls back to the default sort for an unknown one', () => {
    const out = filterPeripherals(monitors, { category: 'monitor', sort: 'nonsense' })
    expect(out[0].price).toBeLessThanOrEqual(out[out.length - 1].price)
  })

  it('combines a band, a spec and a query without contradicting itself', () => {
    const bands = priceBands(monitors.map((p) => p.price))
    const band = bands[0]
    const out = filterPeripherals(monitors, { category: 'monitor', band, spec: 'all', query: '' })
    expect(out.length).toBeGreaterThan(0)
    expect(out.length).toBeLessThanOrEqual(monitors.length)
    for (const p of out) expect(p.price).toBeLessThan(band.max)
  })

  it('does not mutate the array it is given', () => {
    const copy = [...monitors]
    filterPeripherals(monitors, { category: 'monitor', sort: 'price-desc' })
    expect(monitors.map((p) => p.id)).toEqual(copy.map((p) => p.id))
  })

  it('exposes a label for every sort', () => {
    for (const key of Object.keys(SORTS)) expect(SORTS[key].label).toBeTruthy()
  })
})

describe('advanced peripheral filters', () => {
  it('lists brands alphabetically, without duplicates', () => {
    const brands = brandValues(monitors)
    expect(brands.length).toBeGreaterThan(1)
    expect(brands).toEqual([...new Set(brands)])
    expect(brands).toEqual([...brands].sort((a, b) => a.localeCompare(b)))
  })

  it('narrows to the chosen brands only', () => {
    const [first, second] = brandValues(monitors)
    const out = filterPeripherals(monitors, { category: 'monitor', brands: [first, second] })
    expect(out.length).toBeGreaterThan(0)
    for (const p of out) expect([first, second]).toContain(p.brand)
  })

  it('takes the union of several spec values, not the intersection', () => {
    const values = specValues(monitors, 'monitor')
    expect(values.length).toBeGreaterThan(1)
    const [a, b] = values
    const both = filterPeripherals(monitors, { category: 'monitor', specs: [a, b] })
    const justA = filterPeripherals(monitors, { category: 'monitor', specs: [a] })
    expect(both.length).toBeGreaterThan(justA.length)
    for (const p of both) expect([a, b]).toContain(p.resolution)
  })

  it('buckets refresh rates so 165 and 170 are one choice', () => {
    const band = REFRESH_BANDS.find((b) => b.id === '165-239')
    expect(inRefreshBand(165, band)).toBe(true)
    expect(inRefreshBand(170, band)).toBe(true)
    expect(inRefreshBand(240, band)).toBe(false)
    expect(inRefreshBand(144, band)).toBe(false)
  })

  it('offers only refresh buckets that contain a monitor', () => {
    const offered = refreshBandsFor(monitors)
    expect(offered.length).toBeGreaterThan(0)
    for (const b of offered) expect(monitors.some((p) => inRefreshBand(p.refresh, b))).toBe(true)
  })

  it('filters monitors by refresh bucket', () => {
    const band = refreshBandsFor(monitors)[0]
    const out = filterPeripherals(monitors, { category: 'monitor', refresh: [band.id] })
    expect(out.length).toBeGreaterThan(0)
    for (const p of out) expect(inRefreshBand(p.refresh, band)).toBe(true)
  })

  it('honours a custom price range', () => {
    const out = filterPeripherals(monitors, { category: 'monitor', priceMin: 200, priceMax: 400 })
    expect(out.length).toBeGreaterThan(0)
    for (const p of out) {
      expect(p.price).toBeGreaterThanOrEqual(200)
      expect(p.price).toBeLessThanOrEqual(400)
    }
  })

  // Opening the panel and applying it untouched must not empty the tab.
  it('treats empty arrays as no constraint at all', () => {
    const out = filterPeripherals(monitors, {
      category: 'monitor', brands: [], specs: [], refresh: [],
    })
    expect(out).toHaveLength(monitors.length)
  })

  it('combines brand, spec and refresh together', () => {
    const brand = brandValues(monitors)[0]
    const out = filterPeripherals(monitors, {
      category: 'monitor',
      brands: [brand],
      specs: specValues(monitors, 'monitor'),
      refresh: refreshBandsFor(monitors).map((b) => b.id),
    })
    // Every spec value and every populated bucket is allowed, so this is just
    // the brand filter — a good check that the clauses AND rather than fight.
    const brandOnly = filterPeripherals(monitors, { category: 'monitor', brands: [brand] })
    expect(out.map((p) => p.id)).toEqual(brandOnly.map((p) => p.id))
  })
})
