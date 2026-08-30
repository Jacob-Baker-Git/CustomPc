# Upgrade Wizard v2 + Build-a-new-PC v2 — design

Date: 2026-07-06
Status: awaiting user review

## Overview

Two independent improvements to the CustomPc entry flows, sharing one spec but shipping as
two separate implementation plans (in order):

1. **Upgrade Wizard v2** — rework the single linear upgrade flow into a **two-path fork**:
   after entering the current rig the user chooses **"Select what I want to upgrade" (Path A)**
   or **"I'm unsure of my upgrade path" (Path B)**. Path A evaluates only the parts the user
   highlights; Path B diagnoses the whole system and prescribes a plan. Backed by a new
   **whole-system upgrade scorer** that keeps CPU/GPU as the honest FPS drivers while scoring
   supporting parts (RAM, storage, PSU, cooler) on their own merits.

2. **Build-a-new-PC v2** — add a **Back to menu** control, **replace the resolution + FPS steps
   with a use-case picker** (Gaming / Everyday / Programming / Workstation), build with a new
   **budget-maximizing, use-case-weighted builder**, and **generate the quick-start tiers** from
   that builder so they are always the best build the current catalog can make at each price.

Everything reuses the existing dark/cyan visual language and existing components
(`PANEL`, `BTN_PRIMARY`, `CategoryList`, `PartSelector`, `Backdrop`, `upgradeCandidates`,
`computeBottleneck`, `gameFps`, `checkCompatibility`, `autoBuild`). No restyle.

## Non-goals / out of scope

- No change to the Build-tab layout, Peripherals, Summary, or Saved views.
- No TypeScript migration, no live pricing (unchanged deferrals).
- No new persistence schema. Field names stay as-is (`price`, `perfScore`, `tdp`, `wattage`,
  `capacityGb`, `ramType`, `speed`, `storageType`, `specs.readMbps`, `length`, `resolution`).
- `targetBuild()` (the existing FPS-target builder) and `suggestUpgrade()` (the in-builder
  single-suggestion helper) are **left untouched** — they still serve other callers.

---

# Area 1 — Upgrade Wizard v2

## Routing & state machine

All state stays local to `UpgradeWizard.jsx`; nothing touches `useBuilderStore` until **Apply**.

```
path:        'select' | 'unsure' | null      // set by the two Step-1 buttons
screen:      'specs' | 'highlight' | 'goal' | 'results'
currentParts: { [category]: Part }           // existing scratch build
selectedCats: Set<string>                    // Path A only — highlighted categories
game/resolution/fps                          // existing goal fields (unchanged)
upgradeBudget, sortKey                        // existing (unchanged)
```

Screen order:
- **Path A:** `specs → highlight → goal → results`
- **Path B:** `specs → goal → results` (skips `highlight`)

The step breadcrumb becomes path-aware:
- Path A: `Current PC → Choose parts → Goal → Upgrades`
- Path B: `Current PC → Goal → Diagnosis`
- Before a path is chosen (screen `specs`): just `Current PC`.

## Step 1 — Current PC (`screen === 'specs'`)

Unchanged from today except the footer. Keeps the `Build current PC` / `Select saved build`
tabs, the `CategoryList` + `PartSelector` (with `contextParts`/`ignoreBudget`), the saved-build
loader, and the "CPU and GPU are required" note.

**Footer replaces the single "Next: goal" button with two buttons** (both disabled until
`hasCore = currentParts.cpu && currentParts.gpu`):

```
[ Select what I want to upgrade → ]   → setPath('select'); setScreen('highlight')
[ I'm unsure of my upgrade path → ]   → setPath('unsure'); setScreen('goal')
← Back to menu                        → onBack()   (existing)
```

## Path A — Step 2: Highlight parts (`screen === 'highlight'`, new)

Renders the categories present in `currentParts` as toggle cards. Clicking toggles membership
in `selectedCats` (cyan ring when selected, reusing the Selected-badge styling). Copy header:
*"Tap the parts you'd like to upgrade."*

- `Continue →` enabled once `selectedCats.size > 0`; goes to `goal`.
- `← Back` returns to `specs`.

## Goal (`screen === 'goal'`, reused)

Identical to today's Step 2: game `<select>`, resolution buttons (`1080p/1440p/4K`), FPS target
buttons (`60/120/144/240`). Produces `{ game, resolution, targetFps }`. `See upgrades →` goes to
`results`; `← Back` returns to `highlight` (Path A) or `specs` (Path B).

## Whole-system scorer — `src/lib/systemUpgrades.js` (new)

