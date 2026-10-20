# Showroom UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Build for a game, Parts, Performance and Summary to the Lovable "Showroom" look, with live leader-line labels on the Summary 3D model and close-up stills on the game result cards.

**Architecture:** One shared overlay component (`ShowroomOverlay`) draws label columns, leader lines and dots over any picture; on Summary a projector inside the r3f canvas moves the dots every rendered frame, elsewhere a captured still plus fixed anchors feed it. Pure logic (slots, focus part, price share, projection) lives in `src/lib/showroom.js` with unit tests.

**Tech Stack:** React 19, Vite 8, Tailwind 4, Zustand 5, three + @react-three/fiber + drei, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-showroom-ui-design.md`. Reference mockup: `scratch/lovable-mock/Mockup.tsx` (Variant C — read `Stage`, `PTS`, `Showroom`, `CardShow`, `CTable`, `SummaryScreen`).

## Global Constraints

- No new npm dependencies. No change to scoring, perf model, optimiser, catalogue data, Supabase.
- Remove nothing the screens have today (case toggle, drag/zoom hint, banner, warnings, use-case chips, score, Best next move, Holding back, frame-rate table, resolution picker, folds, Peripherals, Save/Share/Print/Markdown, Dock, step header, 1–4 keys).
- Live 3D only on Summary, still behind `Deferred3D` on coarse pointers. `frameloop="demand"` stays; no React re-render per frame.
- Hairlines not boxes; `brass` the only accent; text ≥ 12px (`text-[12px]`, not `text-xs`); targets ≥ 24px, 44px where they are today.
- `.area-viz, .area-viz *` keep `touch-action: pan-y`. Fixed overlays inside the Summary column portal to `document.body`.
- Never push. Commit on `feat/showroom-ui`.

## Review Focus

1. A card whose biggest change is a part with no anchor (case, fans, paste) → shows the whole still, label still names that part and its delta. (Task 1 test, Task 7 test)
2. Partial or empty build on Summary → only picked parts get labels; empty build shows no overlay and the existing "No parts selected" text. (Task 3 test)
3. Long part names → wrap inside the label; the label never extends past the frame. (Task 3 test asserts no `truncate` class; Task 10 screenshot check)
4. Coarse pointer before the 3D is loaded → no dots, no tap strip until `show3D`. (Task 5 test)
5. A cheaper swap → delta reads with a true minus sign "−£40", not "+£-40". (Task 1 test)

---

### Task 1: Showroom logic

**Files:**
- Create: `src/lib/showroom.js`
- Test: `src/tests/showroom.test.js`

**Interfaces:**
- Produces:
  - `SHOWROOM_SLOTS: { id: string, side: 'l'|'r' }[]` — order top→bottom: left `cooler, motherboard, storage, psu`; right `ram, cpu, gpu`.
  - `COMPACT_IDS = ['cpu','gpu','cooler','psu']` (phone tap dots).
  - `focusChange(prevOption, option, changed: Set<string>) -> { id, part, delta, others: string[], anchored: boolean } | null` — `id` = changed category with the largest `|option.parts[id].price - prevOption.parts[id].price|` (missing part price = 0), preferring anchored ids (in `SHOWROOM_SLOTS`) and falling back to any changed id with `anchored:false`; `others` = remaining changed ids in `CATEGORIES` order; `null` when `changed` is empty.
  - `formatDelta(n) -> string` — `"+£95"`, `"−£40"` (U+2212), `"£0"`.
  - `priceShares(selectedParts) -> { id, price, pct }[]` — pct of the parts total, one decimal, CATEGORIES order, picked parts only.
  - `projectAnchor(world: [x,y,z], camera: THREE.Camera) -> { x: number, y: number, visible: boolean }` — x/y in percent of the canvas (0–100, y down); `visible` false when behind the camera or outside 0–100.

- [ ] **Step 1: Write the failing tests** — `focusChange` picks GPU (+£95) over CPU (+£30); picks an unanchored `case` with `anchored:false` when only case changed; returns `others:['cpu']`; `null` for empty set. `formatDelta(-40) === '−£40'`, `formatDelta(95) === '+£95'`. `priceShares` on `{cpu:{price:100},gpu:{price:300}}` → `[{id:'cpu',price:100,pct:25},{id:'gpu',price:300,pct:75}]`. `projectAnchor([0,0,0], cam)` with a `PerspectiveCamera(46,1)` at `[0,0,5]` looking at origin → `{x:50,y:50,visible:true}`; a point behind the camera → `visible:false`.
- [ ] **Step 2:** `npx vitest run src/tests/showroom.test.js` → FAIL (module missing).
- [ ] **Step 3:** Implement. `projectAnchor` uses `new THREE.Vector3(...world).project(camera)`; behind = `z > 1`.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(showroom): slots, focus change, price share, projection`.

