# Phase 2 — Smart Build Assistance — Design

**Date:** 2026-06-16
**Status:** Approved (pending spec review)
**Part of:** the 4-phase roadmap. Phase 2 of 4 (after persistence & sharing). Each phase is its own spec → plan → build.

## Goal

Make the builder *smart*: one-click auto-build a balanced, compatible build for a budget; offer quick-start presets; and warn about real build problems (under-sized PSU, missing essentials). All driven by the existing catalog and compatibility engine — no new data files.

## Architecture

One pure engine surfaced three ways:
- `autoBuilder.js` — generates a complete `{category: part}` build.
- `presets.js` + BudgetEntry chips — call `autoBuild` at fixed budget/resolution targets.
- `buildWarnings.js` — a separate pure health-check rendered in a small card.

Pure logic (`autoBuilder`, `buildWarnings`, `presets`) is isolated and unit-tested; components are thin.

## Feature 1 — Auto-build engine (`src/lib/autoBuilder.js`, pure)

`autoBuild(selectedParts, budget, partsData, resolution)` → a complete `{ category: part }` map (existing picks kept, empty slots filled).

**Budget weights** (fraction of budget per category, base for 1440p):

```
cpu 0.18, gpu 0.32, motherboard 0.11, ram 0.08, storage 0.07,
psu 0.07, case 0.08, cooler 0.06, fans 0.03
```

Resolution-aware shift: `4k` moves 0.06 from cpu→gpu (cpu 0.12 / gpu 0.38); `1080p` moves 0.04 from gpu→cpu (cpu 0.22 / gpu 0.28); `1440p` uses base.

**Algorithm:**
1. `remaining = budget − Σ(price of already-selected parts)`.
2. Allocate `remaining` across the **empty** categories, proportional to their weights renormalised over the empty set → a £ `slice` per category.
3. Fill empty categories in **dependency order**: `cpu → gpu → motherboard → ram → cooler → case → storage → fans → psu`. For each:
   - `candidates` = catalog parts of that category where `checkCompatibility(currentSelection, part).compatible` is true.
   - `affordable` = candidates with `price ≤ slice` (fallback: `price ≤ remaining`; final fallback: cheapest candidate overall).
   - **Choose:** CPU/GPU → highest `perfScore` (tie → lower price). Supporting parts *except PSU* → cheapest compatible (keeps spend off non-perf parts). PSU → sized per step 4.
   - Add it; subtract its price from `remaining`.
4. **PSU** (filled in step 3's order, last): cheapest PSU with `wattage ≥ draw × 1.3`; if none affordable, cheapest with `wattage ≥ draw`; else cheapest available.
5. **Spend leftover:** while `remaining` is comfortable, upgrade GPU then CPU to the next-higher-`perfScore` compatible part that still fits `remaining` (reuses the "best affordable upgrade" idea), so a large budget isn't left unspent.

Deterministic (no randomness) → testable. Returns the merged map; the store's new `setBuild(map)` action applies it.

## Feature 2 — Build health warnings (`src/lib/buildWarnings.js`, pure)

`getBuildWarnings(selectedParts)` → `[{ level: 'critical' | 'warning', message }]`, critical first.

- **PSU** (`draw = Σ tdp`):
  - `draw > 0` and no PSU → critical: "Add a PSU — the build draws {draw}W with no power supply."
  - PSU and `draw ≥ wattage` → critical: "PSU too small — {draw}W draw meets or exceeds the {wattage}W supply."
  - PSU and `draw > 0.8 × wattage` → warning: "Low PSU headroom — {draw}W of {wattage}W (aim under 80%)."
- **Missing essentials** (only once a CPU or GPU is present):
  - CPU and no motherboard → warning "Add a motherboard."
  - CPU and no cooler → warning "Add a CPU cooler."
  - CPU and no RAM → warning "Add RAM."
  - (CPU or GPU) and no case → warning "Add a case."
  - (CPU or GPU) and no storage → warning "Add storage."

Rendered by `BuildWarnings.jsx` — a compact `PANEL` card listing each warning with a status dot (critical = red, warning = amber). Renders `null` when there are no warnings.

## Feature 3 — UI surfaces

- **Auto-build button** (`src/components/AutoBuildButton.jsx`) — an "⚡ Auto-build" button in the build view, under the view tabs. `onClick` → `setBuild(autoBuild(selectedParts, budget, partsData, resolution))`. Disabled when `budget ≤ 0`.
- **Presets** (`src/lib/presets.js` + BudgetEntry chips) — `PRESETS = [{ label, budget, resolution }]`: `1080p · £700`, `1440p · £1200`, `4K · £2500`. A chip sets resolution, runs `setBuild(autoBuild({}, budget, partsData, resolution))`, and submits the budget — landing the user in the builder with a finished build in one click.
- **Warnings card** (`BuildWarnings.jsx`) — mounted in the build view; appears only when there are warnings.

## Store change

Add one action to `useBuilderStore`: `setBuild: (parts) => set({ selectedParts: parts })` (bulk-replace selected parts with an auto-built map). Persisted like any other state change.

## Files

| File | Change |
|---|---|
| `src/lib/autoBuilder.js` | New — `autoBuild` (pure) |
| `src/lib/buildWarnings.js` | New — `getBuildWarnings` (pure) |
| `src/lib/presets.js` | New — `PRESETS` list |
| `src/components/AutoBuildButton.jsx` | New — auto-build CTA |
| `src/components/BuildWarnings.jsx` | New — warnings card |
| `src/store/useBuilderStore.js` | Add `setBuild` action |
| `src/components/BudgetEntry.jsx` | Add preset chips |
| `src/screens/BuilderScreen.jsx` | Mount AutoBuildButton + BuildWarnings in the build view |

## Testing

- `autoBuilder.test.js` — from empty + a generous budget: result fills all 9 categories, every pair is compatible (CPU/mobo socket, RAM/mobo type, cooler socket, case form factor, GPU length ≤ case clearance, `psu.wattage ≥ draw`), and total `≤ budget`. Respects an existing pick (pass an LGA1700 CPU → it's kept and the motherboard is LGA1700). A tight budget still returns a complete, compatible build.
- `buildWarnings.test.js` — CPU+GPU with no PSU → a critical PSU warning; under-sized PSU → critical "too small"; a complete balanced build with ample PSU → no critical warnings; CPU without a cooler → an "Add a CPU cooler" warning.
- `BuildWarnings.test.jsx` — renders the messages; renders nothing when there are no warnings.
- Auto-build button + presets verified in the dev-server preview (click a preset → lands in builder with a full build; click Auto-build on a partial build → fills the gaps).

## Edge cases

- Budget too low for a complete build → fills cheapest compatible parts (may exceed budget; the over-budget total shows red and warnings flag the PSU). The build is still complete and compatible.
- A category with no compatible candidate (shouldn't happen with the full catalog) → left empty; warnings may flag it.
- Auto-build is deterministic — same inputs always yield the same build.

## Non-goals

- No new catalog fields (no cooler cooling-capacity, RAM-speed support, or case cooler-height data — so no warnings that would require them).
- No per-game targets, responsive, or SEO (Phases 3–4).
- Presets are generated, not hand-curated (decided during brainstorming).
