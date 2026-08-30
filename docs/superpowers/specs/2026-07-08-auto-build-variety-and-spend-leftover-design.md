# Auto-build variety + Spend-the-leftover fix (Stage 2) — design

Date: 2026-07-08
Status: awaiting user review

## Overview

Two builder-logic improvements, building on Stage 1's persisted `useCase`:

1. **Auto-build variety** — the on-page **Auto-build** button regenerates the *best* budget-maximising
   build for the **selected use case + budget**, choosing among near-best parts so clicking again
   gives a different, still-excellent build (fixes "same build every time"). Variety is **opt-in**
   and off by default, so the quick-start presets, the new-PC **Generate build**, and every existing
   test stay deterministic.
2. **Fix "Spend the leftover"** — today the button usually does nothing. Rework it to spend the
   remaining budget on the best affordable, compatible upgrades **across all categories**, ranked by
   the current use case — so it always visibly improves the build.

Everything reuses the existing builder (`autoBuild`, `buildForUseCase`, `partQuality`,
`checkCompatibility`, `BUILD_PROFILES`). No visual restyle.

## Non-goals / out of scope

- No change to Generate build / quick-start tiers behavior (they stay deterministic-best).
- No change to `targetBuild`, `suggestUpgrade` (still used by `UpgradeSuggestion`), or the rating libs.
- No new store fields; `useCase` (added in Stage 1) is the only cross-flow input.
- No seeded-RNG persistence — production variety uses `Math.random`; only tests inject a seeded PRNG.
- Keep field names as-is (`perfScore`, `price`, `wattage`, `partQuality`).

## A. Opt-in variety in `autoBuild` — `src/lib/autoBuilder.js`

Add two optional keys to the existing `options` arg (both default to today's behavior):

- `rng` — a `() => number` in `[0, 1)`. When **absent**, selection is deterministic (unchanged).
  When **present**, wherever the builder currently takes the single best of a best-first-sorted
  pool, it instead picks among the **top `k`** of that pool.
- `lockExisting` — `boolean`, default `true`. When `true`, the upgrade/maximise pass skips
  categories already present in `selectedParts` (today's `userCats` guard). When `false`, no
  category is treated as locked, so the maximise pass will step up parts that were passed in
  (needed by `maxOutBudget`, section C).

### The `pick` helper (new, module-local)
```js
// Deterministic head of a best-first pool, or a random one of its top k when an
// rng is supplied. k is small so a varied build stays within the best tier.
function pick(sortedBestFirst, rng, k = 3) {
  if (sortedBestFirst.length === 0) return null
  if (!rng) return sortedBestFirst[0]
  const n = Math.min(k, sortedBestFirst.length)
  return sortedBestFirst[Math.floor(rng() * n)]
}
```

### Wiring
- `const rng = options.rng ?? null`, `const lockExisting = options.lockExisting ?? true`.
- `const userCats = lockExisting ? new Set(Object.keys(selectedParts)) : new Set()`.
- `chooseBest(category, candidates, slice, remaining, rng)` — build the same affordable `pool` and
  the same sort it uses today (perf-desc for `PERF` categories, price-asc otherwise), then
  `return pick(sortedPool, rng)` instead of `sortedPool[0]`. The empty/degraded fallbacks
  (cheapest overall when nothing fits the slice) are unchanged and ignore `rng`.
- `affordableUpgrade(category, cheapest)` — after building and sorting `pool` (its existing
  cheapest-first or best-quality-first sort), `return pick(pool, rng)` instead of `pool[0]`.
  The maximise loop still converges: each step strictly increases that category's `partQuality`
  over a finite catalog, so the `guard < 200` loop terminates regardless of which near-best step
  is chosen.

**Back-compat:** with no `rng` and `lockExisting` defaulting true, `pick` returns `pool[0]` and
`userCats` is unchanged, so `autoBuild`'s output is byte-identical for every current caller. This is
guarded by the existing `autoBuild` determinism / default-path tests, which must stay green untouched.

## B. `buildForUseCase` passes rng through — `src/lib/useCaseBuilder.js`

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
Existing callers (`tiers.partsForTier`, `BudgetEntry.generate`) call `buildForUseCase(b, uc, parts)`
→ `{ rng } = {}` → `rng` undefined → deterministic. The `buildForUseCase` determinism test is unaffected.

## B2. Auto-build button — `src/components/AutoBuildButton.jsx`

Read the stored `useCase`; on click, regenerate the best varied build for the budget + use case and
replace the current build:

```js
const useCase = useBuilderStore((s) => s.useCase)
...
function handleClick() {
  const result = buildForUseCase(budget, useCase, partsData, { rng: Math.random })
  const spend = Object.values(result).reduce((s, p) => s + (p?.price ?? 0), 0)
  if (spend > budget) {
    // The builder's cheapest-part fallback overshoots when the budget is too low
    // to complete a build — detect that by the total, not a missing slot.
    setNotice(`£${budget.toFixed(0)} isn't enough to auto-build a complete PC yet. Raise the budget (click the £ figure in the header).`)
    return
  }
  setBuild(result)
}
```
(`autoBuild`'s `chooseBest` returns the cheapest part in a category even when it can't fit the
remaining budget, so a too-low budget yields an over-budget build rather than a missing CPU/GPU —
hence the `spend > budget` guard rather than a `!result.cpu` check.)
- It now **starts from empty** (`buildForUseCase` seeds `{}`), so Auto-build **regenerates** the
  whole build for the budget + use case rather than filling around existing parts — this is what
  makes "a different build every time" real and matches "use as much budget as possible to make the
  best PC for the mode + budget". Manual picks are replaced; the user re-tunes via the parts list.
- The old "did anything change?" / whole-budget-already-spent branches are removed; the only notice
  left is the genuine can't-afford-a-core-pair case above. `disabled={budget <= 0}` stays.
- `selTotalSpent` import is no longer needed here if unused after the edit — drop it if so.

## C. Fix "Spend the leftover" — `src/lib/maxOutBudget.js` + `src/components/GeneratedBanner.jsx`

Rewrite `maxOutBudget` to be use-case-aware and multi-category by delegating to `autoBuild` with the
new `lockExisting: false`:

```js
import { autoBuild } from './autoBuilder'
import { BUILD_PROFILES } from './buildProfiles'

