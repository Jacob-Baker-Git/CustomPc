# Entry flows + desktop Build layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a main menu (Build new / Upgrade), a desktop-only Build-tab layout, an Upgrade-your-PC flow with ranked CPU/GPU suggestions, and fix the wizard sometimes landing on Summary.

**Architecture:** Reuse existing components and the existing visual language — no restyle. Routing is driven by a new transient `flow` field in the builder store plus the existing `budget>0` builder gate. The desktop Build layout is one DOM (single WebGL canvas) reflowed with CSS grid-areas at `lg`. The upgrade flow is a self-contained wizard writing to local state until "Apply", which loads the store like a saved build does.

**Tech Stack:** React 19, Zustand, Tailwind, Vitest + Testing Library, Playwright.

**Conventions:** Commit after each task. Commit messages use `feat:`/`fix:`/`refactor:` and end with the trailer:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
Run tests with `npm run test:run -- <path>` (single file) or `npm run test:run` (all). Do not push/deploy unless the user asks.

---

## File structure

- `src/lib/enterBuildTab.js` (new) — one-liner that forces the URL hash to `#build`.
- `src/store/useBuilderStore.js` (edit) — add transient `flow` / `setFlow`.
- `src/components/MainMenu.jsx` (new) — two-option landing screen.
- `src/components/UpgradeWizard.jsx` (new) — the upgrade flow (created as a stub in Task 4, fleshed out in Task 10).
- `src/App.jsx` (edit) — route menu / new / upgrade / builder.
- `src/components/TopBar.jsx` (edit) — back arrow returns to the menu.
- `src/components/CategoryList.jsx` (edit) — optional `columns={2}` grid mode.
- `src/index.css` (edit) — `.build-grid` desktop grid-areas.
- `src/screens/BuilderScreen.jsx` (edit) — responsive Build layout.
- `src/lib/upgradeAdvisor.js` (edit) — add `upgradeCandidates` + `sortCandidates`.
- `src/components/PartSelector.jsx` (edit) — optional `contextParts` / `ignoreBudget` seam.
- `e2e/wizard.spec.js` (edit) — start via "Build a new PC".
- New tests under `src/tests/`.

---

## Task 1: `enterBuildTab` helper + wizard always lands on Build (Feature 4)

**Files:**
- Create: `src/lib/enterBuildTab.js`
- Modify: `src/components/BudgetEntry.jsx` (functions `enterBuilder`, `startEmpty`, `applyTier`)
- Test: `src/tests/BudgetEntry.test.jsx` (add one test)

- [ ] **Step 1: Write the helper**

Create `src/lib/enterBuildTab.js`:

```js
// Force the Build tab when entering the builder from a wizard/menu. Without
// this, useHashView restores a stale #summary/#saved from a previous session
// and the freshly generated build opens on the wrong tab.
export function enterBuildTab() {
  if (typeof window !== 'undefined') window.location.hash = 'build'
}
```

- [ ] **Step 2: Add the failing test**

In `src/tests/BudgetEntry.test.jsx`, add inside the existing `describe`:

```jsx
it('always lands on the Build tab even if the URL hash was left on summary', () => {
  window.location.hash = 'summary'
  render(<BudgetEntry onSubmit={() => {}} />)
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '900' } })
  fireEvent.click(screen.getByRole('button', { name: /next: resolution/i }))
  fireEvent.click(screen.getByRole('button', { name: /1080p/i }))
  fireEvent.click(screen.getByRole('button', { name: /next: fps target/i }))
  fireEvent.click(screen.getByRole('button', { name: /start empty/i }))
  expect(window.location.hash).toBe('#build')
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:run -- src/tests/BudgetEntry.test.jsx`
Expected: FAIL — hash is `#summary`, not `#build`.

- [ ] **Step 4: Wire the helper into BudgetEntry**

In `src/components/BudgetEntry.jsx`, add the import near the top:

```jsx
import { enterBuildTab } from '../lib/enterBuildTab'
```

Call `enterBuildTab()` as the first line of `enterBuilder`, `startEmpty`, and `applyTier`. Example for `applyTier`:

```jsx
function applyTier(tier) {
  enterBuildTab()
  setResolution(tier.resolution)
  setBuild(partsForTier(tier, partsData))
  onSubmit(tier.budget)
}
```

Do the same (first line `enterBuildTab()`) in `enterBuilder` and `startEmpty`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:run -- src/tests/BudgetEntry.test.jsx`
Expected: PASS (all existing tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/enterBuildTab.js src/components/BudgetEntry.jsx src/tests/BudgetEntry.test.jsx
git commit -m "fix: always open the Build tab after the wizard"
```

---

## Task 2: `flow` routing field in the builder store (Feature 1)

**Files:**
- Modify: `src/store/useBuilderStore.js`
- Test: `src/tests/builderStoreFlow.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `src/tests/builderStoreFlow.test.js`:

```js
import useBuilderStore from '../store/useBuilderStore'

