# Build-a-new-PC v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the resolution + FPS steps of Build-a-new-PC with a single use-case picker (Gaming / Everyday / Programming / Workstation), build with a budget-maximizing use-case-weighted builder, add a Back-to-menu control, and generate the quick-start tiers so they're always the best build the catalog can make.

**Architecture:** Generalize `autoBuild` with a backward-compatible `options` arg (weights / upgradeOrder / maximise). Add `buildProfiles.js` (per-use-case weights + upgrade order + resolution) and `useCaseBuilder.js` (`useCaseBuild`). Rewire `tiers.js` to generate builds. Rewrite `BudgetEntry.jsx` to the budget → use-case flow and extend `GeneratedBanner` with a use-case summary.

**Tech Stack:** React 19, Vitest + Testing Library, Playwright. Node at `C:\Program Files\nodejs` (prepend to PATH in PowerShell if needed). Tests: `npm run test:run -- <file>`; E2E: `npm run test:e2e`.

**Dependency:** Requires Plan 1's `src/lib/partQuality.js` (used by the generalized `autoBuild`). Execute Plan 1 first.

---

### Task 1: Generalize `autoBuild` with a backward-compatible `options` arg

**Files:**
- Modify: `src/lib/autoBuilder.js`
- Test: `src/tests/autoBuilder.test.js` (append)

**Context:** `autoBuild(selectedParts, budget, partsData, resolution)` currently hardcodes gaming weights and a `['gpu','cpu']` leftover-upgrade pass keyed on `perfScore`. Add a 5th `options` arg — `{ weights, upgradeOrder, maximise }` — defaulting to today's exact behavior, and switch the leftover pass to `partQuality()` (which equals `perfScore` for CPU/GPU, so defaults are unchanged) so it can also upgrade RAM/storage. `maximise` runs an incremental loop that spends as much of the budget as possible. The existing `autoBuilder.test.js` cases MUST still pass unchanged — that is the back-compat guard.

- [ ] **Step 1: Write the failing tests (append to `src/tests/autoBuilder.test.js`)**

```js
import { partQuality } from '../lib/partQuality'

describe('autoBuild options', () => {
  it('default path is unchanged when options are omitted vs explicit gaming defaults', () => {
    const idMap = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.id]))
    const a = autoBuild({}, 1800, partsData, '1440p')
    const b = autoBuild({}, 1800, partsData, '1440p', { upgradeOrder: ['gpu', 'cpu'], maximise: false })
    expect(idMap(a)).toEqual(idMap(b))
  })

  it('maximise spends at least as much as the default pass', () => {
    const total = (b) => Object.values(b).reduce((s, p) => s + (p?.price ?? 0), 0)
    const plain = autoBuild({}, 1800, partsData, '1440p')
    const maxed = autoBuild({}, 1800, partsData, '1440p', { upgradeOrder: ['gpu', 'cpu'], maximise: true })
    expect(total(maxed)).toBeGreaterThanOrEqual(total(plain))
  })

  it('a RAM-heavy profile buys more memory than the default gaming build', () => {
    const ramWeights = { cpu: .18, gpu: .14, motherboard: .11, ram: .22, storage: .1, psu: .07, case: .06, cooler: .06, fans: .03 }
    const heavy = autoBuild({}, 2500, partsData, '1440p', { weights: ramWeights, upgradeOrder: ['ram', 'cpu'], maximise: true })
    const gaming = autoBuild({}, 2500, partsData, '1440p')
    expect(partQuality(heavy.ram)).toBeGreaterThanOrEqual(partQuality(gaming.ram))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/autoBuilder.test.js`
Expected: FAIL — the new `options` behavior isn't implemented (RAM-heavy assertion fails / maximise no-ops).

- [ ] **Step 3: Rewrite `autoBuild` (replace the exported function and add the `partQuality` import)**

At the top of `src/lib/autoBuilder.js`, add under the existing import:

```js
import { checkCompatibility } from './compatibility'
import { partQuality } from './partQuality'
```

Replace the whole `export function autoBuild(...) { ... }` with:

```js
export function autoBuild(selectedParts, budget, partsData, resolution = '1440p', options = {}) {
  const weights = options.weights ?? weightsFor(resolution)
  const upgradeOrder = options.upgradeOrder ?? ['gpu', 'cpu']
  const maximise = options.maximise ?? false

  const result = { ...selectedParts }
  const userCats = new Set(Object.keys(selectedParts))
  const spentExisting = Object.values(result).reduce((s, p) => s + (p?.price ?? 0), 0)
  const available = Math.max(0, budget - spentExisting)
  let remaining = available

  const emptyCats = FILL_ORDER.filter((c) => !result[c])
  const weightSum = emptyCats.reduce((s, c) => s + (weights[c] ?? 0), 0) || 1
  // Hold back the PSU's slice so the upgrade pass can't spend the power budget.
  const psuReserve = result.psu ? 0 : ((weights.psu ?? 0) / weightSum) * available

  // Fill every empty category except PSU (sized last, after upgrades).
  for (const category of emptyCats) {
    if (category === 'psu') continue
    const slice = ((weights[category] ?? 0) / weightSum) * available
    let candidates = ofCategory(partsData, category).filter((p) => checkCompatibility(result, p).compatible)
    if (category === 'case' && result.gpu) {
      candidates = candidates.filter((p) => result.gpu.length <= p.maxGpuLength)
    }
    const pick = chooseBest(category, candidates, slice, remaining - psuReserve)
    if (pick) { result[category] = pick; remaining -= pick.price }
  }

  // Best higher-quality part in `category` we can still afford. `cheapest` picks
  // the smallest affordable step up (used by the maximise loop); otherwise the
  // best affordable jump (the original leftover behavior).
  const affordableUpgrade = (category, cheapest) => {
    const current = result[category]
    if (!current) return null
    const curQ = partQuality(current)
    const without = { ...result, [category]: undefined }
    const pool = ofCategory(partsData, category)
      .filter((p) => checkCompatibility(without, p).compatible)
      .filter((p) => partQuality(p) > curQ && p.price - current.price <= remaining - psuReserve)
    if (pool.length === 0) return null
    return cheapest
      ? [...pool].sort((a, b) => (a.price - b.price) || (partQuality(b) - partQuality(a)))[0]
      : [...pool].sort((a, b) => (partQuality(b) - partQuality(a)) || (a.price - b.price))[0]
  }

  if (maximise) {
    // Step each priority category up one tier at a time until nothing more is
    // affordable — spends as much of the budget as possible. Terminates because
    // quality strictly increases each step over a finite catalog.
    let guard = 0
    let stepped = true
    while (stepped && guard++ < 200) {
      stepped = false
      for (const category of upgradeOrder) {
        if (userCats.has(category)) continue
        const next = affordableUpgrade(category, true)
        if (next) { remaining -= next.price - result[category].price; result[category] = next; stepped = true }
      }
    }
  } else {
    // Spend leftover upgrading auto-picked parts (never the user's own picks).
    for (const category of upgradeOrder) {
      if (userCats.has(category)) continue
      const better = affordableUpgrade(category, false)
      if (better) { remaining -= better.price - result[category].price; result[category] = better }
    }
  }

  // Size the PSU last, against the final draw.
  if (!result.psu) {
    const psu = choosePsu(ofCategory(partsData, 'psu'), drawOf(result), remaining)
    if (psu) { result.psu = psu; remaining -= psu.price }
  }

  return result
}
```

