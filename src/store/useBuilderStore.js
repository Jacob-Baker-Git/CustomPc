import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useBuilderStore = create(persist((set) => ({
  budget: 0,
  selectedParts: {},

  setBudget: (amount) => set({ budget: amount }),

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
  version: 1,
  partialize: (s) => ({
    budget: s.budget,
    selectedParts: s.selectedParts,
    selectedPeripherals: s.selectedPeripherals,
    resolution: s.resolution,
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
