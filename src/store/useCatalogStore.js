import { create } from 'zustand'
import bundledParts from '../data/partsData.json'
import bundledPeripherals from '../data/peripheralsData.json'
import bundledGames from '../data/gamesData.json'
import { fetchCatalog } from '../lib/supabaseCatalog'
import useBuilderStore from './useBuilderStore'

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
      syncBuildWithCatalog()
    }
  } catch {
    // Keep the bundled snapshot; the builder works fully offline.
  }
}

// Point the persisted build at the current catalogue's part objects.
export function syncBuildWithCatalog() {
  const { parts, peripherals } = useCatalogStore.getState()
  useBuilderStore.getState().syncWithCatalog(parts, peripherals)
}

export default useCatalogStore
