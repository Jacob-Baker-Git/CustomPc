# Entry flows + desktop Build layout — design

Date: 2026-07-06
Status: awaiting user review

## Overview

Four related changes to the CustomPc app's entry experience and desktop layout:

1. A **main menu** landing screen with two paths: *Build a new PC* and *Upgrade your PC*.
2. A **desktop-only Build-tab layout** that uses the horizontal space (3D on the right, bottleneck + how-it-runs on the left, parts full-width below). Mobile is untouched.
3. A new **Upgrade your PC** flow: enter your current rig, pick an FPS goal, get ranked upgrade suggestions you can apply and view in the Build tab.
4. A **bug fix**: after the wizard, always land on the Build tab (today a stale URL hash can drop you on Summary).

All four reuse existing components and the existing visual language (dark theme, cyan accent, `PANEL` box styles). No restyle — only new arrangement and new screens built from the same tokens.

## Non-goals / out of scope

- No change to the mobile layout of the Build tab (user confirmed mobile is fine).
- No change to Peripherals / Summary / Saved layouts (they keep the centered `max-w-2xl` column at all widths).
- No multi-part upgrade recommendations — CPU/GPU swaps only (user decision).
- No new persistence schema for saved builds; the upgrade flow reads the existing `useSavedStore`.
- No TypeScript migration, no live pricing — unchanged from prior deferrals.

---

## Feature 1 — Routing & main menu

### Current state
`App.jsx`: `if (!budget) return <BudgetEntry onSubmit={setBudget} />; return <BuilderScreen />`. The wizard *is* the landing screen. TopBar's back arrow does `setBudget(0)`, which re-shows the wizard ("build is kept").

### Change
Add a transient `flow` field to `useBuilderStore` (NOT persisted — excluded from `partialize`):

```
flow: 'menu' | 'new' | 'upgrade'   // default 'menu'
setFlow: (flow) => set({ flow })
```

`App.jsx` renders:

```
if (budget > 0) return <BuilderScreen />
if (flow === 'new')     return <BudgetEntry onSubmit={setBudget} onBack={() => setFlow('menu')} />
if (flow === 'upgrade') return <UpgradeWizard onBack={() => setFlow('menu')} />
return <MainMenu onNew={() => setFlow('new')} onUpgrade={() => setFlow('upgrade')} />
```

Because `flow` is not persisted, a returning user with `budget > 0` goes straight to the builder; a fresh visit (or after pressing "home") shows the menu.

### `MainMenu.jsx` (new)
- Full-screen, `Backdrop`, same dark background as `BudgetEntry`.
- Title ("Build Your PC") + two large selectable cards, matching the wizard's card styling (border, cyan hover, `rounded-sm`):
  - **Build a new PC** — "Start from your budget and build up." → `onNew()`.
  - **Upgrade your PC** — "Tell us your current rig and goal." → `onUpgrade()`.
- Icons via existing lucide usage.

### TopBar back arrow
`onClick={() => { setBudget(0); setFlow('menu') }}`. Re-label the title/aria to "Back to menu (your build is kept)".

### Wizard back controls
`BudgetEntry` step 1 gains a "← Back to menu" link calling `onBack()`. `UpgradeWizard` step 1 has the same.

---

## Feature 2 — Desktop Build-tab layout

### Current state
`BuilderScreen.jsx` renders one stacked Build view at all widths: canvas `h-[42vh] md:h-[48vh]` on top, then a centered `max-w-2xl` column (`GeneratedBanner`, `CategoryList`, `BottleneckIndicator`, `GamePerformancePanel`, `BuildWarnings`, `UpgradeSuggestion`, `AutoBuildButton`).

### Change
Introduce a `lg`-and-up layout for the **Build view only**. Below `lg`, markup is unchanged (identical classes → identical mobile/tablet render). At `lg`:

- Two-column grid inside the existing `relative z-10 transform-gpu` wrapper (keep the compositing-layer fix), roughly `lg:grid-cols-[1fr_1.4fr]`:
  - **Left**: `BottleneckIndicator`, then `GamePerformancePanel`.
  - **Right**: the 3D canvas block (`CanvasErrorBoundary` → `BuildCanvas`), taller on desktop (e.g. `lg:h-[60vh]`), with `InfoDisclaimer` and the `CaseToggle` overlay as today.
- **Full-width row below** the two columns (spans both): `GeneratedBanner` (top), `CategoryList` in 2-column grid mode, then `BuildWarnings`, `UpgradeSuggestion`, `AutoBuildButton`.
- A desktop max width wider than `max-w-2xl` (e.g. `lg:max-w-6xl`) so the columns have room; mobile keeps `max-w-2xl mx-auto`.

The canvas must remain inside the single scroll container so the tabs still scroll away (no floating chrome) and the compositing fix holds.

### `CategoryList.jsx`
Add an optional prop (e.g. `columns={1}` default, `columns={2}` on desktop) that switches the list wrapper to a 2-column grid (`sm:grid-cols-2` style) without changing row markup. Existing single-column callers unaffected. Only the Build view passes `columns={2}` at `lg` (via a responsive wrapper or a prop derived from a matchMedia-free CSS grid — prefer pure CSS grid so no JS breakpoint hook is needed).

### Tabs / other views
The tab bar and the Peripherals/Summary/Saved views are unchanged.

