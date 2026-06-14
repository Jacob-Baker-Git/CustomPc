# Tower Case Realism + No-Cost Feature Batch — Design Spec
**Date:** 2026-06-14
**Builds on:** Phase 1, 3D models, builder overhaul (A/B/C), realism + UI overhaul (D/E/F/G)

---

## Overview

Two themes in one spec: (1) fix the 3D build so it reads as a real **tower** with a glass side window and the motherboard mounted on a panel (the "this looks wrong" fix), and (2) begin adding **no-cost features** that run entirely on the existing static catalog — no APIs, no live pricing, nothing that costs money.

Four chunks, continuing the existing A–G scheme:

- **Chunk H — Tower case + glass window + mounted motherboard:** replace the near-cube case with mid-tower proportions, rebuild the case from individual panels so "solid" mode shows a tinted tempered-glass side window, mount the motherboard flush against the rear interior panel, and declutter/retune the assembly + camera.
- **Chunk I — Performance insights:** pure `estimateFps` and `valuePerPound` helpers + a glass Performance panel (estimated FPS at the selected resolution, build value).
- **Chunk J — Upgrade My PC:** pure `suggestUpgrade` helper + a suggestion card recommending the single highest-FPS-gain affordable, compatible swap.
- **Chunk K — Peripherals / exterior tab:** a separate static catalog (monitor/keyboard/mouse/headset) with its own tab, store slice, and subtotal — kept out of the 3D scene, compatibility, and bottleneck logic.

**Build order: H → I → J → K.** Each chunk leaves the app working. Commit locally; **do not push/deploy** until the user asks (per project preference).

---

## Chunk H — Tower Case + Glass Window + Mounted Motherboard

### Tower geometry
Replace the near-cube case (`3.2 × 3.0 × 3.2`) with mid-tower proportions: **taller than wide, depth ≈ height** — target ~`3.0 W × 4.4 H × 3.6 D`, tuned live. Height > width is what makes it read as a tower rather than a box.

### Panelized case (key structural change)
Rebuild `CaseModel.jsx` from **6 individual panels + thin corner rails** instead of one `side=2` box. This is what makes a real window possible:

- **Solid mode** (`caseTransparent === false`): five opaque dark-metal panels (top, bottom, back, front bezel, far side) + **one tinted tempered-glass side panel** on the camera-facing side. Glass = semi-transparent dark tint (~0.2–0.3 opacity, low roughness) so the build is visible *through the window*, like a real case.
- **Open mode** (`caseTransparent === true`): solid panels drop to a faint frame/skeleton (the current "see everything" view) so nothing occludes the parts.

The existing `CaseToggle` + `caseTransparent` store flag are reused unchanged; only `CaseModel`'s rendering changes.

### Motherboard mounted on the panel
Today the board floats at the origin (dead-center). Push the whole component assembly toward the **rear interior panel** so the motherboard PCB sits flush against the back wall (small realistic standoff gap), with components facing forward toward the glass window — exactly how you'd view a real build through the side panel.

### Declutter + camera
Re-tune each part's `position`/`rotation` in `assemblyLayout.js` so RAM, cooler, GPU, PSU, and storage sit cleanly inside the tower with breathing room (no overlap/clutter). Adjust `BuildCanvas` camera position and lighting so the upright tower is centered, framed, and well-lit.

### What is and isn't testable
3D appearance can't be unit-tested (no WebGL in jsdom). The unit-tested invariants stay: `assemblyLayout` returns a `{ position, rotation }` for every category, and the GPU remains visible (non-degenerate transform). Looks are verified live on the dev server via screenshots.

---

## Chunk I — Performance Insights (FPS + Value)

### `src/lib/fpsEstimate.js` — `estimateFps(cpu, gpu, resolution) → number`
Pure, unit-tested. Transparent heuristic on the 0–100 `perfScore` scale:

```
RES_GPU = { '1080p': 2.0, '1440p': 1.5, '4k': 0.95 }   // fps per GPU perf point
RES_CPU = { '1080p': 2.4, '1440p': 2.2, '4k': 2.0 }    // CPU frame ceiling factor
gpuFps  = gpu.perfScore * RES_GPU[res]
cpuCeil = cpu.perfScore * RES_CPU[res]
fps     = round(min(gpuFps, cpuCeil))
```

Tuning intent (verified by tests): a top GPU (perfScore 100) lands ~200 / 150 / 95 fps at 1080p / 1440p / 4K; a weak CPU correctly caps low-resolution FPS (the `min` mirrors the existing bottleneck model). Returns `0` (or `null`) if either part is missing. Constants chosen so reference points land in believable ranges; the resolution key normalizes `'4K'`/`'4k'` like `bottleneck.js`.

### `src/lib/valueScore.js`
Pure, unit-tested:
- `valuePerPound(part) → number` — `perfScore` per £100 (`perfScore / (price / 100)`), guarding divide-by-zero.
- A build-level value: gaming score (e.g. estimated 1440p FPS, or a CPU/GPU `perfScore` blend) per £100 of total build cost.