// Spend whatever budget is left on the best affordable, compatible upgrades to
// the CURRENT build, prioritised by the use case's upgrade order — across every
// category, not just CPU/GPU. Deterministic (best, not varied).
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
- `lockExisting: false` means the maximise pass steps up the parts already in `parts` (the current
  build) rather than treating them as locked — so it actually spends the leftover.
- `checkCompatibility` (used inside `affordableUpgrade`) already enforces PSU power-fit, so an
  upgrade the current PSU can't power is never chosen.
- The old `import { suggestUpgrade }` and the CPU/GPU-only loop are removed.

`GeneratedBanner.spendLeftover` reads the stored `useCase` and calls the new signature:
```js
const useCase = useBuilderStore((s) => s.useCase)
...
function spendLeftover() {
  setBuild(maxOutBudget(selectedParts, budget, partsData, useCase))
  clear()
}
```
(The `resolution` argument it passed before is dropped — `maxOutBudget` no longer takes it.)

## Testing

- **`autoBuild` (existing):** the current determinism / default-path / maximise / RAM-heavy tests
  stay green **unchanged** (no `rng`, `lockExisting` defaulting true).
- **`autoBuild` (new, seeded PRNG):** a tiny `mulberry32(seed)` helper in the test file.
  - With an `rng`, the build is still complete, compatible, and within budget.
  - Same seed → identical build (reproducible); two different seeds → the builds can differ
    (assert *not deep equal* across a couple of seeds on the real catalog at a mid budget).
  - `lockExisting: false` upgrades a passed-in part when budget allows (a cheap CPU + big leftover →
    the returned CPU has `partQuality` ≥ the input's, i.e. it was stepped up), whereas the default
    `lockExisting: true` leaves it unchanged.
- **`buildForUseCase` (existing determinism test) unchanged;** new: `{ rng }` still yields a
  complete/compatible/within-budget build.
- **`maxOutBudget` (rewritten test):** given a complete build well under budget, the result spends
  strictly more than the input and stays ≤ budget; upgrades land in **more than just CPU/GPU** (e.g.
  a supporting category improves); every returned part passes `checkCompatibility`; use-case-aware
  (programming vs gaming push the leftover to different categories). Delete the old CPU/GPU-only
  assertions.
- **`AutoBuildButton`:** with a seeded catalog + a workable budget + a stored `useCase`, clicking
  calls `setBuild` with a build that has cpu+gpu; with a tiny budget it shows the can't-afford notice
  and does not call `setBuild`.
- **`GeneratedBanner`:** after "Spend the leftover", total spend increases toward budget and
  `maxOutBudget` is exercised with the stored `useCase` (spend rises across categories, not only cpu/gpu).
- Keep the full unit suite + Playwright E2E green.

## Risks / notes

- **Termination:** the maximise loop already has a `guard < 200` cap and each step strictly raises a
  category's `partQuality`; random near-best selection doesn't change that it converges.
- **Auto-build replaces manual picks** (regenerates from empty). This is the intended "best build for
  budget + mode / try again" behavior per the design decision; call it out in the button's notice
  copy if it ever surprises users, but no lock-tracking is in scope.
- **`k` and the near-best band** are the tuning surface. Start `k = 3`; if variety feels too subtle
  or too wild, adjust `k` (and, if needed, restrict the pool to a quality band before `pick`).
- **`maxOutBudget` signature changed** from `(parts, budget, catalog, resolution)` to
  `(parts, budget, catalog, useCase)`. Grep confirms `GeneratedBanner` is the only caller; update it
  in the same change. `suggestUpgrade` stays (still used by `UpgradeSuggestion`).