### Task 2: Pictograms and crop frame

**Files:**
- Create: `src/components/showroom/PartPictogram.jsx`, `src/components/showroom/CropFrame.jsx`
- Test: `src/tests/showroomPrimitives.test.jsx`

**Interfaces:**
- Produces: `<PartPictogram id={categoryId} className? />` — the mockup's `Picto` line drawings (32×32 viewBox, `stroke="currentColor"`, 1.25 stroke), keyed by category id (`cpu, gpu, motherboard, ram, storage, psu, case, cooler, fans`, plus a new simple `paste` syringe/drop); `aria-hidden`; falls back to `CategoryIcon` for unknown ids. `<CropFrame className?>{children}</CropFrame>` — relative wrapper with the four corner marks.

- [ ] **Step 1: Failing test** — every id in `CATEGORIES` renders an `svg[aria-hidden="true"]` with ≥1 child; `CropFrame` renders its children and 4 `[data-crop-mark]` spans.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement (port from mockup; keep `noHardwareMotifs.test.js` green — no `data-board`, `RamBox`, designator names).
- [ ] **Step 4:** `npx vitest run src/tests/showroomPrimitives.test.jsx src/tests/noHardwareMotifs.test.js` → PASS.
- [ ] **Step 5:** Commit.

### Task 3: ShowroomOverlay

**Files:**
- Create: `src/components/showroom/ShowroomOverlay.jsx`
- Test: `src/tests/ShowroomOverlay.test.jsx`

**Interfaces:**
- Consumes: Task 1 `SHOWROOM_SLOTS`, `COMPACT_IDS`; Task 2 `PartPictogram`.
- Produces: `ShowroomOverlay` (forwardRef) props `{ parts: Record<id, part|null>, ids?: string[], anchors?: Record<id,{x,y,visible?}>, hot: string|null, setHot: (id|null)=>void, compact: boolean, chip?: string }`. Ref handle: `{ place(id, x, y, visible) }` writes the dot's `left/top` and the leader polyline's points directly to the DOM (no state). Desktop mode: labels in fixed columns (left 3% / right 3%, width 33%, rows spaced evenly down the column), each `[data-label=id]` with type, `£price`, name (wrapping, never `truncate`), `onMouseEnter/Leave → setHot`; an `svg` of polylines from the label edge to the dot; dots `[data-dot=id]`. Compact mode: numbered buttons `aria-label={label}` at the dots for `COMPACT_IDS ∩ picked`, and a strip below (`[data-tap-strip]`) showing icon, type, name, price of `hot`, else "Tap a number to see the part". Only picked parts render. `pointer-events-none` on the layer, `auto` on labels/buttons; no `touch-action` set.

- [ ] **Step 1: Failing tests** — with `parts={{cpu, gpu}}` only `data-label="cpu"` and `"gpu"` exist; hovering the cpu label calls `setHot('cpu')`; label name element has no `truncate` class; compact mode renders 2 numbered buttons and the strip shows "Tap a number to see the part", then the tapped part's name after a click with `hot` rerendered; `ref.current.place('cpu', 40, 60, true)` sets the cpu dot's `style.left` to `40%`; `visible:false` hides the dot and line (`style.display = 'none'`); empty `parts` renders nothing.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; static `anchors` prop places dots on mount through the same `place`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit.

### Task 4: Live anchors in the 3D canvas

**Files:**
- Modify: `src/components/BuildCanvas.jsx` (new prop `overlayRef`), create `src/components/showroom/AnchorProjector.jsx`
- Test: `src/tests/AnchorProjector.test.js` (pure part only)