(The `import { checkCompatibility }` line already exists at the top — only add the `partQuality` import; don't duplicate `checkCompatibility`.)

- [ ] **Step 4: Run the file + the full suite to verify back-compat**

Run: `npm run test:run -- src/tests/autoBuilder.test.js`
Expected: PASS (original 3 + new 3).
Run: `npm run test:run -- src/tests/targetBuilder.test.js src/tests/maxOutBudget.test.js`
Expected: PASS — existing `autoBuild` callers unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autoBuilder.js src/tests/autoBuilder.test.js
git commit -m "feat: autoBuild options (weights/upgradeOrder/maximise), partQuality-ranked"
```

---

### Task 2: `buildProfiles.js` — per-use-case profiles

**Files:**
- Create: `src/lib/buildProfiles.js`
- Test: `src/tests/buildProfiles.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { BUILD_PROFILES, USE_CASES, USE_CASE_LABEL } from '../lib/buildProfiles'

describe('buildProfiles', () => {
  it('has the four use cases', () => {
    expect(Object.keys(BUILD_PROFILES).sort()).toEqual(['everyday', 'gaming', 'programming', 'workstation'])
  })
  it('each profile has weights, an upgrade order and a resolution', () => {
    for (const p of Object.values(BUILD_PROFILES)) {
      expect(typeof p.weights.cpu).toBe('number')
      expect(Array.isArray(p.upgradeOrder)).toBe(true)
      expect(typeof p.resolution).toBe('string')
    }
  })
  it('gaming weights GPU above CPU; programming weights CPU above GPU', () => {
    expect(BUILD_PROFILES.gaming.weights.gpu).toBeGreaterThan(BUILD_PROFILES.gaming.weights.cpu)
    expect(BUILD_PROFILES.programming.weights.cpu).toBeGreaterThan(BUILD_PROFILES.programming.weights.gpu)
  })
  it('USE_CASES cards line up with the profiles and labels', () => {
    expect(USE_CASES.map((u) => u.id).sort()).toEqual(Object.keys(BUILD_PROFILES).sort())
    for (const u of USE_CASES) expect(USE_CASE_LABEL[u.id]).toBe(u.label)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/buildProfiles.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// Per-use-case build profiles for the budget-maximizing builder. `weights`
// follows autoBuilder's slice model (need not sum to 1). `upgradeOrder` is the
// priority list the maximise pass spends leftover on. `resolution` seeds the
// build's stored resolution (changeable later in the Build tab).
export const BUILD_PROFILES = {
  gaming: {
    weights: { cpu: 0.18, gpu: 0.32, motherboard: 0.11, ram: 0.08, storage: 0.07, psu: 0.07, case: 0.08, cooler: 0.06, fans: 0.03 },
    upgradeOrder: ['gpu', 'cpu'],
    resolution: '1440p',
  },
  everyday: {
    weights: { cpu: 0.20, gpu: 0.14, motherboard: 0.11, ram: 0.10, storage: 0.14, psu: 0.08, case: 0.09, cooler: 0.08, fans: 0.06 },
    upgradeOrder: ['storage', 'cpu'],
    resolution: '1080p',
  },
  programming: {
    weights: { cpu: 0.30, gpu: 0.14, motherboard: 0.11, ram: 0.16, storage: 0.11, psu: 0.06, case: 0.06, cooler: 0.06, fans: 0.03 },
    upgradeOrder: ['cpu', 'ram', 'storage'],
    resolution: '1440p',
  },
  workstation: {
    weights: { cpu: 0.26, gpu: 0.24, motherboard: 0.11, ram: 0.14, storage: 0.09, psu: 0.07, case: 0.05, cooler: 0.06, fans: 0.03 },
    upgradeOrder: ['gpu', 'cpu', 'ram'],
    resolution: '4k',
  },
}

export const USE_CASE_LABEL = {
  gaming: 'Gaming', everyday: 'Everyday', programming: 'Programming', workstation: 'Workstation',
}

export const USE_CASES = [
  { id: 'gaming',      label: 'Gaming',      blurb: 'High frame rates in the latest games.' },
  { id: 'everyday',    label: 'Everyday',    blurb: 'Fast, quiet, great value for general use.' },
  { id: 'programming', label: 'Programming', blurb: 'Cores and memory for compiling and many tabs.' },
  { id: 'workstation', label: 'Workstation', blurb: 'Heavy CPU + GPU + RAM for rendering and editing.' },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/buildProfiles.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/buildProfiles.js src/tests/buildProfiles.test.js
git commit -m "feat: buildProfiles — per-use-case weights, upgrade order, resolution"
```

---

### Task 3: `useCaseBuilder.js` — budget-maximizing build

**Files:**
- Create: `src/lib/useCaseBuilder.js`
- Test: `src/tests/useCaseBuilder.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { useCaseBuild } from '../lib/useCaseBuilder'
import { autoBuild } from '../lib/autoBuilder'
import { checkCompatibility } from '../lib/compatibility'
import partsData from '../data/partsData.json'

const CATS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']
const total = (b) => CATS.reduce((s, c) => s + (b[c]?.price ?? 0), 0)

describe('useCaseBuild', () => {
  it('builds a complete, compatible build within budget', () => {
    const b = useCaseBuild(1800, 'gaming', partsData)
    for (const c of CATS) expect(b[c], `missing ${c}`).toBeTruthy()
    for (const part of Object.values(b)) {
      const others = { ...b }; delete others[part.category]
      expect(checkCompatibility(others, part).compatible).toBe(true)
    }
    expect(total(b)).toBeLessThanOrEqual(1800)
  })

  it('spends at least as much as a non-maximising build', () => {
    const plain = autoBuild({}, 1800, partsData, '1440p')
    expect(total(useCaseBuild(1800, 'gaming', partsData))).toBeGreaterThanOrEqual(total(plain))
  })

  it('use case shifts the build: gaming favours GPU, programming favours RAM', () => {
    const g = useCaseBuild(2500, 'gaming', partsData)
    const p = useCaseBuild(2500, 'programming', partsData)
    expect(g.gpu.perfScore).toBeGreaterThanOrEqual(p.gpu.perfScore)
    expect(p.ram.capacityGb).toBeGreaterThanOrEqual(g.ram.capacityGb)
  })

  it('is deterministic', () => {
    const idMap = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.id]))
    expect(idMap(useCaseBuild(1500, 'everyday', partsData))).toEqual(idMap(useCaseBuild(1500, 'everyday', partsData)))
  })

  it('falls back to the gaming profile for an unknown use case', () => {
    const b = useCaseBuild(1500, 'nonsense', partsData)
    for (const c of CATS) expect(b[c]).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/useCaseBuilder.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
import { autoBuild } from './autoBuilder'
import { BUILD_PROFILES } from './buildProfiles'

// Budget-maximizing build for a use case: fills every category by the profile's
// weights, then spends the remainder up the profile's priority list. The
// opposite of targetBuild (which minimizes spend to hit an FPS target).
export function useCaseBuild(budget, useCase, partsData) {
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  return autoBuild({}, budget, partsData, profile.resolution, {
    weights: profile.weights,
    upgradeOrder: profile.upgradeOrder,
    maximise: true,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/useCaseBuilder.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/useCaseBuilder.js src/tests/useCaseBuilder.test.js
git commit -m "feat: useCaseBuild — budget-maximizing use-case build"
```

---

### Task 4: Generate the quick-start tiers

**Files:**
- Modify: `src/lib/tiers.js`
- Test: `src/tests/tiers.test.js` (rewrite)

**Context:** `TIERS` currently hardcodes part IDs; `partsForTier` maps them. Replace with metadata (`budget` + `useCase`) and generate via `useCaseBuild`. `BudgetEntry` (Task 6) reads the resolution from the profile.

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `src/tests/tiers.test.js` with:

```js
import { describe, it, expect } from 'vitest'
import { TIERS, partsForTier } from '../lib/tiers'
import partsData from '../data/partsData.json'
import { checkCompatibility } from '../lib/compatibility'

const CATS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']

describe('tiers', () => {
  it('has the three tiers in order, each with a use case', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['budget', 'mainstream', 'ultimate'])
    for (const t of TIERS) expect(typeof t.useCase).toBe('string')
  })

  for (const tier of TIERS) {
    it(`${tier.id}: generates a complete, compatible build within budget`, () => {
      const map = partsForTier(tier, partsData)
      for (const c of CATS) expect(map[c], `missing ${c}`).toBeTruthy()
      for (const part of Object.values(map)) {
        const others = { ...map }; delete others[part.category]
        expect(checkCompatibility(others, part).compatible).toBe(true)
      }
      expect(map.gpu.length).toBeLessThanOrEqual(map.case.maxGpuLength)
      const total = Object.values(map).reduce((s, p) => s + p.price, 0)
      expect(total).toBeLessThanOrEqual(tier.budget)
    })
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/tiers.test.js`
Expected: FAIL — `TIERS[].useCase` undefined / old `ids` shape.

- [ ] **Step 3: Rewrite `src/lib/tiers.js`**

```js
import { useCaseBuild } from './useCaseBuilder'

// Quick-start templates: budget + intended use case. Parts are generated from
// the current catalog so the build is always the best that money can buy.
export const TIERS = [
  { id: 'budget',     label: 'Budget',     budget: 900,  useCase: 'gaming' },
  { id: 'mainstream', label: 'Mainstream', budget: 1700, useCase: 'gaming' },
  { id: 'ultimate',   label: 'Ultimate',   budget: 3800, useCase: 'workstation' },
]

export function partsForTier(tier, parts) {
  return useCaseBuild(tier.budget, tier.useCase, parts)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/tiers.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tiers.js src/tests/tiers.test.js
git commit -m "feat: generate quick-start tiers from budget + use case"
```

---

### Task 5: `GeneratedBanner` use-case summary

**Files:**
- Modify: `src/components/GeneratedBanner.jsx`
- Test: `src/tests/GeneratedBanner.test.jsx` (append)

**Context:** Builds on Plan 1 Task 4 (the FPS-less guard). Add a `info.useCase` branch that summarizes spend vs budget with no FPS claim.

- [ ] **Step 1: Write the failing test (append)**

```js
it('summarises a use-case build without an FPS claim', () => {
  useBuilderStore.setState({
    lastGenerated: { useCase: 'programming', spend: 1450, budget: 1600 },
    budget: 1600, resolution: '1440p',
    selectedParts: { cpu: { price: 300 }, gpu: { price: 400 } },
  })
  render(<GeneratedBanner />)
  expect(screen.getByText(/programming build/i)).toBeInTheDocument()
  expect(screen.getByRole('status').textContent).not.toMatch(/fps/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/GeneratedBanner.test.jsx`
Expected: FAIL — renders "Upgrade applied" (no "programming build").

- [ ] **Step 3: Implement**

Add the import at the top of `src/components/GeneratedBanner.jsx`:

```js
import { USE_CASE_LABEL } from '../lib/buildProfiles'
```

Change the message paragraph's ternary so the `info.useCase` branch comes first (this replaces the paragraph body added in Plan 1 Task 4):

```jsx
      <p className="text-xs text-slate-200">
        {info.useCase
          ? <>Your <span className="text-slate-100">{USE_CASE_LABEL[info.useCase] ?? info.useCase}</span> build uses <span className={`${TELEMETRY} text-cyan-300 font-semibold`}>£{spent.toFixed(0)}</span> of your £{budget.toFixed(0)} budget</>
          : info.estFps != null && info.gameName
            ? (info.met
                ? <>This build hits <span className={`${TELEMETRY} text-cyan-300 font-semibold`}>~{info.estFps} fps</span> in {info.gameName} at {resLabel}</>
                : <>Closest to your {info.targetFps} fps target: <span className={`${TELEMETRY} text-amber-300 font-semibold`}>~{info.estFps} fps</span> in {info.gameName} at {resLabel}</>)
            : <>Upgrade applied</>}
        {info.quality && info.quality !== 'high' && <> on <span className="text-slate-100">{info.quality}</span> settings</>}
        {leftover > 0 && <> — <span className={`${TELEMETRY} text-emerald-300`}>£{leftover.toFixed(0)}</span> under budget</>}
      </p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/GeneratedBanner.test.jsx`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/GeneratedBanner.jsx src/tests/GeneratedBanner.test.jsx
git commit -m "feat: GeneratedBanner use-case summary variant"
```

---

### Task 6: Rewrite `BudgetEntry` to budget → use-case → generate

**Files:**
- Modify: `src/components/BudgetEntry.jsx` (full rewrite)
- Test: `src/tests/BudgetEntry.test.jsx` (rewrite)

**Context:** Drop the resolution + FPS + custom-res + custom-fps + shortfall UI (all belonged to `targetBuild`, no longer called here). New flow: budget step (with quick-start tiers + Back-to-menu) → use-case step (four cards) → `Generate build` / `Start empty instead`. `App.jsx` already passes `onBack`.

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `src/tests/BudgetEntry.test.jsx` with:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import BudgetEntry from '../components/BudgetEntry'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  window.location.hash = ''
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p', lastGenerated: null })
})

const enterBudget = (v) => {
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: v } })
  fireEvent.click(screen.getByRole('button', { name: /next: use case/i }))
}

describe('BudgetEntry wizard', () => {
  it('renders the budget heading and the two steps', () => {
    render(<BudgetEntry onSubmit={() => {}} onBack={() => {}} />)
    expect(screen.getByText(/what's your budget/i)).toBeInTheDocument()
    expect(screen.getByText(/^budget$/i)).toBeInTheDocument()
    expect(screen.getByText(/^use case$/i)).toBeInTheDocument()
  })

  it('back to menu calls onBack', () => {
    const onBack = vi.fn()
    render(<BudgetEntry onSubmit={() => {}} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('does not advance with a zero budget', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} onBack={() => {}} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByText(/what will you use/i)).not.toBeInTheDocument()
  })

  it('budget → use case → generate builds a PC and enters the builder', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} onBack={() => {}} />)
    enterBudget('1500')
    expect(screen.getByText(/what will you use/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /gaming/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    expect(onSubmit).toHaveBeenCalledWith(1500)
    expect(useBuilderStore.getState().selectedParts.cpu).toBeDefined()
    expect(useBuilderStore.getState().selectedParts.gpu).toBeDefined()
  })

  it('workstation use case defaults the stored resolution to 4k', () => {
    render(<BudgetEntry onSubmit={() => {}} onBack={() => {}} />)
    enterBudget('3000')
    fireEvent.click(screen.getByRole('button', { name: /workstation/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    expect(useBuilderStore.getState().resolution).toBe('4k')
  })

  it('start empty skips generation and wipes a persisted build', () => {
    const onSubmit = vi.fn()
    useBuilderStore.setState({
      selectedParts: { cpu: { id: 'old', category: 'cpu', name: 'Old', price: 100, tdp: 65 } },
      selectedPeripherals: { mouse: { id: 'm', category: 'mouse', name: 'M', price: 10 } },
    })
    render(<BudgetEntry onSubmit={onSubmit} onBack={() => {}} />)
    enterBudget('900')
    fireEvent.click(screen.getByRole('button', { name: /start empty/i }))
    expect(onSubmit).toHaveBeenCalledWith(900)
    expect(useBuilderStore.getState().selectedParts).toEqual({})
    expect(useBuilderStore.getState().selectedPeripherals).toEqual({})
  })

  it('always lands on the Build tab even if the hash was left on summary', () => {
    window.location.hash = 'summary'
    render(<BudgetEntry onSubmit={() => {}} onBack={() => {}} />)
    enterBudget('900')
    fireEvent.click(screen.getByRole('button', { name: /start empty/i }))
    expect(window.location.hash).toBe('#build')
  })

  it('a quick-start tier applies a generated build and its budget', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /budget · £900/i }))
    expect(onSubmit).toHaveBeenCalledWith(900)
    expect(useBuilderStore.getState().selectedParts.cpu).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/BudgetEntry.test.jsx`
Expected: FAIL — old wizard has resolution/FPS steps, no "Next: use case".

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `src/components/BudgetEntry.jsx` with:

```jsx
import { useState, useMemo } from 'react'
import Backdrop from './Backdrop'
import useBuilderStore from '../store/useBuilderStore'
import { TIERS, partsForTier } from '../lib/tiers'
import { BUILD_PROFILES, USE_CASES } from '../lib/buildProfiles'
import { useCaseBuild } from '../lib/useCaseBuilder'
import useCatalogStore from '../store/useCatalogStore'
import { enterBuildTab } from '../lib/enterBuildTab'

const STEPS = ['Budget', 'Use case']
const totalOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)

export default function BudgetEntry({ onSubmit, onBack }) {
  const [step, setStep] = useState(1)
  const [value, setValue] = useState('')
  const [useCase, setUseCase] = useState('gaming')
  const setResolution = useBuilderStore((s) => s.setResolution)
  const setBuild = useBuilderStore((s) => s.setBuild)
  const clearBuild = useBuilderStore((s) => s.clearBuild)
  const setLastGenerated = useBuilderStore((s) => s.setLastGenerated)
  const partsData = useCatalogStore((s) => s.parts)

  const budgetNum = parseFloat(value)
  const tierBuilds = useMemo(
    () => TIERS.map((t) => ({ tier: t, parts: partsForTier(t, partsData) })),
    [partsData],
  )

  function handleBudgetSubmit(e) {
    e.preventDefault()
    if (budgetNum > 0) setStep(2)
  }

  function applyTier(tier, parts) {
    enterBuildTab()
    setResolution(BUILD_PROFILES[tier.useCase].resolution)
    setBuild(parts)
    onSubmit(tier.budget)
  }

  function generate() {
    const profile = BUILD_PROFILES[useCase]
    const parts = useCaseBuild(budgetNum, useCase, partsData)
    enterBuildTab()
    setResolution(profile.resolution)
    setBuild(parts)
    setLastGenerated({ useCase, spend: totalOf(parts), budget: budgetNum })
    onSubmit(budgetNum)
  }

  // Really start with nothing — also drops any build persisted from a previous
  // visit, which used to leak into "empty" sessions.
  function startEmpty() {
    enterBuildTab()
    clearBuild()
    setResolution(BUILD_PROFILES[useCase].resolution)
    onSubmit(budgetNum)
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-white bg-[#05080f]">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center px-4">
        <h1 className="text-5xl font-bold mb-3 text-white">Build Your PC</h1>
        <ol className="flex items-center gap-2 mb-6 text-[11px] uppercase tracking-wider">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-700">→</span>}
              <span className={`flex items-center gap-1.5 ${step === i + 1 ? 'text-cyan-300' : 'text-slate-500'}`}>
                <span className="font-mono">{i + 1}</span>
                <span>{label}</span>
              </span>
            </li>
          ))}
        </ol>

        {step === 1 && (
          <>
            <p className="text-gray-400 mb-10 text-lg">What's your budget?</p>
            <form onSubmit={handleBudgetSubmit} aria-label="form" className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-2 text-3xl">
                <span className="text-cyan-300">£</span>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  placeholder="Enter budget"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="bg-slate-950/60 backdrop-blur-md text-white font-mono text-3xl w-72 px-4 py-3 rounded-sm border border-slate-700/70 focus:outline-none focus:border-cyan-400 text-center placeholder:text-2xl placeholder:text-slate-600 transition-colors"
                />
              </div>
              <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-10 py-3 rounded-sm text-lg transition-colors">
                Next: use case
              </button>
            </form>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-slate-500">or quick-start:</span>
              {tierBuilds.map(({ tier, parts }) => (
                <button
                  key={tier.id}
                  onClick={() => applyTier(tier, parts)}
                  className="text-xs font-mono px-3 py-1.5 rounded-sm border border-slate-700/70 text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {tier.label} · £{tier.budget}
                </button>
              ))}
            </div>
            <button onClick={onBack} className="mt-8 text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back to menu</button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-gray-400 mb-10 text-lg">What will you use this PC for?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {USE_CASES.map((u) => {
                const selected = useCase === u.id
                return (
                  <button
                    key={u.id}
                    onClick={() => setUseCase(u.id)}
                    aria-pressed={selected}
                    className={`w-64 px-4 py-5 rounded-sm border text-left transition-colors group
                      ${selected ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-700/70 hover:border-cyan-400'}`}
                  >
                    <div className={`text-xl font-bold ${selected ? 'text-cyan-200' : 'group-hover:text-cyan-300'}`}>{u.label}</div>
                    <div className={`text-xs mt-1 ${selected ? 'text-cyan-300/80' : 'text-slate-400'}`}>{u.blurb}</div>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={generate} className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-8 py-3 rounded-sm transition-colors">
                Generate build
              </button>
              <button onClick={startEmpty} className="px-8 py-3 rounded-sm border border-slate-700/70 text-slate-300 hover:border-slate-500 transition-colors">
                Start empty instead
              </button>
            </div>
            <button onClick={() => setStep(1)} className="mt-6 text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back to budget</button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the file + full suite + lint**

Run: `npm run test:run -- src/tests/BudgetEntry.test.jsx`
Expected: PASS.
Run: `npm run test:run`
Expected: all green.
Run: `npm run lint`
Expected: no NEW errors (2 pre-existing `SpecSheet.jsx` errors allowed).

- [ ] **Step 5: Commit**

```bash
git add src/components/BudgetEntry.jsx src/tests/BudgetEntry.test.jsx
git commit -m "feat: Build-a-new-PC uses a use-case picker + back-to-menu"
```

---

### Task 7: Update the Playwright E2E for the new wizard path

**Files:**
- Modify: `e2e/wizard.spec.js`

**Context:** The wizard now goes budget → use case → generate, and the banner shows a use-case summary instead of "This build hits …".

- [ ] **Step 1: Rewrite the spec body**

Replace the contents of `e2e/wizard.spec.js` with:

```js
import { test, expect } from '@playwright/test'

// Walks the real wizard in a real browser and asserts the parts UI is
// actually VISIBLE — guards paint/compositing regressions that unit tests
// (jsdom) can never catch.
test('wizard generates a build and the selected parts are visible', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /build a new pc/i }).click()

  await page.getByPlaceholder('Enter budget').fill('1600')
  await page.getByRole('button', { name: /next: use case/i }).click()
  await page.getByRole('button', { name: /gaming/i }).click()
  await page.getByRole('button', { name: /generate build/i }).click()

  // The generated-build banner summarises the use-case build.
  await expect(page.getByText(/gaming build/i)).toBeVisible()

  // Selected parts are visible on screen (part list rows).
  await expect(page.getByRole('button', { name: /remove cpu$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /remove gpu/i })).toBeVisible()

  // Deep-linkable tabs: summary shows the same build.
  await page.getByRole('button', { name: /^summary$/i }).click()
  await expect(page).toHaveURL(/#summary/)
  await expect(page.getByText(/your build/i)).toBeVisible()
})
```

- [ ] **Step 2: Run the E2E**

Run: `npm run test:e2e`
Expected: PASS (1 test). If the dev server isn't configured to auto-start, start it per the Playwright config, then re-run.

- [ ] **Step 3: Commit**

```bash
git add e2e/wizard.spec.js
git commit -m "test: update wizard E2E for the use-case flow"
```

---

## Final review

After all tasks, dispatch a code-reviewer over the whole diff (Tasks 1–7) and confirm:
- `autoBuild` default output is byte-identical for existing callers (targetBuilder, maxOutBudget, AutoBuildButton).
- `useCaseBuild` output is always compatible and within budget; profiles measurably change the build.
- No regression across the full suite; lint clean except the 2 known `SpecSheet.jsx` errors.

## Notes for the implementer

- Do NOT change `targetBuild`, `maxOutBudget`, `suggestUpgrade` — `autoBuild`'s default path must stay identical (guarded by Task 1's first test + the untouched `autoBuilder.test.js` cases).
- `useCatalogStore` seeds from the bundled JSON snapshot at import, so component tests don't need to set `parts` (the existing tests relied on this).
- Keep field names as-is (`capacityGb`, `ramType`, `speed`, `storageType`, `wattage`, `perfScore`, `length`).
- The tier button label is `"{label} · £{budget}"` using a middot (·) — the E2E/unit matchers rely on that exact format.
```
