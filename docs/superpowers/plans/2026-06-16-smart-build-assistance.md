# Phase 2 — Smart Build Assistance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-click auto-build a balanced, compatible build for a budget; quick-start presets; and build-health warnings (under-sized PSU, missing essentials).

**Architecture:** A pure `autoBuilder` engine (budget weights → dependency-ordered compatible fill → PSU sizing → leftover-upgrade pass), a pure `buildWarnings` health-check, presets that call the engine, and thin components. Everything runs off the existing catalog + `checkCompatibility` — no new data files.

**Tech Stack:** React 19, Zustand, Vite, Tailwind, Vitest + Testing Library (jsdom).

**Conventions for every task:**
- Node at `C:\Program Files\nodejs`. In PowerShell once per shell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`.
- Full suite: `npm run test:run`. Single file: `npm run test:run -- src/tests/<file>`. Baseline **89 passing**.
- Every commit appends: `-m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"`.
- Work on `main` locally; do not push.

---

### Task 1: Auto-build engine

**Files:**
- Create: `src/lib/autoBuilder.js`
- Create: `src/tests/autoBuilder.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/autoBuilder.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { autoBuild } from '../lib/autoBuilder'
import partsData from '../data/partsData.json'

const CATS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']
const idMap = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.id]))

describe('autoBuild', () => {
  it('produces a complete, compatible build within budget', () => {
    const build = autoBuild({}, 2000, partsData, '1440p')
    for (const c of CATS) expect(build[c], `missing ${c}`).toBeTruthy()
    expect(build.cpu.socket).toBe(build.motherboard.socket)
    expect(build.ram.ramType).toBe(build.motherboard.ramType)
    expect(build.cooler.sockets).toContain(build.cpu.socket)
    expect(build.case.supportedFormFactors).toContain(build.motherboard.formFactor)
    expect(build.gpu.length).toBeLessThanOrEqual(build.case.maxGpuLength)
    const draw = CATS.reduce((s, c) => s + (build[c].tdp || 0), 0)
    expect(build.psu.wattage).toBeGreaterThanOrEqual(draw)
    const total = CATS.reduce((s, c) => s + build[c].price, 0)
    expect(total).toBeLessThanOrEqual(2000)
  })

  it('keeps an existing pick and matches the rest to it', () => {
    const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x') // AM5
    const build = autoBuild({ cpu }, 1500, partsData, '1440p')
    expect(build.cpu.id).toBe('cpu-ryzen-7-7700x')
    expect(build.motherboard.socket).toBe('AM5')
  })

  it('is deterministic', () => {
    expect(idMap(autoBuild({}, 1500, partsData, '1440p')))
      .toEqual(idMap(autoBuild({}, 1500, partsData, '1440p')))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/autoBuilder.test.js`
Expected: FAIL — `../lib/autoBuilder` does not exist.

- [ ] **Step 3: Implement the engine**

Create `src/lib/autoBuilder.js`:

```js
import { checkCompatibility } from './compatibility'

const BASE_WEIGHTS = {
  cpu: 0.18, gpu: 0.32, motherboard: 0.11, ram: 0.08, storage: 0.07,
  psu: 0.07, case: 0.08, cooler: 0.06, fans: 0.03,
}

// CPU/GPU first (perf drivers), parts that depend on them next, PSU last.
const FILL_ORDER = ['cpu', 'gpu', 'motherboard', 'ram', 'cooler', 'case', 'storage', 'fans', 'psu']
const PERF = new Set(['cpu', 'gpu'])

function weightsFor(resolution) {
  const w = { ...BASE_WEIGHTS }
  if (resolution === '4k') { w.cpu -= 0.06; w.gpu += 0.06 }
  else if (resolution === '1080p') { w.gpu -= 0.04; w.cpu += 0.04 }
  return w
}

const ofCategory = (parts, c) => parts.filter((p) => p.category === c)
const drawOf = (sel) => Object.values(sel).reduce((s, p) => s + (p?.tdp ?? 0), 0)

function choosePsu(candidates, draw, remaining) {
  const byPrice = [...candidates].sort((a, b) => a.price - b.price)
  return (
    byPrice.find((p) => p.wattage >= draw * 1.3 && p.price <= remaining) ||
    byPrice.find((p) => p.wattage >= draw && p.price <= remaining) ||
    byPrice.find((p) => p.wattage >= draw * 1.3) ||
    byPrice.find((p) => p.wattage >= draw) ||
    byPrice[byPrice.length - 1] ||
    null
  )
}

function chooseBest(category, candidates, slice, remaining) {
  if (candidates.length === 0) return null
  let pool = candidates.filter((p) => p.price <= slice)
  if (pool.length === 0) pool = candidates.filter((p) => p.price <= remaining)
  if (pool.length === 0) return [...candidates].sort((a, b) => a.price - b.price)[0]
  if (PERF.has(category)) return [...pool].sort((a, b) => (b.perfScore - a.perfScore) || (a.price - b.price))[0]
  return [...pool].sort((a, b) => a.price - b.price)[0]
}

export function autoBuild(selectedParts, budget, partsData, resolution = '1440p') {
  const result = { ...selectedParts }
  const weights = weightsFor(resolution)
  const spentExisting = Object.values(result).reduce((s, p) => s + (p?.price ?? 0), 0)
  const available = Math.max(0, budget - spentExisting)
  let remaining = available

  const emptyCats = FILL_ORDER.filter((c) => !result[c])
  const weightSum = emptyCats.reduce((s, c) => s + weights[c], 0) || 1

  for (const category of emptyCats) {
    const slice = (weights[category] / weightSum) * available
    let candidates = ofCategory(partsData, category).filter((p) => checkCompatibility(result, p).compatible)
    // compatibility.js only checks GPU-length when selecting a GPU, not a case —
    // so enforce it here when a GPU is already chosen.
    if (category === 'case' && result.gpu) {
      candidates = candidates.filter((p) => result.gpu.length <= p.maxGpuLength)
    }
    const pick = category === 'psu'
      ? choosePsu(candidates, drawOf(result), remaining)
      : chooseBest(category, candidates, slice, remaining)
    if (pick) {
      result[category] = pick
      remaining -= pick.price
    }
  }

  // Spend leftover budget upgrading the perf drivers (GPU first, then CPU).
  for (const category of ['gpu', 'cpu']) {
    const current = result[category]
    if (!current) continue
    const without = { ...result, [category]: undefined }
    const better = ofCategory(partsData, category)
      .filter((p) => checkCompatibility(without, p).compatible)
      .filter((p) => p.perfScore > current.perfScore && p.price - current.price <= remaining)
      .sort((a, b) => (b.perfScore - a.perfScore) || (a.price - b.price))[0]
    if (better) {
      remaining -= better.price - current.price
      result[category] = better
    }
  }

  return result
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/autoBuilder.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autoBuilder.js src/tests/autoBuilder.test.js
git commit -m "feat: auto-build engine (balanced build within budget)"
```

---

### Task 2: Build health warnings

**Files:**
- Create: `src/lib/buildWarnings.js`
- Create: `src/tests/buildWarnings.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/buildWarnings.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { getBuildWarnings } from '../lib/buildWarnings'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x') // 105W
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')      // 450W
const smallPsu = partsData.find((p) => p.id === 'psu-corsair-cv550')   // 550W
const bigPsu = partsData.find((p) => p.id === 'psu-corsair-rm1000x')   // 1000W

describe('getBuildWarnings', () => {
  it('flags a missing PSU as critical when the build draws power', () => {
    const w = getBuildWarnings({ cpu, gpu })
    expect(w.some((x) => x.level === 'critical' && /PSU/i.test(x.message))).toBe(true)
  })

  it('flags an under-sized PSU as critical', () => {
    const w = getBuildWarnings({ cpu, gpu, psu: smallPsu }) // 555W >= 550W
    expect(w.some((x) => x.level === 'critical' && /too small/i.test(x.message))).toBe(true)
  })

  it('warns to add a cooler when a CPU is present', () => {
    const w = getBuildWarnings({ cpu })
    expect(w.some((x) => /cooler/i.test(x.message))).toBe(true)
  })

  it('has no critical warnings for a powered build with an ample PSU', () => {
    const w = getBuildWarnings({ cpu, gpu, psu: bigPsu }) // 555W of 1000W
    expect(w.some((x) => x.level === 'critical')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/buildWarnings.test.js`
