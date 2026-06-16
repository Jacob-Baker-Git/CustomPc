# Phase 1 — Build Persistence & Sharing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the build to localStorage, make it shareable via a stateless URL, and add a "Summary" tab with a parts list, totals, and retailer buy links.

**Architecture:** A build is `{ budget, resolution, parts, peripherals }`. `persist` middleware saves the live store; a pure `buildCodec` encodes/decodes the build to a base64url URL param; `shareLink` wires the codec to the store + `window.location`; `BuildSummary` renders it. No backend, no router.

**Tech Stack:** React 19, Zustand (+ `zustand/middleware` persist), Vite, Tailwind, Vitest + Testing Library (jsdom).

**Conventions for every task:**
- Node is at `C:\Program Files\nodejs` (not on the default PATH). In PowerShell, run once per shell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`.
- Full suite: `npm run test:run`. Single file: `npm run test:run -- src/tests/<file>`. Baseline is **79 passing**; this phase adds tests (ending at ~87).
- Every commit appends the trailer: `-m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"`.
- Work on `main` locally; do not push.

---

### Task 1: Persist the store to localStorage

**Files:**
- Modify: `src/store/useBuilderStore.js`

- [ ] **Step 1: Wrap the store in the persist middleware**

Replace the top of `src/store/useBuilderStore.js` — the `import` and the `create(...)` call — so the store object is wrapped in `persist(...)`. Keep every existing action body unchanged; only the wrapper and the trailing options are new:

```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useBuilderStore = create(
  persist(
    (set) => ({
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
    }),
    {
      name: 'custompc-build-v1',
      version: 1,
      partialize: (state) => ({
        budget: state.budget,
        selectedParts: state.selectedParts,
        selectedPeripherals: state.selectedPeripherals,
        resolution: state.resolution,
        caseTransparent: state.caseTransparent,
      }),
    }
  )
)

export default useBuilderStore
```

Leave everything below `export default useBuilderStore` (the `selTotalSpent`, `selPsuWattage`, etc. selectors) exactly as-is.

- [ ] **Step 2: Verify the existing suite still passes**

Run: `npm run test:run`
Expected: PASS — 79 tests. (`persist` preserves `getState`/`setState`; the store tests are unaffected.)

- [ ] **Step 3: Commit**

```bash
git add src/store/useBuilderStore.js
git commit -m "feat: persist build state to localStorage"
```

---

### Task 2: Build codec (pure encode/decode)

**Files:**
- Create: `src/lib/buildCodec.js`
- Create: `src/tests/buildCodec.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/buildCodec.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { encodeBuild, decodeBuild } from '../lib/buildCodec'
import partsData from '../data/partsData.json'
import peripheralsData from '../data/peripheralsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4060ti')
const mon = peripheralsData.find((p) => p.id === 'mon-dell-s2721dgf')

describe('buildCodec', () => {
  it('round-trips budget, resolution, parts and peripherals', () => {
    const code = encodeBuild({
      budget: 1500,
      resolution: '4k',
      parts: { cpu, gpu },
      peripherals: { monitor: mon },
    })
    const out = decodeBuild(code)
    expect(out.budget).toBe(1500)
    expect(out.resolution).toBe('4k')
    expect(out.parts.cpu.id).toBe(cpu.id)
    expect(out.parts.gpu.id).toBe(gpu.id)
    expect(out.peripherals.monitor.id).toBe(mon.id)
  })

  it('drops ids that are not in the catalog', () => {
    const code = encodeBuild({
      budget: 1000,
      resolution: '1440p',
      parts: { cpu, gpu: { id: 'gpu-does-not-exist' } },
      peripherals: {},
    })
    const out = decodeBuild(code)
    expect(out.parts.cpu.id).toBe(cpu.id)
    expect(out.parts.gpu).toBeUndefined()
  })

  it('returns null for garbage input', () => {
    expect(decodeBuild('!!!not-valid!!!')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/buildCodec.test.js`
Expected: FAIL — `../lib/buildCodec` does not exist.

- [ ] **Step 3: Implement the codec**

Create `src/lib/buildCodec.js`:

