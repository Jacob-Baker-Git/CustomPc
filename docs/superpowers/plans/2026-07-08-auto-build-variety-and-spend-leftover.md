# Auto-build variety + Spend-the-leftover fix (Stage 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the on-page Auto-build button regenerate the best *varied* budget-maximising build for the selected use case, and make "Spend the leftover" actually spend the remaining budget on the best compatible upgrades across all categories.

**Architecture:** Add two opt-in `options` to `autoBuild` — `rng` (pick among the top-k near-best per slot) and `lockExisting` (default true) — behind a `pick()` helper, so default output stays byte-identical. `buildForUseCase` threads `rng` through; the Auto-build button calls it with `Math.random`. `maxOutBudget` is rewritten to delegate to `autoBuild(..., { maximise:true, lockExisting:false })` keyed on the stored `useCase`.

**Tech Stack:** React 19, Zustand, Vitest + Testing Library, Playwright. Node at `C:\Program Files\nodejs` — in PowerShell prepend it: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`. Single-file test: `npm run test:run -- <file>`; full suite: `npm run test:run`; lint: `npm run lint`; E2E: `npm run test:e2e`.

**Branch:** `feat/build-page-ratings-panel` (Stage 1 lives here; continue on it). Commit per task, do NOT push.

**Depends on Stage 1:** the store already has a persisted `useCase`/`setUseCase`.

---

## File structure

- `src/lib/autoBuilder.js` (edit) — `pick()` helper; `rng` + `lockExisting` options.
- `src/lib/useCaseBuilder.js` (edit) — `buildForUseCase` accepts `{ rng }`.
- `src/lib/maxOutBudget.js` (rewrite) — use-case-aware, all-category leftover spend.
- `src/components/AutoBuildButton.jsx` (rewrite) — regenerate via `buildForUseCase` + `Math.random`.
- `src/components/GeneratedBanner.jsx` (edit) — `spendLeftover` passes the stored `useCase`.
- Tests: append to `src/tests/autoBuilder.test.js`; append to `src/tests/useCaseBuilder.test.js`; rewrite `src/tests/maxOutBudget.test.js`, `src/tests/AutoBuildButton.test.jsx`; edit `src/tests/GeneratedBanner.test.jsx`.

Do NOT touch `targetBuilder.js`, `upgradeAdvisor.js` (`suggestUpgrade` stays — used by `UpgradeSuggestion`), the rating libs, or `tiers.js`.

---

## Task 1: `autoBuild` — `rng` + `lockExisting` options (opt-in variety)

**Files:**
- Modify: `src/lib/autoBuilder.js`
- Test: `src/tests/autoBuilder.test.js` (append)

**Context:** `autoBuild(selectedParts, budget, partsData, resolution, options)` currently takes the single best of each best-first-sorted pool and locks any category present in `selectedParts` during the upgrade pass. Add `options.rng` (pick among the top-k) and `options.lockExisting` (default true). With no `rng` and `lockExisting` defaulting true, output must be identical — the existing tests are the guard.

- [ ] **Step 1: Append failing tests to `src/tests/autoBuilder.test.js`**

Add these imports at the top of the file (next to the existing imports):

```js
import { BUILD_PROFILES } from '../lib/buildProfiles'
import { checkCompatibility } from '../lib/compatibility'
```

Add this helper below the existing `idMap` const:

```js
// Small seedable PRNG so variety is reproducible in tests.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gamingOpts = (extra) => ({
  weights: BUILD_PROFILES.gaming.weights,
  upgradeOrder: BUILD_PROFILES.gaming.upgradeOrder,
  maximise: true,
  ...extra,
})
```

Add this describe block at the end of the file:

```js
describe('autoBuild variety + lockExisting', () => {
  it('a seeded build is complete, compatible and within budget', () => {
    const b = autoBuild({}, 1800, partsData, '1440p', gamingOpts({ rng: mulberry32(1) }))
    for (const c of CATS) expect(b[c], `missing ${c}`).toBeTruthy()
    expect(CATS.reduce((s, c) => s + b[c].price, 0)).toBeLessThanOrEqual(1800)
    for (const c of CATS) {
      const others = { ...b }; delete others[c]
      expect(checkCompatibility(others, b[c]).compatible).toBe(true)
    }
  })

  it('the same seed reproduces the same build', () => {
    expect(idMap(autoBuild({}, 1800, partsData, '1440p', gamingOpts({ rng: mulberry32(7) }))))
      .toEqual(idMap(autoBuild({}, 1800, partsData, '1440p', gamingOpts({ rng: mulberry32(7) }))))
  })

  it('different seeds can produce different builds', () => {
    const variants = new Set([1, 2, 3, 4, 5].map((s) =>
      JSON.stringify(idMap(autoBuild({}, 1800, partsData, '1440p', gamingOpts({ rng: mulberry32(s) }))))))
    expect(variants.size).toBeGreaterThan(1)
  })

  it('lockExisting:false steps up a passed-in part; default keeps it', () => {
    const cheapCpu = [...partsData.filter((p) => p.category === 'cpu')].sort((a, b) => a.price - b.price)[0]
    const seed = { cpu: cheapCpu }
    const opts = { weights: BUILD_PROFILES.gaming.weights, upgradeOrder: ['cpu'], maximise: true }
    const locked = autoBuild(seed, 2500, partsData, '1440p', { ...opts, lockExisting: true })
    const unlocked = autoBuild(seed, 2500, partsData, '1440p', { ...opts, lockExisting: false })
    expect(locked.cpu.id).toBe(cheapCpu.id)
    expect(partQuality(unlocked.cpu)).toBeGreaterThan(partQuality(cheapCpu))
  })
})
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npm run test:run -- src/tests/autoBuilder.test.js`
Expected: the 4 new tests FAIL (rng ignored → seeds identical; lockExisting ignored → unlocked keeps cheapCpu). The original `autoBuild` tests still pass.

- [ ] **Step 3: Add the `pick` helper + wire the options in `src/lib/autoBuilder.js`**

3a. Add the `pick` helper immediately above the existing `function chooseBest(...)`:

```js
// Head of a best-first pool, or a random one of its top k when an rng is given —
// keeps a varied build inside the best tier. Deterministic (head) without rng.
function pick(sortedBestFirst, rng, k = 3) {
  if (sortedBestFirst.length === 0) return null
  if (!rng) return sortedBestFirst[0]
  return sortedBestFirst[Math.floor(rng() * Math.min(k, sortedBestFirst.length))]
}
```

3b. Replace the whole `chooseBest` function with an rng-aware version:

```js
function chooseBest(category, candidates, slice, remaining, rng) {
  if (candidates.length === 0) return null
  let pool = candidates.filter((p) => p.price <= slice)
  if (pool.length === 0) pool = candidates.filter((p) => p.price <= remaining)
  if (pool.length === 0) return [...candidates].sort((a, b) => a.price - b.price)[0]
  if (PERF.has(category)) return pick([...pool].sort((a, b) => (b.perfScore - a.perfScore) || (a.price - b.price)), rng)
  return pick([...pool].sort((a, b) => a.price - b.price), rng)
}
```

3c. In `autoBuild`, extend the options destructuring (just after `const maximise = options.maximise ?? false`):

```js
  const rng = options.rng ?? null
  const lockExisting = options.lockExisting ?? true