Expected: FAIL — `../lib/buildWarnings` does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/buildWarnings.js`:

```js
const RANK = { critical: 0, warning: 1 }

export function getBuildWarnings(selectedParts) {
  const warnings = []
  const { cpu, gpu, motherboard, ram, cooler, case: pcCase, storage, psu } = selectedParts
  const draw = Object.values(selectedParts).reduce((s, p) => s + (p?.tdp ?? 0), 0)
  const hasCore = Boolean(cpu || gpu)

  if (draw > 0 && !psu) {
    warnings.push({ level: 'critical', message: `Add a PSU — the build draws ${draw}W with no power supply.` })
  } else if (psu && draw >= psu.wattage) {
    warnings.push({ level: 'critical', message: `PSU too small — ${draw}W draw meets or exceeds the ${psu.wattage}W supply.` })
  } else if (psu && draw > 0.8 * psu.wattage) {
    warnings.push({ level: 'warning', message: `Low PSU headroom — ${draw}W of ${psu.wattage}W (aim under 80%).` })
  }

  if (cpu && !motherboard) warnings.push({ level: 'warning', message: 'Add a motherboard.' })
  if (cpu && !cooler) warnings.push({ level: 'warning', message: 'Add a CPU cooler.' })
  if (cpu && !ram) warnings.push({ level: 'warning', message: 'Add RAM.' })
  if (hasCore && !pcCase) warnings.push({ level: 'warning', message: 'Add a case.' })
  if (hasCore && !storage) warnings.push({ level: 'warning', message: 'Add storage.' })

  return warnings.sort((a, b) => RANK[a.level] - RANK[b.level])
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/buildWarnings.test.js`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/buildWarnings.js src/tests/buildWarnings.test.js
git commit -m "feat: build health warnings (PSU + missing essentials)"
```

---

### Task 3: Presets + store setBuild action

**Files:**
- Create: `src/lib/presets.js`
- Modify: `src/store/useBuilderStore.js`
- Modify: `src/tests/useBuilderStore.test.js`

- [ ] **Step 1: Write the failing test**

In `src/tests/useBuilderStore.test.js`, add this test inside the `describe('useBuilderStore', ...)` block (after the existing `removes a part` test):

```js
  it('setBuild replaces all selected parts at once', () => {
    useBuilderStore.getState().addPart('cpu', cpu)
    useBuilderStore.getState().setBuild({ gpu })
    expect(useBuilderStore.getState().selectedParts.cpu).toBeUndefined()
    expect(useBuilderStore.getState().selectedParts.gpu).toEqual(gpu)
  })
```

The file already defines `cpu` and `gpu` at the top.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/useBuilderStore.test.js`
Expected: FAIL — `setBuild is not a function`.

- [ ] **Step 3: Add the action and the presets**

In `src/store/useBuilderStore.js`, add the `setBuild` action immediately after the `removePart` action (inside the store object):

```js
      setBuild: (parts) => set({ selectedParts: parts }),
```

Create `src/lib/presets.js`:

```js
// Quick-start targets. Each chip sets the budget + resolution and runs autoBuild.
export const PRESETS = [
  { label: '1080p', budget: 700, resolution: '1080p' },
  { label: '1440p', budget: 1200, resolution: '1440p' },
  { label: '4K', budget: 2500, resolution: '4k' },
]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/useBuilderStore.test.js`
Expected: PASS (the store suite, now including `setBuild`).

- [ ] **Step 5: Commit**

```bash
git add src/store/useBuilderStore.js src/tests/useBuilderStore.test.js src/lib/presets.js
git commit -m "feat: setBuild store action + quick-start presets"
```

---

### Task 4: Build warnings card + mount

**Files:**
- Create: `src/components/BuildWarnings.jsx`
- Create: `src/tests/BuildWarnings.test.jsx`
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/BuildWarnings.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import BuildWarnings from '../components/BuildWarnings'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')

beforeEach(() => {
  useBuilderStore.setState({ budget: 1000, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('BuildWarnings', () => {
  it('renders nothing when there are no warnings', () => {
    const { container } = render(<BuildWarnings />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a PSU warning when the build draws power but has no PSU', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<BuildWarnings />)
    expect(screen.getByText(/PSU/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/BuildWarnings.test.jsx`
Expected: FAIL — `../components/BuildWarnings` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/BuildWarnings.jsx`:

```jsx
import useBuilderStore from '../store/useBuilderStore'
import { getBuildWarnings } from '../lib/buildWarnings'
import { PANEL } from '../lib/uiTokens'

export default function BuildWarnings() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const warnings = getBuildWarnings(selectedParts)
  if (warnings.length === 0) return null

  return (
    <div className={`absolute top-80 left-4 w-72 ${PANEL} p-3`}>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Build checks</div>
      <ul className="space-y-1.5">
        {warnings.map((w, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
            <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${w.level === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
            <span>{w.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/BuildWarnings.test.jsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Mount it in the builder**

In `src/screens/BuilderScreen.jsx`, add after the `BuildSummary` import:

```js
import BuildWarnings from '../components/BuildWarnings'
```

Then in the build-view branch, add `<BuildWarnings />` right after `<UpgradeSuggestion />`:

```jsx
            <UpgradeSuggestion />
            <BuildWarnings />
```

- [ ] **Step 6: Commit**

```bash
git add src/components/BuildWarnings.jsx src/tests/BuildWarnings.test.jsx src/screens/BuilderScreen.jsx
git commit -m "feat: build health warnings card"
```

---

### Task 5: Auto-build button + mount

**Files:**
- Create: `src/components/AutoBuildButton.jsx`
- Create: `src/tests/AutoBuildButton.test.jsx`
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/AutoBuildButton.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import AutoBuildButton from '../components/AutoBuildButton'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  useBuilderStore.setState({ budget: 1500, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('AutoBuildButton', () => {
  it('fills an empty build when clicked', () => {
    render(<AutoBuildButton />)
    fireEvent.click(screen.getByRole('button', { name: /auto-build/i }))
    const parts = useBuilderStore.getState().selectedParts
    expect(parts.cpu).toBeTruthy()
    expect(parts.gpu).toBeTruthy()
    expect(parts.psu).toBeTruthy()
  })

  it('is disabled when there is no budget', () => {
    useBuilderStore.setState({ budget: 0 })
    render(<AutoBuildButton />)
    expect(screen.getByRole('button', { name: /auto-build/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/AutoBuildButton.test.jsx`
Expected: FAIL — `../components/AutoBuildButton` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/AutoBuildButton.jsx`:

```jsx
import useBuilderStore from '../store/useBuilderStore'
import { autoBuild } from '../lib/autoBuilder'
import partsData from '../data/partsData.json'

export default function AutoBuildButton() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const budget = useBuilderStore((s) => s.budget)
  const resolution = useBuilderStore((s) => s.resolution)
  const setBuild = useBuilderStore((s) => s.setBuild)

  return (
    <button
      onClick={() => setBuild(autoBuild(selectedParts, budget, partsData, resolution))}
      disabled={budget <= 0}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium px-5 py-2 rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_22px_rgba(34,211,238,0.6)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
    >
      ⚡ Auto-build
    </button>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/AutoBuildButton.test.jsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Mount it in the builder**

In `src/screens/BuilderScreen.jsx`, add after the `BuildWarnings` import:

```js
import AutoBuildButton from '../components/AutoBuildButton'
```

Then add `<AutoBuildButton />` right after `<BuildWarnings />`:

```jsx
            <BuildWarnings />
            <AutoBuildButton />
```

- [ ] **Step 6: Commit**

```bash
git add src/components/AutoBuildButton.jsx src/tests/AutoBuildButton.test.jsx src/screens/BuilderScreen.jsx
git commit -m "feat: one-click auto-build button"
```

---

### Task 6: Budget-screen presets + final verification

**Files:**
- Modify: `src/components/BudgetEntry.jsx`

- [ ] **Step 1: Add preset chips to BudgetEntry**

Replace `src/components/BudgetEntry.jsx` entirely:

```jsx
import { useState } from 'react'
import Backdrop from './Backdrop'
import useBuilderStore from '../store/useBuilderStore'
import { autoBuild } from '../lib/autoBuilder'
import { PRESETS } from '../lib/presets'
import partsData from '../data/partsData.json'

export default function BudgetEntry({ onSubmit }) {
  const [value, setValue] = useState('1000')
  const setResolution = useBuilderStore((s) => s.setResolution)
  const setBuild = useBuilderStore((s) => s.setBuild)

  function handleSubmit(e) {
    e.preventDefault()
    const num = parseFloat(value)
    if (num > 0) onSubmit(num)
  }

  function applyPreset(p) {
    setResolution(p.resolution)
    setBuild(autoBuild({}, p.budget, partsData, p.resolution))
    onSubmit(p.budget)
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-white bg-[#05080f]">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
          Build Your PC
        </h1>
        <p className="text-gray-400 mb-10 text-lg">What's your budget?</p>
        <form onSubmit={handleSubmit} aria-label="form" className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2 text-3xl">
            <span className="text-cyan-300">£</span>
            <input
              autoFocus
              type="number"
              min="1"
              placeholder="e.g. 1500"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="bg-slate-950/60 backdrop-blur-md text-white font-mono text-3xl w-52 px-4 py-3 rounded-sm border border-slate-700/70 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_25px_rgba(34,211,238,0.35)] text-center transition-all"
            />
          </div>
          <button
            type="submit"
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-[0_0_25px_rgba(34,211,238,0.45)] text-white font-semibold px-10 py-3 rounded-sm text-lg transition-all"
          >
            Start Building
          </button>
        </form>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-slate-500">or auto-build:</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="text-xs font-mono px-3 py-1.5 rounded-sm border border-slate-700/70 text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-all"
            >
              {p.label} · £{p.budget}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the full suite**

Run: `npm run test:run`
Expected: PASS — ~100 tests (89 baseline + autoBuilder 3 + buildWarnings 4 + setBuild 1 + BuildWarnings 2 + AutoBuildButton 2). The existing `BudgetEntry` tests still pass (manual form unchanged).

- [ ] **Step 3: Verify in the dev server**

Start the dev server and check:
- On the budget screen, click a preset (e.g. `4K · £2500`) → lands in the builder with a **complete, compatible** auto-built build; the parts read out in the orbit + Summary tab.
- Clear the build (or fresh session), enter a budget, click **⚡ Auto-build** → fills every empty slot within budget.
- Pick only a CPU + GPU (no PSU) → the **Build checks** card shows a critical "Add a PSU" warning; add an under-sized PSU → "PSU too small"; add an ample PSU → warning clears.
- Auto-build respects a manual pick: select a specific CPU first, then Auto-build → that CPU is kept and the motherboard matches its socket.

- [ ] **Step 4: Commit**

```bash
git add src/components/BudgetEntry.jsx
git commit -m "feat: quick-start preset chips on the budget screen"
```

---

## Self-Review

- **Spec coverage:** auto-build engine → Task 1; warnings → Task 2; presets + `setBuild` → Task 3; warnings card → Task 4; auto-build button → Task 5; budget-screen presets → Task 6. All three features + the store change covered.
- **Placeholders:** none — every step has exact code and commands.
- **Type/name consistency:** `autoBuild(selectedParts, budget, partsData, resolution)` (Task 1) is called identically by AutoBuildButton (Task 5) and BudgetEntry (Task 6); `getBuildWarnings` (Task 2) used by BuildWarnings (Task 4); `setBuild` (Task 3) used by AutoBuildButton + BudgetEntry; `PRESETS` (Task 3) used by BudgetEntry. Part ids (`cpu-ryzen-7-7700x` 105W, `gpu-rtx-4090` 450W, `psu-corsair-cv550` 550W, `psu-corsair-rm1000x` 1000W) confirmed in the catalog; 555W ≥ 550W drives the "too small" test.
- **Placement note:** the spec said the auto-build button goes "under the tabs"; the plan places it bottom-centre instead to avoid colliding with the top orbit pill. Will confirm visually in Step 3 and can move it if the user prefers.
