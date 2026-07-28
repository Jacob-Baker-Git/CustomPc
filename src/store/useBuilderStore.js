import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useBuilderStore = create(persist((set) => ({
  budget: 0,
  selectedParts: {},

  setBudget: (amount) => set({ budget: amount }),

  // Which screen the app is on: 'hub' | 'setup' | 'saved' | 'builder'.
  // Persisted, so a refresh returns you where you were. This used to be
  // derived from `budget > 0`, which meant leaving the builder had to zero
  // the budget and a returning visitor could never reach the hub at all.
  flow: 'hub',
  setFlow: (flow) => set({ flow }),

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

  caseTransparent: false,
  toggleCaseTransparency: () =>
    set((state) => ({ caseTransparent: !state.caseTransparent })),

  // What the wizard just generated (for the one-off summary banner). Transient.
  lastGenerated: null,
  setLastGenerated: (info) => set({ lastGenerated: info }),
  clearLastGenerated: () => set({ lastGenerated: null }),

  // Category chip currently hovered — the matching 3D part highlights. Transient.
  hoveredCategory: null,
  setHoveredCategory: (category) => set({ hoveredCategory: category }),

  resolution: '1440p',
  setResolution: (resolution) => set({ resolution }),

  // Use case the build is rated for — drives BuildRatingPanel and its dropdown.
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
  name: 'custompc-builder-v1',
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