```js
systemUpgrades(currentParts, { game, resolution, targetFps }, budget, catalog) → {
  bottleneck,                 // computeBottleneck(cpu, gpu, resolution) | null
  byCat: {                    // best-first candidate lists, only categories with real options
    cpu: Candidate[],   gpu: Candidate[],      // FPS candidates (fpsGain, resultFps, meetsGoal, fixesBottleneck)
    ram: PartUpgrade[], storage: PartUpgrade[],
    psu: PartUpgrade[], cooler: PartUpgrade[],
  },
  deficiencies: Deficiency[], // [{ category, reason, severity: 'high'|'medium'|'low' }]
}
```

**CPU/GPU candidates** reuse `upgradeCandidates(currentParts, goal, catalog)` (already returns
`fpsGain / resultFps / meetsGoal / fixesBottleneck`), grouped by `category` and sorted with
`sortCandidates(list, 'value')`.

**Supporting-part candidates** — a candidate is a same-category part that is *better* on that
category's honest merit, is compatible (`checkCompatibility(currentParts, cand).compatible`),
and whose `extraCost = cand.price - current.price` is `> 0` and `<= budget`. Shape:
`{ category, fromPart, toPart, extraCost, reason }`, sorted by ascending `extraCost`, capped to
the top 3 per category.

Merit + reason per category (`partQuality()` — a shared helper, see below):
- **ram** — better if higher `capacityGb`, or equal capacity with higher `speed`. Must match the
  board's `ramType` (already covered by `checkCompatibility`). reason: `"{cap}GB (+{delta}) — {speed}MT/s"`.
- **storage** — better if higher `specs.readMbps` **or** higher `capacityGb`.
  reason keyed off read speed: `>=5000 → "PCIe 4.0 NVMe — far faster loads"`, `>=2000 → "NVMe SSD"`,
  `>=400 → "SATA SSD — quicker than a hard drive"`, else `"{cap}GB — more space"`.
- **psu** — better if higher `wattage`; only surfaced when the current PSU headroom is tight
  (see deficiencies). reason: `"{wattage}W — comfortable headroom"`.
- **cooler** — better if the current CPU runs hot (`currentParts.cpu.tdp >= 125`) and the candidate
  is a higher tier (`partQuality` cooler score). reason: `"handles a {tdp}W CPU with less noise"`.

**Categories with no meaningful upgrade axis** (`case`, `motherboard`, `fans`) return **no**
`byCat` entry. In Path A, highlighting one of these yields the honest message
*"This part doesn't change performance — swap it directly in the Build tab if you want a different one."*

**Deficiencies** (concrete thresholds; each references the actual current value in its copy):
- `ram.capacityGb < 16` → **high** — *"{cap}GB RAM holds modern games back — 16GB is the baseline."*
- storage is `storageType === 'HDD'` → **medium** — *"An SSD would cut load times dramatically."*
  else `storage.capacityGb < 1000` → **low** — *"Under 1TB fills up fast — consider more space."*
- PSU headroom tight: `sum(tdp) * 1.3 > psu.wattage` → **high** —
  *"Your PSU leaves under ~30% headroom for this build."* (No PSU selected also counts as high.)
- `bottleneck.limitedBy === 'cpu'` → **high** — use `bottleneck.verdict`.

### `partQuality(part)` (shared helper, e.g. `src/lib/partQuality.js`)

Used by both `systemUpgrades` and `useCaseBuild` to rank same-category parts on a comparable scale:
```
cpu, gpu   → perfScore
ram        → capacityGb * 100 + (speed ?? 0) / 100        // capacity dominates, speed tiebreaks
storage    → (specs.readMbps ?? 0) + (capacityGb ?? 0)
psu        → wattage
cooler     → specs.type === 'AIO' ? 300 + (radiatorMm(specs.radiator) ?? 0) : (specs.height ?? 0)
default    → perfScore ?? 0
```

## Path A — Results (`screen === 'results'`, path `select`)

Show one section per highlighted category (`selectedCats`), each listing `byCat[cat]`:
- CPU/GPU cards: today's card (`+N fps`, `+£cost`, `£/fps`, `hits {fps} fps`, `fixes bottleneck`) + **Apply**.
- Supporting-part cards: part name + `reason` + `+£cost` + **Apply**.
- Empty `byCat[cat]` → *"Your {category} is already well-specced for this goal."*
- Non-upgradeable highlighted category → the "swap in the Build tab" message above.

## Path B — Diagnosis (`screen === 'results'`, path `unsure`)

Two blocks:

**① The Limiter** — `bottleneck.verdict` plus every `deficiencies` entry with `severity === 'high'`,
rendered as amber callouts. If there are none: *"Nothing is holding this build back at your target —
it's well balanced."*

