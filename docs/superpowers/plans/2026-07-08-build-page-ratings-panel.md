# Build-page ratings panel (Stage 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the use-case rating on the main Build tab as a permanent, interactive panel that replaces the "Bottleneck" and "How it runs" boxes; each part row is *part → score → a dropdown of improvements* that swaps the live component. The Upgrade flow drops its standalone ratings dashboard and lands on the Build tab. The desktop layout widens.

**Architecture:** A new `useCase` field in `useBuilderStore` (persisted) drives a new `BuildRatingPanel` component that reuses the existing `rateBuild`/`partUpgradeOptions` libs and the `PANEL`/`TELEMETRY` visual tokens — no restyle. `BuilderScreen` swaps two panels for one and widens its grid. `UpgradeWizard` loses its dashboard screen; both entry flows write the store `useCase`.

**Tech Stack:** React 19, Zustand (+persist), Tailwind, Vitest + Testing Library, Playwright. Node lives at `C:\Program Files\nodejs` — in PowerShell prepend it to PATH if `npm`/`node` isn't found: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`. Single-file test: `npm run test:run -- <file>`; full suite: `npm run test:run`; lint: `npm run lint`; E2E: `npm run test:e2e`.

**Scope:** Stage 1 only. Auto-build use-case awareness + variety and the "Spend the leftover" fix are Stage 2 (separate spec/plan). Do NOT touch `autoBuilder.js`, `maxOutBudget.js`, or `GeneratedBanner.jsx` here.

---

## File structure

- `src/store/useBuilderStore.js` (edit) — add persisted `useCase` / `setUseCase`.
- `src/components/BuildRatingPanel.jsx` (new) — the interactive on-page rating panel.
- `src/screens/BuilderScreen.jsx` (edit) — render the panel, widen container, drop the two old panels.
- `src/index.css` (edit) — `.build-grid` areas: `rating` replaces `bottleneck` + `perf`.
- `src/components/UpgradeWizard.jsx` (edit) — remove the `dashboard` screen; `Open in Build →`.
- `src/components/BudgetEntry.jsx` (edit) — write store `useCase` on generate / start-empty.
- `e2e/wizard.spec.js` (edit) — assert the rating panel appears on the Build tab.
- New tests: `src/tests/builderStoreUseCase.test.js`, `src/tests/BuildRatingPanel.test.jsx`.
- Rewritten/appended tests: `src/tests/UpgradeWizard.test.jsx`, `src/tests/BudgetEntry.test.jsx`.

Kept in the repo, just no longer rendered on the Build tab: `BottleneckIndicator`, `ResolutionToggle`, `GamePerformancePanel`, `GamePerformanceList` (and their unit tests stay green — they render the components in isolation).

---

## Task 1: `useCase` field in the builder store

**Files:**
- Modify: `src/store/useBuilderStore.js`
- Test: `src/tests/builderStoreUseCase.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `src/tests/builderStoreUseCase.test.js`:

```js
import { describe, it, expect } from 'vitest'
import useBuilderStore from '../store/useBuilderStore'

