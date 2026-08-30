# Build-page ratings panel (Stage 1) — design

Date: 2026-07-08
Status: awaiting user review

## Overview

Move the use-case rating onto the main **Build tab** as a permanent, interactive panel that
replaces both `BottleneckIndicator` ("Bottleneck") and `GamePerformancePanel` ("How it runs").
The panel shows an **overall /100** for the chosen use case, with a header **dropdown to change
the use case live** (no rebuild), and **per-part rows** (weakest first) where each row is simply
*part → score → a dropdown of improvement options*. Selecting an option **swaps that component
live**, so the part boxes below (and the 3D + the overall score) update immediately.

The Upgrade-your-PC flow drops its standalone ratings **dashboard** screen and lands on the Build
tab like the new-PC flow does. The desktop Build layout widens so the 3D model and panels use more
of the screen.

**No restyle.** Reuse the existing visual language — `PANEL` (`bg-slate-950/30 … rounded-sm`),
cyan/slate tokens, `TELEMETRY` mono numbers. Components are relocated, not redesigned; the box and
colours stay identical to the panels they replace.

## Non-goals / out of scope (Stage 1)

- **Auto-build use-case awareness + variety** — Stage 2.
- **"Spend the leftover" fix** — Stage 2.
- No change to Peripherals / Summary / Saved. Mobile Build stays a single stacked column.
- **FPS logic stays in the repo, unrendered** — `gameFps`, `GamePerformanceList`,
  `GamePerformancePanel` are kept for a future standalone FPS panel; they're just no longer
  rendered on the Build tab.
- No new rating math — reuse `rateBuild` / `partUpgradeOptions` / `partSynergy` as-is.
- No new persistence schema beyond one added field, no TypeScript migration, no live pricing.
  Keep field names as-is (`perfScore`, `capacityGb`, `price`, `resolution`, `useCase`).

## Store — `useCase` becomes first-class

`src/store/useBuilderStore.js`:
- Add `useCase: 'gaming'` and `setUseCase: (useCase) => set({ useCase })`.
- Add `useCase` to `partialize` (persists alongside `resolution`), so a returning user keeps the
  use case their build was rated for.

Both entry flows write `useCase` on entry; the panel reads it and mutates it via the header
dropdown.

## `src/components/BuildRatingPanel.jsx` (new)

Reuses `PANEL`, `TELEMETRY`, the cyan/slate palette and `rounded-sm` — visually identical box to
the ones it replaces.

**Store reads:** `selectedParts`, `useCase`, `resolution`; **actions:** `setUseCase`, `addPart`.
**Catalog:** `parts` (and `games` for the representative FPS title). Memoize
`rateBuild(selectedParts, useCase, partsData)` keyed on `[selectedParts, useCase, partsData]`.

