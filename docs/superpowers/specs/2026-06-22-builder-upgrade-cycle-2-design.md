# Builder Upgrade Cycle 2 — Design (2026-06-22)

Status: design approved in brainstorm; pending written-spec review.

## Context

A second upgrade cycle, driven by a supplied "mega prompt" describing a dynamic
JSON-fetch rewrite. As with cycle 1, the prompt is treated as a **feature
checklist for the existing app**, not a teardown — several of its items are
already implemented, conflict with the current (better) architecture, or
conflict with decisions made in cycle 1. The user resolved those conflicts
during brainstorming.

Stack: React 19 + Vite, Zustand (working build is in-memory as of cycle 1),
React Three Fiber, Vitest (129 passing). Parts live in `src/data/partsData.json`
(bundled). The working build resets on refresh; the existing `?build=` share link
hydrates on load then strips the param.

## Goals

1. **Data architecture** — confirm no inline hardcoded parts remain; keep data
   bundled (no runtime fetch); add the one genuinely-new field needed downstream.
2. **Save PC + Saved builds** — explicit local saves (the user's chosen
   alternative to live permalinks), viewable/loadable/shareable from a new tab.
3. **Modal sort** — a sort dropdown in the part-selection modal.
4. **Physical Dimensions Checklist** — a reactive GPU-length / cooler-height fit
   box in the Summary tab.
5. **Quick-Start tiers** — 3 curated fixed-ID builds replacing the entry-screen
   budget presets; relabel buy links to "Find Best Price" with brand in the query.

## Non-goals (YAGNI)

