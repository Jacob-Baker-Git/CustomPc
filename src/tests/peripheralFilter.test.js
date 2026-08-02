import { describe, it, expect } from 'vitest'
import peripheralsData from '../data/peripheralsData.json'
import { filterPeripherals, specValues, specLabel, SORTS } from '../lib/peripheralFilter'
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
