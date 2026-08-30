# Upgrade-your-PC ratings redesign — design

Date: 2026-07-07
Status: awaiting user review

## Overview

Replace the current Upgrade-your-PC flow (two-path fork + game/resolution/FPS goal +
`systemUpgrades`) with a **use-case-driven ratings dashboard**:

`Current PC (build or saved) → pick a Use case → Ratings dashboard → click a part → upgrade options`

Each part is scored **/100 for the chosen use case**, where a part scores low when it is the
**weak link** for that use (a mid CPU behind a strong GPU rates low for Gaming; RAM that lags a
render rig rates low for Content Creation). An **overall PC score** blends them by importance.
Clicking a part reveals suggested upgrades that would raise its score. This also relabels the
shared use-case set and makes the saved-builds picker a proper selectable, highlightable card.

Everything reuses the existing visual language and libs (`computeBottleneck`, `gameFps`,
`partQuality`, `checkCompatibility`, `autoBuild`, `PANEL`/`BTN_PRIMARY`/`TELEMETRY`, the `.rise`
entrance animation).

## Non-goals / out of scope

- No change to Build-a-new-PC beyond the shared use-case relabel (its budget→use-case→generate
  flow stays; it just uses the new 5 use-case ids).
- No change to the Build tab, Peripherals, Summary, Saved views.
- No live pricing, no TypeScript migration.
- No per-game selector in the upgrade flow anymore (the use case implies a resolution).

## Use-case set (shared by Build-a-new-PC and Upgrade)

Five use cases replace the current four. `buildProfiles.js` is the single source of truth.

| id            | label              | blurb                                                  | resolution |
|---------------|--------------------|--------------------------------------------------------|------------|
| `gaming`      | Gaming             | High frame rates in the latest games.                  | 1440p      |
| `office`      | Everyday & Office  | Browsing, docs, email and media — fast and quiet.      | 1080p      |
| `creation`    | Content Creation   | Video/photo editing and rendering.                     | 4k         |
| `programming` | Programming        | Compiling, VMs and dozens of tabs.                     | 1440p      |
| `streaming`   | Streaming          | Play and broadcast/encode at the same time.            | 1440p      |

Id migration from the current profiles: `everyday → office`, `workstation → creation`, `gaming`
and `programming` unchanged, `streaming` is new. `tiers.js` `ultimate` tier's `useCase` changes
`workstation → creation` (its resolution stays 4k via the profile).

## `buildProfiles.js` (extended)

Each profile gains an `expect` table (the per-category level a part should reach to be "enough"
for this use, 0–100) alongside the existing `weights` (importance), `upgradeOrder`, `resolution`.
`weights` are reused for both the builder's fill/maximise AND the overall-score blend.

```js
export const BUILD_PROFILES = {
  gaming: {
    weights:      { cpu:.18, gpu:.32, motherboard:.11, ram:.08, storage:.07, psu:.07, case:.08, cooler:.06, fans:.03 },
    expect:       { cpu:68,  gpu:75,  motherboard:35,  ram:45,  storage:40,  psu:45,  case:30,  cooler:45,  fans:30 },
    upgradeOrder: ['gpu','cpu','storage','ram'], resolution:'1440p',
  },
  office: {
    weights:      { cpu:.20, gpu:.14, motherboard:.11, ram:.10, storage:.14, psu:.08, case:.09, cooler:.08, fans:.06 },
    expect:       { cpu:35,  gpu:15,  motherboard:30,  ram:40,  storage:45,  psu:35,  case:25,  cooler:30,  fans:20 },
    upgradeOrder: ['storage','ram','cpu'], resolution:'1080p',
  },
  creation: {
    weights:      { cpu:.26, gpu:.24, motherboard:.11, ram:.14, storage:.09, psu:.07, case:.05, cooler:.06, fans:.03 },
    expect:       { cpu:70,  gpu:65,  motherboard:40,  ram:70,  storage:60,  psu:50,  case:30,  cooler:55,  fans:30 },
    upgradeOrder: ['cpu','gpu','ram','storage'], resolution:'4k',
  },
  programming: {
    weights:      { cpu:.30, gpu:.14, motherboard:.11, ram:.16, storage:.11, psu:.06, case:.06, cooler:.06, fans:.03 },
    expect:       { cpu:70,  gpu:30,  motherboard:35,  ram:65,  storage:55,  psu:40,  case:25,  cooler:50,  fans:20 },
    upgradeOrder: ['cpu','ram','storage'], resolution:'1440p',
  },
  streaming: {
    weights:      { cpu:.24, gpu:.28, motherboard:.10, ram:.12, storage:.08, psu:.07, case:.04, cooler:.06, fans:.03 },
    expect:       { cpu:68,  gpu:70,  motherboard:35,  ram:50,  storage:45,  psu:50,  case:30,  cooler:50,  fans:30 },
    upgradeOrder: ['gpu','cpu','ram','storage'], resolution:'1440p',
  },
}

export const USE_CASE_LABEL = {
  gaming:'Gaming', office:'Everyday & Office', creation:'Content Creation',
  programming:'Programming', streaming:'Streaming',
}
export const USE_CASES = [
  { id:'gaming',      label:'Gaming',            blurb:'High frame rates in the latest games.' },
  { id:'office',      label:'Everyday & Office', blurb:'Browsing, docs, email and media — fast and quiet.' },
  { id:'creation',    label:'Content Creation',  blurb:'Video/photo editing and rendering.' },
  { id:'programming', label:'Programming',       blurb:'Compiling, VMs and dozens of tabs.' },
  { id:'streaming',   label:'Streaming',         blurb:'Play and broadcast at the same time.' },
]
```

