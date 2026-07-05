import { create } from 'zustand'
import bundledParts from '../data/partsData.json'
import bundledPeripherals from '../data/peripheralsData.json'
import bundledGames from '../data/gamesData.json'
import { fetchCatalog } from '../lib/supabaseCatalog'

// The catalog renders instantly from the bundled snapshot, then swaps to the
// live Supabase data once fetched. If the fetch fails (offline, project
// paused) the snapshot simply stays — the app never blocks on the network.
const useCatalogStore = create(() => ({
  parts: bundledParts,
  peripherals: bundledPeripherals,
  games: bundledGames,
  source: 'bundled',
}))

export async function loadCatalog() {
  try {
    const { parts, peripherals, games } = await fetchCatalog()
    if (parts.length > 0 && peripherals.length > 0 && games.length > 0) {
      useCatalogStore.setState({ parts, peripherals, games, source: 'supabase' })
    }
  } catch {
    // Keep the bundled snapshot; the builder works fully offline.
  }
}

export default useCatalogStore