```js
import partsData from '../data/partsData.json'
import peripheralsData from '../data/peripheralsData.json'

const PART_BY_ID = new Map(partsData.map((p) => [p.id, p]))
const PERIPHERAL_BY_ID = new Map(peripheralsData.map((p) => [p.id, p]))

function toBase64Url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code) {
  return atob(code.replace(/-/g, '+').replace(/_/g, '/'))
}

export function encodeBuild({ budget, resolution, parts, peripherals }) {
  const p = {}
  for (const [cat, part] of Object.entries(parts || {})) if (part) p[cat] = part.id
  const x = {}
  for (const [cat, part] of Object.entries(peripherals || {})) if (part) x[cat] = part.id
  return toBase64Url(JSON.stringify({ b: budget || 0, r: resolution || '1440p', p, x }))
}

export function decodeBuild(code) {
  let payload
  try {
    payload = JSON.parse(fromBase64Url(code))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null

  const parts = {}
  for (const [cat, id] of Object.entries(payload.p || {})) {
    const part = PART_BY_ID.get(id)
    if (part) parts[cat] = part
  }
  const peripherals = {}
  for (const [cat, id] of Object.entries(payload.x || {})) {
    const part = PERIPHERAL_BY_ID.get(id)
    if (part) peripherals[cat] = part
  }
  return {
    budget: typeof payload.b === 'number' ? payload.b : 0,
    resolution: payload.r || '1440p',
    parts,
    peripherals,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/buildCodec.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/buildCodec.js src/tests/buildCodec.test.js
git commit -m "feat: build codec for stateless share links"
```

---

### Task 3: Retailer buy links (pure)

**Files:**
- Create: `src/lib/retailerLinks.js`
- Create: `src/tests/retailerLinks.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/retailerLinks.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { searchUrl } from '../lib/retailerLinks'

describe('retailerLinks', () => {
  it('builds an Amazon UK search URL with the encoded part name', () => {
    const url = searchUrl('AMD Ryzen 9 7950X')
    expect(url).toContain('amazon.co.uk/s?k=')
    expect(url).toContain(encodeURIComponent('AMD Ryzen 9 7950X'))
  })

  it('does not append an affiliate tag when none is configured', () => {
    expect(searchUrl('Test Part')).not.toContain('&tag=')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/retailerLinks.test.js`
Expected: FAIL — `../lib/retailerLinks` does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/retailerLinks.js`:

```js
// Set to an Amazon Associates tag to monetise later; empty = plain search links.
export const AMAZON_TAG = ''