**② The Plan** — the recommended swaps:
- The top CPU/GPU candidate that best moves toward the goal (prefer `meetsGoal`, then best `£/fps`).
- One fix per high/medium deficiency (top `byCat[cat]` for ram / psu / storage).
Each card has **Apply**; a footer **Apply all recommended** button applies the whole plan at once
(see Apply). Below the plan, a collapsible *"Also worth it"* lists medium/low-severity items.

## Apply

`apply(candidate)` (single) — extends today's logic to any category:
```
enterBuildTab()
setBuild({ ...currentParts, [candidate.category]: candidate.toPart })
setStoreResolution(resolution)   // + setCustomResolution when custom
setLastGenerated({ upgrade: true, gameName, quality: 'high',
                   met: candidate.meetsGoal ?? undefined,
                   estFps: candidate.resultFps ?? undefined, targetFps })
setBudget(totalOf(currentParts) + upgradeBudget)   // flips App → BuilderScreen on Build tab
```

`applyPlan(candidates)` (Path B "Apply all") — start from `currentParts`, apply each candidate in
the order `[cpu, gpu, ram, cooler, storage, psu]`, re-checking `checkCompatibility` against the
running build before each and skipping any that no longer fits (PSU last so it is sized against the
upgraded draw). Then the same store writes as `apply`, with `setLastGenerated` reflecting the CPU/GPU
result FPS when one was in the plan.

Each recommended CPU/GPU candidate is already individually compatible with the *current* board/RAM
(via `checkCompatibility`), and the plan only touches independent categories, so sequential apply is
safe; the re-check is a belt-and-braces guard.

---

# Area 2 — Build-a-new-PC v2

## Back to menu

`App.jsx` already passes `onBack={() => setFlow('menu')}` to `BudgetEntry`, but `BudgetEntry`
ignores it. Destructure `onBack` and add a `← Back to menu` link on Step 1 (budget), matching
`UpgradeWizard`'s styling.

## Use-case step replaces resolution + FPS

`BudgetEntry` flow becomes **budget → use case → generate**. Steps array: `['Budget', 'Use case']`.

After the budget step, one screen of selectable cards (same card styling as the resolution cards),
single-select:

| id            | label         | blurb                                             |
|---------------|---------------|---------------------------------------------------|
| `gaming`      | Gaming        | High frame rates in the latest games.             |
| `everyday`    | Everyday      | Fast, quiet, great value for general use.         |
| `programming` | Programming   | Cores and memory for compiling and many tabs.     |
| `workstation` | Workstation   | Heavy CPU + GPU + RAM for rendering and editing.  |

Selecting a use case + `Generate build` calls `useCaseBuild(budgetNum, useCase, partsData)`, then:
```
enterBuildTab()
setResolution(profile.resolution)          // per-use-case default; user can change in Build tab
setBuild(parts)
setLastGenerated({ useCase, spend: totalOf(parts), budget: budgetNum })
onSubmit(budgetNum)
```

No game / FPS / resolution is collected here. The Build tab's own game selector and
`ResolutionToggle` still let the user explore performance afterward.

The existing `Start empty instead` button is preserved (still calls `startEmpty()`), moved to this
screen. The FPS-shortfall UI is removed from this flow (it belonged to `targetBuild`, which this
flow no longer calls).

**`GeneratedBanner` gets a use-case variant.** Today it assumes `info.met/estFps/gameName/targetFps`
and would print "undefined fps" for a use-case build. Add a branch: when `info.useCase` is present,
render *"Your {useCaseLabel} build uses £{spend} of your £{budget} budget"* (no FPS claim) and keep
the existing `leftover > 20` "Spend the leftover" button (it still works via `maxOutBudget`). Guard
the existing FPS copy behind the presence of `info.gameName` so the upgrade-flow and FPS-target
callers are unaffected.

## Budget-maximizing builder

**`src/lib/buildProfiles.js` (new)** — one profile per use case. Weights follow the shape of
`autoBuilder.js`'s `BASE_WEIGHTS` (they need not sum to 1; `autoBuild` normalizes over empty cats).
Starting values (tunable):

```
gaming:      { weights: {cpu:.18, gpu:.32, motherboard:.11, ram:.08, storage:.07, psu:.07, case:.08, cooler:.06, fans:.03},
               upgradeOrder: ['gpu','cpu'],          resolution: '1440p' }
everyday:    { weights: {cpu:.20, gpu:.14, motherboard:.11, ram:.10, storage:.14, psu:.08, case:.09, cooler:.08, fans:.06},
               upgradeOrder: ['storage','cpu'],      resolution: '1080p' }
programming: { weights: {cpu:.30, gpu:.14, motherboard:.11, ram:.16, storage:.11, psu:.06, case:.06, cooler:.06, fans:.03},
               upgradeOrder: ['cpu','ram','storage'], resolution: '1440p' }
workstation: { weights: {cpu:.26, gpu:.24, motherboard:.11, ram:.14, storage:.09, psu:.07, case:.05, cooler:.06, fans:.03},
               upgradeOrder: ['gpu','cpu','ram'],    resolution: '4k' }
```

