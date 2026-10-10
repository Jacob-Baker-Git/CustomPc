import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BUILDER_STORAGE_KEY } from '../lib/storageKey'

// Swap each selected part for the catalogue's copy of the same id, dropping any
// the catalogue no longer has. Returns `selection` itself when nothing changed.
// ponytail: a dropped part disappears silently; add a notice if removals become common.
function resolveById(selection, catalog) {
  const byId = new Map(catalog.map((p) => [p.id, p]))
  let changed = false
  const next = {}
  for (const [cat, part] of Object.entries(selection)) {
    const fresh = byId.get(part?.id)
    if (fresh) next[cat] = fresh
    if (fresh !== part) changed = true
  }
  return changed ? next : selection
}

const useBuilderStore = create(persist((set, get) => ({
  budget: 0,
  selectedParts: {},

  setBudget: (amount) => set({ budget: amount }),

  // Which screen the app is on: 'hub' | 'setup' | 'saved' | 'builder'.
  // Persisted, so a refresh returns you where you were. This used to be
  // derived from `budget > 0`, which meant leaving the builder had to zero
  // the budget and a returning visitor could never reach the hub at all.
  // Each change is a browser history entry ({ flow }), so Back moves between
  // screens (flowHistory.js restores it). Entering the builder always opens
  // the Build tab rather than whatever tab a previous visit left in the hash.
  flow: 'hub',
  setFlow: (flow) => {
    const same = get().flow === flow
    set({ flow })
    if (typeof window === 'undefined') return
    window.history[same ? 'replaceState' : 'pushState']({ flow }, '', flow === 'builder' ? '/#build' : '/')
  },

  addPart: (category, part) =>
    set((state) => ({
      selectedParts: { ...state.selectedParts, [category]: part },
    })),

  removePart: (category) =>
    set((state) => {
      const next = { ...state.selectedParts }
      delete next[category]
      return { selectedParts: next }
    }),

  setBuild: (parts) => set({ selectedParts: parts }),

  clearBuild: () => set({ selectedParts: {}, selectedPeripherals: {} }),

  // The build persists whole part objects, so without this a returning visitor
  // keeps the prices and specs from whenever each part was picked.
  syncWithCatalog: (parts, peripherals) =>
    set((state) => {
      const selectedParts = resolveById(state.selectedParts, parts)
      const selectedPeripherals = resolveById(state.selectedPeripherals, peripherals)
      return selectedParts === state.selectedParts && selectedPeripherals === state.selectedPeripherals
        ? state
        : { selectedParts, selectedPeripherals }
    }),

  caseTransparent: false,
  toggleCaseTransparency: () =>
    set((state) => ({ caseTransparent: !state.caseTransparent })),

  // What the wizard just generated (for the one-off summary banner). Transient.
  lastGenerated: null,
  setLastGenerated: (info) => set({ lastGenerated: info }),
  clearLastGenerated: () => set({ lastGenerated: null }),

  resolution: '1440p',
  setResolution: (resolution) => set({ resolution }),

  // Use case the build is rated for — drives BuildRatingPanel and its chips.
  useCase: 'gaming',
  setUseCase: (useCase) => set({ useCase }),

  selectedPeripherals: {},

  addPeripheral: (category, part) =>
    set((state) => ({
      selectedPeripherals: { ...state.selectedPeripherals, [category]: part },
    })),

  removePeripheral: (category) =>
    set((state) => {
      const next = { ...state.selectedPeripherals }
      delete next[category]
      return { selectedPeripherals: next }
    }),
}), {
  name: BUILDER_STORAGE_KEY,
  version: 2,
  // v1 had no persisted `flow` and inferred "in the builder" from a non-zero
  // budget. Preserve that inference once, so anyone mid-build reopens in the
  // builder rather than being dropped back on the hub.
  migrate: (persisted, version) => {
    if (version >= 2 || !persisted) return persisted
    return { ...persisted, flow: (persisted.budget ?? 0) > 0 ? 'builder' : 'hub' }
  },
  partialize: (s) => ({
    budget: s.budget,
    selectedParts: s.selectedParts,
    selectedPeripherals: s.selectedPeripherals,
    resolution: s.resolution,
    useCase: s.useCase,
    flow: s.flow,
  }),
}))

export default useBuilderStore

export const selTotalSpent = (s) =>
  Object.values(s.selectedParts).reduce((sum, p) => sum + (p?.price ?? 0), 0)

export const selRemainingBudget = (s) => s.budget - selTotalSpent(s)

export const selTotalPower = (s) =>
  Object.values(s.selectedParts).reduce((sum, p) => sum + (p?.tdp ?? 0), 0)

export const selPsuWattage = (s) => s.selectedParts.psu?.wattage ?? null

export const selPeripheralsTotal = (s) =>
  Object.values(s.selectedPeripherals).reduce((sum, p) => sum + (p?.price ?? 0), 0)