export function searchUrl(name) {
  const base = `https://www.amazon.co.uk/s?k=${encodeURIComponent(name)}`
  return AMAZON_TAG ? `${base}&tag=${AMAZON_TAG}` : base
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/retailerLinks.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/retailerLinks.js src/tests/retailerLinks.test.js
git commit -m "feat: retailer search links for build parts"
```

---

### Task 4: Share-link wiring (store + URL) and startup hydration

**Files:**
- Create: `src/lib/shareLink.js`
- Create: `src/tests/shareLink.test.js`
- Modify: `src/main.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/shareLink.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import useBuilderStore from '../store/useBuilderStore'
import { encodeBuild } from '../lib/buildCodec'
import { buildShareUrl, applyShareLinkFromUrl } from '../lib/shareLink'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4060ti')

beforeEach(() => {
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
  window.history.replaceState({}, '', '/')
})

describe('shareLink', () => {
  it('buildShareUrl encodes the current build into a ?build= url', () => {
    useBuilderStore.setState({ budget: 1500, selectedParts: { cpu }, resolution: '4k' })
    const url = buildShareUrl()
    expect(url).toContain('?build=')
    const code = new URL(url).searchParams.get('build')
    expect(code).toBe(encodeBuild({ budget: 1500, resolution: '4k', parts: { cpu }, peripherals: {} }))
  })

  it('applyShareLinkFromUrl hydrates the store and strips the param', () => {
    const code = encodeBuild({ budget: 2000, resolution: '1080p', parts: { cpu, gpu }, peripherals: {} })
    window.history.pushState({}, '', '/?build=' + code)
    expect(applyShareLinkFromUrl()).toBe(true)
    const st = useBuilderStore.getState()
    expect(st.budget).toBe(2000)
    expect(st.selectedParts.cpu.id).toBe(cpu.id)
    expect(st.selectedParts.gpu.id).toBe(gpu.id)
    expect(window.location.search).toBe('')
  })

  it('returns false when there is no build param', () => {
    expect(applyShareLinkFromUrl()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/shareLink.test.js`
Expected: FAIL — `../lib/shareLink` does not exist.

- [ ] **Step 3: Implement shareLink**

Create `src/lib/shareLink.js`:

```js
import useBuilderStore from '../store/useBuilderStore'
import { encodeBuild, decodeBuild } from './buildCodec'

export function buildShareUrl() {
  const { budget, resolution, selectedParts, selectedPeripherals } = useBuilderStore.getState()
  const code = encodeBuild({ budget, resolution, parts: selectedParts, peripherals: selectedPeripherals })
  return `${window.location.origin}${window.location.pathname}?build=${code}`
}

export function applyShareLinkFromUrl() {
  const code = new URLSearchParams(window.location.search).get('build')
  if (!code) return false
  const decoded = decodeBuild(code)
  if (decoded) {
    useBuilderStore.setState({
      budget: decoded.budget,
      resolution: decoded.resolution,
      selectedParts: decoded.parts,
      selectedPeripherals: decoded.peripherals,
    })
  }
  // Strip the param either way so a refresh doesn't reload a stale link.
  window.history.replaceState({}, '', window.location.pathname)
  return Boolean(decoded)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/shareLink.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Wire hydration into app startup**

Replace `src/main.jsx` entirely:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyShareLinkFromUrl } from './lib/shareLink'
import './index.css'

// Hydrate from a ?build= share link before the first render (no BudgetEntry flash).
applyShareLinkFromUrl()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: Run the full suite**

Run: `npm run test:run`
Expected: PASS — 87 tests (79 + 3 codec + 2 retailer + 3 shareLink... = 87).

- [ ] **Step 7: Commit**

```bash
git add src/lib/shareLink.js src/tests/shareLink.test.js src/main.jsx
git commit -m "feat: share-link hydration and url builder"
```

---

### Task 5: Build summary component

**Files:**
- Create: `src/components/BuildSummary.jsx`
- Create: `src/tests/BuildSummary.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/BuildSummary.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import BuildSummary from '../components/BuildSummary'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4060ti')

beforeEach(() => {
  useBuilderStore.setState({ budget: 1000, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('BuildSummary', () => {
  it('shows an empty prompt when nothing is selected', () => {
    render(<BuildSummary />)
    expect(screen.getByText(/no parts selected yet/i)).toBeInTheDocument()
  })

  it('lists selected parts with prices and buy links', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<BuildSummary />)
    expect(screen.getByText(cpu.name)).toBeInTheDocument()
    expect(screen.getByText(gpu.name)).toBeInTheDocument()
    const buyLinks = screen.getAllByRole('link', { name: /buy/i })
    expect(buyLinks.length).toBe(2)
    expect(buyLinks[0].getAttribute('href')).toContain('amazon.co.uk')
    expect(buyLinks[0].getAttribute('href')).toContain(encodeURIComponent(cpu.name))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/BuildSummary.test.jsx`
Expected: FAIL — `../components/BuildSummary` does not exist.

- [ ] **Step 3: Implement BuildSummary**

Create `src/components/BuildSummary.jsx`:

```jsx
import { useState } from 'react'
import useBuilderStore, { selTotalSpent, selPeripheralsTotal, selTotalPower } from '../store/useBuilderStore'
import { CATEGORIES } from '../lib/categories'
import { searchUrl } from '../lib/retailerLinks'
import { buildShareUrl } from '../lib/shareLink'
import { PANEL } from '../lib/uiTokens'

const PERIPHERAL_LABELS = { monitor: 'Monitor', keyboard: 'Keyboard', mouse: 'Mouse', headset: 'Headset' }
const PERIPHERAL_ORDER = ['monitor', 'keyboard', 'mouse', 'headset']

function Row({ label, name, price }) {
  return (
    <div className="flex items-center py-1.5 border-t border-slate-800/50">
      <span className="font-mono text-[11px] uppercase text-slate-500 w-16 shrink-0">{label}</span>
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

export default function BuildSummary() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const selectedPeripherals = useBuilderStore((s) => s.selectedPeripherals)
  const budget = useBuilderStore((s) => s.budget)
  const buildTotal = useBuilderStore(selTotalSpent)
  const periphTotal = useBuilderStore(selPeripheralsTotal)
  const power = useBuilderStore(selTotalPower)
  const [copied, setCopied] = useState(false)

  const buildRows = CATEGORIES.map((c) => ({ key: c.id, label: c.label, part: selectedParts[c.id] })).filter((r) => r.part)
  const periphRows = PERIPHERAL_ORDER.map((id) => ({ key: id, label: PERIPHERAL_LABELS[id], part: selectedPeripherals[id] })).filter((r) => r.part)
  const isEmpty = buildRows.length === 0 && periphRows.length === 0
  const grandTotal = buildTotal + periphTotal
  const overBudget = budget > 0 && buildTotal > budget

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(buildShareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable */ }
  }

  function copyPartsList() {
    const lines = [...buildRows, ...periphRows].map((r) => `${r.label}: ${r.part.name} — £${r.part.price.toFixed(2)}`)
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {})
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        <div className={`${PANEL} p-5`}>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-lg text-white">Your build</h2>
            <span className="font-mono text-base text-cyan-300">
              £{buildTotal.toFixed(0)}
              {budget > 0 && (
                <span className={`text-sm ${overBudget ? 'text-red-400' : 'text-slate-500'}`}> / £{budget.toFixed(0)}</span>
              )}
            </span>
          </div>

          {isEmpty ? (
            <p className="text-sm text-slate-400 py-6 text-center">No parts selected yet — head to the Build tab.</p>
          ) : (
            <>
              {buildRows.length > 0 && (
                <>
                  <div className="mt-4 mb-1 text-[11px] uppercase tracking-wider text-slate-500">Core build</div>
                  {buildRows.map((r) => <Row key={r.key} label={r.label} name={r.part.name} price={r.part.price} />)}
                </>
              )}
              {periphRows.length > 0 && (
                <>
                  <div className="mt-5 mb-1 text-[11px] uppercase tracking-wider text-slate-500">Peripherals</div>
                  {periphRows.map((r) => <Row key={r.key} label={r.label} name={r.part.name} price={r.part.price} />)}
                </>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-500">
                <span>Build <span className="font-mono text-slate-300">£{buildTotal.toFixed(2)}</span></span>
                <span>Peripherals <span className="font-mono text-slate-300">£{periphTotal.toFixed(2)}</span></span>
                <span>Draw <span className="font-mono text-amber-400">{power}W</span></span>
                <span>Total <span className="font-mono text-slate-100">£{grandTotal.toFixed(2)}</span></span>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={copyShareLink}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm bg-gradient-to-r from-cyan-500 to-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {copied ? 'Copied!' : 'Copy share link'}
            </button>
            <button
              onClick={() => window.print()}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm border border-slate-700/70 text-slate-200 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Print
            </button>
            <button
              onClick={copyPartsList}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm border border-slate-700/70 text-slate-200 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Copy parts list
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/BuildSummary.test.jsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildSummary.jsx src/tests/BuildSummary.test.jsx
git commit -m "feat: build summary view with totals and buy links"
```

---

### Task 6: Wire the Summary tab + final verification

**Files:**
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Import BuildSummary**

In `src/screens/BuilderScreen.jsx`, add after the `PeripheralsPanel` import:

```js
import BuildSummary from '../components/BuildSummary'
```

- [ ] **Step 2: Add 'summary' to the view toggle**

Change the toggle's option list:

```jsx
          {['build', 'peripherals', 'summary'].map((v) => (
```

- [ ] **Step 3: Render the summary branch**

Replace the `view === 'build' ? (...) : (<PeripheralsPanel />)` ternary's `) : (` and tail so the three views are handled. The exact change: find

```jsx
        ) : (
          <PeripheralsPanel />
        )}
```

and replace it with:

```jsx
        ) : view === 'peripherals' ? (
          <PeripheralsPanel />
        ) : (
          <BuildSummary />
        )}
```

- [ ] **Step 4: Run the full suite**

Run: `npm run test:run`
Expected: PASS — 89 tests.

- [ ] **Step 5: Verify in the dev server**

Start the dev server and check the build view, then:
- Select a CPU + GPU, click the **Summary** tab → parts listed with mono prices, totals, Draw, and Buy links; "Copy share link" enabled.
- **Persistence:** reload the page → the build is still there (no BudgetEntry).
- **Share link:** click "Copy share link", open the copied URL in a fresh tab → the same build loads and the `?build=` param disappears from the address bar.
- Empty state: clear the build (or fresh session) → Summary shows the prompt and disabled buttons.

- [ ] **Step 6: Commit**

```bash
git add src/screens/BuilderScreen.jsx
git commit -m "feat: add Summary tab to the builder"
```

---

## Self-Review

- **Spec coverage:** Persistence → Task 1. Stateless codec → Task 2. Retailer links → Task 3. Share URL + startup hydration → Task 4. Summary view (rows, totals, actions, empty state) → Task 5. Summary tab wiring → Task 6. All spec features covered.
- **Placeholders:** none — every step has exact code and commands.
- **Type/name consistency:** `encodeBuild`/`decodeBuild` (Task 2) are imported by `shareLink` (Task 4) and the codec test; `buildShareUrl`/`applyShareLinkFromUrl` (Task 4) are imported by `BuildSummary` (Task 5) and `main.jsx`; `searchUrl` (Task 3) used by `BuildSummary`; `selTotalSpent`/`selPeripheralsTotal`/`selTotalPower` already exist in the store. Test part ids (`cpu-ryzen-7-7700x`, `gpu-rtx-4060ti`, `mon-dell-s2721dgf`) are confirmed present in the data.
- **Test count:** 79 baseline + 3 + 2 + 3 + 2 = **89** at the end (Task 4's "87" note counts through Task 4; final is 89 after Task 5).