describe('builder store useCase field', () => {
  it('defaults to gaming', () => {
    expect(useBuilderStore.getState().useCase).toBe('gaming')
  })
  it('setUseCase updates the use case', () => {
    useBuilderStore.getState().setUseCase('programming')
    expect(useBuilderStore.getState().useCase).toBe('programming')
    useBuilderStore.getState().setUseCase('gaming')
  })
  it('persists useCase via partialize', () => {
    const persisted = useBuilderStore.persist.getOptions().partialize(useBuilderStore.getState())
    expect(persisted).toHaveProperty('useCase')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/builderStoreUseCase.test.js`
Expected: FAIL — `useCase` is `undefined`, no `setUseCase`, not in partialize.

- [ ] **Step 3: Add the field and action**

In `src/store/useBuilderStore.js`, add these lines immediately after the `setResolution` line (currently line 45):

```js
  // Use case the build is rated for — drives BuildRatingPanel and its dropdown.
  useCase: 'gaming',
  setUseCase: (useCase) => set({ useCase }),
```

Then add `useCase` to `partialize` (the returned object, currently lines 68-74) so it reads:

```js
  partialize: (s) => ({
    budget: s.budget,
    selectedParts: s.selectedParts,
    selectedPeripherals: s.selectedPeripherals,
    resolution: s.resolution,
    customResolution: s.customResolution,
    useCase: s.useCase,
  }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/builderStoreUseCase.test.js`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/store/useBuilderStore.js src/tests/builderStoreUseCase.test.js
git commit -m "feat: persisted useCase field in the builder store"
```

---

## Task 2: `BuildRatingPanel` — the interactive on-page rating

**Files:**
- Create: `src/components/BuildRatingPanel.jsx`
- Test: `src/tests/BuildRatingPanel.test.jsx` (new)

**Context:** Reuses `rateBuild` / `partUpgradeOptions` (unchanged) and the `PANEL`/`TELEMETRY` tokens. Reads `selectedParts` / `useCase` from the store; the header `<select>` calls `setUseCase`; each part row's `<select>` lists improvements and applies one via `addPart`. `rateBuild` returns `{ overall, verdict, parts }` and `{ overall: 0, verdict, parts: {} }` when cpu/gpu are missing. `partUpgradeOptions(parts, useCase, category, catalog, { game })` returns `[{ toPart, extraCost, newScore, fpsGain? }]` cheapest-first.

- [ ] **Step 1: Write the failing test**

Create `src/tests/BuildRatingPanel.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import BuildRatingPanel from '../components/BuildRatingPanel'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'

const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const cpuHi = { id: 'cpu-hi', category: 'cpu', name: 'CPU Hi', price: 300, perfScore: 250, tdp: 105, socket: 'AM5' }
const gpuHi = { id: 'gpu-hi', category: 'gpu', name: 'GPU Hi', price: 600, perfScore: 300, tdp: 250, length: 300 }
const game  = { id: 'fortnite', name: 'Fortnite', fpsFactor: 1, cpuFactor: 1 }

beforeEach(() => {
  useCatalogStore.setState({ parts: [cpuLo, cpuHi, gpuHi], games: [game] })
  useBuilderStore.setState({ selectedParts: {}, useCase: 'gaming' })
})

describe('BuildRatingPanel', () => {
  it('prompts for a core pair when cpu/gpu are missing', () => {
    render(<BuildRatingPanel />)
    expect(screen.getByText(/add a cpu and gpu/i)).toBeInTheDocument()
  })

  it('shows the overall score and a row per part', () => {
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'gaming' })
    render(<BuildRatingPanel />)
    expect(screen.getByText('/100')).toBeInTheDocument()
    expect(screen.getByText('CPU Lo')).toBeInTheDocument()
    expect(screen.getByText('GPU Hi')).toBeInTheDocument()
  })

  it('changing the use case re-rates live', () => {
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'gaming' })
    render(<BuildRatingPanel />)
    fireEvent.change(screen.getByLabelText('Use case'), { target: { value: 'office' } })
    expect(useBuilderStore.getState().useCase).toBe('office')
    // /(for|with) …/ targets the verdict span ("Struggles with Everyday & Office"),
    // not the bare <option>Everyday & Office</option> in the use-case dropdown.
    expect(screen.getByText(/(for|with) everyday & office/i)).toBeInTheDocument()
  })

  it('picking an improvement swaps the live part', () => {
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'gaming' })
    render(<BuildRatingPanel />)
    fireEvent.change(screen.getByLabelText('Improve CPU'), { target: { value: 'cpu-hi' } })
    expect(useBuilderStore.getState().selectedParts.cpu.id).toBe('cpu-hi')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/BuildRatingPanel.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/components/BuildRatingPanel.jsx`**

```jsx
import { useMemo } from 'react'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { rateBuild, partUpgradeOptions } from '../lib/partRatings'
import { USE_CASES } from '../lib/buildProfiles'
import { PANEL, TELEMETRY } from '../lib/uiTokens'

const CAT_LABEL = {
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', storage: 'Storage', psu: 'PSU',
  cooler: 'Cooler', motherboard: 'Motherboard', case: 'Case', fans: 'Fans',
}
const scoreText = (s) => (s >= 80 ? 'text-emerald-300' : s >= 50 ? 'text-amber-300' : 'text-red-400')
const scoreBar  = (s) => (s >= 80 ? 'bg-emerald-400' : s >= 50 ? 'bg-amber-400' : 'bg-red-500')

// The Build-tab rating: overall /100 for the chosen use case (header dropdown
// changes it live), plus one row per part where a dropdown lists in-catalog
// upgrades that raise that part's score. Picking one swaps the live component.
export default function BuildRatingPanel() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const useCase       = useBuilderStore((s) => s.useCase)
  const setUseCase    = useBuilderStore((s) => s.setUseCase)
  const addPart       = useBuilderStore((s) => s.addPart)
  const partsData     = useCatalogStore((s) => s.parts)
  const gamesData     = useCatalogStore((s) => s.games)

  const game = gamesData.find((g) => g.id === 'fortnite') ?? gamesData[0] ?? null
  const hasCore = Boolean(selectedParts.cpu && selectedParts.gpu)

  const rating = useMemo(
    () => rateBuild(selectedParts, useCase, partsData),
    [selectedParts, useCase, partsData],
  )
  const rows = useMemo(
    () => Object.entries(rating.parts).sort((a, b) => a[1].score - b[1].score),
    [rating],
  )
  const optionsByCat = useMemo(() => {
    const m = {}
    for (const cat of Object.keys(rating.parts)) {
      m[cat] = partUpgradeOptions(selectedParts, useCase, cat, partsData, { game })
    }
    return m
  }, [rating, selectedParts, useCase, partsData, game])

  function chooseUpgrade(cat, partId) {
    const opt = (optionsByCat[cat] ?? []).find((o) => o.toPart.id === partId)
    if (opt) addPart(cat, opt.toPart)
  }

  return (
    <div className={`${PANEL} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-white text-sm font-semibold tracking-wide">Rating</span>
        <select
          aria-label="Use case"
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-xs text-slate-100 px-2 py-1 focus:outline-none focus:border-cyan-400"
        >
          {USE_CASES.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </select>
      </div>

      {!hasCore ? (
        <p className="text-gray-500 text-xs">Add a CPU and GPU to rate your build.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`${TELEMETRY} text-3xl font-bold ${scoreText(rating.overall)}`}>{rating.overall}</span>
            <span className="text-xs text-slate-500">/100</span>
            <span className="text-xs text-slate-300 ml-auto">{rating.verdict}</span>
          </div>

          <div className="space-y-1.5">
            {rows.map(([cat, info]) => {
              const opts = optionsByCat[cat] ?? []
              return (
                <div key={cat} className="flex flex-col gap-1 border border-slate-800/60 rounded-sm px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="uppercase text-[10px] text-slate-500 w-14 shrink-0">{CAT_LABEL[cat] ?? cat}</span>
                    <span className="text-sm text-slate-100 flex-1 min-w-0 truncate">{info.part.name}</span>
                    <span className="w-14 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
                      <span className={`block h-full ${scoreBar(info.score)}`} style={{ width: `${info.score}%` }} />
                    </span>
                    <span className={`${TELEMETRY} text-sm font-semibold w-7 text-right shrink-0 ${scoreText(info.score)}`}>{info.score}</span>
                    <select
                      aria-label={`Improve ${CAT_LABEL[cat] ?? cat}`}
                      value=""
                      disabled={opts.length === 0}
                      onChange={(e) => chooseUpgrade(cat, e.target.value)}
                      className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-[11px] text-slate-200 px-1.5 py-1 max-w-[8.5rem] focus:outline-none focus:border-cyan-400 disabled:opacity-40"
                    >
                      {opts.length === 0 ? (
                        <option value="">Best available</option>
                      ) : (
                        <>
                          <option value="" disabled>Upgrade…</option>
                          {opts.map((o) => (
                            <option key={o.toPart.id} value={o.toPart.id}>
                              {o.toPart.name} → {o.newScore} (+£{o.extraCost.toFixed(0)}){o.fpsGain != null && o.fpsGain > 0 ? ` · +${o.fpsGain} fps` : ''}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                  {info.reason && <span className="block text-[11px] text-amber-300/80 pl-[3.75rem]">{info.reason}</span>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/BuildRatingPanel.test.jsx`
Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildRatingPanel.jsx src/tests/BuildRatingPanel.test.jsx
git commit -m "feat: BuildRatingPanel — on-page use-case rating with per-part upgrade dropdowns"
```

---

## Task 3: Wire the panel into the Build tab + widen the layout

**Files:**
- Modify: `src/index.css`
- Modify: `src/screens/BuilderScreen.jsx`
- Verify: full unit suite + browser preview (layout is visual — not unit-testable in jsdom).

- [ ] **Step 1: Confirm nothing else renders the two removed panels**

Search `src` for other importers before dropping them from `BuilderScreen` (Grep tool, or PowerShell `Get-ChildItem -Recurse src -Include *.jsx | Select-String 'BottleneckIndicator|GamePerformancePanel'`). Expected matches ONLY in `src/screens/BuilderScreen.jsx` and the components'/tests' own files. If anything else imports them, stop and reassess.

- [ ] **Step 2: Update the grid CSS**

In `src/index.css`, replace the entire desktop-layout block (the comment starting `/* Desktop-only Build-tab layout` through the closing `}` of the `@media` block — currently lines 20-52) with:

```css
/* Desktop-only Build-tab layout: 3D on the right, the rating panel on the left,
   everything else full-width below. Below lg it is a plain flex column, so the
   child DOM order IS the (unchanged) mobile order. Every child sits above the
   WebGL canvas child to avoid the known compositing gotcha where content paints
   invisibly under the canvas. */
.build-grid { display: flex; flex-direction: column; gap: 0.75rem; }
.build-grid > * { position: relative; z-index: 1; }
.build-grid > .area-viz { z-index: 0; }

@media (min-width: 1024px) {
  .build-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
    grid-template-areas:
      "rating    viz"
      "banner    banner"
      "parts     parts"
      "warnings  warnings"
      "upgrade   upgrade"
      "autobuild autobuild";
    align-items: start;
    gap: 1rem;
  }
  .build-grid > .area-viz       { grid-area: viz; }
  .build-grid > .area-rating    { grid-area: rating; }
  .build-grid > .area-banner    { grid-area: banner; }
  .build-grid > .area-parts     { grid-area: parts; }
  .build-grid > .area-warnings  { grid-area: warnings; }
  .build-grid > .area-upgrade   { grid-area: upgrade; }
  .build-grid > .area-autobuild { grid-area: autobuild; }
}
```

- [ ] **Step 3: Swap the panels + widen the container in `BuilderScreen.jsx`**

3a. Replace the import line `import BottleneckIndicator from '../components/BottleneckIndicator'` with:

```jsx
import BuildRatingPanel from '../components/BuildRatingPanel'
```

3b. Delete the import line `import GamePerformancePanel from '../components/GamePerformancePanel'`.

3c. Widen the Build view container — replace:

```jsx
          <div className="relative z-10 transform-gpu w-full max-w-2xl lg:max-w-6xl mx-auto p-4 pb-12">
```

with:

```jsx
          <div className="relative z-10 transform-gpu w-full max-w-2xl lg:max-w-6xl 2xl:max-w-[88rem] mx-auto p-4 pb-12">
```

3d. Replace the two panel divs:

```jsx
              <div className="area-bottleneck"><BottleneckIndicator /></div>
              <div className="area-perf"><GamePerformancePanel /></div>
```

with a single rating panel:

```jsx
              <div className="area-rating"><BuildRatingPanel /></div>
```

- [ ] **Step 4: Run the full unit suite (no regressions)**

Run: `npm run test:run`
Expected: PASS. The `GamePerformancePanel` / `BottleneckIndicator` unit tests still pass (they render those components directly). No test asserts those panels inside `BuilderScreen`.

- [ ] **Step 5: Verify in the browser preview**

Start the dev server (preview_start with the project's dev config), open the Build tab (generate any build first), then:
- **Desktop 1440×900 and 1920×1080:** the rating panel sits top-left, the 3D model fills the right and reaches toward the edges (container now `2xl:max-w-[88rem]`), and the parts grid is full-width below. Confirm **every panel is visible** — none painted blank under the WebGL canvas (the documented compositing gotcha). Confirm the use-case dropdown re-rates and a part row's dropdown swaps the part + updates the part boxes below.
- **Mobile 375×812:** unchanged single column — 3D on top, then banner, parts, the rating panel where the Bottleneck box used to be, warnings, upgrade, auto-build.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/screens/BuilderScreen.jsx
git commit -m "feat: Build tab shows the rating panel and uses a wider desktop layout"
```

---

## Task 4: Rewire the Upgrade flow to land on the Build tab

**Files:**
- Modify: `src/components/UpgradeWizard.jsx` (replace whole file)
- Test: `src/tests/UpgradeWizard.test.jsx` (replace whole file)

**Context:** The wizard loses its `dashboard` screen (that rating/upgrade interaction now lives on the Build tab). Flow becomes `specs → usecase`; the final button sets the store `useCase` + build + resolution + budget and enters the Build tab.

- [ ] **Step 1: Replace `src/tests/UpgradeWizard.test.jsx` entirely**

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import UpgradeWizard from '../components/UpgradeWizard'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import useCatalogStore from '../store/useCatalogStore'
import { encodeBuild } from '../lib/buildCodec'

const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const gpuHi = { id: 'gpu-hi', category: 'gpu', name: 'GPU Hi', price: 600, perfScore: 300, tdp: 250, length: 300 }
const game  = { id: 'fortnite', name: 'Fortnite', fpsFactor: 1, cpuFactor: 1 }

function loadSavedRig() {
  fireEvent.click(screen.getByRole('button', { name: /select saved build/i }))
  fireEvent.click(screen.getByRole('button', { name: /my rig/i }))
}

beforeEach(() => {
  window.location.hash = ''
  useCatalogStore.setState({ parts: [cpuLo, gpuHi], games: [game] })
  useBuilderStore.setState({ budget: 0, flow: 'upgrade', selectedParts: {}, resolution: '1440p', useCase: 'gaming' })
  const code = encodeBuild({ budget: 0, resolution: '1440p', parts: { cpu: cpuLo, gpu: gpuHi }, peripherals: {} })
  useSavedStore.setState({ saved: [{ id: 's1', name: 'My rig', savedAt: 1, code }] })
})

describe('UpgradeWizard flow', () => {
  it('requires CPU and GPU before continuing to the use case', () => {
    render(<UpgradeWizard onBack={() => {}} />)
    expect(screen.getByRole('button', { name: /next: use case/i })).toBeDisabled()
  })

  it('highlights a saved build when selected', () => {
    render(<UpgradeWizard onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /select saved build/i }))
    const card = screen.getByRole('button', { name: /my rig/i })
    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /next: use case/i })).not.toBeDisabled()
  })

  it('opens the current rig in the Build tab for the chosen use case', () => {
    window.location.hash = 'summary'
    render(<UpgradeWizard onBack={() => {}} />)
    loadSavedRig()
    fireEvent.click(screen.getByRole('button', { name: /next: use case/i }))
    fireEvent.click(screen.getByRole('button', { name: /^gaming/i }))
    fireEvent.click(screen.getByRole('button', { name: /open in build/i }))

    const s = useBuilderStore.getState()
    expect(s.selectedParts.cpu.id).toBe('cpu-lo')
    expect(s.selectedParts.gpu.id).toBe('gpu-hi')
    expect(s.useCase).toBe('gaming')
    expect(s.budget).toBe(700) // 100 (cpu-lo) + 600 (gpu-hi)
    expect(s.resolution).toBe('1440p')
    expect(window.location.hash).toBe('#build')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/UpgradeWizard.test.jsx`
Expected: FAIL — the current wizard still has the `See ratings →` dashboard step, no `Open in Build`.

- [ ] **Step 3: Replace `src/components/UpgradeWizard.jsx` entirely**

```jsx
import { useState } from 'react'
import Backdrop from './Backdrop'
import CategoryList from './CategoryList'
import PartSelector from './PartSelector'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import { decodeBuild } from '../lib/buildCodec'
import { BUILD_PROFILES, USE_CASES } from '../lib/buildProfiles'
import { enterBuildTab } from '../lib/enterBuildTab'
import { PANEL, BTN_PRIMARY, TELEMETRY } from '../lib/uiTokens'

const totalOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)

export default function UpgradeWizard({ onBack }) {
  const [screen, setScreen] = useState('specs')      // 'specs' | 'usecase'
  const [tab, setTab] = useState('build')
  const [currentParts, setCurrentParts] = useState({})
  const [savedSelectedId, setSavedSelectedId] = useState(null)
  const [pickerCategory, setPickerCategory] = useState(null)
  const [useCase, setUseCase] = useState('gaming')

  const saved     = useSavedStore((s) => s.saved)
  const setBuild           = useBuilderStore((s) => s.setBuild)
  const setBudget          = useBuilderStore((s) => s.setBudget)
  const setStoreResolution = useBuilderStore((s) => s.setResolution)
  const setStoreUseCase    = useBuilderStore((s) => s.setUseCase)
  const setLastGenerated   = useBuilderStore((s) => s.setLastGenerated)

  const hasCore = Boolean(currentParts.cpu && currentParts.gpu)
  const profile = BUILD_PROFILES[useCase]

  function selectPart(part) { setCurrentParts((p) => ({ ...p, [part.category]: part })); setPickerCategory(null) }
  function deselect(category) { setCurrentParts((p) => { const n = { ...p }; delete n[category]; return n }) }
  function loadSaved(b) {
    const d = decodeBuild(b.code)
    if (!d) return
    setSavedSelectedId(b.id)
    setCurrentParts(d.parts)
  }
  function openInBuild() {
    setStoreUseCase(useCase)
    enterBuildTab()
    setBuild(currentParts)
    setStoreResolution(profile.resolution)
    const spend = totalOf(currentParts)
    setLastGenerated({ upgrade: true, useCase, spend, budget: spend })
    setBudget(spend) // flips App → BuilderScreen on the Build tab
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center text-white bg-[#05080f] py-12">
      <Backdrop />
      <div className="relative z-10 w-full max-w-2xl px-4">
        <h1 className="rise text-3xl font-bold mb-1 text-center">Upgrade your PC</h1>
        <ol className="rise flex items-center justify-center gap-2 mb-8 text-[11px] uppercase tracking-wider">
          {['Current PC', 'Use case'].map((label, i) => {
            const active = (screen === 'specs' && i === 0) || (screen === 'usecase' && i === 1)
            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 && <span className="text-slate-700">→</span>}
                <span className={active ? 'text-cyan-300' : 'text-slate-500'}>{i + 1} {label}</span>
              </li>
            )
          })}
        </ol>

        {screen === 'specs' && (
          <div className={`${PANEL} p-5 rise`}>
            <div className="inline-flex rounded-sm border border-slate-800/60 p-0.5 mb-4">
              <button onClick={() => setTab('build')} className={`px-3 py-1 text-xs rounded-sm ${tab === 'build' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Build current PC</button>
              <button onClick={() => setTab('saved')} className={`px-3 py-1 text-xs rounded-sm ${tab === 'saved' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Select saved build</button>
            </div>

            {tab === 'build' ? (
              <CategoryList selectedParts={currentParts} onSelectCategory={setPickerCategory} onDeselect={deselect} />
            ) : saved.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No saved builds yet. Build one first, or use the "Build current PC" tab.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500">Pick one of your saved builds to rate and upgrade.</p>
                {saved.map((b) => {
                  const on = savedSelectedId === b.id
                  const d = decodeBuild(b.code)
                  const total = d ? Object.values(d.parts).reduce((s, p) => s + (p?.price ?? 0), 0) : 0
                  return (
                    <button
                      key={b.id}
                      onClick={() => loadSaved(b)}
                      aria-pressed={on}
                      className={`w-full text-left border rounded-sm px-3 py-2.5 transition-colors
                        ${on ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-700/70 hover:border-slate-500'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-100">{b.name}</span>
                        <span className={`${TELEMETRY} text-xs ${on ? 'text-cyan-300' : 'text-slate-400'}`}>£{total.toFixed(0)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{new Date(b.savedAt).toLocaleDateString()}</div>
                    </button>
                  )
                })}
              </div>
            )}

            <p className="text-[11px] text-slate-500 mt-4">CPU and GPU are required — they drive the rating.</p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setScreen('usecase')}
                disabled={!hasCore}
                className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              >
                Next: use case →
              </button>
              <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back to menu</button>
            </div>
          </div>
        )}

        {screen === 'usecase' && (
          <div className={`${PANEL} p-5 rise`}>
            <p className="text-sm text-slate-300 mb-4">What do you use this PC for? We'll rate it for that.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {USE_CASES.map((u) => {
                const on = useCase === u.id
                return (
                  <button
                    key={u.id}
                    onClick={() => setUseCase(u.id)}
                    aria-pressed={on}
                    className={`px-4 py-3 rounded-sm border text-left transition-colors
                      ${on ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-700/70 hover:border-cyan-400'}`}
                  >
                    <div className={`text-sm font-semibold ${on ? 'text-cyan-200' : 'text-slate-100'}`}>{u.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{u.blurb}</div>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button onClick={openInBuild} className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium transition-colors`}>Open in Build →</button>
              <button onClick={() => setScreen('specs')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Current PC</button>
            </div>
          </div>
        )}
      </div>

      {pickerCategory && (
        <PartSelector category={pickerCategory} contextParts={currentParts} ignoreBudget onSelect={selectPart} onClose={() => setPickerCategory(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/UpgradeWizard.test.jsx`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/components/UpgradeWizard.jsx src/tests/UpgradeWizard.test.jsx
git commit -m "feat: Upgrade flow lands on the Build tab; rating lives on the page now"
```

---

## Task 5: New-PC flow writes the store `useCase`

**Files:**
- Modify: `src/components/BudgetEntry.jsx`
- Test: `src/tests/BudgetEntry.test.jsx` (append one test + one beforeEach field)

**Context:** The tier buttons only prefill the budget and jump to step 2, so the only build entry points are `generate()` and `startEmpty()` — both must write the store `useCase` so the Build-tab panel opens on the right one.

- [ ] **Step 1: Add the failing test**

In `src/tests/BudgetEntry.test.jsx`, add `useCase: 'gaming'` to the `beforeEach` `setState` object (so tests don't leak a use case between runs):

```js
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p', lastGenerated: null, useCase: 'gaming' })
```

Then add this test inside the `describe('BudgetEntry wizard', ...)` block:

```jsx
  it('stores the picked use case for the build-page rating', () => {
    render(<BudgetEntry onSubmit={() => {}} onBack={() => {}} />)
    enterBudget('1500')
    fireEvent.click(screen.getByRole('button', { name: /programming/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    expect(useBuilderStore.getState().useCase).toBe('programming')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/BudgetEntry.test.jsx`
Expected: FAIL — `useCase` stays `gaming` (component never writes the store `useCase`).

- [ ] **Step 3: Wire `setUseCase` into `BudgetEntry.jsx`**

3a. Add the store action read after the `setLastGenerated` read (currently line 20):

```jsx
  const setStoreUseCase = useBuilderStore((s) => s.setUseCase)
```

3b. In `generate()`, add `setStoreUseCase(useCase)` right after `setBuild(parts)`:

```jsx
  function generate() {
    const profile = BUILD_PROFILES[useCase]
    const parts = buildForUseCase(budgetNum, useCase, partsData)
    enterBuildTab()
    setResolution(profile.resolution)
    setBuild(parts)
    setStoreUseCase(useCase)
    setLastGenerated({ useCase, spend: totalOf(parts), budget: budgetNum })
    onSubmit(budgetNum)
  }
```

3c. In `startEmpty()`, add `setStoreUseCase(useCase)` after `clearBuild()`:

```jsx
  function startEmpty() {
    enterBuildTab()
    clearBuild()
    setStoreUseCase(useCase)
    setResolution(BUILD_PROFILES[useCase].resolution)
    onSubmit(budgetNum)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/BudgetEntry.test.jsx`
Expected: PASS (all existing + the new one).

- [ ] **Step 5: Commit**

```bash
git add src/components/BudgetEntry.jsx src/tests/BudgetEntry.test.jsx
git commit -m "feat: new-PC flow stores the chosen use case for the build-page rating"
```

---

## Task 6: E2E + full suite + lint green

**Files:**
- Modify: `e2e/wizard.spec.js`
- Verify: full unit suite, lint, E2E.

- [ ] **Step 1: Assert the rating panel on the Build tab in the E2E**

In `e2e/wizard.spec.js`, immediately after the two "Selected parts are visible" `expect` lines (after the `remove gpu` assertion, before the summary-tab navigation), add:

```js
  // The Build tab now rates the generated build inline.
  await expect(page.getByText('/100')).toBeVisible()
```

- [ ] **Step 2: Run the E2E**

Run: `npm run test:e2e`
Expected: PASS (1). If the dev server isn't auto-started by the Playwright config, start it first, then re-run.

- [ ] **Step 3: Run the full unit suite**

Run: `npm run test:run`
Expected: all green (prior suite + `builderStoreUseCase` 3 + `BuildRatingPanel` 4 + rewritten `UpgradeWizard` 3 + new `BudgetEntry` case).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no NEW errors (only the 2 known pre-existing `SpecSheet.jsx` errors, if still present). Fix any unused-import lint errors introduced by the `BuilderScreen`/`UpgradeWizard` edits (e.g. a leftover import).

- [ ] **Step 5: Commit**

```bash
git add e2e/wizard.spec.js
git commit -m "test: assert the rating panel appears on the Build tab after generate"
```

---

## Final review

After all tasks, dispatch a code-reviewer over the whole diff and confirm:
- The rating panel reuses `PANEL`/`TELEMETRY` and `rounded-sm` — no new card styling; the box matches the panels it replaced.
- Each part row is `part → score → improvement dropdown`; selecting an option calls `addPart` and the parts list + 3D + overall score update.
- The header use-case dropdown re-rates live and writes the store `useCase`.
- `BottleneckIndicator` and `GamePerformancePanel` are gone from the Build view but still exist as files with passing unit tests; `gameFps`/`GamePerformanceList` untouched.
- Both entry flows set the store `useCase`; the Upgrade flow has no dashboard screen and lands on `#build`.
- Full unit suite + E2E green; lint clean except the known `SpecSheet.jsx` errors.
- Eyeball desktop (1440 + 1920) and mobile (375): wider layout, all panels visible over the WebGL canvas (see [[webgl-verification-gotchas]]), dropdown swaps work.

## Notes for the implementer

- Do NOT touch `autoBuilder.js`, `maxOutBudget.js`, `GeneratedBanner.jsx`, `upgradeAdvisor.js`, or `partRatings.js` — Stage 1 reuses the rating libs as-is; the builder-logic changes are Stage 2.
- `rateBuild(parts, useCase, catalog)` → `{ overall, verdict, parts: { [cat]: { score, level, part, isWeakLink, reason } } }`; `{ overall:0, verdict, parts:{} }` when cpu/gpu missing.
- `addPart(category, part)` is the live single-part swap already in the store.
- The score bar's `style={{ width }}` is the one intentional inline style (allowed under the CSP's `style-src 'unsafe-inline'`).
- `buildForUseCase(budget, useCase, partsData)` is the builder function name (not `useCaseBuild`).
