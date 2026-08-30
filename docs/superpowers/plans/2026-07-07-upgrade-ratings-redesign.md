# Upgrade-your-PC ratings redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Upgrade-your-PC two-path fork with a use-case-driven ratings dashboard — each part scored /100 (bottleneck-aware) with click-to-upgrade options.

**Architecture:** A new pure-lib `partRatings.js` (level → adequacy + balance → score) built on the existing `partQuality`/`computeBottleneck`/`gameFps`. `buildProfiles.js` migrates to a 5 use-case set with `expect` tables. `UpgradeWizard.jsx` becomes `specs → usecase → dashboard`. `systemUpgrades.js` is deleted (superseded).

**Tech Stack:** React 19, Vitest + Testing Library, Playwright. Node at `C:\Program Files\nodejs` (prepend to PATH in PowerShell if `npm`/`node` isn't found). Single-file test: `npm run test:run -- <file>`; full suite: `npm run test:run`; lint: `npm run lint`; E2E: `npm run test:e2e`.

---

### Task 1: Migrate to the 5 use-case set + `expect` tables

**Files:**
- Modify: `src/lib/buildProfiles.js` (replace whole file)
- Modify: `src/lib/tiers.js` (one id)
- Test: `src/tests/buildProfiles.test.js` (replace whole file)
- Test: `src/tests/useCaseBuilder.test.js` (one id), `src/tests/BudgetEntry.test.jsx` (one matcher)

**Context:** ids change `everyday→office`, `workstation→creation`; `streaming` is new; `gaming`/`programming` stay. Every downstream reference must move in this one task so the suite stays green.

- [ ] **Step 1: Replace `src/tests/buildProfiles.test.js` entirely:**

```js
import { describe, it, expect } from 'vitest'
import { BUILD_PROFILES, USE_CASES, USE_CASE_LABEL } from '../lib/buildProfiles'

const IDS = ['creation', 'gaming', 'office', 'programming', 'streaming']

describe('buildProfiles', () => {
  it('has the five use cases', () => {
    expect(Object.keys(BUILD_PROFILES).sort()).toEqual(IDS)
  })
  it('each profile has weights, expect, an upgrade order and a resolution', () => {
    for (const p of Object.values(BUILD_PROFILES)) {
      expect(typeof p.weights.cpu).toBe('number')
      expect(typeof p.expect.cpu).toBe('number')
      expect(Array.isArray(p.upgradeOrder)).toBe(true)
      expect(typeof p.resolution).toBe('string')
    }
  })
  it('gaming weights GPU above CPU; programming weights CPU above GPU', () => {
    expect(BUILD_PROFILES.gaming.weights.gpu).toBeGreaterThan(BUILD_PROFILES.gaming.weights.cpu)
    expect(BUILD_PROFILES.programming.weights.cpu).toBeGreaterThan(BUILD_PROFILES.programming.weights.gpu)
  })
  it('gaming expects a stronger GPU than office does', () => {
    expect(BUILD_PROFILES.gaming.expect.gpu).toBeGreaterThan(BUILD_PROFILES.office.expect.gpu)
  })
  it('USE_CASES cards line up with the profiles and labels', () => {
    expect(USE_CASES.map((u) => u.id).sort()).toEqual(IDS)
    for (const u of USE_CASES) expect(USE_CASE_LABEL[u.id]).toBe(u.label)
  })
})
```

- [ ] **Step 2:** Run `npm run test:run -- src/tests/buildProfiles.test.js` — FAIL (ids mismatch, no `expect`).

- [ ] **Step 3: Replace `src/lib/buildProfiles.js` entirely:**

```js
// Per-use-case profiles for the budget-maximizing builder AND the ratings model.
// `weights` = importance (builder slices + overall-score blend). `expect` = the
// per-category level (0-100) a part should reach to be "enough" for this use.
// `upgradeOrder` = the maximise pass priority. `resolution` seeds stored res.
export const BUILD_PROFILES = {
  gaming: {
    weights:      { cpu: .18, gpu: .32, motherboard: .11, ram: .08, storage: .07, psu: .07, case: .08, cooler: .06, fans: .03 },
    expect:       { cpu: 68,  gpu: 75,  motherboard: 35,  ram: 45,  storage: 40,  psu: 45,  case: 30,  cooler: 45,  fans: 30 },
    upgradeOrder: ['gpu', 'cpu', 'storage', 'ram'], resolution: '1440p',
  },
  office: {
    weights:      { cpu: .20, gpu: .14, motherboard: .11, ram: .10, storage: .14, psu: .08, case: .09, cooler: .08, fans: .06 },
    expect:       { cpu: 35,  gpu: 15,  motherboard: 30,  ram: 40,  storage: 45,  psu: 35,  case: 25,  cooler: 30,  fans: 20 },
    upgradeOrder: ['storage', 'ram', 'cpu'], resolution: '1080p',
  },
  creation: {
    weights:      { cpu: .26, gpu: .24, motherboard: .11, ram: .14, storage: .09, psu: .07, case: .05, cooler: .06, fans: .03 },
    expect:       { cpu: 70,  gpu: 65,  motherboard: 40,  ram: 70,  storage: 60,  psu: 50,  case: 30,  cooler: 55,  fans: 30 },
    upgradeOrder: ['cpu', 'gpu', 'ram', 'storage'], resolution: '4k',
  },
  programming: {
    weights:      { cpu: .30, gpu: .14, motherboard: .11, ram: .16, storage: .11, psu: .06, case: .06, cooler: .06, fans: .03 },
    expect:       { cpu: 70,  gpu: 30,  motherboard: 35,  ram: 65,  storage: 55,  psu: 40,  case: 25,  cooler: 50,  fans: 20 },
    upgradeOrder: ['cpu', 'ram', 'storage'], resolution: '1440p',
  },
  streaming: {
    weights:      { cpu: .24, gpu: .28, motherboard: .10, ram: .12, storage: .08, psu: .07, case: .04, cooler: .06, fans: .03 },
    expect:       { cpu: 68,  gpu: 70,  motherboard: 35,  ram: 50,  storage: 45,  psu: 50,  case: 30,  cooler: 50,  fans: 30 },
    upgradeOrder: ['gpu', 'cpu', 'ram', 'storage'], resolution: '1440p',
  },
}

export const USE_CASE_LABEL = {
  gaming: 'Gaming', office: 'Everyday & Office', creation: 'Content Creation',
  programming: 'Programming', streaming: 'Streaming',
}

export const USE_CASES = [
  { id: 'gaming',      label: 'Gaming',            blurb: 'High frame rates in the latest games.' },
  { id: 'office',      label: 'Everyday & Office', blurb: 'Browsing, docs, email and media — fast and quiet.' },
  { id: 'creation',    label: 'Content Creation',  blurb: 'Video/photo editing and rendering.' },
  { id: 'programming', label: 'Programming',       blurb: 'Compiling, VMs and dozens of tabs.' },
  { id: 'streaming',   label: 'Streaming',         blurb: 'Play and broadcast at the same time.' },
]
```

- [ ] **Step 4: Fix the downstream id references.**

In `src/lib/tiers.js`, change the `ultimate` tier's `useCase` from `'workstation'` to `'creation'`:
```js
  { id: 'ultimate',   label: 'Ultimate',   budget: 3800, useCase: 'creation' },
```

In `src/tests/useCaseBuilder.test.js`, change the two `'everyday'` occurrences to `'office'` (the deterministic test): `buildForUseCase(1500, 'office', partsData)` in both the "is deterministic" assertions.

In `src/tests/BudgetEntry.test.jsx`, the "workstation use case defaults the stored resolution to 4k" test: rename it to "content creation use case defaults the stored resolution to 4k" and change the click matcher from `/workstation/i` to `/content creation/i` (the `'4k'` assertion is unchanged — `creation` is 4k):
```js
  it('content creation use case defaults the stored resolution to 4k', () => {
    render(<BudgetEntry onSubmit={() => {}} onBack={() => {}} />)
    enterBudget('3000')
    fireEvent.click(screen.getByRole('button', { name: /content creation/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    expect(useBuilderStore.getState().resolution).toBe('4k')
  })
```

- [ ] **Step 5: Run the affected suites:**

Run: `npm run test:run -- src/tests/buildProfiles.test.js src/tests/useCaseBuilder.test.js src/tests/tiers.test.js src/tests/BudgetEntry.test.jsx`
Expected: all PASS. Then `npm run test:run` — full suite green (the `everyday`/`workstation` ids no longer appear anywhere).

- [ ] **Step 6: Commit**

```bash
git add src/lib/buildProfiles.js src/lib/tiers.js src/tests/buildProfiles.test.js src/tests/useCaseBuilder.test.js src/tests/BudgetEntry.test.jsx
git commit -m "feat: 5 use-case profiles (gaming/office/creation/programming/streaming) + expect tables"
```

---

### Task 2: `partLevel` — normalized per-category level

**Files:**
- Create: `src/lib/partRatings.js`
- Test: `src/tests/partRatings.test.js`

- [ ] **Step 1: Write the failing test:**

```js
import { describe, it, expect } from 'vitest'
import { partLevel } from '../lib/partRatings'

const cpuLo = { id: 'cpu-lo', category: 'cpu', perfScore: 50 }
const cpuMid = { id: 'cpu-mid', category: 'cpu', perfScore: 150 }
const cpuHi = { id: 'cpu-hi', category: 'cpu', perfScore: 250 }
const gpu = { id: 'g', category: 'gpu', perfScore: 300 }
const catalog = [cpuLo, cpuMid, cpuHi, gpu]

describe('partLevel', () => {
  it('scales the weakest to 0 and strongest to 100 within a category', () => {
    expect(partLevel(cpuLo, catalog)).toBe(0)
    expect(partLevel(cpuHi, catalog)).toBe(100)
    expect(partLevel(cpuMid, catalog)).toBe(50)
  })
  it('a lone part in its category is 100', () => {
    expect(partLevel(gpu, catalog)).toBe(100)
  })
  it('null part is 0', () => {
    expect(partLevel(null, catalog)).toBe(0)
  })
})
```

- [ ] **Step 2:** Run `npm run test:run -- src/tests/partRatings.test.js` — FAIL (module not found).

- [ ] **Step 3: Create `src/lib/partRatings.js`:**

```js
import { partQuality } from './partQuality'
import { computeBottleneck } from './bottleneck'
import { checkCompatibility } from './compatibility'
import { gameFps } from './gameFps'
import { BUILD_PROFILES, USE_CASE_LABEL } from './buildProfiles'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const FPS_USES = new Set(['gaming', 'streaming'])

// Percentile of a part's quality within its category across the catalog (0-100).
export function partLevel(part, catalog) {
  if (!part) return 0
  const qs = catalog.filter((p) => p.category === part.category).map(partQuality)
  if (qs.length === 0) return 0
  const min = Math.min(...qs)
  const max = Math.max(...qs)
  return max > min ? Math.round(100 * (partQuality(part) - min) / (max - min)) : 100
}
```

- [ ] **Step 4:** Run `npm run test:run -- src/tests/partRatings.test.js` — PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/partRatings.js src/tests/partRatings.test.js
git commit -m "feat: partLevel — per-category percentile for ratings"
```

---

### Task 3: `rateBuild` — per-part /100 + overall

**Files:**
- Modify: `src/lib/partRatings.js`
- Test: `src/tests/partRatings.test.js` (append)

- [ ] **Step 1: Append the failing tests** (these module-scope consts are shared with Task 4 — place them above the describe block):

```js
import { rateBuild } from '../lib/partRatings'

// Three levels per category so partLevel gives 0 / ~50 / 100.
const cW = { id: 'cw', category: 'cpu', perfScore: 60,  price: 100, tdp: 65,  socket: 'AM5' }
const cM = { id: 'cm', category: 'cpu', perfScore: 160, price: 220, tdp: 88,  socket: 'AM5' }
const cS = { id: 'cs', category: 'cpu', perfScore: 260, price: 340, tdp: 120, socket: 'AM5' }
const gW = { id: 'gw', category: 'gpu', perfScore: 120, price: 200, tdp: 150, length: 260 }
const gM = { id: 'gm', category: 'gpu', perfScore: 260, price: 420, tdp: 220, length: 280 }
const gS = { id: 'gs', category: 'gpu', perfScore: 400, price: 800, tdp: 300, length: 300 }
const rW = { id: 'rw', category: 'ram', capacityGb: 8,  price: 30,  ramType: 'DDR5', speed: 5200 }
const rS = { id: 'rs', category: 'ram', capacityGb: 64, price: 200, ramType: 'DDR5', speed: 6000 }
const ratingCatalog = [cW, cM, cS, gW, gM, gS, rW, rS]

describe('rateBuild', () => {
  it('scores a weak CPU behind a strong GPU below the GPU (gaming)', () => {
    const r = rateBuild({ cpu: cW, gpu: gS }, 'gaming', ratingCatalog)
    expect(r.parts.cpu.score).toBeLessThan(r.parts.gpu.score)
    expect(r.parts.gpu.score).toBeGreaterThanOrEqual(80)
  })
  it('rates a mid build higher for office than for gaming', () => {
    const build = { cpu: cM, gpu: gM, ram: rS }
    expect(rateBuild(build, 'office', ratingCatalog).overall)
      .toBeGreaterThan(rateBuild(build, 'gaming', ratingCatalog).overall)
  })
  it('flags low RAM as a weak link for content creation', () => {
    const r = rateBuild({ cpu: cS, gpu: gS, ram: rW }, 'creation', ratingCatalog)
    expect(r.parts.ram.isWeakLink).toBe(true)
    expect(r.parts.ram.score).toBeLessThan(r.parts.gpu.score)
  })
  it('rates a strong balanced build highly', () => {
    const r = rateBuild({ cpu: cS, gpu: gS, ram: rS }, 'gaming', ratingCatalog)
    expect(r.overall).toBeGreaterThanOrEqual(70)
    expect(r.verdict).toMatch(/gaming/i)
  })
  it('returns overall 0 without a CPU or GPU', () => {
    expect(rateBuild({ cpu: cS }, 'gaming', ratingCatalog)).toEqual({ overall: 0, verdict: expect.any(String), parts: {} })
  })
})
```

- [ ] **Step 2:** Run `npm run test:run -- src/tests/partRatings.test.js` — the new `rateBuild` tests FAIL.

- [ ] **Step 3: Add to `src/lib/partRatings.js`** (below `partLevel`):

```js
function verdictFor(overall, label) {
  if (overall >= 85) return `Excellent for ${label}`
  if (overall >= 70) return `Strong for ${label}`
  if (overall >= 50) return `Okay for ${label}`
  return `Struggles with ${label}`
}

// Score every present part /100 for the use case. cpu/gpu balance comes from the
// FPS bottleneck; other parts are judged against the build's own tier. A part is
// only as good as its worst of {adequacy vs the use-case expectation, balance}.
export function rateBuild(parts, useCase, catalog) {
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  const label = USE_CASE_LABEL[useCase] ?? 'this use'
  if (!parts.cpu || !parts.gpu) return { overall: 0, verdict: verdictFor(0, label), parts: {} }

  const cats = Object.keys(parts).filter((c) => parts[c])
  const w = profile.weights
  const expect = profile.expect

  const level = {}
  for (const c of cats) level[c] = partLevel(parts[c], catalog)

  let wsum = 0, lsum = 0
  for (const c of cats) { const wc = w[c] ?? 0; wsum += wc; lsum += wc * level[c] }
  const D = wsum > 0 ? lsum / wsum : 0

  const bn = computeBottleneck(parts.cpu, parts.gpu, profile.resolution)

  const out = {}
  for (const c of cats) {
    const adequacy = clamp(Math.round(100 * level[c] / Math.max(expect[c] ?? 1, 1)), 0, 100)
    let balance
    if (c === 'cpu') balance = bn && bn.limitedBy === 'cpu' ? bn.balancePct : 100
    else if (c === 'gpu') balance = bn && bn.limitedBy === 'gpu' ? bn.balancePct : 100
    else balance = clamp(Math.round(100 * level[c] / Math.max(D, 1)), 0, 100)
    const score = Math.round(Math.min(adequacy, balance))
    out[c] = { score, level: level[c], part: parts[c], isWeakLink: score < 70 }
  }

  let owsum = 0, ossum = 0
  for (const c of cats) { const wc = w[c] ?? 0; owsum += wc; ossum += wc * out[c].score }
  const overall = owsum > 0 ? Math.round(ossum / owsum) : 0
  return { overall, verdict: verdictFor(overall, label), parts: out }
}
```

- [ ] **Step 4:** Run `npm run test:run -- src/tests/partRatings.test.js` — PASS (partLevel 3 + rateBuild 5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/partRatings.js src/tests/partRatings.test.js
git commit -m "feat: rateBuild — bottleneck-aware per-part /100 + overall"
```

---

### Task 4: `partUpgradeOptions` — click-to-upgrade candidates

**Files:**
- Modify: `src/lib/partRatings.js`
- Test: `src/tests/partRatings.test.js` (append)

- [ ] **Step 1: Append the failing tests** (reuse the `ratingCatalog` / `cW` / `cM` / `cS` / `gS` consts from Task 3's block — same file):

```js
import { partUpgradeOptions } from '../lib/partRatings'

const game = { id: 'fortnite', name: 'Fortnite', fpsFactor: 1, cpuFactor: 1 }

describe('partUpgradeOptions', () => {
  it('offers cheaper-first, higher-scoring, compatible upgrades with newScore', () => {
    const opts = partUpgradeOptions({ cpu: cW, gpu: gS }, 'gaming', 'cpu', ratingCatalog, { game })
    expect(opts.length).toBeGreaterThan(0)
    expect(opts[0].toPart.id).toBe('cm') // cheapest CPU stronger than cW
    expect(opts[0].extraCost).toBe(120)
    expect(opts[0].newScore).toBeGreaterThan(0)
  })
  it('adds an fps gain for gaming cpu/gpu, none for office', () => {
    const g = partUpgradeOptions({ cpu: cW, gpu: gS }, 'gaming', 'cpu', ratingCatalog, { game })
    expect(g[0].fpsGain).toBeGreaterThan(0)
    const o = partUpgradeOptions({ cpu: cW, gpu: gS }, 'office', 'cpu', ratingCatalog, { game })
    expect(o[0]?.fpsGain).toBeUndefined()
  })
  it('is empty when the part is already the best in its category', () => {
    expect(partUpgradeOptions({ cpu: cS, gpu: gS }, 'gaming', 'cpu', ratingCatalog, { game })).toEqual([])
  })
})
```

- [ ] **Step 2:** Run `npm run test:run -- src/tests/partRatings.test.js` — the new tests FAIL.

- [ ] **Step 3: Add to `src/lib/partRatings.js`** (below `rateBuild`):

```js
// Better-in-category swaps that would raise this part's score. Cheapest first,
// capped to `limit`. gaming/streaming cpu/gpu also carry an fps gain when a
// representative `game` is supplied.
export function partUpgradeOptions(parts, useCase, category, catalog, { game = null, limit = 5 } = {}) {
  const current = parts[category]
  if (!current) return []
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  const curLevel = partLevel(current, catalog)
  const curScore = rateBuild(parts, useCase, catalog).parts[category]?.score ?? 0
  const showFps = Boolean(game) && FPS_USES.has(useCase) && (category === 'cpu' || category === 'gpu')
  const baseFps = showFps ? gameFps(parts.cpu, parts.gpu, profile.resolution, game, 'high') : 0

  const out = []
  for (const cand of catalog) {
    if (cand.category !== category) continue
    if (partLevel(cand, catalog) <= curLevel) continue
    if (cand.price <= current.price) continue
    if (!checkCompatibility(parts, cand).compatible) continue
    const next = { ...parts, [category]: cand }
    const newScore = rateBuild(next, useCase, catalog).parts[category]?.score ?? 0
    if (newScore <= curScore) continue
    const opt = { toPart: cand, extraCost: cand.price - current.price, newScore }
    if (showFps) opt.fpsGain = gameFps(next.cpu, next.gpu, profile.resolution, game, 'high') - baseFps
    out.push(opt)
  }
  return out.sort((a, b) => a.extraCost - b.extraCost).slice(0, limit)
}
```

- [ ] **Step 4:** Run `npm run test:run -- src/tests/partRatings.test.js` — PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/partRatings.js src/tests/partRatings.test.js
git commit -m "feat: partUpgradeOptions — click-to-upgrade candidates with newScore + fps"
```

---

### Task 5: Rework `UpgradeWizard` into the ratings dashboard

**Files:**
- Modify: `src/components/UpgradeWizard.jsx` (replace whole file)
- Delete: `src/lib/systemUpgrades.js`, `src/tests/systemUpgrades.test.js`
- Test: `src/tests/UpgradeWizard.test.jsx` (replace whole file)

**Context:** New flow `specs → usecase → dashboard`. Saved builds become highlightable cards. `systemUpgrades` is superseded — delete it and its test. Before deleting, confirm nothing else imports it.

- [ ] **Step 1: Delete the superseded module + confirm no other imports.**

Search for `systemUpgrades` across `src` (use the Grep tool, or `rg systemUpgrades src`, or PowerShell `Get-ChildItem -Recurse src -Include *.js,*.jsx | Select-String systemUpgrades`) — expect matches only in `src/components/UpgradeWizard.jsx` and `src/tests/systemUpgrades.test.js`.
Then delete both files:
```bash
git rm src/lib/systemUpgrades.js src/tests/systemUpgrades.test.js
```

- [ ] **Step 2: Replace `src/tests/UpgradeWizard.test.jsx` entirely:**

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import UpgradeWizard from '../components/UpgradeWizard'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import useCatalogStore from '../store/useCatalogStore'
import { encodeBuild } from '../lib/buildCodec'

const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const cpuHi = { id: 'cpu-hi', category: 'cpu', name: 'CPU Hi', price: 300, perfScore: 250, tdp: 105, socket: 'AM5' }
const gpuHi = { id: 'gpu-hi', category: 'gpu', name: 'GPU Hi', price: 600, perfScore: 300, tdp: 250, length: 300 }
const game  = { id: 'fortnite', name: 'Fortnite', fpsFactor: 1, cpuFactor: 1 }

function loadSavedRig() {
  fireEvent.click(screen.getByRole('button', { name: /select saved build/i }))
  fireEvent.click(screen.getByRole('button', { name: /my rig/i }))
}

beforeEach(() => {
  window.location.hash = ''
  useCatalogStore.setState({ parts: [cpuLo, cpuHi, gpuHi], games: [game] })
  useBuilderStore.setState({ budget: 0, flow: 'upgrade', selectedParts: {}, resolution: '1440p' })
  const code = encodeBuild({ budget: 0, resolution: '1440p', parts: { cpu: cpuLo, gpu: gpuHi }, peripherals: {} })
  useSavedStore.setState({ saved: [{ id: 's1', name: 'My rig', savedAt: 1, code }] })
})

describe('UpgradeWizard ratings flow', () => {
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

  it('rates the build, upgrades a part, and opens it in the Build tab', () => {
    window.location.hash = 'summary'
    render(<UpgradeWizard onBack={() => {}} />)
    loadSavedRig()
    fireEvent.click(screen.getByRole('button', { name: /next: use case/i }))
    fireEvent.click(screen.getByRole('button', { name: /^gaming/i }))
    fireEvent.click(screen.getByRole('button', { name: /see ratings/i }))

    // Dashboard shows the weak CPU row; open it and apply the upgrade.
    fireEvent.click(screen.getByRole('button', { name: /cpu lo/i }))
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))

    // Finalise into the builder.
    fireEvent.click(screen.getByRole('button', { name: /open in build tab/i }))

    const s = useBuilderStore.getState()
    expect(s.selectedParts.cpu.id).toBe('cpu-hi')
    expect(s.selectedParts.gpu.id).toBe('gpu-hi')
    expect(s.budget).toBe(900) // 300 (cpu-hi) + 600 (gpu-hi)
    expect(window.location.hash).toBe('#build')
  })
})
```

- [ ] **Step 3:** Run `npm run test:run -- src/tests/UpgradeWizard.test.jsx` — FAIL (old wizard).

- [ ] **Step 4: Replace `src/components/UpgradeWizard.jsx` entirely:**

```jsx
import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import Backdrop from './Backdrop'
import CategoryList from './CategoryList'
import PartSelector from './PartSelector'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { decodeBuild } from '../lib/buildCodec'
import { rateBuild, partUpgradeOptions } from '../lib/partRatings'
import { BUILD_PROFILES, USE_CASES, USE_CASE_LABEL } from '../lib/buildProfiles'
import { enterBuildTab } from '../lib/enterBuildTab'
import { PANEL, BTN_PRIMARY, TELEMETRY } from '../lib/uiTokens'

const CAT_LABEL = {
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', storage: 'Storage', psu: 'PSU',
  cooler: 'Cooler', motherboard: 'Motherboard', case: 'Case', fans: 'Fans',
}
const totalOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)
const scoreText = (s) => (s >= 80 ? 'text-emerald-300' : s >= 50 ? 'text-amber-300' : 'text-red-400')
const scoreBar  = (s) => (s >= 80 ? 'bg-emerald-400' : s >= 50 ? 'bg-amber-400' : 'bg-red-500')

export default function UpgradeWizard({ onBack }) {
  const [screen, setScreen] = useState('specs')      // 'specs' | 'usecase' | 'dashboard'
  const [tab, setTab] = useState('build')
  const [currentParts, setCurrentParts] = useState({})
  const [savedSelectedId, setSavedSelectedId] = useState(null)
  const [pickerCategory, setPickerCategory] = useState(null)
  const [useCase, setUseCase] = useState('gaming')
  const [openCat, setOpenCat] = useState(null)

  const saved     = useSavedStore((s) => s.saved)
  const partsData = useCatalogStore((s) => s.parts)
  const gamesData = useCatalogStore((s) => s.games)
  const setBuild           = useBuilderStore((s) => s.setBuild)
  const setBudget          = useBuilderStore((s) => s.setBudget)
  const setStoreResolution = useBuilderStore((s) => s.setResolution)
  const setLastGenerated   = useBuilderStore((s) => s.setLastGenerated)

  const hasCore = Boolean(currentParts.cpu && currentParts.gpu)
  const profile = BUILD_PROFILES[useCase]
  const game = gamesData.find((g) => g.id === 'fortnite') ?? gamesData[0] ?? null

  const rating = useMemo(
    () => (screen === 'dashboard' && hasCore ? rateBuild(currentParts, useCase, partsData) : null),
    [screen, hasCore, currentParts, useCase, partsData],
  )
  const rows = rating ? Object.entries(rating.parts).sort((a, b) => a[1].score - b[1].score) : []

  function selectPart(part) { setCurrentParts((p) => ({ ...p, [part.category]: part })); setPickerCategory(null) }
  function deselect(category) { setCurrentParts((p) => { const n = { ...p }; delete n[category]; return n }) }
  function loadSaved(b) {
    const d = decodeBuild(b.code)
    if (!d) return
    setSavedSelectedId(b.id)
    setCurrentParts(d.parts)
  }
  function applyOption(category, toPart) {
    setCurrentParts((p) => ({ ...p, [category]: toPart }))
  }
  function openInBuild() {
    enterBuildTab()
    setBuild(currentParts)
    setStoreResolution(profile.resolution)
    const spend = totalOf(currentParts)
    setLastGenerated({ upgrade: true, useCase, spend, budget: spend })
    setBudget(spend) // flips App → BuilderScreen on the Build tab
  }

  const totalCurrent = totalOf(currentParts)

  return (
    <div className="relative min-h-screen flex flex-col items-center text-white bg-[#05080f] py-12">
      <Backdrop />
      <div className="relative z-10 w-full max-w-2xl px-4">
        <h1 className="rise text-3xl font-bold mb-1 text-center">Upgrade your PC</h1>
        <ol className="rise flex items-center justify-center gap-2 mb-8 text-[11px] uppercase tracking-wider">
          {['Current PC', 'Use case', 'Ratings'].map((label, i) => {
            const active = (screen === 'specs' && i === 0) || (screen === 'usecase' && i === 1) || (screen === 'dashboard' && i === 2)
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
              <button onClick={() => { setOpenCat(null); setScreen('dashboard') }} className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium transition-colors`}>See ratings →</button>
              <button onClick={() => setScreen('specs')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Current PC</button>
            </div>
          </div>
        )}

        {screen === 'dashboard' && rating && (
          <div className={`${PANEL} p-5 rise`}>
            <div className="flex items-center gap-4 mb-5">
              <div className={`${TELEMETRY} text-4xl font-bold ${scoreText(rating.overall)}`}>{rating.overall}<span className="text-lg text-slate-500">/100</span></div>
              <div>
                <div className="text-sm text-white">{rating.verdict}</div>
                <div className="text-[11px] text-slate-500">Tap a part to see upgrades that raise its score.</div>
              </div>
            </div>

            <div className="space-y-1.5">
              {rows.map(([cat, info]) => (
                <div key={cat} className="border border-slate-800/60 rounded-sm">
                  <button onClick={() => setOpenCat(openCat === cat ? null : cat)} className="w-full flex items-center gap-3 px-3 py-2 text-left">
                    <span className="uppercase text-[10px] text-slate-500 w-16 shrink-0">{CAT_LABEL[cat] ?? cat}</span>
                    <span className="text-sm text-slate-100 flex-1 min-w-0 truncate">{info.part.name}</span>
                    <span className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
                      <span className={`block h-full ${scoreBar(info.score)}`} style={{ width: `${info.score}%` }} />
                    </span>
                    <span className={`${TELEMETRY} text-sm font-semibold w-8 text-right shrink-0 ${scoreText(info.score)}`}>{info.score}</span>
                    <ChevronDown size={14} className={`text-slate-500 transition-transform shrink-0 ${openCat === cat ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>

                  {openCat === cat && (
                    <div className="border-t border-slate-800/60 p-2 space-y-2">
                      {(() => {
                        const opts = partUpgradeOptions(currentParts, useCase, cat, partsData, { game })
                        if (opts.length === 0) return <p className="text-xs text-slate-400 px-1 py-1">Your {CAT_LABEL[cat] ?? cat} is already well-matched for {USE_CASE_LABEL[useCase]}.</p>
                        return opts.map((o) => (
                          <div key={o.toPart.id} className="flex items-center gap-2 border border-slate-700/70 rounded-sm px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-slate-100 truncate">{o.toPart.name}</div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span className="text-emerald-300">→ {o.newScore}/100</span>
                                <span>+£{o.extraCost.toFixed(0)}</span>
                                {o.fpsGain != null && o.fpsGain > 0 && <span className="text-cyan-300">+{o.fpsGain} fps</span>}
                              </div>
                            </div>
                            <button onClick={() => applyOption(cat, o.toPart)} className={`${BTN_PRIMARY} text-xs font-medium px-3 py-1.5 rounded-sm shrink-0 transition-colors`}>Apply</button>
                          </div>
                        ))
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 mt-5">
              <button onClick={() => setScreen('usecase')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Use case</button>
              <div className="flex items-center gap-3">
                <span className={`${TELEMETRY} text-xs text-slate-400`}>£{totalCurrent.toFixed(0)}</span>
                <button onClick={openInBuild} className={`${BTN_PRIMARY} px-5 py-2 rounded-sm text-sm font-medium transition-colors`}>Open in Build tab →</button>
              </div>
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

- [ ] **Step 5:** Run `npm run test:run -- src/tests/UpgradeWizard.test.jsx` — PASS (3). Then `npm run test:run` — full suite green. Then `npm run lint` — no NEW errors (only the 2 known `SpecSheet.jsx` errors).

- [ ] **Step 6:** Run the E2E to confirm the new-PC path is unaffected: `npm run test:e2e` — PASS (1).

- [ ] **Step 7: Commit**

```bash
git add src/components/UpgradeWizard.jsx src/tests/UpgradeWizard.test.jsx
git commit -m "feat: Upgrade wizard is now a use-case ratings dashboard"
```

---

## Final review

After all tasks, dispatch a code-reviewer over the whole diff and verify:
- `rateBuild` flags the bottleneck part low and never returns a part not in the build.
- The dashboard sorts weakest-first, Apply re-rates in place, and "Open in Build tab" sets `selectedParts`/`budget`/`resolution`/hash correctly.
- `systemUpgrades` is fully gone with no dangling imports.
- Full suite + E2E green; lint clean except the 2 known `SpecSheet.jsx` errors.
- Eyeball a couple of real builds in preview (mobile + desktop): an unbalanced rig scores its weak part clearly below the strong one; a balanced high-end rig scores 80+.

## Notes for the implementer
- `computeBottleneck(cpu, gpu, resolution)` returns `{ balancePct, limitedBy, verdict, cpuFps, gpuFps }`.
- `checkCompatibility(parts, cand)` returns `{ compatible, ... }`.
- Do NOT touch `upgradeCandidates`/`sortCandidates` in `upgradeAdvisor.js` — the in-builder `UpgradeSuggestion` panel still uses them.
- The `style={{ width: … }}` on the score bar is the one intentional inline style (dynamic width) — fine under the CSP's `style-src 'unsafe-inline'`.
