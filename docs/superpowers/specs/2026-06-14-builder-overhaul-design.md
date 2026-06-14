# Builder Overhaul — Design Spec
**Date:** 2026-06-14
**Builds on:** Phase 1 + 3D models

---

## Overview

A major enhancement pass on the CustomPc builder, grouped into three independently-shippable chunks built in order:

- **Chunk A — Builder UX & State:** orbit ring becomes a full build manager (deselect, recommended order), editable budget, modern interactive polish.
- **Chunk B — Data & 3D Fixes:** large curated parts catalog, new Case Fans category, search + smarter filtering in the selector, GPU layout-bug fix, case transparency toggle.
- **Chunk C — Bottleneck Calculator:** resolution-aware CPU↔GPU balance check with real-world-seeded performance scores.

Constraint acknowledged: there is no free, reliable live parts-data API for a static site, so the catalog is a **large curated static snapshot** of real parts/UK prices (refreshable by editing the data), not a live feed.

---

## Chunk A — Builder UX & State

### OrbitRing as build manager
The ring shows **all 9 categories** (currently it hides selected ones):
- **Empty slot** → a "+ Category" button. The **recommended-next** category glows/pulses.
- **Filled slot** → shows the chosen part's name + price and an **✕ deselect** control. Deselecting calls `removePart`, frees the budget, and re-opens the slot.
- Each slot shows an **order badge** (see recommended order below). Picking in any order is still allowed; badges + glow only guide.

### Recommended order
A pure module `src/lib/recommendedOrder.js` exports the constant `RECOMMENDED_ORDER`:
`motherboard → cpu → cooler → ram → gpu → storage → psu → case → fans`
and a helper `nextRecommended(selectedParts)` that returns the first category in that order with no part selected. `OrbitRing` uses it to highlight the next slot.

### Editable budget
The top-bar budget figure becomes **click-to-edit**: click the £ amount → inline number input → Enter/blur commits via the existing `setBudget`. Remaining budget and the bars recompute live. Reducing the budget below current spend turns "remaining" red (already handled).

### Modern / interactive polish
- Smooth transitions when parts snap into the 3D scene and when ring slots change state
- Hover states + subtle glow on the recommended slot
- Animated bar fills (already present) carried through
- Cleaner top bar and a more refined part-selector card layout

### State changes (`useBuilderStore`)
- Reuse existing `budget`, `setBudget`, `selectedParts`, `addPart`, `removePart`
- Add `resolution` (Chunk C) and `caseTransparent` (Chunk B) — see those chunks
- The recommended-order logic lives in the pure `src/lib/recommendedOrder.js` (not the store)

---

## Chunk B — Data & 3D Fixes

### Large curated catalog
Expand `partsData.json` to **~12–18 real options per category** (~120+ parts total) at real UK prices, covering budget → mid → high-end. CPUs and GPUs also get a `perfScore` (Chunk C). This is a static snapshot, refreshable by editing the file.

### New category: Case Fans (`fans`)
- 9th category. Universally compatible (no socket/form-factor locks) — contributes price + a small TDP only.
- Options from a single budget fan to RGB 3-packs.
- Gets a 3D model (`FansModel` — fan frame + blades), a registry entry, an assembly position, a category icon, and a place in `RECOMMENDED_ORDER` (last).

### Selector: search + smarter filtering (`PartSelector`)
- **Search bar** per category: filters the list by case-insensitive name match.
- **70%-of-budget rule:** by default, hide any part whose price exceeds **70% of the total budget** (anti-overspend).
- **Hide incompatible by default:** the default view shows only compatible, affordable parts to cut clutter.
- **Search reveals everything:** when a search query is present, matching parts are shown regardless of compatibility or the 70% rule — incompatible ones rendered greyed with their reason, so they're findable but clearly marked.

### Fix GPU-under-motherboard bug
In `assemblyLayout.js`, the GPU currently mounts at negative Y and clips under the PCB. Reposition so the GPU sits **visibly in the PCIe slot region**, not hidden beneath the board, and audit every category's mount position so nothing overlaps or disappears. Update the `assemblyLayout` tests to lock in the corrected relationship (GPU visible relative to board, not under it).

### Case transparency toggle
- Store flag `caseTransparent` (default `true`) with `toggleCaseTransparency`.
- A switch in the builder UI flips it.
- `CaseModel` reads the flag: **transparent** (opacity ~0.12, see internals) vs **solid** (opacity ~0.9, see the exterior look).

---

## Chunk C — Bottleneck Calculator

### Performance scores
Each CPU and GPU carries a `perfScore` in the data, seeded from **real-world relative benchmark performance** (normalized within its category so the strongest ≈ 100).

### Resolution selector
Store field `resolution` ∈ `{ '1080p', '1440p', '4k' }` (default `1440p`) with `setResolution`. A toggle in the UI sets it. Lower resolution weights the CPU more; higher weights the GPU more.

### The calculation (`src/lib/bottleneck.js`, pure + unit-tested)
`computeBottleneck(cpu, gpu, resolution) → { balancePct, limitedBy, verdict }`
- Returns `null`/neutral when CPU or GPU is missing.
- Applies resolution weighting to the two `perfScore`s, compares them, and yields:
  - `balancePct` (100 = perfectly matched)
  - `limitedBy` ∈ `{ 'cpu', 'gpu', 'none' }`
  - `verdict` — plain-English, e.g. "Well matched for 1440p", "CPU can't keep up — GPU is overkill at 1080p", "GPU is holding the CPU back at 4K"

### Bottleneck indicator (UI)
A compact indicator (balance bar + verdict text) in the top bar / a small panel, updating live as CPU, GPU, or resolution change. This is the anti-overspend guardrail.

---

## Architecture & New Files

| File | Responsibility |
|---|---|
| `src/lib/bottleneck.js` | Pure bottleneck calc |
| `src/lib/recommendedOrder.js` | `RECOMMENDED_ORDER` constant + helpers |
| `src/components/BottleneckIndicator.jsx` | Balance bar + verdict UI |
| `src/components/ResolutionToggle.jsx` | 1080p/1440p/4K selector |
| `src/components/CaseToggle.jsx` | Transparency switch |
| `src/components/models/FansModel.jsx` | Case fans 3D model |
| `src/components/SearchBar.jsx` | Reusable search input for the selector |
| Modified: `OrbitRing`, `PartSelector`, `TopBar`, `BuildCanvas`, `CaseModel`, `assemblyLayout.js`, `useBuilderStore.js`, `partsData.json`, `partModelRegistry.js`, `compatibility.js` (fans = always compatible) |

---

## Testing

- **Pure logic, unit-tested:** `bottleneck.js`, `recommendedOrder.js` (`selNextRecommended`), the 70%-budget filter and search filter (extracted as pure helpers), `assemblyLayout.js` (updated GPU position), `compatibility.js` (fans always compatible). Existing 33 tests stay green.
- **UI + 3D:** verified via `vite build` + manual browser check (no WebGL unit tests).

---

## Build Order

**A → B → C.** Each chunk leaves the app working and deployable. Per project preference, work is committed locally but **not pushed/deployed** until explicitly requested.

---

## Out of Scope

- Live/real-time parts pricing (no free data source; catalog is a curated snapshot)
- Brand-accurate 3D models
- Phases from the original roadmap not listed here (upgrade tools, game recommendations, exterior devices, SEO)