Weights and expectations are starting values, tunable during implementation.

## Rating model — `src/lib/partRatings.js` (new)

### `partLevel(part, catalog) → 0..100`
Percentile of the part's `partQuality` within its category across the catalog:
```
const qs = catalog.filter(p => p.category === part.category).map(partQuality)
const min = Math.min(...qs), max = Math.max(...qs)
return max > min ? Math.round(100 * (partQuality(part) - min) / (max - min)) : 100
```

### `rateBuild(parts, useCase, catalog) → { overall, verdict, parts: { [cat]: { score, level, part, isWeakLink } } }`
For the profile `p = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming`:

1. **Level** `L_c = partLevel(part, catalog)` for each present category.
2. **Build tier** `D = Σ w_c·L_c / Σ w_c` over present categories (the build's overall ambition).
3. **Adequacy** `A_c = clamp(round(100 · L_c / max(p.expect[c], 1)), 0, 100)` — meets/exceeds the
   use-case expectation → 100.
4. **Balance** `B_c`:
   - **cpu / gpu** (when both present) from `bn = computeBottleneck(cpu, gpu, p.resolution)`:
     `B_cpu = bn.limitedBy === 'cpu' ? bn.balancePct : 100`,
     `B_gpu = bn.limitedBy === 'gpu' ? bn.balancePct : 100`.
     (Well-matched → both 100. The limiter side takes the imbalance penalty; this is the
     "mid CPU behind a strong GPU" case.)
   - **every other category**: `B_c = clamp(round(100 · L_c / max(D, 1)), 0, 100)` — a supporting
     part far below the build's tier is a weak link (the "RAM lags the render rig" case).
5. **Score** `score_c = round(min(A_c, B_c))`. A part is only as good as its worst dimension.
6. **isWeakLink** `= score_c < 70`.
7. **Overall** `= round(Σ w_c·score_c / Σ w_c)` over present categories.
8. **Verdict** from overall: `≥85 "Excellent for {label}"`, `70–84 "Strong for {label}"`,
   `50–69 "Okay for {label}"`, `<50 "Struggles with {label}"`.

`rateBuild` returns `parts` only for categories present in the build. Returns `overall:0`,
`parts:{}` if `cpu`/`gpu` missing (the dashboard requires the core pair, same gate as today).

### `partUpgradeOptions(parts, useCase, category, catalog, limit = 5) → Option[]`
```
Option = { toPart, extraCost, newScore, fpsGain? }
```
- Candidates: catalog parts in `category` with `partLevel(cand) > partLevel(current)`,
  `checkCompatibility(parts, cand).compatible`, and `cand.price > current.price`.
- `newScore` = `rateBuild({ ...parts, [category]: cand }, useCase, catalog).parts[category].score`.
- Keep only candidates whose `newScore > current score`; sort by `extraCost` ascending; take `limit`.
- For **gaming / streaming** and `category ∈ {cpu, gpu}`: add
  `fpsGain = gameFps(next.cpu, next.gpu, res, DEFAULT_GAME, 'high') - gameFps(cpu, gpu, res, DEFAULT_GAME, 'high')`
  where `DEFAULT_GAME = gamesData.find(g => g.id === 'fortnite')` (a representative title).

## `UpgradeWizard.jsx` (reworked)

Local state machine: `screen: 'specs' | 'usecase' | 'dashboard'`, `currentParts`, `useCase`,
`savedSelectedId` (for the saved tab highlight), `openCat` (which part's upgrade panel is open),
`pickerCategory` (build-current-PC picker).

### Step 1 — Current PC (`specs`)
Keeps the Build/Saved tabs, `CategoryList` + `PartSelector` (`contextParts`/`ignoreBudget`), and
the "CPU and GPU required" gate. **Saved tab upgrade:** each saved build renders as a selectable
**card** — bordered box with name, date and total (`£{sum}`) — and the **selected card highlights
cyan** (`savedSelectedId`); selecting it loads `decodeBuild(code).parts` into `currentParts`.
Footer: one primary **`Next: use case →`** (enabled when `currentParts.cpu && currentParts.gpu`)
and `← Back to menu`.

### Step 2 — Use case (`usecase`)
The five `USE_CASES` as selectable cards (same styling as `BudgetEntry` step 2, single select).
`See ratings →` goes to the dashboard; `← Current PC` back.

### Step 3 — Ratings dashboard (`dashboard`)
- **Overall**: big `{overall}/100` number (colour-coded) + `verdict` + a thin bar.
- **Parts list** (present categories, sorted **weakest score first** so upgrade targets lead):
  each row shows `CAT_LABEL`, part name, a `{score}` badge and a bar, colour-coded
  (`<50` red / `50–79` amber / `≥80` green), and a chevron. Clicking a row toggles `openCat`.
- **Open part panel** (`openCat === cat`): renders `partUpgradeOptions(...)` as cards — new part
  name, `→ {newScore}/100`, `+£{extraCost}`, and `+{fpsGain} fps` for gaming/streaming cpu/gpu —
  each with **Apply**. Empty → *"Your {label} is already well-matched for this use."*
- **Apply(option)**: `setCurrentParts({ ...currentParts, [cat]: option.toPart })` and re-rate in
  place (dashboard updates, panel stays), so the user can keep tuning. No store writes yet.
- **Footer**: `Open in Build tab →` commits to the store:
  `enterBuildTab()`, `setBuild(currentParts)`, `setResolution(profile.resolution)`,
  `setBudget(totalOf(currentParts))`, `setLastGenerated({ upgrade:true, useCase, spend:totalOf(currentParts), budget:totalOf(currentParts) })`.
  Plus `← Use case`.

`GeneratedBanner`'s existing `info.useCase` branch already renders a use-case summary, so the
Build-tab banner works unchanged (spend == budget here, so no "under budget").

## Removed
- The two-path fork (`path`, highlight screen, Path A/B results), the game/resolution/FPS goal
  screen, the upgrade-budget slider and sort control **in the upgrade flow**.
- `src/lib/systemUpgrades.js` and `src/tests/systemUpgrades.test.js` (superseded by `partRatings`).
- `src/lib/partQuality.js` stays (used by ratings + builder). `upgradeCandidates`/`sortCandidates`
  in `upgradeAdvisor.js` stay (still used by the in-builder `UpgradeSuggestion` panel — verify with
  a grep before deleting anything; do NOT remove them).

## Testing
- **partLevel**: monotonic; min part → 0, max → 100; single-part category → 100.
- **rateBuild**:
  - CPU bottleneck behind a strong GPU → cpu score low, gpu score high (gaming).
  - Low RAM (8GB) in a strong build → ram score low for `creation`; the same RAM scores fine for
    `office` (expectation differs).
  - Balanced strong build → all scores high, overall high.
  - Overall is importance-weighted (a weak `case` barely moves it; a weak `gpu` for gaming tanks it).
  - Missing cpu/gpu → `overall:0`, `parts:{}`.
- **partUpgradeOptions**: only higher-scoring, compatible, pricier candidates; sorted by cost;
  `newScore` present; `fpsGain` present for gaming cpu/gpu, absent for office.
- **buildProfiles**: five ids; each has weights/expect/upgradeOrder/resolution; USE_CASES align.
- **Component**: specs gate (cpu+gpu) → usecase → dashboard renders overall + rows; clicking a row
  opens options; Apply swaps + re-rates; `Open in Build tab` sets store + hash `build`; saved card
  highlights on select.
- Update ripples: `BudgetEntry.test` — the old "workstation → 4k" case now clicks the **Content
  Creation** card (`creation`, still resolution 4k); update the button-name matcher, the `'4k'`
  assertion stands. `useCaseBuilder.test`: `everyday → office`. `tiers.test`: `ultimate.useCase`
  is `creation`. Delete `systemUpgrades.test.js`. Keep the rest of the suite + E2E green (the
  new-PC E2E path is unchanged — it still uses "Gaming").

## Risks / notes
- `partUpgradeOptions` calls `rateBuild` per candidate — fine for a single category's catalog slice
  (tens of parts), but memoize the dashboard's `rateBuild` in the component.
- Expectation/weight tables are the main tuning surface — pick values that make an obviously
  unbalanced build (great GPU, weak CPU) score the CPU clearly below the GPU, and validate by
  eyeballing a couple of real builds in preview (like the tier eyeball).
- Keep field names as-is (`perfScore`, `capacityGb`, `price`, `resolution`, `balancePct`, `limitedBy`).