### UI
- A glass **Performance panel** (overlay in `BuilderScreen`) showing estimated FPS at the currently selected resolution (reuses `ResolutionToggle` / the `resolution` store value) and the build value figure. Always labelled **"estimated."**
- Optional value badge on CPU/GPU cards in `PartCard`/`PartSelector`.

Shows only when both a CPU and GPU are selected; degrades gracefully otherwise.

---

## Chunk J — Upgrade My PC

### `src/lib/upgradeAdvisor.js` — `suggestUpgrade(selectedParts, budget, catalog) → suggestion | null`
Pure, unit-tested. Logic:

- Compute remaining budget = `budget − totalSpent`.
- For each upgradeable category (focus on **cpu** and **gpu**, the FPS drivers): consider catalog parts in that category with a higher `perfScore` than the current pick, that remain **compatible** with the rest of the build (via existing `compatibility.js`), and whose **extra cost** (`candidate.price − current.price`) fits within remaining budget.
- Score each candidate by resulting estimated-FPS gain (using `estimateFps` at the current resolution); pick the single best.
- Return `{ category, fromPart, toPart, fpsGain, extraCost }`, or `null` if nothing helps or budget is exhausted.

### UI
A glass **upgrade-suggestion card** in `BuilderScreen` — e.g. *"Swap GPU → RTX 4070 Ti for +34 FPS at 1440p (+£200)."* Hidden when `suggestUpgrade` returns `null`. (Applying the swap can reuse the existing `addPart`.)

---

## Chunk K — Peripherals / Exterior Tab

### Data — `src/data/peripheralsData.json`
New static catalog, separate from `partsData.json`: categories **monitor, keyboard, mouse, headset**. Each entry: `id`, `category`, `name`, `price`, and 1–2 display specs (monitor: resolution + refresh; keyboard: switch type; mouse: dpi; headset: type). ~6–10 per category.

### Store
A new slice in `useBuilderStore`: `selectedPeripherals` (map category → part), with `addPeripheral` / `removePeripheral` and a `selPeripheralsTotal` selector. Independent of `selectedParts`.

### UI
- A **Build | Peripherals** tab (toggle in `TopBar` or a small segmented control in `BuilderScreen`).
- The Peripherals view: a simple glass list/grid per category to pick from the static catalog, styled with existing `uiTokens`.
- A separate **"Peripherals: £X"** subtotal. Peripherals do **not** enter the 3D scene, orbit ring, compatibility checks, bottleneck, the 60% budget filter, or the component budget bar — the core engine is untouched. This is a foundation to extend later (more categories, optional grand total).

---

## Architecture & New/Changed Files

| File | Change |
|---|---|
| `src/components/models/CaseModel.jsx` | Panelized tower; tinted glass side panel in solid mode, faint frame in open mode |
| `src/lib/assemblyLayout.js` | Tower-fit positions; motherboard flush to rear panel; declutter |
| `src/components/BuildCanvas.jsx` | Camera/lighting retune for the upright tower |
| `src/lib/fpsEstimate.js` | NEW — pure `estimateFps` |
| `src/lib/valueScore.js` | NEW — pure `valuePerPound` + build value |
| `src/lib/upgradeAdvisor.js` | NEW — pure `suggestUpgrade` |
| `src/components/PerformancePanel.jsx` | NEW — estimated FPS + value (glass) |
| `src/components/UpgradeSuggestion.jsx` | NEW — upgrade card (glass) |
| `src/data/peripheralsData.json` | NEW — monitor/keyboard/mouse/headset catalog |
| `src/components/PeripheralsPanel.jsx` | NEW — peripherals tab view |
| `src/store/useBuilderStore.js` | NEW peripherals slice + selectors |
| `src/screens/BuilderScreen.jsx` | Mount Performance panel, Upgrade card, Build/Peripherals tab |
| `src/components/PartCard.jsx` | Optional value badge on CPU/GPU |
| `src/tests/*` | New tests for fpsEstimate, valueScore, upgradeAdvisor; assemblyLayout invariants stay green |

---

## Testing

- **Pure logic, unit-tested (Vitest):**
  - `fpsEstimate.js` — monotonicity (more GPU/CPU perf → more FPS; higher resolution → fewer FPS), key reference points, missing-part guard, resolution-key normalization.
  - `valueScore.js` — value increases as perf rises / price falls; divide-by-zero guard.
  - `upgradeAdvisor.js` — picks the best affordable compatible swap; respects compatibility; returns `null` when nothing fits budget; ignores already-optimal parts.
  - `assemblyLayout.js` — every category returns `{ position, rotation }`; GPU stays visible. Existing tests stay green.
- **3D / UI:** verified via `vite build` + manual browser screenshots on the dev server (WebGL/camera projection can't run in jsdom).

---

## Out of Scope

- Live parts pricing / live FPS benchmarks (catalog + heuristics remain a curated snapshot).
- Brand-accurate or textured GLB models (still procedural placeholders).
- Peripherals affecting compatibility/bottleneck or a unified grand-total budget (separate subtotal only for now).
- AI search / SEO (needs external services).
- Animated fan spin.
