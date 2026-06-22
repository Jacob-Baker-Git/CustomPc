# Builder Upgrade Cycle 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add modal sort, explicit Save-PC / Saved-builds, a physical-dimensions checklist, curated quick-start tiers, and brand-aware "Find Best Price" links to the existing bundled-data PC builder.

**Architecture:** Pure helper libs (`sortParts`, `dimensionsCheck`, `tiers`) plus a single new persisted store (`useSavedStore` — the only persistence; the working build stays in-memory) and thin components. No runtime data fetch, no field renames, no live URL sync. The working build still resets on refresh; only explicit saves persist.

**Tech Stack:** React 19, Vite 8, Zustand 5 (+ persist for saves only), Tailwind 3, Vitest 4 (jsdom).

---

## Conventions

- **Node isn't on PATH.** In each fresh PowerShell first run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
- Single test file: `npm run test:run -- src/tests/<file>` · whole suite: `npm run test:run` · build: `npm run build`
- Work on `main` locally. **Do not push.**
- Baseline: **129 tests passing**, head `29fe58e` (spec commit).

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/sortParts.js` | Pure sort + `SORT_OPTIONS` | Create |
| `src/components/PartSelector.jsx` | Add sort `<select>` | Modify |
| `src/store/useSavedStore.js` | Persisted saved-builds list | Create |
| `src/lib/shareLink.js` | `shareUrlFromCode` helper | Modify |
| `src/components/BuildSummary.jsx` | Save PC, dimensions section, Find Best Price | Modify (×3 tasks) |
| `src/components/SavedBuilds.jsx` | Saved-builds tab view | Create |
| `src/screens/BuilderScreen.jsx` | Add Saved tab | Modify |
| `src/lib/dimensionsCheck.js` | Pure fit checks | Create |
| `src/components/DimensionsChecklist.jsx` | Renders fit checklist | Create |
| `src/data/partsData.json` | Add `maxCoolerHeight` to cases | Modify |
| `src/lib/tiers.js` | Curated tier configs + resolver | Create |
| `src/components/BudgetEntry.jsx` | Swap presets → tiers | Modify |
| `src/lib/presets.js` | Superseded | Delete |
| `src/lib/retailerLinks.js` | `searchUrl(name, brand)` | Modify |

---

### Task 1: Modal sort

**Files:** Create `src/lib/sortParts.js`, `src/tests/sortParts.test.js`; Modify `src/components/PartSelector.jsx`; Create `src/tests/PartSelector.test.jsx`.

- [ ] **Step 1: Write the failing lib test**

Create `src/tests/sortParts.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { sortParts, SORT_OPTIONS } from '../lib/sortParts'

const parts = [
  { id: 'a', name: 'Zeta', brand: 'Zen', price: 300, tdp: 50 },
  { id: 'b', name: 'Alpha', brand: 'Acme', price: 100, tdp: 200 },
  { id: 'c', name: 'Mid', brand: 'Mako', price: 200, tdp: 10 },
]