```

3d. Change the `userCats` line to respect `lockExisting`:

```js
  const userCats = lockExisting ? new Set(Object.keys(selectedParts)) : new Set()
```

3e. In the fill loop, rename the local `pick` variable (it would shadow the new helper) and pass `rng`. Replace:

```js
    const pick = chooseBest(category, candidates, slice, remaining - psuReserve)
    if (pick) {
      result[category] = pick
      remaining -= pick.price
    }
```

with:

```js
    const chosen = chooseBest(category, candidates, slice, remaining - psuReserve, rng)
    if (chosen) {
      result[category] = chosen
      remaining -= chosen.price
    }
```

3f. In `affordableUpgrade`, take the near-best via `pick` instead of `[0]`. Replace:

```js
    if (pool.length === 0) return null
    return cheapest
      ? [...pool].sort((a, b) => (a.price - b.price) || (partQuality(b) - partQuality(a)))[0]
      : [...pool].sort((a, b) => (partQuality(b) - partQuality(a)) || (a.price - b.price))[0]
```

with:

```js
    if (pool.length === 0) return null
    const sorted = cheapest
      ? [...pool].sort((a, b) => (a.price - b.price) || (partQuality(b) - partQuality(a)))
      : [...pool].sort((a, b) => (partQuality(b) - partQuality(a)) || (a.price - b.price))
    return pick(sorted, rng)
