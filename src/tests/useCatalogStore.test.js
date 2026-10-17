import { describe, it, expect, afterEach } from 'vitest'
import useCatalogStore, { loadCatalog } from '../store/useCatalogStore'
import useBuilderStore from '../store/useBuilderStore'
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
      json: async () => {
        const u = String(url)
        if (u.includes('rest/v1/parts')) return dbRows(dbParts)
        if (u.includes('rest/v1/peripherals')) return dbRows(dbPeripherals)
        throw new Error('unexpected table ' + u)
      },
    })))

    await loadCatalog()
    const s = useCatalogStore.getState()
    expect(s.source).toBe('supabase')
    expect(s.parts[0].id).toBe('cpu-db')
    expect(s.peripherals[0].id).toBe('mon-db')
    // The retired games table is no longer read at all.
    expect(s.games).toBeUndefined()
  })

  it('refreshes the in-progress build against the fetched catalogue', async () => {
    const live = { id: 'cpu-db', category: 'cpu', name: 'DB CPU', price: 120 }
    useBuilderStore.setState({ selectedParts: { cpu: { ...live, price: 100 } }, selectedPeripherals: {} })
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('rest/v1/parts') ? dbRows([live]) : dbRows([{ id: 'x', name: 'x' }])),
    })))
    await loadCatalog()
    expect(useBuilderStore.getState().selectedParts.cpu.price).toBe(120)
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
