import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BUILDER_STORAGE_KEY } from '../lib/storageKey'
import { peakDrawW } from '../lib/partSynergy'
import { MAX_BUDGET } from '../lib/buildCodec'

// Every budget the store takes: 0 for nonsense, capped like a share link. The
// top bar's editor once accepted 1e300 and rendered "£1e+300".
const clampBudget = (n) => (Number.isFinite(n) && n > 0 ? Math.min(n, MAX_BUDGET) : 0)
const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Swap each selected part for the catalogue's copy of the same id, dropping any
// the catalogue no longer has or that sit in a slot of another category (a
// hand-edited store). Returns `selection` itself when nothing changed.
// ponytail: a dropped part disappears silently; add a notice if removals become common.
function resolveById(selection, catalog) {
  const byId = new Map(catalog.map((p) => [p.id, p]))
  let changed = false
  const next = {}
  for (const [cat, part] of Object.entries(selection)) {
    const fresh = byId.get(part?.id)
    if (fresh?.category === cat) next[cat] = fresh
    if (next[cat] !== part) changed = true
  }
  return changed ? next : selection
}

const useBuilderStore = create(persist((set, get) => ({
  budget: 0,
  selectedParts: {},

  setBudget: (amount) => set({ budget: clampBudget(amount) }),

  // Which screen the app is on: 'hub' | 'target' | 'saved' | 'builder'.
  // Persisted, so a refresh returns you where you were. This used to be
  // derived from `budget > 0`, which meant leaving the builder had to zero
  // the budget and a returning visitor could never reach the hub at all.
  // Each change is a browser history entry ({ flow }), so Back moves between
  // screens (flowHistory.js restores it). Entering the builder opens the tab
  // it is asked for (Build by default) rather than whatever tab a previous
  // visit left in the hash.
  flow: 'hub',
  setFlow: (flow, view = 'build') => {
    const same = get().flow === flow
    set({ flow })
    if (typeof window === 'undefined') return
    window.history[same ? 'replaceState' : 'pushState']({ flow }, '', flow === 'builder' ? `/#${view}` : '/')
  },

  // Which of the Welcome screen's two paths the build came from. Drives the
  // builder's "Next" button: entering parts walks every tab, a game-target
  // build starts at Peripherals.
  path: 'parts',
  setPath: (path) => set({ path }),

  // The game being asked about, shared by the Performance tab's estimator and
  // the Build-for-a-game screen, so picking a game in one shows it in the other.
  // Resolution is the store's existing `resolution`; budget is `budget`.
  target: { gameId: null, presetKey: null, fps: 60 },
  setTarget: (patch) => set((s) => ({ target: { ...s.target, ...patch } })),

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
  version: 3,
  // v1 had no persisted `flow` and inferred "in the builder" from a non-zero
  // budget; that inference is preserved once, so anyone mid-build reopens in
  // the builder. v2's `setup` screen no longer exists. Each step runs in turn,
  // so a v1 visitor is carried all the way.
  migrate: (persisted, version) => {
    if (!persisted) return persisted
    let s = persisted
    if (version < 2) s = { ...s, flow: (s.budget ?? 0) > 0 ? 'builder' : 'hub' }
    if (s.flow === 'setup') s = { ...s, flow: 'hub' }
    return s
  },
  // A hand-edited or half-written store must not reach the UI: a null parts
  // map threw on load, a negative budget rendered as "1486.41£".
  merge: (persisted, current) => ({
    ...current,
    ...persisted,
    budget: clampBudget(persisted?.budget),
    selectedParts: isMap(persisted?.selectedParts) ? persisted.selectedParts : {},
    selectedPeripherals: isMap(persisted?.selectedPeripherals) ? persisted.selectedPeripherals : {},
  }),
  partialize: (s) => ({
    budget: s.budget,
    selectedParts: s.selectedParts,
    selectedPeripherals: s.selectedPeripherals,
    resolution: s.resolution,
    useCase: s.useCase,
    flow: s.flow,
    path: s.path,
    target: s.target,
  }),
}))

export default useBuilderStore

export const selTotalSpent = (s) =>
  Object.values(s.selectedParts).reduce((sum, p) => sum + (p?.price ?? 0), 0)

export const selRemainingBudget = (s) => s.budget - selTotalSpent(s)

// What the build can pull with the CPU at full boost: the figure every power
// readout shows, so the top bar, Summary and Performance tab agree.
export const selPeakDraw = (s) => peakDrawW(s.selectedParts)

export const selPsuWattage = (s) => s.selectedParts.psu?.wattage ?? null

export const selPeripheralsTotal = (s) =>
  Object.values(s.selectedPeripherals).reduce((sum, p) => sum + (p?.price ?? 0), 0)