- No single-file rewrite (prompt's "deliver single-file code" is declined, as in cycle 1).
- No runtime `fetch('./data/parts.json')` / loading skeleton — data stays bundled
  (instant, no error states; the git deploy makes "edit without rebuild" moot).
  The first-paint skeleton from cycle 1 already covers initial paint.
- No wholesale field renames (`tdp`→`wattage`, `length`→`gpuLength_mm`, etc.) —
  they would break the codebase and 129 tests. Keep existing names.
- No live `?cpu=…&gpu=…` URL syncing — it would reverse cycle 1's refresh-reset.
  Replaced by explicit Save PC.
- No `amazon.com` — app is £/UK, so `amazon.co.uk` stays.

## Design

### 1. Data architecture
- No inline hardcoded parts exist; all data is already in `src/data/*.json`. Nothing to remove.
- Keep the static `import partsData from '../data/partsData.json'` everywhere.
- Field names unchanged. The **only** new field: `maxCoolerHeight` (mm) added to
  every `case` part in `partsData.json`, sized by its form factor (mini-ITX/mATX
  smaller, full tower larger). Used by feature 4.

### 2. Save PC + Saved builds
- New **persisted** store `src/store/useSavedStore.js` (Zustand + `persist`,
  localStorage key `custompc-saved-v1`). This is the *only* persisted store; the
  working `useBuilderStore` stays in-memory.
  - State: `saved: [{ id, name, savedAt, code }]` (newest first).
  - Actions: `saveBuild(name, code)`, `removeSaved(id)`.
  - `code` is the existing `buildCodec.encodeBuild(...)` string.
- **Save PC** button in the `BuildSummary` action row: encodes the current build,
  `window.prompt('Name this build', 'Build · £<total>')`, then `saveBuild`.
  Disabled when the build is empty.
- New **Saved tab**: top bar becomes `Build · Peripherals · Summary · Saved`. A new
  `SavedBuilds.jsx` lists saves (name, formatted date, total-from-decode optional)
  with three row actions:
  - **Load** — `decodeBuild(code)` then `useBuilderStore.setState({ budget,
    resolution, selectedParts, selectedPeripherals })` (same shape as
    `applyShareLinkFromUrl`); then switch the view to Build (via an `onLoaded`
    callback from `BuilderScreen`).
  - **Copy link** — `shareUrlFromCode(code)` (new helper in `shareLink.js`:
    `${origin}${pathname}?build=${code}`).
  - **Delete** — `removeSaved(id)`.
  - Empty state when no saves.

### 3. Modal sort
- New pure `src/lib/sortParts.js`:
  - `SORT_OPTIONS = [{key:'price-asc',label:'Price: Low to High'},
    {key:'price-desc',label:'Price: High to Low'}, {key:'brand-asc',label:'Brand (A–Z)'},
    {key:'tdp-desc',label:'Power Draw (TDP)'}]`.
  - `sortParts(list, key)` returns a sorted copy: price asc/desc by `price`,
    brand by `(brand ?? name).localeCompare(...)`, tdp by `(tdp ?? 0)` desc.
- `PartSelector.jsx`: add a `<select>` (default `price-asc`) beside the search box;
  sort the category parts before `filterParts` (order is preserved through filter).

### 4. Physical Dimensions Checklist
- New pure `src/lib/dimensionsCheck.js`: `dimensionsCheck(selectedParts)` →
  `[{ id, label, status: 'pass'|'fail'|'na', detail }]` for:
  - GPU length ≤ case `maxGpuLength` (existing fields).
  - CPU cooler `specs.height` ≤ case `maxCoolerHeight` (new field). AIO/liquid
    coolers without `specs.height` → `na`.
  - Missing parts → `na` with a "select X" hint.
- New `src/components/DimensionsChecklist.jsx`: renders the rows with a green check
  (pass), red warning (fail), or muted dot (na). Reads `selectedParts` from the store.
- Placed in the **Summary tab** (the 3D build screen is already dense). Rendered as
  a titled section inside `BuildSummary`, near the existing "How it runs" section.

### 5a. Quick-Start tiers
- New `src/lib/tiers.js`: `TIERS = [{ id:'budget', label:'Budget', budget, resolution,
  ids:[...] }, { id:'mainstream', ... }, { id:'ultimate', ... }]`, each `ids` a curated,
  mutually-compatible set of real part IDs from `partsData.json`.
- Entry screen (`BudgetEntry.jsx`): **replace the 3 budget presets** with the 3 tier
  buttons. Clicking a tier resolves its `ids` against `partsData` into a parts map and
  calls `useBuilderStore.setState({ budget, resolution, selectedParts })`, entering the
  builder. The in-builder "Auto-build" button is unchanged.
- `presets.js` is superseded by `tiers.js` for the entry screen (remove preset usage there).

### 5b. Find Best Price
- `src/lib/retailerLinks.js`: `searchUrl(name, brand)` → query
  `encodeURIComponent(brand ? `${brand} ${name}` : name)` on `amazon.co.uk` (tag logic kept).
- `BuildSummary.jsx` `Row`: relabel "Buy ↗" → **"Find Best Price"**, pass `part.brand`,
  call `searchUrl(name, brand)`.

## Risks & integration points
- `useSavedStore` reintroduces localStorage, but **only** for explicit saves — the
  working build store remains in-memory, so refresh-reset (cycle 1) is preserved.
- `sortParts` runs before `filterParts`; verify `filterParts` preserves input order
  (it maps then filters — it does).
- Loading a saved build uses `setState` (matching `applyShareLinkFromUrl`), so it
  must set all four fields (budget, resolution, selectedParts, selectedPeripherals).
- Tier `ids` must reference real, compatible part IDs — verified against `partsData`
  when authored in the plan.
- `maxCoolerHeight` must be added to every case or the cooler check shows `na`.

## Testing
TDD throughout. New pure libs (`sortParts`, `dimensionsCheck`, `tiers`,
`useSavedStore`) get unit tests; `SavedBuilds`, `DimensionsChecklist`, the modal
sort, and the relabeled link get RTL/component tests; `retailerLinks.test.js`
updated for the brand param. Baseline 129 green; full `npm run test:run` and
`npm run build` green before done.

## Out of scope / follow-ups
Runtime data fetch / CMS, readable `?cpu=` URLs, OG share image, affiliate tag,
real GLB models, full SSG.