---

## Feature 3 — Upgrade your PC

New `UpgradeWizard.jsx` (may be split into small sub-components if it grows). Local component state holds a scratch build and goal; nothing touches `useBuilderStore` until the user applies an upgrade.

### Step 1 — Current PC
A tab toggle:
- **Build current PC**: full 10-category picker reusing `CategoryList` + `PartSelector` against a local `currentParts` object (same add/remove UX as the builder, but writing to local state, not the store).
- **Select saved build**: list from `useSavedStore().saved`; each row → `decodeBuild(code).parts` loaded into `currentParts` (and its `resolution` pre-fills step 2).

Continue is enabled once `currentParts.cpu` **and** `currentParts.gpu` exist. Other parts are optional; when present they feed `checkCompatibility` so incompatible swaps are filtered.

### Step 2 — Goal
Game selector + resolution + target FPS, reusing the wizard's step-3 pattern (`gamesData`, resolution options incl. custom, FPS presets + custom box). Produces `{ game, resolution, targetFps }`.

### Step 3 — Budget & filter
- **Upgrade-budget slider**: range from £0 to a sensible max (e.g. £2000 or catalog-derived), default mid-range. This caps `extraCost`.
- **Sort control**: price-per-FPS (default), biggest FPS gain, lowest cost.
- Candidates that meet the goal and that fix the current bottleneck get badges.

### Results
Ranked list of candidate CPU/GPU swaps from `upgradeCandidates(...)`. Each card: category, current → new part, `+N FPS` in the chosen game at the resolution, `+£cost`, `£X/FPS`, and goal/bottleneck badges. Empty state when nothing within budget beats the current parts.

**Apply**: 
- `setBuild({ ...currentParts, [category]: toPart })`
- `setResolution(goal.resolution)` (+ `setCustomResolution` if custom)
- `setBudget(currentTotal + upgradeBudget)` where `currentTotal = sum(currentParts prices)` (user decision)
- `setLastGenerated({ ... })` for the Build-tab banner summary
- set `window.location.hash = 'build'`, then `setBudget(...)` triggers `App` → `BuilderScreen` on the Build tab.

### Advisor: `upgradeCandidates` (new, in `upgradeAdvisor.js`)
```
upgradeCandidates(currentParts, { game, resolution, targetFps, budget }, catalog) → Candidate[]
```
- Iterate `['cpu','gpu']` (reuse the existing `UPGRADEABLE`), keep candidates with higher `perfScore`, `extraCost <= budget`, and `checkCompatibility` true.
- For each, compute `resultFps = gameFps(nextCpu, nextGpu, resolution, game, quality)` and `fpsGain = resultFps - baseFps`; drop gains `< MIN_GAIN`.
- Return objects: `{ category, fromPart, toPart, fpsGain, extraCost, resultFps, pricePerFps, meetsGoal, fixesBottleneck }`.
- Sorting/filtering by budget + sort key happens in the component; the function returns the full compatible set (or accepts a sort key — decide in the plan). The existing `suggestUpgrade` single-result helper is untouched (still used by the in-builder `UpgradeSuggestion` panel).
- `fixesBottleneck` derived from the existing `bottleneck.js` on current vs. resulting parts.

---

## Feature 4 — Always land on Build after a wizard

### Root cause
`useHashView` initializes from `window.location.hash` on mount. A prior session left on `#summary`/`#saved` persists in the URL, so entering the builder restores that tab instead of Build. Manifests most on mobile where the user reported it.

### Fix
Every path that enters the builder from a wizard/menu sets `window.location.hash = 'build'` immediately before the `budget`-setting call that swaps `App` to `BuilderScreen`. Covers `BudgetEntry` (`enterBuilder`, `startEmpty`, `applyTier`) and `UpgradeWizard` apply. A tiny shared helper (e.g. `enterBuildTab()` in the store or a util) keeps it DRY. Intentional tab deep-linking still works via `useHashView`.

---

## Testing

- **Routing**: `App` shows `MainMenu` at `budget===0 && flow==='menu'`; `flow` transitions render the right wizard; `budget>0` renders builder.
- **MainMenu**: both cards call the right callbacks.
- **UpgradeWizard**: CPU+GPU gate; saved-build load path; apply sets store correctly (`selectedParts`, `budget = currentTotal + upgradeBudget`, `resolution`, hash `build`).
- **`upgradeCandidates`**: ranking, budget cap, compatibility filtering, `meetsGoal`/`fixesBottleneck` flags, empty result.
- **CategoryList**: 2-column mode renders a grid; default stays single-column.
- **Hash fix**: entering the builder forces `#build` even when hash was `#summary`.
- Keep the existing 264 unit tests + Playwright E2E green. Update the E2E if the entry path changed (it now starts at the menu → "Build a new PC").

## Risks / notes

- The Playwright wizard E2E (`e2e/wizard.spec.js`) will need a leading "Build a new PC" click.
- Desktop layout must preserve the `relative z-10 transform-gpu` compositing layer over the WebGL canvas (documented gotcha) — verify content isn't painted under the canvas at `lg`.
- Prefer pure CSS responsive grid for the desktop layout (no `useIsMobile`-style hook — that subsystem was deliberately deleted).
- Keep field names as-is (`price`, `tdp`, `perfScore`, `length`, `resolution`) per project conventions.
