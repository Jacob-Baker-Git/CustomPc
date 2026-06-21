# Builder Refinements — Design (2026-06-21)

Status: design approved in brainstorm; pending written-spec review.

## Context

The 4-phase roadmap shipped and is live (head `93450a9`). This is a focused
refinement pass on the **existing** app — not a rewrite. The user also supplied a
"mega prompt" describing a single-file PC builder; ~90% of it is already
implemented (3D view, 182 parts, search modal, socket/form-factor/RAM
compatibility, summary totals + green/red status), so it is treated as a feature
checklist, and only its genuine gaps are filled.

Stack: React 19 + Vite, Zustand store, React Three Fiber, Vitest (116 passing).

## Goals

1. **Ephemeral state** — refresh resets to a clean slate (no `localStorage`).
2. **Thermal paste** as a selectable, optional part (not rendered in 3D).
3. **Per-game "how it runs"** list in a top-right corner panel on the build
   screen; remove the Games tab.
4. **Clear Build** button — clears parts/peripherals, keeps budget.
5. **Markdown-table export** for sharing.
6. **PSU headroom** warning aligned to a ×1.3 rule.
7. **First-paint skeleton** in `index.html`.

## Non-goals (YAGNI)

- No from-scratch single-file rebuild (the mega prompt is a checklist, not a teardown).
- No full SSG/prerender pipeline — marginal runtime benefit for a client-heavy
  R3F app, with real prerender-crash risk (Three.js touches `window`/WebGL).
- No real GLB swap-in, no affiliate tags, no OS/other accessory slots, no
  price-sort/filter in the part modal.
- The per-game **upgrade advisor** (old `GamePanel`) is dropped; the general
  `UpgradeSuggestion` on the build screen stays.

## Design

### 1. Ephemeral state — `src/store/useBuilderStore.js`

Remove the `persist` middleware (its import and the `name`/`version`/`partialize`
config); plain `create((set) => …)`. State lives only in memory.

- Refresh → `budget` is `0` → `App` renders `BudgetEntry` (clean slate), per the
  chosen reset behavior.
- Share links unaffected: `applyShareLinkFromUrl()` (`main.jsx`) sets state
  directly at load, then strips `?build=`; a later refresh resets — consistent.
- Old `custompc-build-v1` keys from returning users are simply ignored (orphaned,
  harmless).
- Tests: `useBuilderStore.test.js` resets via `setState` and has no persistence
  assertions → still passes unchanged.

### 2. Clear Build — store + `BuildSummary.jsx`

- Store: add `clearBuild: () => set({ selectedParts: {}, selectedPeripherals: {} })`.
  Keeps `budget`, `resolution`, `caseTransparent` (stays on the builder).
- UI: a "Clear build" button in the `BuildSummary` action row (alongside Copy
  share / Print / Export). Guarded by `window.confirm` to prevent accidental
  wipes; disabled when the build is empty.
- Rationale: a *refresh* is the "everything" reset; *Clear Build* is the
  mid-session "parts" reset, so it preserves budget.

### 3. Thermal paste

- `categories.js`: append `{ id: 'paste', label: 'Thermal Paste', icon: '🧴' }`
  (icon adjustable).
- `recommendedOrder.js`: append `'paste'` to `RECOMMENDED_ORDER` (so it appears in
  the orbit ring + mobile category list), and make `nextRecommended` skip an
  `OPTIONAL = new Set(['paste'])` so it never becomes the highlighted "next" step.
  Existing behavior for the 9 current categories is unchanged.
- `partsData.json`: add ~5 paste entries shaped
  `{ id, category: 'paste', name, brand, price, tdp: 0 }` — e.g. Arctic MX-4,
  Noctua NT-H1, Thermal Grizzly Kryonaut, Arctic MX-6, Cooler Master MasterGel
  (£5–£10). No `socket`/`formFactor` → universal fit.
- 3D: `PartModel.jsx` renders a grey fallback cube for unmodeled categories, so
  add `paste` to the early `return null` guard next to `fans` — paste is not drawn.
- `compatibility.js`: paste matches no branch → always compatible (no change).
- `autoBuilder.js`: leave paste out of auto-build (optional; avoids shifting
  budgets/expected totals). Confirm in the plan that it iterates an explicit
  category list rather than all of `CATEGORIES`.
