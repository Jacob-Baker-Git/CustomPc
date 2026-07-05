import { describe, it, expect, afterEach } from 'vitest'
import useCatalogStore, { loadCatalog } from '../store/useCatalogStore'
import partsData from '../data/partsData.json'
import peripheralsData from '../data/peripheralsData.json'

afterEach(() => {
  vi.unstubAllGlobals()
  useCatalogStore.setState({ parts: partsData, peripherals: peripheralsData, source: 'bundled' })
})

const dbRows = (items) => items.map((data) => ({ data }))

describe('useCatalogStore', () => {
  it('starts with the bundled snapshot so the UI renders instantly', () => {
    const s = useCatalogStore.getState()
    expect(s.source).toBe('bundled')
    expect(s.parts.length).toBeGreaterThan(200)
    expect(s.peripherals.length).toBeGreaterThan(20)
  })

  it('swaps to the Supabase catalog when the fetch succeeds', async () => {
    const dbParts = [{ id: 'cpu-db', category: 'cpu', name: 'DB CPU', price: 100 }]
    const dbPeripherals = [{ id: 'mon-db', category: 'monitor', name: 'DB Monitor', price: 200 }]
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('rest/v1/parts') ? dbRows(dbParts) : dbRows(dbPeripherals)),
    })))

    await loadCatalog()
    const s = useCatalogStore.getState()
    expect(s.source).toBe('supabase')
    expect(s.parts[0].id).toBe('cpu-db')
    expect(s.peripherals[0].id).toBe('mon-db')
  })

  it('keeps the bundled snapshot when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    await loadCatalog()
    const s = useCatalogStore.getState()
    expect(s.source).toBe('bundled')
    expect(s.parts).toBe(partsData)
  })

  it('keeps the bundled snapshot when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await loadCatalog()
    expect(useCatalogStore.getState().source).toBe('bundled')
  })

  it('ignores an empty catalog rather than blanking the app', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })))
    await loadCatalog()
    const s = useCatalogStore.getState()
    expect(s.source).toBe('bundled')
    expect(s.parts.length).toBeGreaterThan(200)
  })
})