**Interfaces:**
- Consumes: Task 1 `projectAnchor`, `SHOWROOM_SLOTS`; Task 3 ref handle `place`.
- Produces: `<AnchorProjector overlayRef parts />` rendered inside `<Canvas>`; `anchorWorldPoint(id, parts) -> [x,y,z]` exported from `src/lib/showroom.js` (uses `partCentre(id)` from `assemblyGeometry.js`, and for `gpu`/`cooler`/`psu` whatever point sits on the visible face — choose by eye in the browser, record the offset in a comment).

- [ ] **Step 1: Failing test** — `anchorWorldPoint('psu', {})` equals `partCentre('psu')` plus its documented offset; returns finite numbers for every slot id.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement: `useFrame(({camera}) => …)` calls `place` for each picked slot. With `frameloop="demand"` it runs only on rendered frames; also invalidate once after the overlay mounts.
- [ ] **Step 4:** Run → PASS. Then in the browser (dev server, Summary, desktop + phone width): rotate/zoom → dots stay on their parts; idle → `scripts/probe-3d-idle.mjs` still reports 0 draws.
- [ ] **Step 5:** Commit.

### Task 5: Summary — labelled 3D, spec stack, build table, layout

**Files:**
- Modify: `src/screens/BuilderScreen.jsx` (summary branch), `src/index.css` (`.build-grid` areas), `src/components/BuildSummary.jsx` (rows)
- Create: `src/components/showroom/SpecStack.jsx`
- Test: `src/tests/SpecStack.test.jsx`, update `src/tests/BuildSummary.test.jsx`, `src/tests/BuilderScreenViews.test.jsx`

**Interfaces:**
- Consumes: Tasks 1–4. `estimatePower`, `estimateThermals` from `src/lib/perfEngine/power.js`; `selTotalSpent`, `budget` from the store. Do NOT import anything that pulls `perfModel.json` into Summary.
- Produces: `<SpecStack layout="column"|"grid" />` showing Price (`£total / £budget` when budget>0), Peak power (`peakW` W), PSU (`psuWattage` W), PSU headroom (`psuHeadroomPct`%), Cooling margin (`thermals.headroomPct`%); a field whose value is null renders "—". `hot`/`setHot` state lives in BuilderScreen's summary branch and is passed to the overlay and `BuildSummary` (`hot`, `onHot` props).