describe('sortParts', () => {
  it('exposes the four sort options in order', () => {
    expect(SORT_OPTIONS.map((o) => o.key)).toEqual(['price-asc', 'price-desc', 'brand-asc', 'tdp-desc'])
  })
  it('sorts price low to high', () => {
    expect(sortParts(parts, 'price-asc').map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })
  it('sorts price high to low', () => {
    expect(sortParts(parts, 'price-desc').map((p) => p.id)).toEqual(['a', 'c', 'b'])
  })
  it('sorts by brand A-Z', () => {
    expect(sortParts(parts, 'brand-asc').map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })
  it('sorts by power draw (TDP) high to low', () => {
    expect(sortParts(parts, 'tdp-desc').map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })
  it('does not mutate the input', () => {
    const copy = [...parts]
    sortParts(parts, 'price-desc')
    expect(parts).toEqual(copy)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/tests/sortParts.test.js`
Expected: FAIL — `../lib/sortParts` does not exist.

- [ ] **Step 3: Implement the lib**

Create `src/lib/sortParts.js`:

```js
export const SORT_OPTIONS = [
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
  { key: 'brand-asc', label: 'Brand (A-Z)' },
  { key: 'tdp-desc', label: 'Power Draw (TDP)' },
]

export function sortParts(list, key) {
  const arr = [...list]
  switch (key) {
    case 'price-desc': return arr.sort((a, b) => b.price - a.price)
    case 'brand-asc': return arr.sort((a, b) => (a.brand ?? a.name).localeCompare(b.brand ?? b.name))
    case 'tdp-desc': return arr.sort((a, b) => (b.tdp ?? 0) - (a.tdp ?? 0))
    case 'price-asc':
    default: return arr.sort((a, b) => a.price - b.price)
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/tests/sortParts.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Wire the sort `<select>` into PartSelector**

In `src/components/PartSelector.jsx`, add the import after the `filterParts` import:

```js
import { sortParts, SORT_OPTIONS } from '../lib/sortParts'
```

Replace the state + memo block:

```jsx
  const [query, setQuery] = useState('')

  const parts = useMemo(
    () => partsData.filter((p) => p.category === category),
    [category]
  )

  const visible = useMemo(
    () => filterParts(parts, selectedParts, budget, query),
    [parts, selectedParts, budget, query]
  )
```

with:

```jsx
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('price-asc')

  const parts = useMemo(
    () => partsData.filter((p) => p.category === category),
    [category]
  )

  const sorted = useMemo(() => sortParts(parts, sortKey), [parts, sortKey])

  const visible = useMemo(
    () => filterParts(sorted, selectedParts, budget, query),
    [sorted, selectedParts, budget, query]
  )
```

Then add the select after the SearchBar wrapper `</div>` (before the close button):

```jsx
          <div className="flex-1 max-w-sm">
            <SearchBar value={query} onChange={setQuery} placeholder={`Search ${category}...`} />
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            aria-label="Sort parts"
            className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-xs text-slate-100 px-2 py-2 focus:outline-none focus:border-cyan-400"
          >
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
```

- [ ] **Step 6: Write the PartSelector wiring test**

Create `src/tests/PartSelector.test.jsx`:

```jsx
import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import PartSelector from '../components/PartSelector'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {} })
})

describe('PartSelector sorting', () => {
  it('renders a sort control with the four options', () => {
    render(<PartSelector category="gpu" onSelect={() => {}} onClose={() => {}} />)
    const select = screen.getByLabelText(/sort parts/i)
    expect(within(select).getByText('Price: High to Low')).toBeInTheDocument()
    expect(within(select).getByText('Power Draw (TDP)')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run both test files**

Run: `npm run test:run -- src/tests/sortParts.test.js src/tests/PartSelector.test.jsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/sortParts.js src/tests/sortParts.test.js src/components/PartSelector.jsx src/tests/PartSelector.test.jsx
git commit -m "feat: sort dropdown in the part-selection modal" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Saved-builds store + share-from-code helper

**Files:** Create `src/store/useSavedStore.js`, `src/tests/useSavedStore.test.js`; Modify `src/lib/shareLink.js`, `src/tests/shareLink.test.js`.

- [ ] **Step 1: Write the failing store test**

Create `src/tests/useSavedStore.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import useSavedStore from '../store/useSavedStore'

beforeEach(() => { useSavedStore.setState({ saved: [] }) })

describe('useSavedStore', () => {
  it('persists to storage', () => {
    expect(useSavedStore.persist).toBeDefined()
  })
  it('saveBuild prepends a named entry with a code, id and timestamp', () => {
    useSavedStore.getState().saveBuild('My Rig', 'ABC')
    const { saved } = useSavedStore.getState()
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('My Rig')
    expect(saved[0].code).toBe('ABC')
    expect(typeof saved[0].id).toBe('string')
    expect(typeof saved[0].savedAt).toBe('number')
  })
  it('keeps newest save first', () => {
    useSavedStore.getState().saveBuild('First', 'A')
    useSavedStore.getState().saveBuild('Second', 'B')
    expect(useSavedStore.getState().saved.map((b) => b.name)).toEqual(['Second', 'First'])
  })
  it('removeSaved deletes by id', () => {
    useSavedStore.getState().saveBuild('X', 'A')
    const id = useSavedStore.getState().saved[0].id
    useSavedStore.getState().removeSaved(id)
    expect(useSavedStore.getState().saved).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/tests/useSavedStore.test.js`
Expected: FAIL — `../store/useSavedStore` does not exist.

- [ ] **Step 3: Implement the store**

Create `src/store/useSavedStore.js`:

```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const useSavedStore = create(
  persist(
    (set) => ({
      saved: [],
      saveBuild: (name, code) =>
        set((state) => ({
          saved: [{ id: newId(), name, savedAt: Date.now(), code }, ...state.saved],
        })),
      removeSaved: (id) =>
        set((state) => ({ saved: state.saved.filter((b) => b.id !== id) })),
    }),
    { name: 'custompc-saved-v1', version: 1 }
  )
)

export default useSavedStore
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/tests/useSavedStore.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Add `shareUrlFromCode` (DRY with `buildShareUrl`)**

In `src/lib/shareLink.js`, replace `buildShareUrl`:

```js
export function buildShareUrl() {
  const { budget, resolution, selectedParts, selectedPeripherals } = useBuilderStore.getState()
  const code = encodeBuild({ budget, resolution, parts: selectedParts, peripherals: selectedPeripherals })
  return `${window.location.origin}${window.location.pathname}?build=${code}`
}
```

with:

```js
export function shareUrlFromCode(code) {
  return `${window.location.origin}${window.location.pathname}?build=${code}`
}

export function buildShareUrl() {
  const { budget, resolution, selectedParts, selectedPeripherals } = useBuilderStore.getState()
  const code = encodeBuild({ budget, resolution, parts: selectedParts, peripherals: selectedPeripherals })
  return shareUrlFromCode(code)
}
```

- [ ] **Step 6: Add a `shareUrlFromCode` test**

In `src/tests/shareLink.test.js`, change the import line to include the new export:

```js
import { buildShareUrl, applyShareLinkFromUrl, shareUrlFromCode } from '../lib/shareLink'
```

Add this test before the final `})` that closes the `describe`:

```js
  it('shareUrlFromCode builds a ?build= url from a code', () => {
    const url = shareUrlFromCode('ZZZ')
    expect(url).toContain('?build=ZZZ')
    expect(new URL(url).searchParams.get('build')).toBe('ZZZ')
  })
```

- [ ] **Step 7: Run the store + shareLink tests**

Run: `npm run test:run -- src/tests/useSavedStore.test.js src/tests/shareLink.test.js`
Expected: PASS (4 + 4).

- [ ] **Step 8: Commit**

```bash
git add src/store/useSavedStore.js src/tests/useSavedStore.test.js src/lib/shareLink.js src/tests/shareLink.test.js
git commit -m "feat: saved-builds store + shareUrlFromCode helper" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Save PC button in the Summary

**Files:** Modify `src/components/BuildSummary.jsx`, `src/tests/BuildSummary.test.jsx`.

- [ ] **Step 1: Write the failing test**

In `src/tests/BuildSummary.test.jsx`, add the import after the existing store import:

```js
import useSavedStore from '../store/useSavedStore'
```

Add a saved-store reset inside the existing `beforeEach` (after the `useBuilderStore.setState(...)` line):

```js
  useSavedStore.setState({ saved: [] })
```

Add this test inside the `describe('BuildSummary', …)` block:

```js
  it('Save PC stores a named build', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Test Rig')
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<BuildSummary />)
    fireEvent.click(screen.getByRole('button', { name: /save pc/i }))
    expect(useSavedStore.getState().saved.some((b) => b.name === 'Test Rig')).toBe(true)
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/tests/BuildSummary.test.jsx`
Expected: FAIL — no "Save PC" button.

- [ ] **Step 3: Wire Save PC**

In `src/components/BuildSummary.jsx`, add imports after the `buildMarkdown` import:

```js
import { encodeBuild } from '../lib/buildCodec'
import useSavedStore from '../store/useSavedStore'
```

Add the selector after the `clearBuild` selector:

```js
  const saveBuild = useSavedStore((s) => s.saveBuild)
```

Add the handler after `handleClear`:

```js
  function handleSave() {
    const fallback = `Build · £${grandTotal.toFixed(0)}`
    const name = window.prompt('Name this build', fallback)
    if (name === null) return
    const code = encodeBuild({ budget, resolution, parts: selectedParts, peripherals: selectedPeripherals })
    saveBuild(name.trim() || fallback, code)
  }
```

Add the button as the first child of the action row:

```jsx
          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={handleSave}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm border border-cyan-500/60 text-cyan-300 hover:border-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Save PC
            </button>
            <button
              onClick={copyShareLink}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/tests/BuildSummary.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildSummary.jsx src/tests/BuildSummary.test.jsx
git commit -m "feat: Save PC button persists a named build" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Saved tab

**Files:** Create `src/components/SavedBuilds.jsx`, `src/tests/SavedBuilds.test.jsx`; Modify `src/screens/BuilderScreen.jsx`.

- [ ] **Step 1: Write the failing test**

Create `src/tests/SavedBuilds.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import SavedBuilds from '../components/SavedBuilds'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import { encodeBuild } from '../lib/buildCodec'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')

beforeEach(() => {
  useSavedStore.setState({ saved: [] })
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('SavedBuilds', () => {
  it('shows an empty state with no saves', () => {
    render(<SavedBuilds />)
    expect(screen.getByText(/no saved builds yet/i)).toBeInTheDocument()
  })
  it('lists a save and loads it into the workspace', () => {
    const code = encodeBuild({ budget: 1200, resolution: '1440p', parts: { cpu }, peripherals: {} })
    useSavedStore.getState().saveBuild('My Rig', code)
    render(<SavedBuilds />)
    expect(screen.getByText('My Rig')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^load$/i }))
    expect(useBuilderStore.getState().selectedParts.cpu?.id).toBe('cpu-ryzen-7-7700x')
    expect(useBuilderStore.getState().budget).toBe(1200)
  })
  it('deletes a save', () => {
    useSavedStore.getState().saveBuild('Trash', 'ABC')
    render(<SavedBuilds />)
    fireEvent.click(screen.getByRole('button', { name: /delete trash/i }))
    expect(useSavedStore.getState().saved).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/tests/SavedBuilds.test.jsx`
Expected: FAIL — `../components/SavedBuilds` does not exist.

- [ ] **Step 3: Create the component**

Create `src/components/SavedBuilds.jsx`:

```jsx
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import { decodeBuild } from '../lib/buildCodec'
import { shareUrlFromCode } from '../lib/shareLink'
import { PANEL } from '../lib/uiTokens'

export default function SavedBuilds({ onLoaded }) {
  const saved = useSavedStore((s) => s.saved)
  const removeSaved = useSavedStore((s) => s.removeSaved)

  function load(code) {
    const d = decodeBuild(code)
    if (!d) return
    useBuilderStore.setState({
      budget: d.budget,
      resolution: d.resolution,
      selectedParts: d.parts,
      selectedPeripherals: d.peripherals,
    })
    onLoaded?.()
  }

  function copyLink(code) {
    navigator.clipboard?.writeText(shareUrlFromCode(code)).catch(() => {})
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        <div className={`${PANEL} p-5`}>
          <h2 className="text-lg text-white mb-3">Saved builds</h2>
          {saved.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No saved builds yet — build something and hit “Save PC” in Summary.</p>
          ) : (
            <div className="space-y-1">
              {saved.map((b) => (
                <div key={b.id} className="flex items-center gap-3 border-t border-slate-800/50 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-100 truncate">{b.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{new Date(b.savedAt).toLocaleDateString()}</div>
                  </div>
                  <button onClick={() => load(b.code)} className="text-xs px-3 py-1.5 rounded-sm bg-gradient-to-r from-cyan-500 to-blue-600 text-white transition-all">Load</button>
                  <button onClick={() => copyLink(b.code)} className="text-xs px-3 py-1.5 rounded-sm border border-slate-700/70 text-slate-200 hover:border-slate-500 transition-all">Copy link</button>
                  <button onClick={() => removeSaved(b.id)} aria-label={`Delete ${b.name}`} className="w-7 h-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-white hover:bg-red-500/80 text-sm">&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/tests/SavedBuilds.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the Saved tab to BuilderScreen**

In `src/screens/BuilderScreen.jsx`, add the import after the `GamePerformancePanel` import:

```js
import SavedBuilds from '../components/SavedBuilds'
```

Change the tab list:

```jsx
          {['build', 'peripherals', 'summary'].map((v) => (
```

to:

```jsx
          {['build', 'peripherals', 'summary', 'saved'].map((v) => (
```

Replace the view-switch tail:

```jsx
        ) : view === 'peripherals' ? (
          <PeripheralsPanel />
        ) : (
          <BuildSummary />
        )}
```

with:

```jsx
        ) : view === 'peripherals' ? (
          <PeripheralsPanel />
        ) : view === 'summary' ? (
          <BuildSummary />
        ) : (
          <SavedBuilds onLoaded={() => setView('build')} />
        )}
```

- [ ] **Step 6: Run the full suite**

Run: `npm run test:run`
Expected: PASS (no broken imports; Saved tab wired).

- [ ] **Step 7: Commit**

```bash
git add src/components/SavedBuilds.jsx src/tests/SavedBuilds.test.jsx src/screens/BuilderScreen.jsx
git commit -m "feat: Saved builds tab (load / copy link / delete)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Physical Dimensions Checklist

**Files:** Create `src/lib/dimensionsCheck.js`, `src/tests/dimensionsCheck.test.js`, `src/components/DimensionsChecklist.jsx`, `src/tests/DimensionsChecklist.test.jsx`; Modify `src/data/partsData.json`, `src/components/BuildSummary.jsx`.

- [ ] **Step 1: Write the failing lib test**

Create `src/tests/dimensionsCheck.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { dimensionsCheck } from '../lib/dimensionsCheck'

describe('dimensionsCheck', () => {
  it('passes when the GPU fits the case', () => {
    const rows = dimensionsCheck({ gpu: { length: 300 }, case: { maxGpuLength: 360, maxCoolerHeight: 170 } })
    expect(rows.find((r) => r.id === 'gpu-length').status).toBe('pass')
  })
  it('fails when the GPU is longer than the case allows', () => {
    const rows = dimensionsCheck({ gpu: { length: 400 }, case: { maxGpuLength: 360, maxCoolerHeight: 170 } })
    expect(rows.find((r) => r.id === 'gpu-length').status).toBe('fail')
  })
  it('passes when the air cooler fits', () => {
    const rows = dimensionsCheck({ cooler: { specs: { height: 158 } }, case: { maxGpuLength: 360, maxCoolerHeight: 170 } })
    expect(rows.find((r) => r.id === 'cooler-height').status).toBe('pass')
  })
  it('fails when the cooler is too tall', () => {
    const rows = dimensionsCheck({ cooler: { specs: { height: 185 } }, case: { maxGpuLength: 360, maxCoolerHeight: 170 } })
    expect(rows.find((r) => r.id === 'cooler-height').status).toBe('fail')
  })
  it('marks checks NA when parts are missing', () => {
    const rows = dimensionsCheck({})
    expect(rows.every((r) => r.status === 'na')).toBe(true)
    expect(rows).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/tests/dimensionsCheck.test.js`
Expected: FAIL — `../lib/dimensionsCheck` does not exist.

- [ ] **Step 3: Implement the lib**

Create `src/lib/dimensionsCheck.js`:

```js
// Reactive physical-fit checks. Returns rows { id, label, status: 'pass'|'fail'|'na', detail }.
export function dimensionsCheck(selectedParts = {}) {
  const { gpu, case: pcCase, cooler } = selectedParts
  const rows = []

  if (gpu && pcCase && typeof gpu.length === 'number' && typeof pcCase.maxGpuLength === 'number') {
    const pass = gpu.length <= pcCase.maxGpuLength
    rows.push({ id: 'gpu-length', label: 'GPU length vs case clearance', status: pass ? 'pass' : 'fail', detail: `${gpu.length}mm GPU / ${pcCase.maxGpuLength}mm max` })
  } else {
    rows.push({ id: 'gpu-length', label: 'GPU length vs case clearance', status: 'na', detail: 'Select a GPU and a case' })
  }

  const coolerH = cooler?.specs?.height
  const caseMax = pcCase?.maxCoolerHeight
  if (typeof coolerH === 'number' && typeof caseMax === 'number') {
    const pass = coolerH <= caseMax
    rows.push({ id: 'cooler-height', label: 'CPU cooler height vs case', status: pass ? 'pass' : 'fail', detail: `${coolerH}mm cooler / ${caseMax}mm max` })
  } else if (cooler && coolerH == null) {
    rows.push({ id: 'cooler-height', label: 'CPU cooler height vs case', status: 'na', detail: 'AIO cooler — no height limit' })
  } else {
    rows.push({ id: 'cooler-height', label: 'CPU cooler height vs case', status: 'na', detail: 'Select an air cooler and a case' })
  }

  return rows
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/tests/dimensionsCheck.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Add `maxCoolerHeight` to every case**

In `src/data/partsData.json`, replace the entire cases block (the 20 case objects, from `case-fractal-torrent` through `case-phanteks-p400a`) with the same block but with `"maxCoolerHeight": N,` inserted after each `"maxGpuLength": X,`. Use these values:

| id | maxCoolerHeight |
|----|-----------------|
| case-fractal-torrent | 188 |
| case-nzxt-h510 | 165 |
| case-bequiet-pb500 | 190 |
| case-cm-q300l | 159 |
| case-fractal-north | 170 |
| case-lian-li-o11 | 167 |
| case-corsair-4000d | 170 |
| case-nzxt-h7-flow | 185 |
| case-fractal-meshify-2 | 185 |
| case-cm-nr200 | 155 |
| case-lian-li-a4-h2o | 67 |
| case-corsair-3000d | 170 |
| case-phanteks-g360a | 162 |
| case-montech-air-903 | 176 |
| case-lian-li-o11-mini | 170 |
| case-corsair-5000d | 170 |
| case-nzxt-h9-flow | 165 |
| case-fractal-pop-air | 170 |
| case-cm-nr200-max | 155 |
| case-phanteks-p400a | 161 |

Each line becomes e.g.:

```json
    "price": 159.99, "supportedFormFactors": ["ATX", "mATX", "ITX"], "maxGpuLength": 467, "maxCoolerHeight": 188, "tdp": 0,
```

- [ ] **Step 6: Write the component test**

Create `src/tests/DimensionsChecklist.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import DimensionsChecklist from '../components/DimensionsChecklist'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => { useBuilderStore.setState({ selectedParts: {} }) })

describe('DimensionsChecklist', () => {
  it('renders both dimension checks', () => {
    render(<DimensionsChecklist />)
    expect(screen.getByText(/GPU length vs case clearance/i)).toBeInTheDocument()
    expect(screen.getByText(/CPU cooler height vs case/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run to verify it fails**

Run: `npm run test:run -- src/tests/DimensionsChecklist.test.jsx`
Expected: FAIL — `../components/DimensionsChecklist` does not exist.

- [ ] **Step 8: Create the component**

Create `src/components/DimensionsChecklist.jsx`:

```jsx
import useBuilderStore from '../store/useBuilderStore'
import { dimensionsCheck } from '../lib/dimensionsCheck'

const ICON = { pass: '✓', fail: '!', na: '·' }
const COLOR = {
  pass: 'text-emerald-300 border-emerald-400/40',
  fail: 'text-red-400 border-red-400/40',
  na: 'text-slate-500 border-slate-700/60',
}

export default function DimensionsChecklist() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const rows = dimensionsCheck(selectedParts)
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2.5 py-1.5 border-t border-slate-800/50">
          <span className={`w-4 h-4 shrink-0 flex items-center justify-center rounded-sm border text-[10px] font-mono ${COLOR[r.status]}`}>{ICON[r.status]}</span>
          <span className="flex-1 text-sm text-slate-200">{r.label}</span>
          <span className="text-[11px] text-slate-500 font-mono">{r.detail}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 9: Render it in the Summary**

In `src/components/BuildSummary.jsx`, add the import after the `GamePerformanceList` import:

```js
import DimensionsChecklist from './DimensionsChecklist'
```

Insert the section immediately after the "How it runs" block's closing `)}` (still inside the `!isEmpty` fragment):

```jsx
                  <GamePerformanceList cpu={selectedParts.cpu} gpu={selectedParts.gpu} resolution={resolution} />
                </div>
              )}

              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Physical dimensions</div>
                <DimensionsChecklist />
              </div>
            </>
```

- [ ] **Step 10: Run the dimensions + summary tests**

Run: `npm run test:run -- src/tests/dimensionsCheck.test.js src/tests/DimensionsChecklist.test.jsx src/tests/BuildSummary.test.jsx`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/lib/dimensionsCheck.js src/tests/dimensionsCheck.test.js src/components/DimensionsChecklist.jsx src/tests/DimensionsChecklist.test.jsx src/data/partsData.json src/components/BuildSummary.jsx
git commit -m "feat: physical dimensions checklist (GPU length + cooler height)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Quick-Start tiers

**Files:** Create `src/lib/tiers.js`, `src/tests/tiers.test.js`; Modify `src/components/BudgetEntry.jsx`; Delete `src/lib/presets.js`.

- [ ] **Step 1: Write the failing test**

Create `src/tests/tiers.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { TIERS, partsForTier } from '../lib/tiers'
import partsData from '../data/partsData.json'
import { checkCompatibility } from '../lib/compatibility'

describe('tiers', () => {
  it('has the three tiers in order', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['budget', 'mainstream', 'ultimate'])
  })

  for (const tier of TIERS) {
    it(`${tier.id}: every id resolves to a real part`, () => {
      const map = partsForTier(tier, partsData)
      expect(Object.keys(map)).toHaveLength(tier.ids.length)
    })

    it(`${tier.id}: the build is internally compatible`, () => {
      const map = partsForTier(tier, partsData)
      for (const part of Object.values(map)) {
        const others = { ...map }
        delete others[part.category]
        expect(checkCompatibility(others, part).compatible).toBe(true)
      }
    })

    it(`${tier.id}: GPU fits the case and total is within the tier budget`, () => {
      const map = partsForTier(tier, partsData)
      expect(map.gpu.length).toBeLessThanOrEqual(map.case.maxGpuLength)
      const total = Object.values(map).reduce((s, p) => s + p.price, 0)
      expect(total).toBeLessThanOrEqual(tier.budget)
    })
  }
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/tests/tiers.test.js`
Expected: FAIL — `../lib/tiers` does not exist.

- [ ] **Step 3: Implement the tiers (verified-compatible IDs)**

Create `src/lib/tiers.js`:

```js
// Curated, mutually-compatible build templates. IDs reference src/data/partsData.json.
export const TIERS = [
  {
    id: 'budget', label: 'Budget', budget: 900, resolution: '1080p',
    ids: ['cpu-ryzen-5-7600', 'mb-asrock-a620m', 'cooler-deepcool-ak400', 'ram-crucial-ddr5-16', 'gpu-rtx-4060', 'storage-crucial-p3-1tb', 'psu-msi-mag-a650', 'case-cm-q300l', 'fans-arctic-p12-max-single'],
  },
  {
    id: 'mainstream', label: 'Mainstream', budget: 1700, resolution: '1440p',
    ids: ['cpu-ryzen-7-7800x3d', 'mb-asus-b650-plus', 'cooler-deepcool-ak620', 'ram-corsair-ddr5-32', 'gpu-rtx-4070-super', 'storage-wd-sn850x-1tb', 'psu-corsair-rm750e', 'case-corsair-4000d', 'fans-arctic-p12-max-single'],
  },
  {
    id: 'ultimate', label: 'Ultimate', budget: 3800, resolution: '4k',
    ids: ['cpu-ryzen-9-7950x3d', 'mb-asus-x670e', 'cooler-noctua-d15', 'ram-gskill-ddr5-64', 'gpu-rtx-4090', 'storage-wd-sn850x-2tb', 'psu-corsair-rm1000x', 'case-fractal-meshify-2', 'fans-lian-li-sl140-2pack'],
  },
]

export function partsForTier(tier, parts) {
  const byId = new Map(parts.map((p) => [p.id, p]))
  const map = {}
  for (const id of tier.ids) {
    const p = byId.get(id)
    if (p) map[p.category] = p
  }
  return map
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/tests/tiers.test.js`
Expected: PASS (1 + 3×3 = 10 tests). If a compatibility/budget assertion fails, fix the offending ID against `partsData.json` (do not weaken the test).

- [ ] **Step 5: Swap presets → tiers in BudgetEntry**

Replace the **entire** contents of `src/components/BudgetEntry.jsx` with:

```jsx
import { useState } from 'react'
import Backdrop from './Backdrop'
import useBuilderStore from '../store/useBuilderStore'
import { TIERS, partsForTier } from '../lib/tiers'
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

  function applyTier(tier) {
    setResolution(tier.resolution)
    setBuild(partsForTier(tier, partsData))
    onSubmit(tier.budget)
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
          <span className="text-xs text-slate-500">or quick-start:</span>
          {TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => applyTier(t)}
              className="text-xs font-mono px-3 py-1.5 rounded-sm border border-slate-700/70 text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-all"
            >
              {t.label} · £{t.budget}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Delete the superseded presets module**

```bash
git rm src/lib/presets.js
```

- [ ] **Step 7: Run the full suite**

Run: `npm run test:run`
Expected: PASS — `BudgetEntry.test.jsx` still passes (it never referenced presets); no remaining import of `../lib/presets`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tiers.js src/tests/tiers.test.js src/components/BudgetEntry.jsx
git commit -m "feat: curated quick-start tiers replace budget presets" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Find Best Price

**Files:** Modify `src/lib/retailerLinks.js`, `src/tests/retailerLinks.test.js`, `src/components/BuildSummary.jsx`.

- [ ] **Step 1: Write the failing test**

In `src/tests/retailerLinks.test.js`, add inside the `describe`:

```js
  it('includes the brand in the query when provided', () => {
    const url = searchUrl('RTX 4070', 'NVIDIA')
    expect(url).toContain(encodeURIComponent('NVIDIA RTX 4070'))
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/tests/retailerLinks.test.js`
Expected: FAIL — `searchUrl` ignores the brand argument, so the query is just `RTX%204070`.

- [ ] **Step 3: Add the brand argument**

Replace `searchUrl` in `src/lib/retailerLinks.js`:

```js
export function searchUrl(name) {
  const base = `https://www.amazon.co.uk/s?k=${encodeURIComponent(name)}`
  return AMAZON_TAG ? `${base}&tag=${AMAZON_TAG}` : base
}
```

with:

```js
export function searchUrl(name, brand) {
  const term = brand ? `${brand} ${name}` : name
  const base = `https://www.amazon.co.uk/s?k=${encodeURIComponent(term)}`
  return AMAZON_TAG ? `${base}&tag=${AMAZON_TAG}` : base
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/tests/retailerLinks.test.js`
Expected: PASS (existing 2 + new 1).

- [ ] **Step 5: Relabel the Summary link and pass the brand**

In `src/components/BuildSummary.jsx`, replace the `Row` component:

```jsx
function Row({ label, name, price }) {
  return (
    <div className="flex items-center py-1.5 border-t border-slate-800/50">
      <span className="font-mono text-[11px] uppercase text-slate-500 w-28 shrink-0 pr-2">{label}</span>
      <span className="flex-1 text-sm text-slate-100 truncate">{name}</span>
      <span className="font-mono text-sm text-slate-300 w-20 text-right">£{price.toFixed(2)}</span>
      <a
        href={searchUrl(name)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-16 text-right text-xs text-cyan-400 hover:text-cyan-300"
      >
        Buy ↗
      </a>
    </div>
  )
}
```

with:

```jsx
function Row({ label, name, brand, price }) {
  return (
    <div className="flex items-center py-1.5 border-t border-slate-800/50">
      <span className="font-mono text-[11px] uppercase text-slate-500 w-28 shrink-0 pr-2">{label}</span>
      <span className="flex-1 text-sm text-slate-100 truncate">{name}</span>
      <span className="font-mono text-sm text-slate-300 w-20 text-right">£{price.toFixed(2)}</span>
      <a
        href={searchUrl(name, brand)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-28 text-right text-xs text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
      >
        Find Best Price ↗
      </a>
    </div>
  )
}
```

Then pass `brand` at both call sites:

```jsx
                  {buildRows.map((r) => <Row key={r.key} label={r.label} name={r.part.name} brand={r.part.brand} price={r.part.price} />)}
```

```jsx
                  {periphRows.map((r) => <Row key={r.key} label={r.label} name={r.part.name} brand={r.part.brand} price={r.part.price} />)}
```

- [ ] **Step 6: Run the retailer + summary tests**

Run: `npm run test:run -- src/tests/retailerLinks.test.js src/tests/BuildSummary.test.jsx`
Expected: PASS. (The existing BuildSummary buy-link test matches `/buy/i` by accessible name — update note: it will now fail because the link text is "Find Best Price". Change that test's matcher.)

In `src/tests/BuildSummary.test.jsx`, update the buy-links test matcher from `/buy/i` to `/find best price/i`:

```js
    const buyLinks = screen.getAllByRole('link', { name: /find best price/i })
```

Re-run: `npm run test:run -- src/tests/BuildSummary.test.jsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/retailerLinks.js src/tests/retailerLinks.test.js src/components/BuildSummary.jsx src/tests/BuildSummary.test.jsx
git commit -m "feat: Find Best Price links with brand in the query" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Full verification

**Files:** none.

- [ ] **Step 1: Whole suite**

Run: `npm run test:run`
Expected: PASS — all green. Net additions: sortParts 6, PartSelector 1, useSavedStore 4, shareLink +1, BuildSummary +1 (Save PC), SavedBuilds 3, dimensionsCheck 5, DimensionsChecklist 1, tiers 10, retailerLinks +1 = baseline 129 → ~162.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds, no errors.

- [ ] **Step 3 (manual): dev-server smoke check**

Run `npm run dev`; verify: entry screen shows 3 quick-start tiers; clicking one enters the builder with a full build; the part modal has a sort dropdown; Summary shows the Physical dimensions checklist and a Save PC button; Save PC prompts for a name; the Saved tab lists it with Load / Copy link / Delete; refresh still resets the working build but the Saved list persists.

---

## Self-Review

**Spec coverage:**
- Feature 1 (bundled data, no inline parts, new field) → Task 5 adds `maxCoolerHeight`; bundled import unchanged. ✓
- Feature 2 (Save PC + Saved tab + share link) → Tasks 2, 3, 4. ✓
- Feature 3 (modal sort) → Task 1. ✓
- Feature 4 (dimensions checklist) → Task 5. ✓
- Feature 5a (tiers) → Task 6; Feature 5b (Find Best Price) → Task 7. ✓

**Placeholder scan:** No TBD/TODO; every step has complete code; commands have expected output. The case-block edit (Task 5 Step 5) gives exact per-id values. ✓

**Type/name consistency:** `useSavedStore` actions `saveBuild(name, code)` / `removeSaved(id)` and shape `{ id, name, savedAt, code }` are consistent across Tasks 2/3/4. `shareUrlFromCode(code)` defined in Task 2, used in Task 4. `dimensionsCheck` row shape `{ id, label, status, detail }` consistent (Task 5 lib ↔ component). `partsForTier(tier, parts)` defined and used (Task 6). `searchUrl(name, brand)` defined (Task 7) and called in `Row` (Task 7) — and `Row` is only called in `BuildSummary` (both call sites updated). ✓

**Cross-task file note:** `BuildSummary.jsx` is edited by Tasks 3 (Save PC button + imports/handlers), 5 (Dimensions section + import), and 7 (Row + call sites). The edits target distinct regions and must be applied in task order; `BuildSummary.test.jsx` matcher is updated in Task 7 Step 6.