- Tests: `recommendedOrder.test.js` gains a case asserting `nextRecommended` never
  returns `paste`; a data sanity check that paste parts load.

### 4. Game performance on the build screen — remove Games tab

- New `GamePerformancePanel.jsx`: a `PANEL`-styled card titled
  "How it runs @ {resolution}" wrapping the existing `GamePerformanceList`
  (`cpu`, `gpu`, `resolution` from the store). Capped height
  (`max-h-[55vh] overflow-y-auto`) with a quiet scroll for the 12 rows; empty
  state ("Select a CPU + GPU") when either is missing. Read-only — resolution is
  changed via the existing `ResolutionToggle` in `BottleneckIndicator`, so no
  stranded control and no duplicate toggle.
- `BuilderScreen.jsx`:
  - Desktop: add `<div className="absolute top-4 right-4 w-72"><GamePerformancePanel/></div>`
    (mirrors the top-left stack).
  - Mobile: add `<GamePerformancePanel/>` into the stacked column (after
    `PerformancePanel`).
  - Tabs: `['build','peripherals','summary']` (drop `'games'`); remove the
    `view === 'games'` branch and the `GamePanel` import.
- Delete `GamePanel.jsx` + `tests/GamePanel.test.jsx` (superseded; the per-game
  upgrade advisor is intentionally dropped).
- `BuildSummary.jsx` keeps its existing "How it runs" list (unchanged).
- Tests: add `GamePerformancePanel.test.jsx` (empty state; renders rows with a
  CPU+GPU). Remove the GamePanel tests.

### 5. Markdown export — `src/lib/buildMarkdown.js` (new) + `BuildSummary.jsx`

- Pure function `buildMarkdown(rows, total)` → a forum/GitHub Markdown table:

  ```
  | Component | Part | Price |
  | --- | --- | --- |
  | CPU | Ryzen 7 7800X3D | £349.00 |
  | … | … | … |
  | **Total** |  | **£1234.00** |
  ```

  Includes core parts + peripherals in one table.
- Replace the current plain-text "Copy parts list" handler with one that copies
  `buildMarkdown(...)`; relabel the button "Copy as Markdown".
- Tests: `buildMarkdown.test.js` — header row present, a part row formats price,
  total row formats total.

### 6. PSU headroom — `src/lib/buildWarnings.js`

- Keep the critical check: `draw >= psu.wattage`.
- Change the warning branch to the ×1.3 rule: warn when
  `draw * 1.3 > psu.wattage` (under ~30% headroom) while `draw < psu.wattage`.
  Message: `Low PSU headroom — ${draw}W draw vs ${psu.wattage}W (aim for ~30% spare).`
- Tests: update `buildWarnings.test.js` — a build clean at the old 0.8× but
  tripping 1.3×, and one with ample headroom that stays clean.

### 7. First-paint skeleton — `index.html`

- Put a minimal dark placeholder inside `<div id="root">` (centered wordmark on
  `#05080f`) and set the dark background on `body`, so the first paint is the
  app's dark screen rather than a white flash before JS boots. React replaces
  `#root` on mount.
- Tests: `indexHtml.test.js` — assert the skeleton/background markup is present
  (light, optional).

## Risks & integration points

- `nextRecommended` must preserve current behavior for the 9 existing categories
  (only `paste` skipped) — covered by test.
- `PartModel` null-return for paste is **required** or it renders a stray cube —
  covered.
- `OrbitRing` draws a hover tracking-line per ordered category; paste has no
  tracked screen position, so its line falls back to centre (visible only on
  hover) — acceptable.
- Verify `autoBuilder` does not iterate the full `CATEGORIES` list (else it would
  try to pick paste) — checked in the plan.

## Testing

TDD throughout. Baseline 116 green. Net additions: `clearBuild` (store + button),
`recommendedOrder` optional-skip, `GamePerformancePanel`, `buildMarkdown`, PSU
threshold updates; minus the deleted GamePanel tests. Full `npm run test:run`
green and `npm run build` clean before done.

## Out of scope / follow-ups

Raster OG share image, affiliate tags, real GLB models, price sort/filter in the
modal, full SSG/pre-rendering.