```

- [ ] **Step 4: Run the file + confirm back-compat**

Run: `npm run test:run -- src/tests/autoBuilder.test.js`
Expected: PASS (original 6 + new 4).
Run: `npm run test:run -- src/tests/useCaseBuilder.test.js src/tests/tiers.test.js src/tests/targetBuilder.test.js src/tests/maxOutBudget.test.js`
Expected: PASS — every existing `autoBuild` caller is byte-identical (no rng, lockExisting default). If `maxOutBudget.test.js` fails here, STOP — it should be untouched until Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autoBuilder.js src/tests/autoBuilder.test.js
git commit -m "feat: autoBuild opt-in variety (rng) + lockExisting option"
```
End the commit message with:
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

---

## Task 2: `buildForUseCase` threads `rng`

**Files:**
- Modify: `src/lib/useCaseBuilder.js`
- Test: `src/tests/useCaseBuilder.test.js` (append)

- [ ] **Step 1: Append a failing test to `src/tests/useCaseBuilder.test.js`**

Add this helper above the `describe` block:

```js
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

Add this test inside the `describe('buildForUseCase', ...)` block (the file already imports `checkCompatibility` and defines `CATS`/`total`):

```js
  it('threads an rng so seeds vary, each build complete/compatible/within budget', () => {
    const build = (seed) => buildForUseCase(1800, 'gaming', partsData, { rng: mulberry32(seed) })
    const b = build(3)
    for (const c of CATS) expect(b[c], `missing ${c}`).toBeTruthy()
    for (const part of Object.values(b)) {
      const others = { ...b }; delete others[part.category]
      expect(checkCompatibility(others, part).compatible).toBe(true)
    }
    expect(total(b)).toBeLessThanOrEqual(1800)
    const variants = new Set([1, 2, 3, 4, 5].map((s) =>
      JSON.stringify(Object.fromEntries(CATS.map((c) => [c, build(s)[c]?.id])))))
    expect(variants.size).toBeGreaterThan(1)
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/tests/useCaseBuilder.test.js`
Expected: FAIL — `buildForUseCase` currently ignores the 4th arg, so `rng` never reaches `autoBuild`; every seed yields the identical deterministic build → `variants.size === 1` → the last assertion fails.

- [ ] **Step 3: Update `src/lib/useCaseBuilder.js`**

Replace the whole `buildForUseCase` function with:

```js
export function buildForUseCase(budget, useCase, partsData, { rng } = {}) {
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  return autoBuild({}, budget, partsData, profile.resolution, {
    weights: profile.weights,
    upgradeOrder: profile.upgradeOrder,
    maximise: true,
    rng,
  })
}
```

- [ ] **Step 4: Run the file + the determinism guard**

Run: `npm run test:run -- src/tests/useCaseBuilder.test.js`
Expected: PASS (existing 5 + new 1). The existing `is deterministic` test still passes because the tier/Generate callers pass no `rng`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/useCaseBuilder.js src/tests/useCaseBuilder.test.js
git commit -m "feat: buildForUseCase threads an optional rng for varied builds"
```
End with the Co-Authored-By trailer.

---

## Task 3: Rewrite `maxOutBudget` — use-case-aware, all-category leftover spend

**Files:**
- Modify: `src/lib/maxOutBudget.js` (rewrite)
- Test: `src/tests/maxOutBudget.test.js` (rewrite)

**Context:** Today `maxOutBudget(parts, budget, catalog, resolution)` loops `suggestUpgrade` (CPU/GPU only). Rewrite it to delegate to `autoBuild` with `lockExisting:false` so it steps up EVERY present part along the use-case priority order. Signature changes the 4th arg from `resolution` to `useCase`. `GeneratedBanner` (Task 5) is the only caller.

- [ ] **Step 1: Rewrite `src/tests/maxOutBudget.test.js` entirely**

```js
import { describe, it, expect } from 'vitest'
import { maxOutBudget } from '../lib/maxOutBudget'
import { buildForUseCase } from '../lib/useCaseBuilder'
import { checkCompatibility } from '../lib/compatibility'
import partsData from '../data/partsData.json'

const CATS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']
const total = (b) => CATS.reduce((s, c) => s + (b[c]?.price ?? 0), 0)
const ids = (b) => Object.fromEntries(CATS.map((c) => [c, b[c]?.id]))

describe('maxOutBudget', () => {
  it('spends the leftover across categories, staying compatible and within budget', () => {
    const base = buildForUseCase(1200, 'gaming', partsData)
    const upgraded = maxOutBudget(base, 2200, partsData, 'gaming')
    expect(total(upgraded)).toBeGreaterThan(total(base))
    expect(total(upgraded)).toBeLessThanOrEqual(2200)
    for (const c of CATS) {
      const others = { ...upgraded }; delete others[c]
      expect(checkCompatibility(others, upgraded[c]).compatible).toBe(true)
    }
    const changed = CATS.filter((c) => upgraded[c]?.id !== base[c]?.id)
    expect(changed.some((c) => c !== 'cpu' && c !== 'gpu')).toBe(true)
  })

  it('is use-case aware: programming never shrinks RAM when spending leftover', () => {
    const base = buildForUseCase(1200, 'programming', partsData)
    const up = maxOutBudget(base, 2600, partsData, 'programming')
    expect(up.ram.capacityGb).toBeGreaterThanOrEqual(base.ram.capacityGb)
  })

  it('leaves the build unchanged when there is no budget to spend', () => {
    const base = buildForUseCase(1500, 'gaming', partsData)
    expect(ids(maxOutBudget(base, total(base), partsData, 'gaming'))).toEqual(ids(base))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/tests/maxOutBudget.test.js`
Expected: FAIL — the current `maxOutBudget` only upgrades CPU/GPU, so the "more than just cpu/gpu changed" assertion fails (and the signature still means `'gaming'` is treated as a resolution).

- [ ] **Step 3: Rewrite `src/lib/maxOutBudget.js` entirely**

```js
import { autoBuild } from './autoBuilder'
import { BUILD_PROFILES } from './buildProfiles'

// Spend whatever budget is left on the best affordable, compatible upgrades to
// the CURRENT build, prioritised by the use case's upgrade order — across every
// category, not just CPU/GPU. `lockExisting: false` lets the maximise pass step
// up parts already in the build. Deterministic (best, not varied).
export function maxOutBudget(parts, budget, catalog, useCase = 'gaming') {
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  return autoBuild(parts, budget, catalog, profile.resolution, {
    weights: profile.weights,
    upgradeOrder: profile.upgradeOrder,
    maximise: true,
    lockExisting: false,
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/tests/maxOutBudget.test.js`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/maxOutBudget.js src/tests/maxOutBudget.test.js
git commit -m "feat: maxOutBudget spends leftover across all categories per use case"
```
End with the Co-Authored-By trailer.

---

## Task 4: `AutoBuildButton` regenerates a varied build for the use case

**Files:**
- Modify: `src/components/AutoBuildButton.jsx` (rewrite)
- Test: `src/tests/AutoBuildButton.test.jsx` (rewrite)

**Context:** The button currently fills around existing parts and no-ops on a full build. Change it to regenerate the best varied build for the budget + stored `useCase` via `buildForUseCase(..., { rng: Math.random })`, replacing the current parts. The only notice left is when the budget is too low to complete a build (detected by `spend > budget`, because `chooseBest`'s cheapest fallback overshoots rather than leaving a slot empty).

- [ ] **Step 1: Rewrite `src/tests/AutoBuildButton.test.jsx` entirely**

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import AutoBuildButton from '../components/AutoBuildButton'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  useBuilderStore.setState({ budget: 1500, useCase: 'gaming', selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('AutoBuildButton', () => {
  it('regenerates a complete build for the budget and use case when clicked', () => {
    render(<AutoBuildButton />)
    fireEvent.click(screen.getByRole('button', { name: /auto-build/i }))
    const parts = useBuilderStore.getState().selectedParts
    expect(parts.cpu).toBeTruthy()
    expect(parts.gpu).toBeTruthy()
    expect(parts.psu).toBeTruthy()
  })

  it('replaces existing parts with a fresh build', () => {
    useBuilderStore.setState({ selectedParts: { cpu: { id: 'stale', category: 'cpu', name: 'Stale', price: 50, tdp: 65 } } })
    render(<AutoBuildButton />)
    fireEvent.click(screen.getByRole('button', { name: /auto-build/i }))
    expect(useBuilderStore.getState().selectedParts.cpu.id).not.toBe('stale')
  })

  it('is disabled when there is no budget', () => {
    useBuilderStore.setState({ budget: 0 })
    render(<AutoBuildButton />)
    expect(screen.getByRole('button', { name: /auto-build/i })).toBeDisabled()
  })

  it('explains itself when the budget is too low to complete a build', () => {
    useBuilderStore.setState({ budget: 50, useCase: 'gaming', selectedParts: {} })
    render(<AutoBuildButton />)
    fireEvent.click(screen.getByRole('button', { name: /auto-build/i }))
    expect(screen.getByRole('dialog', { name: /auto-build/i })).toBeInTheDocument()
    expect(useBuilderStore.getState().selectedParts).toEqual({})
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/tests/AutoBuildButton.test.jsx`
Expected: FAIL — the current component fills around `selectedParts` (so "replaces existing parts" fails) and its no-op dialog path differs from the new budget-too-low path.

- [ ] **Step 3: Rewrite `src/components/AutoBuildButton.jsx` entirely**

```jsx
import { useState } from 'react'
import { Zap } from 'lucide-react'
import useBuilderStore from '../store/useBuilderStore'
import { buildForUseCase } from '../lib/useCaseBuilder'
import { BTN_PRIMARY, PANEL_STRONG } from '../lib/uiTokens'
import useCatalogStore from '../store/useCatalogStore'

export default function AutoBuildButton() {
  const budget = useBuilderStore((s) => s.budget)
  const useCase = useBuilderStore((s) => s.useCase)
  const setBuild = useBuilderStore((s) => s.setBuild)
  const partsData = useCatalogStore((s) => s.parts)
  const [notice, setNotice] = useState(null)

  function handleClick() {
    // Regenerate the best varied build for the budget + selected use case. Starts
    // from scratch (not the current parts) so each click can differ — "build me
    // the best one / try again".
    const result = buildForUseCase(budget, useCase, partsData, { rng: Math.random })
    const spend = Object.values(result).reduce((s, p) => s + (p?.price ?? 0), 0)
    if (spend > budget) {
      // chooseBest's cheapest fallback overshoots when the budget can't complete a
      // build — surface that instead of applying an over-budget rig.
      setNotice(`£${budget.toFixed(0)} isn't enough to auto-build a complete PC yet. Raise the budget by clicking the £ figure in the header.`)
      return
    }
    setBuild(result)
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={budget <= 0}
        className={`w-full md:w-auto ${BTN_PRIMARY} text-sm font-medium px-5 py-2 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-1.5`}
      >
        <Zap size={14} aria-hidden="true" /> Auto-build
      </button>
      {notice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div role="dialog" aria-modal="true" aria-label="Auto-build" className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
            <h3 className="text-white text-sm font-semibold mb-2">Budget too low</h3>
            <p className="text-xs text-slate-400">{notice}</p>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setNotice(null)}
                className="text-xs px-3.5 py-2 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/tests/AutoBuildButton.test.jsx`
Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/components/AutoBuildButton.jsx src/tests/AutoBuildButton.test.jsx
git commit -m "feat: Auto-build regenerates a varied best build for the use case"
```
End with the Co-Authored-By trailer.

---

## Task 5: `GeneratedBanner` spend-the-leftover uses the stored use case

**Files:**
- Modify: `src/components/GeneratedBanner.jsx`
- Test: `src/tests/GeneratedBanner.test.jsx` (edit)

- [ ] **Step 1: Update the failing test in `src/tests/GeneratedBanner.test.jsx`**

1a. Add `useCase: 'gaming'` to the `beforeEach` `useBuilderStore.setState({...})` object so the spend-leftover call has a use case:

```js
  useBuilderStore.setState({
    budget: 1600,
    resolution: '1440p',
    useCase: 'gaming',
    selectedParts: parts,
    selectedPeripherals: {},
    lastGenerated: { met: true, estFps, targetFps: 60, gameName: 'Fortnite' },
  })
```

1b. Replace the `spend-the-leftover upgrades the build and dismisses the banner` test with a total-spend assertion (upgrades now spread across categories, so asserting a specific part's perfScore is brittle):

```js
  it('spend-the-leftover upgrades the build and dismisses the banner', () => {
    render(<GeneratedBanner />)
    const total = (p) => Object.values(p).reduce((s, x) => s + (x?.price ?? 0), 0)
    const before = total(useBuilderStore.getState().selectedParts)
    fireEvent.click(screen.getByRole('button', { name: /spend the leftover/i }))
    const after = total(useBuilderStore.getState().selectedParts)
    expect(after).toBeGreaterThan(before)
    expect(after).toBeLessThanOrEqual(1600)
    expect(useBuilderStore.getState().lastGenerated).toBeNull()
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/tests/GeneratedBanner.test.jsx`
Expected: FAIL — `GeneratedBanner` still calls `maxOutBudget(..., resolution)`, so `'1440p'` is treated as the use case (`?? gaming`) and the behavior/signature don't match the new contract; the total-spend assertion is what pins the new behavior.

- [ ] **Step 3: Update `src/components/GeneratedBanner.jsx`**

3a. Add a `useCase` store read next to the existing `resolution` read (`const resolution = useBuilderStore((s) => s.resolution)`):

```js
  const useCase       = useBuilderStore((s) => s.useCase)
```

3b. Change `spendLeftover` to pass the use case instead of the resolution:

```js
  function spendLeftover() {
    setBuild(maxOutBudget(selectedParts, budget, partsData, useCase))
    clear()
  }
```

(Leave the `resolution` read in place — it's still used for `resLabel` in the FPS copy.)

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/tests/GeneratedBanner.test.jsx`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/GeneratedBanner.jsx src/tests/GeneratedBanner.test.jsx
git commit -m "fix: Spend-the-leftover spends across categories for the current use case"
```
End with the Co-Authored-By trailer.

---

## Task 6: Full suite + lint + E2E green

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite**

Run: `npm run test:run`
Expected: all green (Stage-1 total 337 + the Stage-2 additions/changes).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no NEW errors (only the 2 known pre-existing `SpecSheet.jsx` errors). Fix any unused-import warning introduced by the `AutoBuildButton` rewrite (e.g. a stray `selTotalSpent`/`autoBuild` import — the rewrite in Task 4 already drops them; confirm).

- [ ] **Step 3: E2E**

Run: `npm run test:e2e`
Expected: PASS (1). The wizard E2E uses the deterministic **Generate build** path (unchanged) and asserts the rating panel — Auto-build isn't exercised there, so this only confirms no regression.

No commit — all work is committed in Tasks 1–5.

---

## Final review

After all tasks, dispatch a code reviewer over the whole Stage-2 diff and confirm:
- `autoBuild` with no `rng`/`lockExisting` is byte-identical (existing determinism tests untouched and green).
- `pick` bounds variety to the top `k` (=3); seeded builds are reproducible and different seeds can differ; every varied build is complete, compatible, within budget.
- `maxOutBudget` spends across all categories, use-case-ranked, within budget, compatible (PSU power-fit respected via `checkCompatibility`); `suggestUpgrade` is no longer imported there but still exists for `UpgradeSuggestion`.
- `AutoBuildButton` regenerates from empty (replaces current parts) and only shows the dialog when `spend > budget`; `GeneratedBanner` passes the stored `useCase`.
- Full suite + E2E green; lint clean except the 2 known `SpecSheet.jsx` errors.

## Notes for the implementer

- The determinism guard is the whole point of the opt-in design: never make an existing caller pass `rng`, and never change the `lockExisting` default. Tiers, Generate, and `targetBuilder` must stay deterministic.
- The maximise loop still terminates with variety: each step strictly raises a category's `partQuality` over a finite catalog (the `guard < 200` cap remains).
- `Math.random` is used only in the live `AutoBuildButton`; every test injects `mulberry32` so results are reproducible.
- `k = 3` is the tuning knob — leave it at 3; only change if the user later asks for more/less variety.