- [ ] **Step 1: Failing tests** — SpecStack with a fixture build shows the five labels and the computed numbers, "—" with no PSU; BuildSummary row shows the share % (`priceShares`), a `[data-share-bar]` with `style.width` = pct%, a `PartPictogram`, no `truncate` on names; hovering a row calls `onHot(id)`; the phone "+N more parts" cap still works.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Desktop grid: `left` (usecase, rating) | `viz` | `spec`, then `parts` full width, then banner + warnings. Phone order: banner, rating, usecase, viz (+tap strip), spec (3-col grid), parts, warnings. Overlay renders only when `show3D`; `compact` = `!useIsDesktop()`.
- [ ] **Step 4:** `npm run test:run` → PASS; `npx playwright test e2e/wizard.spec.js e2e/mobileLayout.spec.js e2e/share.spec.js` → PASS (update selectors only where markup moved; keep every assertion's intent). `node scripts/measure-mobile-heights.mjs` → Summary no taller than before this task (record both numbers in the commit message).
- [ ] **Step 5:** Commit.

### Task 6: Capture the still

**Files:**
- Create: `scripts/capture-showroom-still.mjs`, `public/img/showroom-pc.webp`, `src/data/showroomAnchors.json`

**Interfaces:**
- Produces: `showroomAnchors.json` = `{ width, height, anchors: { [id]: { x, y } } }` (percent of the image) for all 7 slot ids; image ≤ 160 KB, ≥ 1600 px wide.

- [ ] **Step 1:** Write the script from `capture-welcome-render.mjs` (same ANGLE flags, same Cyberpunk £1600 build, so all 7 slots are picked): hide labels/lines but keep the overlay in DOM, screenshot the canvas, read each `[data-dot]`'s rect relative to the canvas → percent, crop like the welcome script and rescale the anchors into the cropped frame.
- [ ] **Step 2:** `npm run dev` then `node scripts/capture-showroom-still.mjs` → writes both files; check the image by eye and that every anchor is inside 0–100.
- [ ] **Step 3:** `npx playwright test --project=csp` → PASS (new image served under the CSP).
- [ ] **Step 4:** Commit script + outputs.

### Task 7: ShowroomStill + game result cards

**Files:**
- Create: `src/components/showroom/ShowroomStill.jsx`
- Modify: `src/screens/TargetScreen.jsx`
- Test: `src/tests/ShowroomStill.test.jsx`, update `src/tests/TargetScreen.test.jsx`, `e2e/wizard.spec.js` if selectors move

**Interfaces:**
- Consumes: Tasks 1, 3, 6.
- Produces: `<ShowroomStill parts ids? hot setHot compact zoom?={{id, scale}} chip? />` — fixed aspect from `showroomAnchors.json`, `<img src="/img/showroom-pc.webp" alt="…" loading="lazy">`, zoom = CSS `scale` with `transform-origin` at that anchor; overlay with static anchors (labels hidden when `zoom` is set — a card shows only its focus callout).
  `<CardShow card prevCard />` (inside TargetScreen.jsx): card 1 → still + "Base build" label with CPU + GPU names; others → `focusChange` → zoomed still on `id` (scale 2.2) when `anchored`, unzoomed otherwise, label `"{Label} · {part name} · {formatDelta(delta)}"` and `"{Labels} also changed"` when `others` is non-empty.

- [ ] **Step 1: Failing tests** — middle card gets `Recommended` and a filled button, others ghost; card 2's callout reads `GPU · <name> · +£95` for a fixture where GPU rose £95 and CPU £10, with "CPU also changed"; a case-only change shows an unzoomed still and names the case; the no-value line, over-budget, unreachable and no-data messages still render.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; desktop inputs as one bordered row across the top (GameSettingsFields + Target FPS + Budget + Find builds), phone 2-col grid; three columns of cards; Best value card raised with a brass outline; card parts list rows = pictogram + label + name + brass dot when changed (keep `data-changed`).
- [ ] **Step 4:** `npm run test:run` and `npx playwright test e2e/wizard.spec.js` → PASS.
- [ ] **Step 5:** Commit.

### Task 8: Parts (Build tab)

**Files:**
- Modify: `src/screens/BuilderScreen.jsx` (build branch), `src/components/SelectedPartsPanel.jsx`, `src/components/PartSlot.jsx`
- Test: update `src/tests/SelectedPartsPanel.test.jsx`, `src/tests/PartSlot.test.jsx`

**Interfaces:**
- Consumes: Tasks 2, 3, 7 (`ShowroomStill`).
- Produces: build branch = single-column part list + `ShowroomStill` (all slots, chip "[ live build ]") sticky on the right from `lg`, above the list below `lg` (compact). Rows: pictogram, type, name (wraps; on phones price under the type), price, remove; hover-linked via `hot`.

- [ ] **Step 1: Failing tests** — a picked row hover calls `setHot`; names have no `truncate`; picking/removing still works through the existing callbacks; the still renders labels only for picked parts.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npm run test:run` and `npx playwright test e2e/partsBrowser.spec.js e2e/wizard.spec.js` → PASS. **Step 5:** Commit.

### Task 9: Performance

**Files:**
- Modify: `src/components/performance/PerformanceScreen.jsx`
- Test: update `src/tests/PerformanceScreen.test.jsx`

**Interfaces:**
- Consumes: Task 7 `ShowroomStill`.
- Produces: from `lg` a third column holding `ShowroomStill ids={['cpu','gpu']}` beside the estimate and bottleneck; below `lg` it sits after the bottleneck section. Every existing section and fold unchanged.

- [ ] **Step 1: Failing test** — Performance renders labels for cpu and gpu only; every existing heading still present.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npm run test:run` and `npx playwright test e2e/performance.spec.js` → PASS. **Step 5:** Commit.

### Task 10: Whole-branch verification

- [ ] `npm run lint` → 0 problems; `npm run test:run` → all pass; `npx playwright test` → all pass (incl. csp; port 4184 free first).
- [ ] `npm run build` then `npm run prerender` → commit regenerated prerender output if it changed.
- [ ] `node scripts/measure-mobile-heights.mjs` → no screen taller than on `main`.
- [ ] Screenshot all four screens at 1440 and 390 (repo-root Playwright script, see `screenshotting-this-app` memory) including a hovered label and a tapped dot; check no label clips or overlaps; send to the user.
- [ ] Commit any fixes; do not push.
