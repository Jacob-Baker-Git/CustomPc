# Builder Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PC-builder state ephemeral (resets on refresh), add a thermal-paste slot, move per-game performance onto the build screen, and fill three feature gaps (Markdown export, Clear Build, ×1.3 PSU headroom) plus a first-paint skeleton — all additive to the existing app.

**Architecture:** A Zustand store (now in-memory only) drives a React 19 + Vite app with an R3F 3D scene. Changes are localized: store edits, one new pure lib (`buildMarkdown`), one new component (`GamePerformancePanel`), small edits to `BuildSummary`/`BuilderScreen`/`buildWarnings`/`PartModel`, data + category additions for paste, and a static skeleton in `index.html`. No rewrite; no SSG.

**Tech Stack:** React 19, Vite 8, Zustand 5, React Three Fiber, Tailwind 3, Vitest 4 (jsdom).

---

## Conventions

- **Node isn't on PATH.** In each fresh PowerShell, first run:
  `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
- Run a single test file: `npm run test:run -- src/tests/<file>`
- Run the whole suite: `npm run test:run`
- Build: `npm run build`
- Work on `main` locally. **Do not push** (auto-deploy is wired; pushing publishes).
- Baseline before this plan: **116 tests passing**, head `1b10f71`.

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/store/useBuilderStore.js` | In-memory state + `clearBuild` | Modify (drop `persist`, add action) |
| `src/lib/buildWarnings.js` | Health warnings incl. PSU headroom | Modify (×1.3 rule) |
| `src/lib/buildMarkdown.js` | Pure Markdown-table generator | Create |
| `src/components/BuildSummary.jsx` | Summary tab: export + Clear build | Modify |
| `src/lib/categories.js` | Category list | Modify (add `paste`) |
| `src/lib/recommendedOrder.js` | Pick order + optional skip | Modify |
| `src/data/partsData.json` | Parts dataset | Modify (add paste parts) |
| `src/components/PartModel.jsx` | 3D dispatch per part | Modify (skip paste) |
| `src/components/GamePerformancePanel.jsx` | Build-screen "how it runs" panel | Create |
| `src/screens/BuilderScreen.jsx` | Layout + tabs | Modify (corner panel, drop Games tab) |
| `src/components/GamePanel.jsx` + test | Old Games tab | Delete |
| `index.html` | First-paint skeleton | Modify |

---

### Task 1: In-memory store + Clear Build

**Files:**
- Modify: `src/store/useBuilderStore.js`
- Test: `src/tests/useBuilderStore.test.js`

- [ ] **Step 1: Write the failing tests**

Add these two tests inside the `describe('useBuilderStore', …)` block in `src/tests/useBuilderStore.test.js` (after the existing `'removes a part'` test):

```js
  it('does not persist to storage', () => {
    expect(useBuilderStore.persist).toBeUndefined()
  })

  it('clearBuild empties parts and peripherals but keeps budget', () => {
    useBuilderStore.getState().setBudget(1500)
    useBuilderStore.getState().addPart('cpu', cpu)
    useBuilderStore.getState().addPeripheral('monitor', { price: 300 })
    useBuilderStore.getState().clearBuild()
    expect(useBuilderStore.getState().selectedParts).toEqual({})
    expect(useBuilderStore.getState().selectedPeripherals).toEqual({})
    expect(useBuilderStore.getState().budget).toBe(1500)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/tests/useBuilderStore.test.js`
Expected: FAIL — `useBuilderStore.persist` is defined (persist middleware) so the first new test fails; `clearBuild` is not a function so the second throws.

- [ ] **Step 3: Replace the store with an in-memory version that has `clearBuild`**

Replace the **entire** contents of `src/store/useBuilderStore.js` with:

```js
import { create } from 'zustand'

const useBuilderStore = create((set) => ({
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

  caseTransparent: true,
  toggleCaseTransparency: () =>
    set((state) => ({ caseTransparent: !state.caseTransparent })),

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/tests/useBuilderStore.test.js`
Expected: PASS (all store tests, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/store/useBuilderStore.js src/tests/useBuilderStore.test.js
git commit -m "feat: in-memory store with clearBuild (drop localStorage persistence)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: PSU ×1.3 headroom warning

**Files:**
- Modify: `src/lib/buildWarnings.js:13-15`
- Test: `src/tests/buildWarnings.test.js`

- [ ] **Step 1: Write the failing tests**

Add these two tests inside the `describe('getBuildWarnings', …)` block in `src/tests/buildWarnings.test.js` (after the last existing test):

```js
  it('warns on thin PSU headroom (under ~30% spare)', () => {
    const w = getBuildWarnings({ cpu: { tdp: 100 }, gpu: { tdp: 300 }, psu: { wattage: 500 } })
    expect(w.some((x) => x.level === 'warning' && /headroom/i.test(x.message))).toBe(true)
    expect(w.some((x) => x.level === 'critical')).toBe(false)
  })

  it('gives no headroom warning when the PSU has ample spare', () => {
    const w = getBuildWarnings({ cpu: { tdp: 100 }, gpu: { tdp: 300 }, psu: { wattage: 800 } })
    expect(w.some((x) => /headroom/i.test(x.message))).toBe(false)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/tests/buildWarnings.test.js`
Expected: FAIL — the current rule warns at `draw > 0.8 * wattage`. For draw 400 / 800W: `400 > 640` is false, so no warning is produced and the "thin headroom" test fails (it expects a warning at 500W and the message text `headroom` with the new wording). (The 500W case already warns under the old rule, but the wording/`/headroom/i` may pass; the 800W ample case is the definitive failure driver only after the message wording is the discriminator — run to confirm current behavior, then implement.)

- [ ] **Step 3: Change the warning branch to the ×1.3 rule**

In `src/lib/buildWarnings.js`, replace this branch:

```js
  } else if (psu && draw > 0.8 * psu.wattage) {
    warnings.push({ level: 'warning', message: `Low PSU headroom — ${draw}W of ${psu.wattage}W (aim under 80%).` })
  }
```

with:

```js
  } else if (psu && draw * 1.3 > psu.wattage) {
    warnings.push({ level: 'warning', message: `Low PSU headroom — ${draw}W draw vs ${psu.wattage}W (aim for ~30% spare).` })
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/tests/buildWarnings.test.js`
Expected: PASS. (draw 400: `520 > 500` → warning, `400 ≥ 500` false → not critical. draw 400 vs 800: `520 > 800` false → no warning. Existing real-part tests unaffected: 555W vs 1000W → `721.5 > 1000` false → no warning, no critical.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/buildWarnings.js src/tests/buildWarnings.test.js
git commit -m "feat: PSU headroom warning uses 1.3x rule" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Markdown export library

**Files:**
- Create: `src/lib/buildMarkdown.js`
- Test: `src/tests/buildMarkdown.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/buildMarkdown.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildMarkdown } from '../lib/buildMarkdown'

describe('buildMarkdown', () => {
  it('renders a header and separator row', () => {
    const md = buildMarkdown([{ label: 'CPU', name: 'Ryzen 7 7800X3D', price: 349 }], 349)
    expect(md).toContain('| Component | Part | Price |')
    expect(md).toContain('| --- | --- | --- |')
  })

  it('formats each part row with a GBP price to two decimals', () => {
    const md = buildMarkdown([{ label: 'GPU', name: 'RTX 4070', price: 549.9 }], 549.9)
    expect(md).toContain('| GPU | RTX 4070 | £549.90 |')
  })

  it('ends with a bold total row', () => {
    const md = buildMarkdown([{ label: 'CPU', name: 'X', price: 100 }], 100)
    expect(md.trim().endsWith('| **Total** |  | **£100.00** |')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/buildMarkdown.test.js`
Expected: FAIL — `../lib/buildMarkdown` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/buildMarkdown.js`:

```js
// Renders the selected build as a GitHub/forum-friendly Markdown table.
// rows: [{ label, name, price }]; total: number.
export function buildMarkdown(rows, total) {
  const header = '| Component | Part | Price |\n| --- | --- | --- |'
  const body = rows.map((r) => `| ${r.label} | ${r.name} | £${r.price.toFixed(2)} |`).join('\n')
  const totalRow = `| **Total** |  | **£${total.toFixed(2)}** |`
  return [header, body, totalRow].filter(Boolean).join('\n')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/buildMarkdown.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/buildMarkdown.js src/tests/buildMarkdown.test.js
git commit -m "feat: buildMarkdown table generator" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Wire Clear Build + Markdown into the Summary

**Files:**
- Modify: `src/components/BuildSummary.jsx`
- Test: `src/tests/BuildSummary.test.jsx`

- [ ] **Step 1: Write the failing tests**

In `src/tests/BuildSummary.test.jsx`, update the import lines at the top:

```js
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
```

Then add these tests inside the `describe('BuildSummary', …)` block (after the existing tests):

```js
  it('offers a Copy as Markdown action', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<BuildSummary />)
    expect(screen.getByRole('button', { name: /copy as markdown/i })).toBeInTheDocument()
  })

  it('Clear build empties the store after confirm', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<BuildSummary />)
    fireEvent.click(screen.getByRole('button', { name: /clear build/i }))
    expect(useBuilderStore.getState().selectedParts).toEqual({})
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/tests/BuildSummary.test.jsx`
Expected: FAIL — there is no "Copy as Markdown" or "Clear build" button yet.

- [ ] **Step 3: Wire the component**

In `src/components/BuildSummary.jsx`:

(a) Add the import after the existing `import { buildShareUrl } …` line:

```js
import { buildMarkdown } from '../lib/buildMarkdown'
```

(b) Add the `clearBuild` selector. After the line `const budget = useBuilderStore((s) => s.budget)` add:

```js
  const clearBuild = useBuilderStore((s) => s.clearBuild)
```

(c) Replace the `copyPartsList` function:

```js
  function copyPartsList() {
    const lines = [...buildRows, ...periphRows].map((r) => `${r.label}: ${r.part.name} — £${r.part.price.toFixed(2)}`)
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {})
  }
```

with:

```js
  function copyMarkdown() {
    const rows = [...buildRows, ...periphRows].map((r) => ({ label: r.label, name: r.part.name, price: r.part.price }))
    navigator.clipboard?.writeText(buildMarkdown(rows, grandTotal)).catch(() => {})
  }

  function handleClear() {
    if (window.confirm('Clear the whole build? This removes all selected parts and peripherals.')) clearBuild()
  }
```

(d) Replace the "Copy parts list" button block:

```jsx
            <button
              onClick={copyPartsList}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm border border-slate-700/70 text-slate-200 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Copy parts list
            </button>
```

with:

```jsx
            <button
              onClick={copyMarkdown}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm border border-slate-700/70 text-slate-200 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Copy as Markdown
            </button>
            <button
              onClick={handleClear}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm border border-red-700/60 text-red-300 hover:border-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Clear build
            </button>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/tests/BuildSummary.test.jsx`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildSummary.jsx src/tests/BuildSummary.test.jsx
git commit -m "feat: Markdown export and Clear build in Summary" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Thermal paste category + data

**Files:**
- Modify: `src/lib/recommendedOrder.js`
- Modify: `src/lib/categories.js`
- Modify: `src/data/partsData.json:907-917`
- Modify: `src/components/PartModel.jsx:6`
- Modify: `src/tests/recommendedOrder.test.js`
- Modify: `src/tests/CategoryList.test.jsx:9`
- Create: `src/tests/thermalPaste.test.js`

- [ ] **Step 1: Write the failing tests**

Replace the **entire** contents of `src/tests/recommendedOrder.test.js` with:

```js
import { describe, it, expect } from 'vitest'
import { RECOMMENDED_ORDER, nextRecommended } from '../lib/recommendedOrder'

describe('recommendedOrder', () => {
  it('starts with motherboard and ends with the optional paste (10 entries)', () => {
    expect(RECOMMENDED_ORDER[0]).toBe('motherboard')
    expect(RECOMMENDED_ORDER[RECOMMENDED_ORDER.length - 1]).toBe('paste')
    expect(RECOMMENDED_ORDER).toHaveLength(10)
  })

  it('returns motherboard first when nothing is selected', () => {
    expect(nextRecommended({})).toBe('motherboard')
  })

  it('skips selected categories and returns the next gap in order', () => {
    expect(nextRecommended({ motherboard: { id: 'm' } })).toBe('cpu')
    expect(nextRecommended({ motherboard: { id: 'm' }, cpu: { id: 'c' } })).toBe('cooler')
  })

  it('treats paste as optional — never returns it as the next pick', () => {
    const allButPaste = {}
    for (const c of RECOMMENDED_ORDER) if (c !== 'paste') allButPaste[c] = { id: c }
    expect(nextRecommended(allButPaste)).toBeNull()
  })

  it('returns null when every category is filled', () => {
    const full = {}
    for (const c of RECOMMENDED_ORDER) full[c] = { id: c }
    expect(nextRecommended(full)).toBeNull()
  })
})
```

Create `src/tests/thermalPaste.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { CATEGORIES } from '../lib/categories'
import partsData from '../data/partsData.json'

describe('thermal paste', () => {
  it('is a category', () => {
    expect(CATEGORIES.some((c) => c.id === 'paste')).toBe(true)
  })

  it('has selectable parts with zero TDP', () => {
    const paste = partsData.filter((p) => p.category === 'paste')
    expect(paste.length).toBeGreaterThanOrEqual(3)
    paste.forEach((p) => {
      expect(typeof p.name).toBe('string')
      expect(typeof p.price).toBe('number')
      expect(p.tdp).toBe(0)
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/tests/recommendedOrder.test.js src/tests/thermalPaste.test.js`
Expected: FAIL — `RECOMMENDED_ORDER` still has 9 entries ending `fans`; `CATEGORIES` has no `paste`; no paste parts exist.

- [ ] **Step 3a: Add the category**

In `src/lib/categories.js`, change:

```js
  { id: 'fans',        label: 'Case Fans',    icon: '🌀' },
]
```

to:

```js
  { id: 'fans',        label: 'Case Fans',    icon: '🌀' },
  { id: 'paste',       label: 'Thermal Paste', icon: '🧴' },
]
```

- [ ] **Step 3b: Update the recommended order (optional skip)**

Replace the **entire** contents of `src/lib/recommendedOrder.js` with:

```js
export const RECOMMENDED_ORDER = [
  'motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case', 'fans', 'paste',
]

// Categories that should never be highlighted as the "next" required pick.
const OPTIONAL = new Set(['paste'])

export function nextRecommended(selectedParts = {}) {
  for (const category of RECOMMENDED_ORDER) {
    if (OPTIONAL.has(category)) continue
    if (!selectedParts[category]) return category
  }
  return null
}
```

- [ ] **Step 3c: Add paste parts to the dataset**

In `src/data/partsData.json`, replace the final fan entry and closing bracket:

```json
  {
    "id": "fans-arctic-p12-max-single", "category": "fans", "name": "Arctic P12 Max 120mm",
    "price": 9.99, "tdp": 3, "modelPath": "/models/fans.glb",
    "specs": { "size": "120mm", "count": 1, "rgb": false }
  }
]
```

with:

```json
  {
    "id": "fans-arctic-p12-max-single", "category": "fans", "name": "Arctic P12 Max 120mm",
    "price": 9.99, "tdp": 3, "modelPath": "/models/fans.glb",
    "specs": { "size": "120mm", "count": 1, "rgb": false }
  },
  {
    "id": "paste-arctic-mx4", "category": "paste", "name": "Arctic MX-4 (4g)",
    "brand": "Arctic", "price": 6.49, "tdp": 0
  },
  {
    "id": "paste-noctua-nth1", "category": "paste", "name": "Noctua NT-H1 (3.5g)",
    "brand": "Noctua", "price": 7.99, "tdp": 0
  },
  {
    "id": "paste-tg-kryonaut", "category": "paste", "name": "Thermal Grizzly Kryonaut (1g)",
    "brand": "Thermal Grizzly", "price": 9.99, "tdp": 0
  },
  {
    "id": "paste-arctic-mx6", "category": "paste", "name": "Arctic MX-6 (4g)",
    "brand": "Arctic", "price": 8.99, "tdp": 0
  },
  {
    "id": "paste-cm-mastergel", "category": "paste", "name": "Cooler Master MasterGel Pro",
    "brand": "Cooler Master", "price": 5.49, "tdp": 0
  }
]
```

- [ ] **Step 3d: Stop the 3D scene drawing a paste cube**

In `src/components/PartModel.jsx`, change line 6:

```js
  if (part.category === 'fans') return null
```

to:

```js
  if (part.category === 'fans' || part.category === 'paste') return null
```

- [ ] **Step 3e: Tidy the now-stale CategoryList test name**

In `src/tests/CategoryList.test.jsx`, change:

```js
  it('renders all nine categories', () => {
```

to:

```js
  it('renders the category rows', () => {
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/tests/recommendedOrder.test.js src/tests/thermalPaste.test.js src/tests/CategoryList.test.js src/tests/CategoryList.test.jsx`
Expected: PASS for recommendedOrder, thermalPaste, and CategoryList.

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.js src/lib/recommendedOrder.js src/data/partsData.json src/components/PartModel.jsx src/tests/recommendedOrder.test.js src/tests/thermalPaste.test.js src/tests/CategoryList.test.jsx
git commit -m "feat: thermal paste as an optional, non-3D part" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Per-game panel on the build screen; remove Games tab

**Files:**
- Create: `src/components/GamePerformancePanel.jsx`
- Test: `src/tests/GamePerformancePanel.test.jsx`
- Modify: `src/screens/BuilderScreen.jsx`
- Delete: `src/components/GamePanel.jsx`, `src/tests/GamePanel.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/GamePerformancePanel.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import GamePerformancePanel from '../components/GamePerformancePanel'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')

beforeEach(() => {
  useBuilderStore.setState({ selectedParts: {}, resolution: '1440p' })
})

describe('GamePerformancePanel', () => {
  it('prompts for a CPU and GPU when either is missing', () => {
    render(<GamePerformancePanel />)
    expect(screen.getByText(/select a cpu \+ gpu/i)).toBeInTheDocument()
  })

  it('shows the header and game rows for a build', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<GamePerformancePanel />)
    expect(screen.getByText(/how it runs @/i)).toBeInTheDocument()
    expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/GamePerformancePanel.test.jsx`
Expected: FAIL — `../components/GamePerformancePanel` does not exist.

- [ ] **Step 3a: Create the panel**

Create `src/components/GamePerformancePanel.jsx`:

```jsx
import useBuilderStore from '../store/useBuilderStore'
import GamePerformanceList from './GamePerformanceList'
import { PANEL } from '../lib/uiTokens'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

export default function GamePerformancePanel() {
  const cpu = useBuilderStore((s) => s.selectedParts.cpu)
  const gpu = useBuilderStore((s) => s.selectedParts.gpu)
  const resolution = useBuilderStore((s) => s.resolution)

  return (
    <div className={`${PANEL} p-3`}>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
        How it runs @ {RES_LABEL[resolution] ?? resolution}
      </div>
      {!cpu || !gpu ? (
        <p className="text-xs text-slate-500 py-2">Select a CPU + GPU to see game FPS.</p>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto">
          <GamePerformanceList cpu={cpu} gpu={gpu} resolution={resolution} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3b: Run the new test to verify it passes**

Run: `npm run test:run -- src/tests/GamePerformancePanel.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 3c: Rewire BuilderScreen**

In `src/screens/BuilderScreen.jsx`:

Change the import (line 16):

```js
import GamePanel from '../components/GamePanel'
```

to:

```js
import GamePerformancePanel from '../components/GamePerformancePanel'
```

Change the tab list:

```js
          {['build', 'peripherals', 'summary', 'games'].map((v) => (
```

to:

```js
          {['build', 'peripherals', 'summary'].map((v) => (
```

In the desktop build branch, add the corner panel directly after the BottleneckIndicator line:

```jsx
              <div className="absolute top-4 left-4 w-72"><BottleneckIndicator /></div>
```

becomes:

```jsx
              <div className="absolute top-4 left-4 w-72"><BottleneckIndicator /></div>
              <div className="absolute top-4 right-4 w-72"><GamePerformancePanel /></div>
```

In the mobile build branch, add the panel after the PerformancePanel line:

```jsx
                <PerformancePanel />
```

becomes:

```jsx
                <PerformancePanel />
                <GamePerformancePanel />
```

Replace the tail of the view switch:

```jsx
        ) : view === 'peripherals' ? (
          <PeripheralsPanel />
        ) : view === 'summary' ? (
          <BuildSummary />
        ) : (
          <GamePanel />
        )}
```

with:

```jsx
        ) : view === 'peripherals' ? (
          <PeripheralsPanel />
        ) : (
          <BuildSummary />
        )}
```

- [ ] **Step 3d: Delete the old Games tab files**

```bash
git rm src/components/GamePanel.jsx src/tests/GamePanel.test.jsx
```

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `npm run test:run`
Expected: PASS — GamePanel tests are gone; GamePerformancePanel passes; no import of `../components/GamePanel` remains.

- [ ] **Step 5: Commit**

```bash
git add src/components/GamePerformancePanel.jsx src/tests/GamePerformancePanel.test.jsx src/screens/BuilderScreen.jsx
git commit -m "feat: per-game performance panel on build screen; remove Games tab" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: First-paint skeleton

**Files:**
- Modify: `index.html:26-29`
- Test: `src/tests/indexHtml.test.js`

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe('index.html metadata', …)` block in `src/tests/indexHtml.test.js`:

```js
  it('paints a dark boot skeleton before JS loads', () => {
    expect(html).toContain('#05080f')
    expect(html).toMatch(/id="root">[\s\S]*class="boot"[\s\S]*<\/div>/)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/indexHtml.test.js`
Expected: FAIL — `#root` is currently empty and there's no `boot` element or `#05080f`.

- [ ] **Step 3: Add the skeleton**

In `index.html`, replace:

```html
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
```

with:

```html
  <body style="margin:0;background:#05080f">
    <div id="root"><div class="boot" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#05080f;color:#67e8f9;font-family:'JetBrains Mono',monospace;font-size:14px;letter-spacing:0.12em">Custom PC Builder…</div></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/indexHtml.test.js`
Expected: PASS (existing metadata tests + the new skeleton test).

- [ ] **Step 5: Commit**

```bash
git add index.html src/tests/indexHtml.test.js
git commit -m "feat: dark first-paint skeleton in index.html" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test:run`
Expected: PASS — all tests green (≈129: 116 baseline + buildMarkdown 3 + store 2 + buildWarnings 2 + BuildSummary 2 + recommendedOrder +1 + thermalPaste 2 + GamePerformancePanel 2 + indexHtml 1, − GamePanel 2).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3 (manual, optional): Smoke-check in the dev server**

Run: `npm run dev` and open http://localhost:5173.
Verify: budget screen paints instantly on a dark background; after entering a budget, the build screen shows a "How it runs" panel top-right; the Games tab is gone; Thermal Paste appears as the last category and is selectable but absent from the 3D scene; Summary has "Copy as Markdown" and "Clear build"; a tab refresh resets to the budget screen.

---

## Self-Review

**Spec coverage:**
- Goal 1 ephemeral state → Task 1. ✓
- Goal 2 thermal paste → Task 5. ✓
- Goal 3 per-game corner panel + remove Games tab → Task 6. ✓
- Goal 4 Clear Build → Task 1 (store) + Task 4 (button). ✓
- Goal 5 Markdown export → Task 3 (lib) + Task 4 (wiring). ✓
- Goal 6 PSU ×1.3 → Task 2. ✓
- Goal 7 first-paint skeleton → Task 7. ✓
- Non-goal "no autoBuilder change" honored (FILL_ORDER is independent of CATEGORIES). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command states expected output. ✓

**Type/name consistency:** `clearBuild` (store action) used identically in Task 1 and Task 4. `buildMarkdown(rows, total)` signature matches Task 3 definition and Task 4 call site (`rows` = `{label,name,price}`, `total` = `grandTotal`). `GamePerformancePanel` default export consumed by Task 6 wiring. `paste` category id consistent across categories.js, recommendedOrder.js, partsData.json, PartModel.jsx, and tests. ✓