**`autoBuild` generalized (backward compatible)** — add an optional 5th argument
`options = { weights, upgradeOrder, maximise }`:
- `weights` defaults to the current `BASE_WEIGHTS` (+ the existing resolution tweak) → gaming
  behavior unchanged for every existing caller.
- `upgradeOrder` defaults to `['gpu','cpu']` (current behavior).
- The leftover-upgrade pass iterates `upgradeOrder` (not a hardcoded `['gpu','cpu']`) and uses
  `partQuality()` to decide "better" so it can upgrade `ram`/`storage`, not only perf drivers.
- When `maximise` is true, the leftover-upgrade pass **loops** the `upgradeOrder` until no
  affordable higher-quality swap remains on any listed category — so it spends as much of the
  budget as possible (still holding the PSU reserve, still sizing the PSU last).

**`src/lib/useCaseBuilder.js` (new)** — `useCaseBuild(budget, useCase, partsData)`:
```
const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
return autoBuild({}, budget, partsData, profile.resolution,
                 { weights: profile.weights, upgradeOrder: profile.upgradeOrder, maximise: true })
```
Empty seed → autoBuild fills every category; `maximise` spends the remainder on the profile's
priority parts.

## Tiers generated from budget

`src/lib/tiers.js` `TIERS` becomes metadata only:
```
[ { id:'budget',     label:'Budget',     budget:900,  useCase:'gaming' },
  { id:'mainstream', label:'Mainstream', budget:1700, useCase:'gaming' },
  { id:'ultimate',   label:'Ultimate',   budget:3800, useCase:'workstation' } ]
```
`partsForTier(tier, partsData)` becomes `useCaseBuild(tier.budget, tier.useCase, partsData)`.
`BudgetEntry` memoizes the three generated builds from `partsData`. `applyTier(tier)` sets
`resolution` from the tier's profile, `setBuild(generated)`, `onSubmit(tier.budget)`.
This makes the tiers self-maintaining: whatever the catalog holds, the quick-start build is the
best that budget can buy for that use case.

---

## Testing

**Area 1**
- `systemUpgrades`: CPU/GPU FPS candidates present and ranked; RAM/storage/PSU candidates scored and
  reason strings correct; deficiency flags fire at the thresholds (8GB RAM, HDD, tight PSU, CPU
  bottleneck) and stay silent above them; non-upgradeable categories return no `byCat` entry;
  budget cap and compatibility filtering respected; empty-goal input returns empty.
- `partQuality`: monotonic per category (bigger RAM > smaller; faster storage > slower).
- Apply: single apply writes `selectedParts`/`budget`/`resolution`/hash; `applyPlan` merges multiple
  swaps, skips an incompatible one, sizes PSU against upgraded draw.
- Component: Step-1 two-button fork sets `path`+`screen`; highlight gate needs ≥1 selection; Path A
  results filter to highlighted cats; Path B renders Limiter + Plan.

**Area 2**
- `useCaseBuild`: spends within budget and close to it (leftover < cheapest upgradeable part);
  changing `useCase` changes the build (programming picks more RAM/CPU than gaming at equal budget);
  output passes `checkCompatibility` for every part; empty catalog degrades gracefully.
- `autoBuild` back-compat: existing callers (no options) produce identical output to before.
- Generated tiers: each is compatible and totals `<= tier.budget`.
- Component: `BudgetEntry` shows Back-to-menu on step 1; use-case step generates and enters Build;
  quick-start buttons apply a generated build.

Keep the 286 existing unit tests + the Playwright E2E green. **E2E update:** the new-PC path is now
`Build a new PC → enter budget → Next → pick a use case → Generate build`.

## Risks / notes

- Generalizing `autoBuild` must not change existing output — guard with a back-compat test before
  touching callers (`targetBuilder`, `maxOutBudget`, `AutoBuildButton`).
- `useCaseBuild` with `maximise` must terminate — the loop stops when no affordable higher-quality
  swap exists on any `upgradeOrder` category; each iteration strictly spends budget, so it converges.
- Path B "Apply all" ordering (`psu` last) matters so the PSU is sized against the upgraded draw.
- Cooler/case/fans/motherboard have no honest performance-upgrade axis — keep them out of `byCat`
  and tell the user to swap them in the Build tab, rather than fabricating rankings.
```