**Header row:** a `Rating` label + a `<select>` of `USE_CASES` (same select styling as the
wizard's game picker), value = `useCase`, `onChange` → `setUseCase`. Changing it re-rates live.

**Overall:** `{overall}/100` colour-coded (`scoreText`: `≥80` emerald / `≥50` amber / else red) +
`verdict`. Reuse the `scoreText` / `scoreBar` helpers currently inline in `UpgradeWizard`
(lift them into a tiny shared spot, or copy — implementer's call).

**Empty state** (no `cpu` or `gpu`, i.e. `rateBuild` returns `overall:0`, `parts:{}`):
*"Add a CPU and GPU to rate your build."*

**Per-part rows** — `Object.entries(rating.parts)` sorted weakest score first. Each row shows,
on one line: `CAT_LABEL`, part name (truncating), a thin score bar + score number, and an
**improvement `<select>`**:
- Options from `partUpgradeOptions(selectedParts, useCase, cat, partsData, { game })`.
- First option is a **disabled placeholder** (`value=""`) labelled `Upgrade…` (or the current part
  name) — it's what shows when nothing is chosen.
- Each real option: `value = toPart.id`, label = `{toPart.name} → {newScore} (+£{extraCost})`,
  with `· +{fpsGain} fps` appended when `fpsGain != null` (gaming/streaming cpu/gpu).
- `onChange`: resolve the chosen option by `toPart.id`, then `addPart(cat, option.toPart)`. The
  store update re-renders the parts list, the 3D and the rating; the select resets to its
  placeholder (the row now reflects the new, higher score with its own fresh options).
- When `partUpgradeOptions` is empty → render the select **disabled** with a single
  `Best available` option.
- Weak-link `reason` (from `rateBuild`) shows as a small amber line under the row — this is what
  carries the balance/bottleneck message, so the separate Bottleneck box is no longer needed.

The bar's dynamic `style={{ width }}` is the one intentional inline style (allowed under the CSP).

## Build layout — `src/screens/BuilderScreen.jsx` + `src/index.css`

- **Widen the container:** extend `max-w-2xl lg:max-w-6xl` with a wider step at very large widths
  (e.g. `2xl:max-w-[88rem]`) so the model and panels reach toward the screen edges instead of
  floating in a narrow centred column.
- **Grid areas:** replace the `bottleneck` + `perf` rows with a single `rating` area in the left
  column; give the viz column more of the width (`grid-template-columns: minmax(0,1fr)
  minmax(0,1.5fr)`).
- Render `<BuildRatingPanel />` in `area-rating`; **remove** `<BottleneckIndicator />` and
  `<GamePerformancePanel />` from the Build view (drop their imports here).
- **Mobile unchanged:** the grid is still a flex column below `lg`; the rating panel appears where
  the Bottleneck box used to (child DOM order preserved), so mobile is a pure relocation.
- Preserve the `relative z-10 transform-gpu` compositing wrapper and the `.build-grid > *` z-index
  rules over the WebGL canvas (documented gotcha) — verify at the new max width.

## Upgrade flow — `src/components/UpgradeWizard.jsx`

- **Remove** the `dashboard` screen and everything only it used: `openCat`, the rows render, the
  inline `partUpgradeOptions` call, and the `scoreText`/`scoreBar`/`CAT_LABEL` helpers now living
  in the panel. Keep the `rateBuild`/`partUpgradeOptions` imports only if still referenced (they
  won't be — the panel owns them now).
- **Screens:** `specs → usecase`. Breadcrumb becomes `Current PC → Use case`.
- Step 2's button changes from `See ratings →` to **`Open in Build →`**, doing exactly what the
  new-PC flow does on generate:
  ```
  setUseCase(useCase)
  enterBuildTab()
  setBuild(currentParts)
  setStoreResolution(profile.resolution)
  const spend = totalOf(currentParts)
  setLastGenerated({ upgrade: true, useCase, spend, budget: spend })
  setBudget(spend)   // flips App → BuilderScreen on the Build tab
  ```
- Keep step 1 (Build / Saved tabs, highlightable saved-build cards, cpu+gpu gate) and step 2
  (use-case cards) unchanged.

## New-PC flow — `src/components/BudgetEntry.jsx`

Add a `setUseCase` store write in the three entry paths so the panel opens on the right use case:
- `generate()` → `setUseCase(useCase)`.
- `applyTier(tier)` → `setUseCase(tier.useCase)`.
- `startEmpty()` → `setUseCase(useCase)`.

No other change to this component.

## Removed from the Build page (files kept in repo)

`BottleneckIndicator`, `ResolutionToggle` (it lived inside the Bottleneck box; resolution now
follows the use-case profile), `GamePerformancePanel`, `GamePerformanceList` — no longer imported
by `BuilderScreen`. The files and their unit tests remain. `UpgradeSuggestion` (the existing
single-FPS-suggestion strip) **stays for now**; it overlaps the new panel and is a retire candidate
for Stage 2.

## Testing

- **store:** `useCase` defaults to `gaming`; `setUseCase` updates it; it survives a persist
  round-trip (in `partialize`).
- **BuildRatingPanel:** with a cpu+gpu build renders the overall `/100` and one row per present
  part; empty state without a core pair; changing the header use-case `<select>` changes the
  overall/verdict; a part row's improvement `<select>` lists options and `onChange` calls
  `addPart(cat, toPart)` (assert the store's `selectedParts[cat]` swapped); disabled `Best
  available` when no options exist.
- **UpgradeWizard:** specs gate (cpu+gpu required) → use case → `Open in Build →` sets
  `useCase` / `selectedParts` / `budget` / `resolution` and hash `#build`; no dashboard screen
  remains. Rewrite/trim the current dashboard-focused test.
- **BudgetEntry:** `generate` / a quick-start tier / `Start empty` each set the store `useCase`.
- **BuilderScreen:** renders `BuildRatingPanel`; the "Bottleneck" and "How it runs" headings are
  gone from the Build view.
- Keep the full unit suite + Playwright E2E green. **E2E:** after generating a build, assert the
  rating panel is visible on the Build tab (e.g. the `/100` overall, or the `Rating` label). The
  new-PC entry path itself is unchanged.

## Risks / notes

- `rateBuild` / `partUpgradeOptions` recompute on render — memoize `rateBuild` in the panel; the
  per-row `partUpgradeOptions` is a single category slice (tens of parts), cheap enough per open
  row, but compute it once per render into a map rather than inside JSX callbacks.
- The improvement `<select>` uses `toPart.id` as the option value; keep the option list in scope so
  `onChange` can resolve the chosen `toPart` (the label needs `newScore`/`extraCost`/`fpsGain`; the
  apply needs `toPart`).
- `rateBuild` keys its cpu/gpu balance off `profile.resolution`, not the stored `resolution`, so the
  removal of the manual `ResolutionToggle` does not change any score. Resolution is still set from
  the profile on entry (kept for the future FPS panel).
- Widening must not break the WebGL compositing layer — verify panels aren't painted under the
  canvas at the new `2xl` width (mobile + desktop eyeball, see [[webgl-verification-gotchas]]).
- This is Stage 1 of two. Stage 2 (auto-build use-case awareness + variety, "Spend the leftover"
  fix) gets its own spec → plan cycle.