describe('builder store flow field', () => {
  it('defaults to the menu', () => {
    expect(useBuilderStore.getState().flow).toBe('menu')
  })
  it('setFlow updates the flow', () => {
    useBuilderStore.getState().setFlow('upgrade')
    expect(useBuilderStore.getState().flow).toBe('upgrade')
    useBuilderStore.getState().setFlow('menu')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/builderStoreFlow.test.js`
Expected: FAIL — `flow` is undefined.

- [ ] **Step 3: Add the field to the store**

In `src/store/useBuilderStore.js`, add these two lines inside the store object (e.g. just after `setBudget`):

```js
  // Which pre-builder screen is showing. Transient — NOT in partialize, so a
  // refresh with a persisted build still skips straight to the builder.
  flow: 'menu',
  setFlow: (flow) => set({ flow }),
```

Leave `partialize` unchanged (it must NOT include `flow`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/builderStoreFlow.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/useBuilderStore.js src/tests/builderStoreFlow.test.js
git commit -m "feat: add transient flow field for menu routing"
```

---

## Task 3: MainMenu component (Feature 1)

**Files:**
- Create: `src/components/MainMenu.jsx`
- Test: `src/tests/MainMenu.test.jsx` (new)

- [ ] **Step 1: Write the failing test**

Create `src/tests/MainMenu.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import MainMenu from '../components/MainMenu'

describe('MainMenu', () => {
  it('shows both entry options', () => {
    render(<MainMenu onNew={() => {}} onUpgrade={() => {}} />)
    expect(screen.getByRole('button', { name: /build a new pc/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade your pc/i })).toBeInTheDocument()
  })
  it('calls the right handler for each option', () => {
    const onNew = vi.fn()
    const onUpgrade = vi.fn()
    render(<MainMenu onNew={onNew} onUpgrade={onUpgrade} />)
    fireEvent.click(screen.getByRole('button', { name: /build a new pc/i }))
    fireEvent.click(screen.getByRole('button', { name: /upgrade your pc/i }))
    expect(onNew).toHaveBeenCalledTimes(1)
    expect(onUpgrade).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/MainMenu.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/MainMenu.jsx`:

```jsx
import { Cpu, Wrench } from 'lucide-react'
import Backdrop from './Backdrop'

export default function MainMenu({ onNew, onUpgrade }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-white bg-[#05080f]">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center px-4">
        <h1 className="text-5xl font-bold mb-3 text-white">PC <span className="text-cyan-400">Builder</span></h1>
        <p className="text-gray-400 mb-10 text-lg">What would you like to do?</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onNew}
            className="w-64 px-6 py-8 rounded-sm border border-slate-700/70 hover:border-cyan-400 hover:bg-cyan-500/10 text-left transition-colors group"
          >
            <Cpu size={28} className="text-cyan-300 mb-3" aria-hidden="true" />
            <div className="text-xl font-semibold group-hover:text-cyan-200">Build a new PC</div>
            <div className="text-sm text-slate-400 mt-1">Start from your budget and build up.</div>
          </button>
          <button
            onClick={onUpgrade}
            className="w-64 px-6 py-8 rounded-sm border border-slate-700/70 hover:border-cyan-400 hover:bg-cyan-500/10 text-left transition-colors group"
          >
            <Wrench size={28} className="text-cyan-300 mb-3" aria-hidden="true" />
            <div className="text-xl font-semibold group-hover:text-cyan-200">Upgrade your PC</div>
            <div className="text-sm text-slate-400 mt-1">Tell us your current rig and goal.</div>
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/MainMenu.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MainMenu.jsx src/tests/MainMenu.test.jsx
git commit -m "feat: add main menu with build-new and upgrade options"
```

---

## Task 4: UpgradeWizard stub (Feature 1 — lets App import it)

**Files:**
- Create: `src/components/UpgradeWizard.jsx`
- Test: `src/tests/UpgradeWizard.test.jsx` (new)

This is a minimal shell so App routing (Task 5) compiles. Task 10 replaces the body.

- [ ] **Step 1: Write the failing test**

Create `src/tests/UpgradeWizard.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import UpgradeWizard from '../components/UpgradeWizard'

describe('UpgradeWizard shell', () => {
  it('shows the heading and a back-to-menu control', () => {
    const onBack = vi.fn()
    render(<UpgradeWizard onBack={onBack} />)
    expect(screen.getByRole('heading', { name: /upgrade your pc/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/UpgradeWizard.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the stub**

Create `src/components/UpgradeWizard.jsx`:

```jsx
import Backdrop from './Backdrop'

export default function UpgradeWizard({ onBack }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center text-white bg-[#05080f] py-12">
      <Backdrop />
      <div className="relative z-10 w-full max-w-2xl px-4">
        <h1 className="text-3xl font-bold mb-2 text-center">Upgrade your PC</h1>
        <button onClick={onBack} className="mt-8 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          ← Back to menu
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/UpgradeWizard.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/UpgradeWizard.jsx src/tests/UpgradeWizard.test.jsx
git commit -m "feat: add UpgradeWizard shell"
```

---

## Task 5: App routing + TopBar back-to-menu (Feature 1)

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/TopBar.jsx`
- Test: `src/tests/AppRouting.test.jsx` (new)

- [ ] **Step 1: Write the failing test**

Create `src/tests/AppRouting.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../App'
import useBuilderStore from '../store/useBuilderStore'

// Keep three.js out of the routing test — only the branch choice matters.
vi.mock('../components/BuildCanvas', () => ({ default: () => <div data-testid="canvas" /> }))
// Avoid the Supabase fetch in App's mount effect.
vi.mock('../store/useCatalogStore', async () => {
  const actual = await vi.importActual('../store/useCatalogStore')
  return { ...actual, loadCatalog: vi.fn() }
})

beforeEach(() => {
  window.location.hash = ''
  useBuilderStore.setState({
    budget: 0, flow: 'menu', selectedParts: {}, selectedPeripherals: {}, resolution: '1440p',
  })
})

describe('App routing', () => {
  it('shows the main menu when there is no build in progress', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /build a new pc/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade your pc/i })).toBeInTheDocument()
  })
  it('routes to the new-build wizard', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /build a new pc/i }))
    expect(screen.getByText(/what's your budget/i)).toBeInTheDocument()
  })
  it('routes to the upgrade wizard', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /upgrade your pc/i }))
    expect(screen.getByRole('heading', { name: /upgrade your pc/i })).toBeInTheDocument()
  })
  it('shows the builder once a budget is set', () => {
    useBuilderStore.setState({ budget: 1500 })
    render(<App />)
    expect(screen.getByRole('button', { name: /^peripherals$/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/AppRouting.test.jsx`
Expected: FAIL — App still renders `BudgetEntry` at `budget===0`, no menu.

- [ ] **Step 3: Rewrite App.jsx routing**

Replace the body of `src/App.jsx` with:

```jsx
import { useEffect } from 'react'
import BudgetEntry from './components/BudgetEntry'
import BuilderScreen from './screens/BuilderScreen'
import MainMenu from './components/MainMenu'
import UpgradeWizard from './components/UpgradeWizard'
import useBuilderStore from './store/useBuilderStore'
import { loadCatalog } from './store/useCatalogStore'

export default function App() {
  const budget    = useBuilderStore((s) => s.budget)
  const setBudget = useBuilderStore((s) => s.setBudget)
  const flow      = useBuilderStore((s) => s.flow)
  const setFlow   = useBuilderStore((s) => s.setFlow)

  useEffect(() => { loadCatalog() }, [])

  if (budget > 0) return <BuilderScreen />
  if (flow === 'new')     return <BudgetEntry onSubmit={setBudget} onBack={() => setFlow('menu')} />
  if (flow === 'upgrade') return <UpgradeWizard onBack={() => setFlow('menu')} />
  return <MainMenu onNew={() => setFlow('new')} onUpgrade={() => setFlow('upgrade')} />
}
```

- [ ] **Step 4: Point the TopBar back arrow at the menu**

In `src/components/TopBar.jsx`:

Add `setFlow` to the store reads (near `setBudget`):

```jsx
  const setFlow    = useBuilderStore((s) => s.setFlow)
```

Change the back button's handler, aria and title:

```jsx
      <button
        onClick={() => { setBudget(0); setFlow('menu') }}
        aria-label="Back to menu"
        title="Back to the main menu (your build is kept)"
        className="w-7 h-7 flex items-center justify-center rounded-sm border border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
      >
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/tests/AppRouting.test.jsx src/tests/TopBar.test.jsx`
Expected: PASS. If `TopBar.test.jsx` asserts the old aria/title text, update those strings to match ("Back to menu").

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/TopBar.jsx src/tests/AppRouting.test.jsx src/tests/TopBar.test.jsx
git commit -m "feat: route through the main menu; TopBar returns to menu"
```

---

## Task 6: CategoryList 2-column mode (Feature 2)

**Files:**
- Modify: `src/components/CategoryList.jsx`
- Test: `src/tests/CategoryList.test.jsx` (add tests)

- [ ] **Step 1: Write the failing tests**

Add to `src/tests/CategoryList.test.jsx`:

```jsx
it('renders a single-column list by default', () => {
  const { container } = render(
    <CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} />
  )
  expect(container.firstChild).toHaveClass('space-y-2')
})

it('renders a grid when columns=2 (desktop parts area)', () => {
  const { container } = render(
    <CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} columns={2} />
  )
  expect(container.firstChild).toHaveClass('grid')
  expect(container.firstChild).toHaveClass('lg:grid-cols-2')
})
```

(Ensure `render` is imported in this file; the existing tests already use Testing Library.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/tests/CategoryList.test.jsx`
Expected: FAIL — default wrapper is `space-y-2` (first test passes) but the `columns=2` grid test fails.

- [ ] **Step 3: Add the columns prop**

In `src/components/CategoryList.jsx`, change the signature and wrapper:

```jsx
export default function CategoryList({ selectedParts, onSelectCategory, onDeselect, columns = 1 }) {
  const next = nextRecommended(selectedParts)
  const wrap = columns === 2 ? 'grid grid-cols-1 lg:grid-cols-2 gap-2' : 'space-y-2'

  return (
    <div className={wrap}>
```

Leave the rest of the component unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/tests/CategoryList.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CategoryList.jsx src/tests/CategoryList.test.jsx
git commit -m "feat: add 2-column grid mode to CategoryList"
```

---

## Task 7: Desktop Build layout (Feature 2)

**Files:**
- Modify: `src/index.css`
- Modify: `src/screens/BuilderScreen.jsx`
- Verify: preview (mobile + desktop) — layout is visual, not unit-testable in jsdom.

- [ ] **Step 1: Add the grid CSS**

Append to `src/index.css` (after the `@tailwind` lines):

```css
/* Desktop-only Build-tab layout: 3D on the right, bottleneck + how-it-runs on
   the left, everything else full-width below. Below lg it is a plain flex
   column, so the child DOM order IS the (unchanged) mobile order. Every child
   sits above the WebGL canvas child to avoid the known compositing gotcha
   where content paints invisibly under the canvas. */
.build-grid { display: flex; flex-direction: column; gap: 0.75rem; }
.build-grid > * { position: relative; z-index: 1; }
.build-grid > .area-viz { z-index: 0; }

@media (min-width: 1024px) {
  .build-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    grid-template-areas:
      "bottleneck viz"
      "perf       viz"
      "banner     banner"
      "parts      parts"
      "warnings   warnings"
      "upgrade    upgrade"
      "autobuild  autobuild";
    align-items: start;
    gap: 1rem;
  }
  .build-grid > .area-viz        { grid-area: viz; }
  .build-grid > .area-bottleneck { grid-area: bottleneck; }
  .build-grid > .area-perf       { grid-area: perf; }
  .build-grid > .area-banner     { grid-area: banner; }
  .build-grid > .area-parts      { grid-area: parts; }
  .build-grid > .area-warnings   { grid-area: warnings; }
  .build-grid > .area-upgrade    { grid-area: upgrade; }
  .build-grid > .area-autobuild  { grid-area: autobuild; }
}
```

- [ ] **Step 2: Restructure the Build view**

In `src/screens/BuilderScreen.jsx`, replace the `view === 'build'` block (the outer `<div>` containing the canvas block and the `relative z-10 transform-gpu` column) with:

```jsx
        {view === 'build' ? (
          <div className="relative z-10 transform-gpu w-full max-w-2xl lg:max-w-6xl mx-auto p-4 pb-12">
            <div className="build-grid">
              <div className="area-viz relative h-[42vh] md:h-[48vh] lg:h-full lg:min-h-[60vh]">
                <CanvasErrorBoundary>
                  <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm motion-safe:animate-pulse">Assembling 3D…</div>}>
                    <BuildCanvas selectedParts={selectedParts} />
                  </Suspense>
                </CanvasErrorBoundary>
                <InfoDisclaimer />
                <div className="absolute bottom-3 right-3"><CaseToggle /></div>
              </div>
              <div className="area-banner"><GeneratedBanner /></div>
              <div className="area-parts">
                <CategoryList
                  selectedParts={selectedParts}
                  onSelectCategory={setActiveCategory}
                  onDeselect={removePart}
                  columns={2}
                />
              </div>
              <div className="area-bottleneck"><BottleneckIndicator /></div>
              <div className="area-perf"><GamePerformancePanel /></div>
              <div className="area-warnings"><BuildWarnings /></div>
              <div className="area-upgrade"><UpgradeSuggestion /></div>
              <div className="area-autobuild"><AutoBuildButton /></div>
            </div>
          </div>
        ) : view === 'peripherals' ? (
```

Leave the other `view` branches and the rest of the file unchanged.

- [ ] **Step 3: Run the full unit suite (no regressions)**

Run: `npm run test:run`
Expected: PASS — existing BuilderScreen-related tests still pass (the same components render, just re-wrapped).

- [ ] **Step 4: Verify in the browser preview**

Start the dev server (preview_start with the project's dev config) and:
- Desktop (resize 1280×800): confirm the Build tab shows bottleneck + how-it-runs on the left, the 3D model on the right, and parts as a 2-column grid full-width below — and that **all panels are visible** (none painted blank under the canvas).
- Mobile (resize 375×812): confirm the Build tab looks unchanged — canvas on top, then banner, parts (single column), bottleneck, how-it-runs, warnings, upgrade, auto-build, in that order.
- If any panel is blank/hidden under the canvas, confirm the `.build-grid > *` z-index rules from Step 1 are present; they force every non-canvas child above the canvas.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/screens/BuilderScreen.jsx
git commit -m "feat: desktop Build layout — 3D right, panels left, parts below"
```

---

## Task 8: `upgradeCandidates` + `sortCandidates` advisor (Feature 3)

**Files:**
- Modify: `src/lib/upgradeAdvisor.js`
- Test: `src/tests/upgradeCandidates.test.js` (new)

- [ ] **Step 1: Write the failing tests**

Create `src/tests/upgradeCandidates.test.js`:

```js
import { upgradeCandidates, sortCandidates } from '../lib/upgradeAdvisor'

// CPU-limited rig: only CPU upgrades move the min(cpu, gpu) FPS, so a GPU-only
// swap yields ~0 gain and must be dropped.
const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const cpuHi = { id: 'cpu-hi', category: 'cpu', name: 'CPU Hi', price: 300, perfScore: 250, tdp: 105, socket: 'AM5' }
const gpuLo = { id: 'gpu-lo', category: 'gpu', name: 'GPU Lo', price: 200, perfScore: 300, tdp: 200, length: 250 }
const gpuHi = { id: 'gpu-hi', category: 'gpu', name: 'GPU Hi', price: 600, perfScore: 600, tdp: 320, length: 300 }
const catalog = [cpuLo, cpuHi, gpuLo, gpuHi]
const game = { id: 'g', name: 'G', fpsFactor: 1, cpuFactor: 1 }
const cur = { cpu: cpuLo, gpu: gpuLo }

describe('upgradeCandidates', () => {
  it('includes the bottleneck-side (CPU) upgrade, drops the no-gain GPU swap', () => {
    const r = upgradeCandidates(cur, { game, resolution: '1080p', targetFps: 1, budget: 1000 }, catalog)
    const ids = r.map((c) => c.toPart.id)
    expect(ids).toContain('cpu-hi')
    expect(ids).not.toContain('gpu-hi')
    r.forEach((c) => expect(c.fpsGain).toBeGreaterThan(0))
    const cpuUp = r.find((c) => c.toPart.id === 'cpu-hi')
    expect(cpuUp.extraCost).toBe(200)
    expect(typeof cpuUp.fixesBottleneck).toBe('boolean')
  })
  it('excludes candidates over the upgrade budget', () => {
    const r = upgradeCandidates(cur, { game, resolution: '1080p', targetFps: 1, budget: 150 }, catalog)
    expect(r.map((c) => c.toPart.id)).not.toContain('cpu-hi') // +200 over 150
  })
  it('flags meetsGoal against the target FPS', () => {
    const easy = upgradeCandidates(cur, { game, resolution: '1080p', targetFps: 1, budget: 1000 }, catalog)
    expect(easy.some((c) => c.meetsGoal)).toBe(true)
    const hard = upgradeCandidates(cur, { game, resolution: '1080p', targetFps: 100000, budget: 1000 }, catalog)
    expect(hard.every((c) => c.meetsGoal === false)).toBe(true)
  })
  it('returns [] without a CPU or GPU', () => {
    expect(upgradeCandidates({ cpu: cpuLo }, { game, resolution: '1080p', targetFps: 1, budget: 1000 }, catalog)).toEqual([])
  })
})

describe('sortCandidates', () => {
  const list = [
    { toPart: { id: 'a' }, fpsGain: 10, extraCost: 200, pricePerFps: 20 },
    { toPart: { id: 'b' }, fpsGain: 30, extraCost: 600, pricePerFps: 20 },
    { toPart: { id: 'c' }, fpsGain: 5,  extraCost: 0,   pricePerFps: 0 },
  ]
  it('value: lowest £/FPS first (free upgrade wins)', () => {
    expect(sortCandidates(list, 'value').map((c) => c.toPart.id)).toEqual(['c', 'a', 'b'])
  })
  it('gain: most FPS first', () => {
    expect(sortCandidates(list, 'gain').map((c) => c.toPart.id)).toEqual(['b', 'a', 'c'])
  })
  it('cost: cheapest first', () => {
    expect(sortCandidates(list, 'cost').map((c) => c.toPart.id)).toEqual(['c', 'a', 'b'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/tests/upgradeCandidates.test.js`
Expected: FAIL — `upgradeCandidates`/`sortCandidates` not exported.

- [ ] **Step 3: Implement the functions**

In `src/lib/upgradeAdvisor.js`, add these imports at the top (keep the existing ones):

```js
import { gameFps } from './gameFps'
import { computeBottleneck } from './bottleneck'
```

Append to the file:

```js
// Ranked, filterable upgrade candidates for the Upgrade-your-PC flow. Only
// CPU/GPU swaps move the FPS needle (same rule as suggestUpgrade). `budget` is
// the extra spend allowed for the swap (not the whole build).
export function upgradeCandidates(currentParts, { game, resolution, targetFps, budget }, catalog) {
  const cpu = currentParts.cpu
  const gpu = currentParts.gpu
  if (!cpu || !gpu || !game) return []

  const baseFps = gameFps(cpu, gpu, resolution, game, 'high')
  const before = computeBottleneck(cpu, gpu, resolution)

  const out = []
  for (const category of UPGRADEABLE) {
    const current = currentParts[category]
    if (!current) continue

    for (const cand of catalog) {
      if (cand.category !== category) continue
      if ((cand.perfScore ?? 0) <= (current.perfScore ?? 0)) continue

      const extraCost = cand.price - current.price
      if (extraCost > budget) continue

      const { compatible } = checkCompatibility(currentParts, cand)
      if (!compatible) continue

      const next = { ...currentParts, [category]: cand }
      const resultFps = gameFps(next.cpu, next.gpu, resolution, game, 'high')
      const fpsGain = resultFps - baseFps
      if (fpsGain < MIN_GAIN) continue

      const after = computeBottleneck(next.cpu, next.gpu, resolution)
      out.push({
        category,
        fromPart: current,
        toPart: cand,
        fpsGain,
        extraCost,
        resultFps,
        pricePerFps: extraCost <= 0 ? 0 : extraCost / fpsGain,
        meetsGoal: resultFps >= targetFps,
        fixesBottleneck: Boolean(
          before && after && before.limitedBy !== 'none' && after.balancePct > before.balancePct
        ),
      })
    }
  }
  return out
}

const CANDIDATE_SORTS = {
  value: (a, b) => a.pricePerFps - b.pricePerFps,
  gain:  (a, b) => b.fpsGain - a.fpsGain,
  cost:  (a, b) => a.extraCost - b.extraCost,
}

export function sortCandidates(list, key = 'value') {
  const cmp = CANDIDATE_SORTS[key] ?? CANDIDATE_SORTS.value
  return [...list].sort(cmp)
}
```

(`UPGRADEABLE`, `MIN_GAIN`, and `checkCompatibility` already exist in this module.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/tests/upgradeCandidates.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/upgradeAdvisor.js src/tests/upgradeCandidates.test.js
git commit -m "feat: add ranked upgradeCandidates + sortCandidates advisor"
```

---

## Task 9: PartSelector reuse seam (Feature 3 support)

**Files:**
- Modify: `src/components/PartSelector.jsx`
- Test: `src/tests/PartSelector.test.jsx` (add a test)

Goal: let PartSelector operate on a caller-provided parts context with the budget filter/lock disabled, so the upgrade flow can pick "current PC" parts against local state. Default behavior (no new props) is unchanged.

- [ ] **Step 1: Write the failing test**

Add to `src/tests/PartSelector.test.jsx`:

```jsx
it('with ignoreBudget shows all parts and never locks for budget', () => {
  useBuilderStore.setState({ budget: 1, selectedParts: {} }) // tiny budget would normally hide most parts
  const onSelect = vi.fn()
  const gpus = useCatalogStore.getState().parts.filter((p) => p.category === 'gpu')
  const priciest = gpus.reduce((m, p) => (p.price > m.price ? p : m), gpus[0])

  render(
    <PartSelector category="gpu" contextParts={{}} ignoreBudget onSelect={onSelect} onClose={() => {}} />
  )
  const card = screen.getByText(priciest.name)
  expect(card).toBeInTheDocument()
  fireEvent.click(card)
  expect(onSelect).toHaveBeenCalled()
})
```

(Ensure the test file imports `useCatalogStore` and `useBuilderStore`; the existing tests already import Testing Library helpers and `PartSelector`. If clicking the name doesn't trigger select because PartCard wires the click elsewhere, click the card's select control per the pattern already used elsewhere in this test file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/PartSelector.test.jsx`
Expected: FAIL — props ignored; with `budget: 1` the priciest GPU is filtered out or locked.

- [ ] **Step 3: Add the override seam**

In `src/components/PartSelector.jsx`, change the signature and the store reads:

```jsx
export default function PartSelector({ category, onSelect, onClose, contextParts, ignoreBudget = false }) {
  const storeSelected   = useBuilderStore((s) => s.selectedParts)
  const storeBudget     = useBuilderStore((s) => s.budget)
  const remainingBudget = useBuilderStore(selRemainingBudget)
  const selectedParts   = contextParts ?? storeSelected
  const budget          = ignoreBudget ? 0 : storeBudget
```

(`filterParts` treats `budget === 0` as "no cutoff", so passing 0 shows every part in the category.)

Then change the per-card `overBudget` calculation in the `visible.map(...)` block:

```jsx
            const swapBudget = remainingBudget + (current?.price ?? 0)
            const overBudget = ignoreBudget ? false : part.price > swapBudget
```

Leave everything else unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/tests/PartSelector.test.jsx`
Expected: PASS (existing PartSelector tests still green — defaults unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/components/PartSelector.jsx src/tests/PartSelector.test.jsx
git commit -m "feat: add contextParts/ignoreBudget seam to PartSelector"
```

---

## Task 10: UpgradeWizard full flow (Feature 3)

**Files:**
- Modify: `src/components/UpgradeWizard.jsx` (replace the stub body)
- Test: `src/tests/UpgradeWizard.test.jsx` (expand)

- [ ] **Step 1: Write the failing tests**

Replace the contents of `src/tests/UpgradeWizard.test.jsx` with:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import UpgradeWizard from '../components/UpgradeWizard'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import useCatalogStore from '../store/useCatalogStore'
import { encodeBuild } from '../lib/buildCodec'

// Deterministic, controlled catalog: CPU-limited current rig with one CPU
// upgrade available in budget.
const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const cpuHi = { id: 'cpu-hi', category: 'cpu', name: 'CPU Hi', price: 300, perfScore: 250, tdp: 105, socket: 'AM5' }
const gpuLo = { id: 'gpu-lo', category: 'gpu', name: 'GPU Lo', price: 200, perfScore: 300, tdp: 200, length: 250 }
const game  = { id: 'fortnite', name: 'Fortnite', fpsFactor: 1, cpuFactor: 1 }

beforeEach(() => {
  window.location.hash = ''
  useCatalogStore.setState({ parts: [cpuLo, cpuHi, gpuLo], games: [game] })
  useBuilderStore.setState({ budget: 0, flow: 'upgrade', selectedParts: {}, resolution: '1440p' })
  const code = encodeBuild({ budget: 0, resolution: '1440p', parts: { cpu: cpuLo, gpu: gpuLo }, peripherals: {} })
  useSavedStore.setState({ saved: [{ id: 's1', name: 'My rig', savedAt: 1, code }] })
})

describe('UpgradeWizard flow', () => {
  it('requires a CPU and GPU before continuing', () => {
    render(<UpgradeWizard onBack={() => {}} />)
    expect(screen.getByRole('button', { name: /next: goal/i })).toBeDisabled()
  })

  it('loads a saved build as the current PC and enables continue', () => {
    render(<UpgradeWizard onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /select saved build/i }))
    fireEvent.click(screen.getByRole('button', { name: /my rig/i }))
    expect(screen.getByRole('button', { name: /next: goal/i })).not.toBeDisabled()
  })

  it('applies an upgrade: swaps the part, sets budget = current + upgrade, opens Build tab', () => {
    window.location.hash = 'summary'
    render(<UpgradeWizard onBack={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /select saved build/i }))
    fireEvent.click(screen.getByRole('button', { name: /my rig/i }))
    fireEvent.click(screen.getByRole('button', { name: /next: goal/i }))
    fireEvent.click(screen.getByRole('button', { name: /see upgrades/i }))

    // Default upgrade budget (400) covers the +200 CPU swap.
    fireEvent.click(screen.getAllByRole('button', { name: /^apply$/i })[0])

    const s = useBuilderStore.getState()
    expect(s.selectedParts.cpu.id).toBe('cpu-hi')
    expect(s.selectedParts.gpu.id).toBe('gpu-lo')
    expect(s.budget).toBe(700) // (100 + 200 current) + 400 upgrade
    expect(s.resolution).toBe('1440p')
    expect(window.location.hash).toBe('#build')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/tests/UpgradeWizard.test.jsx`
Expected: FAIL — the stub has no tabs/steps.

- [ ] **Step 3: Implement the full component**

Replace `src/components/UpgradeWizard.jsx` with:

```jsx
import { useState } from 'react'
import Backdrop from './Backdrop'
import CategoryList from './CategoryList'
import PartSelector from './PartSelector'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { decodeBuild } from '../lib/buildCodec'
import { upgradeCandidates, sortCandidates } from '../lib/upgradeAdvisor'
import { enterBuildTab } from '../lib/enterBuildTab'
import { PANEL, BTN_PRIMARY, TELEMETRY } from '../lib/uiTokens'

const RES_OPTIONS = [
  { id: '1080p', label: '1080p' },
  { id: '1440p', label: '1440p' },
  { id: '4k',    label: '4K' },
]
const TARGETS = [60, 120, 144, 240]
const SORT_LABELS = [
  { key: 'value', label: 'Best £/FPS' },
  { key: 'gain',  label: 'Most FPS' },
  { key: 'cost',  label: 'Cheapest' },
]
const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }
const totalOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)

export default function UpgradeWizard({ onBack }) {
  const [step, setStep] = useState(1)
  const [tab, setTab] = useState('build')
  const [currentParts, setCurrentParts] = useState({})
  const [pickerCategory, setPickerCategory] = useState(null)
  const [gameId, setGameId] = useState('fortnite')
  const [resolution, setResolution] = useState('1440p')
  const [fps, setFps] = useState(120)
  const [upgradeBudget, setUpgradeBudget] = useState(400)
  const [sortKey, setSortKey] = useState('value')

  const saved      = useSavedStore((s) => s.saved)
  const partsData  = useCatalogStore((s) => s.parts)
  const gamesData  = useCatalogStore((s) => s.games)
  const setBuild            = useBuilderStore((s) => s.setBuild)
  const setBudget           = useBuilderStore((s) => s.setBudget)
  const setStoreResolution  = useBuilderStore((s) => s.setResolution)
  const setLastGenerated    = useBuilderStore((s) => s.setLastGenerated)

  const hasCore = Boolean(currentParts.cpu && currentParts.gpu)
  const gameObj = gamesData.find((g) => g.id === gameId)

  function selectPart(part) {
    setCurrentParts((prev) => ({ ...prev, [part.category]: part }))
    setPickerCategory(null)
  }
  function deselect(category) {
    setCurrentParts((prev) => { const n = { ...prev }; delete n[category]; return n })
  }
  function loadSaved(code) {
    const d = decodeBuild(code)
    if (!d) return
    setCurrentParts(d.parts)
    if (d.resolution) setResolution(d.resolution)
  }

  const candidates = hasCore && gameObj
    ? sortCandidates(
        upgradeCandidates(currentParts, { game: gameObj, resolution, targetFps: fps, budget: upgradeBudget }, partsData),
        sortKey,
      )
    : []

  function apply(c) {
    const nextParts = { ...currentParts, [c.category]: c.toPart }
    enterBuildTab()
    setBuild(nextParts)
    setStoreResolution(resolution)
    setLastGenerated({
      met: c.meetsGoal, estFps: c.resultFps, targetFps: fps,
      gameName: gameObj?.name, quality: 'high', upgrade: true,
    })
    setBudget(totalOf(currentParts) + upgradeBudget) // flips App → BuilderScreen on the Build tab
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center text-white bg-[#05080f] py-12">
      <Backdrop />
      <div className="relative z-10 w-full max-w-2xl px-4">
        <h1 className="text-3xl font-bold mb-1 text-center">Upgrade your PC</h1>
        <ol className="flex items-center justify-center gap-2 mb-8 text-[11px] uppercase tracking-wider">
          {['Current PC', 'Goal', 'Upgrades'].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-700">→</span>}
              <span className={step === i + 1 ? 'text-cyan-300' : 'text-slate-500'}>{i + 1} {label}</span>
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className={`${PANEL} p-5`}>
            <div className="inline-flex rounded-sm border border-slate-800/60 p-0.5 mb-4">
              <button
                onClick={() => setTab('build')}
                className={`px-3 py-1 text-xs rounded-sm ${tab === 'build' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}
              >
                Build current PC
              </button>
              <button
                onClick={() => setTab('saved')}
                className={`px-3 py-1 text-xs rounded-sm ${tab === 'saved' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}
              >
                Select saved build
              </button>
            </div>

            {tab === 'build' ? (
              <CategoryList
                selectedParts={currentParts}
                onSelectCategory={setPickerCategory}
                onDeselect={deselect}
              />
            ) : saved.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No saved builds yet. Build one first, or use the "Build current PC" tab.</p>
            ) : (
              <div className="space-y-1">
                {saved.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => loadSaved(b.code)}
                    className="w-full flex items-center justify-between border-t border-slate-800/50 py-2 text-left hover:text-cyan-300"
                  >
                    <span className="text-sm text-slate-100">{b.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{new Date(b.savedAt).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-500 mt-4">CPU and GPU are required — they drive the estimate.</p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setStep(2)}
                disabled={!hasCore}
                className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              >
                Next: goal
              </button>
              <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back to menu</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={`${PANEL} p-5`}>
            <div className="flex items-center gap-3 mb-5">
              <label htmlFor="upgrade-game" className="text-sm text-slate-400">Game</label>
              <select
                id="upgrade-game"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-sm text-slate-100 px-3 py-2 focus:outline-none focus:border-cyan-400"
              >
                {gamesData.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {RES_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setResolution(r.id)}
                  aria-pressed={resolution === r.id}
                  className={`px-4 py-2 rounded-sm border text-sm transition-colors
                    ${resolution === r.id ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {TARGETS.map((t) => (
                <button
                  key={t}
                  onClick={() => setFps(t)}
                  aria-pressed={fps === t}
                  className={`px-4 py-2 rounded-sm border font-mono text-sm transition-colors
                    ${fps === t ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}
                >
                  {t} fps
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(3)} className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium transition-colors`}>
                See upgrades
              </button>
              <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Current PC</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={`${PANEL} p-5`}>
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <label htmlFor="upgrade-budget" className="text-slate-400">Upgrade budget</label>
                <span className={`${TELEMETRY} text-cyan-300`}>£{upgradeBudget}</span>
              </div>
              <input
                id="upgrade-budget"
                type="range"
                min="0"
                max="2000"
                step="50"
                value={upgradeBudget}
                onChange={(e) => setUpgradeBudget(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
            <div className="flex gap-2 mb-4">
              {SORT_LABELS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortKey(s.key)}
                  aria-pressed={sortKey === s.key}
                  className={`px-3 py-1.5 rounded-sm border text-xs transition-colors
                    ${sortKey === s.key ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {candidates.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No upgrade beats your current parts within £{upgradeBudget}. Try raising the budget.</p>
            ) : (
              <div className="space-y-2">
                {candidates.map((c) => (
                  <div key={`${c.category}-${c.toPart.id}`} className="border border-slate-700/70 rounded-sm px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-100">
                        <span className="uppercase text-[10px] text-slate-500 mr-1">{c.category}</span>
                        {c.toPart.name}
                      </span>
                      <span className={`${TELEMETRY} text-emerald-300 text-sm font-semibold`}>+{c.fpsGain} fps</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <span>{c.extraCost <= 0 ? 'no extra cost' : `+£${c.extraCost.toFixed(0)}`}</span>
                      {c.extraCost > 0 && <span>· £{(c.pricePerFps).toFixed(1)}/fps</span>}
                      {c.meetsGoal && <span className="text-cyan-300">· hits {fps} fps</span>}
                      {c.fixesBottleneck && <span className="text-amber-300">· fixes bottleneck</span>}
                    </div>
                    <button
                      onClick={() => apply(c)}
                      className={`mt-2 w-full ${BTN_PRIMARY} text-sm font-medium py-1.5 rounded-sm transition-colors`}
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setStep(2)} className="mt-5 text-xs text-slate-500 hover:text-slate-300 transition-colors">← Goal</button>
          </div>
        )}
      </div>

      {pickerCategory && (
        <PartSelector
          category={pickerCategory}
          contextParts={currentParts}
          ignoreBudget
          onSelect={selectPart}
          onClose={() => setPickerCategory(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/tests/UpgradeWizard.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/UpgradeWizard.jsx src/tests/UpgradeWizard.test.jsx
git commit -m "feat: full Upgrade-your-PC flow with ranked suggestions"
```

---

## Task 11: Playwright E2E + full suite green

**Files:**
- Modify: `e2e/wizard.spec.js`
- Verify: full unit suite + E2E.

- [ ] **Step 1: Update the E2E entry step**

Open `e2e/wizard.spec.js`. The app now opens on the main menu, so the wizard is reached by first clicking "Build a new PC". Add, immediately after the initial `page.goto(...)` and before the budget-entry interactions:

```js
await page.getByRole('button', { name: /build a new pc/i }).click()
```

Keep the rest of the spec as-is (budget → resolution → FPS → generate assertions).

- [ ] **Step 2: Run the E2E**

Run: `npm run test:e2e`
Expected: PASS. If the selector text differs, adjust to match the MainMenu button label ("Build a new PC").

- [ ] **Step 3: Run the full unit suite**

Run: `npm run test:run`
Expected: PASS — all prior tests plus the new ones (target: 264 existing + the new specs, all green).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add e2e/wizard.spec.js
git commit -m "test: enter the wizard via the main menu in the E2E"
```

---

## Self-review notes (author check)

- **Feature 1 (menu + routing):** Tasks 2 (flow field), 3 (MainMenu), 4 (stub), 5 (App + TopBar). ✓
- **Feature 2 (desktop layout):** Tasks 6 (CategoryList columns), 7 (grid CSS + BuilderScreen). ✓ Visual verification in Task 7 Step 4.
- **Feature 3 (upgrade flow):** Tasks 8 (advisor), 9 (PartSelector seam), 10 (wizard). Budget on apply = `totalOf(current) + upgradeBudget` (Task 10) matches the spec. CPU/GPU-only swaps via `UPGRADEABLE`. ✓
- **Feature 4 (hash fix):** Task 1, reused by Task 10's `apply`. ✓
- **Type/name consistency:** `flow`/`setFlow`, `enterBuildTab`, `upgradeCandidates`/`sortCandidates` fields (`fpsGain`, `extraCost`, `resultFps`, `pricePerFps`, `meetsGoal`, `fixesBottleneck`), `columns` prop, `contextParts`/`ignoreBudget` props — all used consistently across tasks. ✓
- **Risk:** the desktop grid places the WebGL canvas in the same stacking context as the panels; the `.build-grid > *` z-index rules force panels above the canvas, but Task 7 Step 4 must confirm visually at 375px and 1280px (see [[webgl-verification-gotchas]]).
