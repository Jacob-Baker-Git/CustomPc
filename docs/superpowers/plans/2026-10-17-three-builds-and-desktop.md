# Three Builds and Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Find builds" answers with Cheapest / Middle (best value) / Best builds, and the home page, "Build for a game" and the part picker get real desktop layouts.

**Architecture:** The three-build logic stays in `src/lib/gameTargetBuilder.js` (pure, unit-tested against the real catalogue). Presentation decisions that depend on width use `useIsDesktop()` (read once at mount) where DOM differs, and Tailwind `lg:` classes where only layout differs. Phone markup is unchanged.

**Tech Stack:** React 19, Vite 8, Tailwind 4.3, Zustand 5, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-three-builds-and-desktop-design.md`

## Global Constraints

- Desktop = `(min-width: 1024px)` (`DESKTOP_QUERY` in `src/hooks/useIsDesktop.js`, Tailwind `lg`).
- Phone layout of every screen unchanged.
- Existing tokens only (`brass`, `ink`, `muted`, `faint`, `line`, `surface`, `surface-2` …); no new colours, gradients, glow or card chrome.
- No text under 12px (`text-[12px]`, never `text-xs` for new text); interactive targets ≥24px.
- Every modal keeps `useDialog`.
- `VALUE_BAR = 1`.
- Nothing invented: a spec column shows only catalogue fields or existing derived stats; missing = "—".
- Commit per task on `main`; never push.
- After touching `MainMenu` run `npm run prerender` and commit its output.

## Review Focus

1. **Budget below every complete build** — Best null, Cheapest still shown if reachable, no Middle, no crash in the column layout. (Task 2 test.)
2. **Target so low every build hits it** (`targetFps: 1`) — Cheapest is the cheapest build overall, Best ≠ Cheapest, Middle may or may not exist; never three identical cards. (Task 2 + 3 tests.)
3. **Cheapest over budget** — marked "over budget", no Middle. (Task 2 + 4 tests.)
4. **Changing inputs after a search** — results hide (existing behaviour) in the desktop layout too. (Task 4 test.)
5. **Typing "1"–"4" or "/" inside the budget box, search box or any input** — must type, not switch tabs. (Task 8 test.)

---

### Task 1: Cooler filter and measured-first tie-break

**Files:**
- Modify: `src/lib/gameTargetBuilder.js:43-50` (completeBuild), `:87-89` and `:111-112` (sorts)
- Test: `src/tests/gameTargetBuilder.test.js`

**Interfaces:**
- Produces: `sensibleCatalog(cpu, parts) -> Part[]` (exported; the filtered catalogue `completeBuild` builds from — Task 2 reuses it). `completeBuild` signature unchanged.

- [ ] **Step 1: Write the failing tests**

```js
import { coolerCapacityW } from '../lib/partSynergy'
describe('completeBuild cooler', () => {
  it('picks a cooler with capacity for the chip base power', () => {
    const hot = partsData.filter((p) => p.category === 'cpu' && !p.legacy).sort((a, b) => b.tdp - a.tdp)[0]
    const b = completeBuild(hot, gpus[0], partsData, RES)
    expect(coolerCapacityW(b.cooler)).toBeGreaterThanOrEqual(hot.tdp)
  })
})
describe('ranking', () => {
  it('on equal fps a measured row beats an "up to" ceiling', () => {
    // fastFirst comparator exported for this test as `compareFastFirst(a, b)`
    const measured = { row: { avgFps: 100, bound: undefined }, cpu: { perfScore: 1, id: 'a' }, gpu: { id: 'g' }, core: 500 }
    const ceiling  = { row: { avgFps: 100, bound: 'upper' }, cpu: { perfScore: 99, id: 'b' }, gpu: { id: 'g' }, core: 100 }
    expect([ceiling, measured].sort(compareFastFirst)[0]).toBe(measured)
  })
})
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/tests/gameTargetBuilder.test.js` (cooler capacity below tdp / `compareFastFirst` not exported).

- [ ] **Step 3: Implement**
  - `sensibleCatalog`: same RAM/storage filters as today; cooler filter = `coolerCapacityW(p) >= cpu.tdp`. If no cooler with known capacity (>0) qualifies, keep the ones with capacity 0. `completeBuild` uses it.
  - Export `compareFastFirst(a, b)` (add it to the test file's import list): `(b.row.avgFps - a.row.avgFps) || measuredFirst || cpu perfScore desc || core asc || ids`, where `measuredFirst = (a.row.bound === 'upper') - (b.row.bound === 'upper')`. Use it for `fastFirst`; add the same measured-first key after FPS in the cheap-first sort.

- [ ] **Step 4: Run, expect PASS** (whole file, existing tests included).

- [ ] **Step 5: Commit** — `fix(builder): game builds pick a cooler sized for the CPU; measured fps beats a ceiling on ties`

---

### Task 2: Best spends the whole budget; Cheapest always computed; Middle by value

**Files:**
- Modify: `src/lib/gameTargetBuilder.js:52-124`
- Test: `src/tests/gameTargetBuilder.test.js` (update the `cheapestHit` tests to the new shape)

**Interfaces:**
- Consumes: `sensibleCatalog`, `compareFastFirst` (Task 1); `autoBuild(selected, budget, parts, resolution, { maximise, rateFor })` from `autoBuilder.js`.
- Produces: `export const VALUE_BAR = 1`; `buildForGame(...)` returns `{ noData, unreachable, best, middle, cheapest, fastest, noValueStep }`; each option `{ parts, total, fps, lowFps, basis, bound }`. `noData` result: `{ noData: true, unreachable: false, best: null, middle: null, cheapest: null, fastest: null, noValueStep: false }`.

- [ ] **Step 1: Write the failing tests** (in `describe('buildForGame')`, `r = run()` at £1600 target 60)

```js
it('best spends the budget on the other parts too', () => {
  const plain = completeBuild(r.best.parts.cpu, r.best.parts.gpu, partsData, RES)
  expect(r.best.total).toBeGreaterThanOrEqual(total(plain))
  expect(r.best.total).toBeLessThanOrEqual(1600)
  expect(r.best.parts.cpu.id).toBe(plain.cpu.id); expect(r.best.parts.gpu.id).toBe(plain.gpu.id)
})
it('always reports the cheapest build that hits, even when best hits', () => {
  expect(r.cheapest.fps).toBeGreaterThanOrEqual(60)
  for (const s of sample.filter((x) => x.fps >= 60)) expect(r.cheapest.total).toBeLessThanOrEqual(s.total)
})
it('middle sits strictly between cheapest and best and every step clears VALUE_BAR', () => {
  const m = r.middle
  if (!m) { expect(r.noValueStep).toBe(true); return }
  expect(m.total).toBeGreaterThan(r.cheapest.total); expect(m.total).toBeLessThan(r.best.total)
  expect(m.fps).toBeGreaterThan(r.cheapest.fps);     expect(m.fps).toBeLessThan(r.best.fps)
  const ratio = ((m.fps - r.cheapest.fps) / r.cheapest.fps) / ((m.total - r.cheapest.total) / r.cheapest.total)
  expect(ratio).toBeGreaterThanOrEqual(VALUE_BAR)
})
it('no middle when cheapest is over budget', () => {
  const hard = run({ budget: 700, targetFps: r.fastest.fps })
  expect(hard.cheapest.total).toBeGreaterThan(700)
  expect(hard.middle).toBeNull()
})
it('no cheapest or middle when the target is unreachable', () => {
  const r2 = run({ targetFps: 100000 })
  expect([r2.unreachable, r2.cheapest, r2.middle]).toEqual([true, null, null])
})
it('budget below every build: best null, cheapest still found', () => {
  const r4 = run({ budget: 100 })
  expect(r4.best).toBeNull(); expect(r4.cheapest).not.toBeNull(); expect(r4.middle).toBeNull()
})
```
Rename `cheapestHit` → `cheapest` in the existing tests; delete "skips the cheapest-hit search when the best build already hits" (behaviour removed); update the noData `toEqual`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**
  - **Best:** after finding the pair as today, `full = autoBuild({ cpu, gpu }, budget, sensibleCatalog(cpu, parts), resolution, { maximise: true, rateFor: 'gaming' })`; use `full` if every ESSENTIAL is set and `sumPrice(full) <= budget`, else the plain completion.
  - **Cheapest:** today's cheap-first loop, run whenever `!unreachable`.
  - **Middle:** only when `cheapest && cheapest.total <= budget && best && best.fps > cheapest.fps`. Candidates = pairs with `cheapest.fps < fps < best.fps` and `core < best.total`; take their Pareto frontier on `(core, fps)` first, complete only those (memoised `complete`), drop any with `total` outside `(cheapest.total, best.total)`, then climb:

```js
// ponytail: frontier taken on CPU+GPU price before completion, so a pair whose
// platform is unusually cheap can be missed; complete every candidate if that shows.
let cur = cheapest
for (;;) {
  let next = null, bestRatio = VALUE_BAR
  for (const c of frontier) {
    if (c.total <= cur.total || c.fps <= cur.fps) continue
    const ratio = ((c.fps - cur.fps) / cur.fps) / ((c.total - cur.total) / cur.total)
    if (ratio >= bestRatio) { bestRatio = ratio; next = c }
  }
  if (!next) break
  cur = next
}
middle = cur === cheapest ? null : cur
noValueStep = middleWasPossible && middle === null
```
  - Middle stays a plain `completeBuild` (no maximise).

- [ ] **Step 4: Run, expect PASS.** Also time it: `run({ budget: 100 })` and a £1600 run each under 3 s in vitest (log, don't assert). Report the numbers in the commit body.

- [ ] **Step 5: Commit** — `feat(builder): three answers per search — cheapest that hits, best value, best for budget`

---

### Task 3: Cards for the results (dedupe, order, step lines)

**Files:**
- Create: `src/lib/buildCards.js`
- Test: `src/tests/buildCards.test.js`

**Interfaces:**
- Consumes: Task 2 result shape.
- Produces: `buildCards(result, { budget, fps }) -> Card[]`, `Card = { kind: 'cheapest'|'middle'|'best', title: string, also: string|null, option, step: string|null, overBudget: boolean, changed: Set<string> }`, ordered cheapest, middle, best, skipping nulls.
  - Titles: cheapest `Cheapest that hits ${fps} fps`; middle `Best value`; best `Best within £${budget}`.
  - Dedupe: a later card whose `parts` ids equal an earlier card's is dropped and its title goes in the earlier card's `also` (lower-case first letter: "also best within £1000").
  - `step` (vs the previous kept card): same fps → `+£${Δ} · same fps, better parts`; else `+£${Δ} · +${Δfps} fps over ${prevTitleShort}` where short = `Cheapest` / `Best value`. First card: null. £ rounded to whole pounds.
  - `changed`: category ids whose part id differs from the previous kept card (empty for the first).
  - `overBudget`: `option.total > budget`.

- [ ] **Step 1: Write the failing tests** with hand-made options (no catalogue): identical cheapest+best → one card with `also`; three distinct → order + `step` strings exactly as above; same CPU/GPU with different RAM → `changed` = `{'ram'}` and step "same fps, better parts"; cheapest over budget → `overBudget: true`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `feat(builder): result cards with dedupe and step lines`

---

### Task 4: "Build for a game" screen — three columns on desktop

**Files:**
- Modify: `src/screens/TargetScreen.jsx`
- Test: `src/tests/TargetScreen.test.jsx`

**Interfaces:**
- Consumes: `buildCards` (Task 3), `useIsDesktop` (`src/hooks/useIsDesktop.js`).

- [ ] **Step 1: Write the failing tests**
  - Fortnite £1600 target 60: after Find, headings `Cheapest that hits 60 fps` and `Best within £1600` both present; ≥2 "Use this build" buttons.
  - With `window.matchMedia = () => ({ matches: true })` (restore in `afterEach`, as `Fold.test.jsx` does): the parts lists render open (`getAllByRole('list')` items visible without clicking), and a changed row carries `data-changed="true"`.
  - Over-budget card shows the text `over budget`.
  - `noValueStep` → text `Nothing above the cheapest build is worth the extra money.`
  - Changing the budget after a search hides results (existing test keeps passing).
  - Update the existing "finds a build…" test to the new title (`Best within £1600`).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**
  - Layout: root `lg:grid lg:grid-cols-[320px_1fr] lg:gap-10`; the form column `lg:sticky lg:top-6 lg:self-start`; form inputs stack full-width at `lg`.
  - Results: `grid gap-6 lg:grid-cols-3` (phone stays a single stack). Before any search on desktop, the results region shows one muted line: `Pick a game, a frame rate and a budget, then Find builds.`
  - `BuildOption` takes a `Card`: title (+ `also` in muted), `step` line in `text-[13px] text-muted`, FPS · £ line, `over budget` in `text-bad` when set, Use button, parts `<details open={desktop}>`; a row in `card.changed` gets `data-changed="true"` and `border-l-2 border-brass pl-2 text-ink`.
  - Unreachable / noData messages as today; the no-value-step line sits in the results grid where Middle would be.
  - SiteChrome's `max-w-3xl` limits width: give SiteChrome a `wide` prop (`max-w-6xl`) and pass it from the target route only. Find the route in `src/App.jsx`.
- [ ] **Step 4: Run, expect PASS** (`npx vitest run src/tests/TargetScreen.test.jsx`).
- [ ] **Step 5: Commit** — `feat(target): three builds side by side on desktop, differences marked`

---

### Task 5: Desktop home page

**Files:**
- Modify: `src/components/MainMenu.jsx`
- Test: `src/tests/MainMenu.test.jsx`, then `npm run prerender`

- [ ] **Step 1: Write the failing test** — rendered `<main>` has class `lg:max-w-6xl` and the image wrapper has `lg:order-2` (a cheap structural guard; visual check is Step 4).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — `main`: `max-w-2xl lg:max-w-6xl lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-12`; text block (h1, tag, sentence, path rows) in one wrapper (`lg:order-1`), image wrapper `lg:order-2 lg:h-[640px] lg:mx-0` with the feather mask on all four sides at `lg`. Headline `lg:text-[52px]`. Same image, same copy.
- [ ] **Step 4: Verify** — vitest passes; `npm run prerender` (commit changed output); screenshot at 1440×900 and 375×812 via the dev preview: phone identical to before, desktop two columns with no horizontal scroll.
- [ ] **Step 5: Commit** — `feat(home): two-column home page on desktop`

---

### Task 6: Part picker as a sortable table on desktop

**Files:**
- Create: `src/lib/partColumns.js`, `src/components/PartTable.jsx`
- Modify: `src/components/PartSelector.jsx`
- Test: `src/tests/partColumns.test.js`, `src/tests/PartSelector.test.jsx`

**Interfaces:**
- Produces: `columnsFor(category, resolution) -> Column[]`, `Column = { key: string, label: string, value: (part) => number|string|null, format?: (v) => string, numeric: boolean }`. Columns per the spec list; values from fields shown below (all exist in `partsData.json`):
  - cpu: price, `perfScore`, `perfPerPound`, `specs.cores`, `socket`, `tdp`
  - gpu: price, `perfScore`, `fpsPerPound(p, resolution)`, `specs.vram`, `length`, `tdp`
  - motherboard: price, `socket`, `ramType`, `formFactor`
  - ram: price, `capacityGb`, `specs.sticks`, `ramType`, `speed`
  - storage: price, `capacityGb`, `storageType`, `pricePerGb`
  - psu: price, `wattage`, `specs.rating`
  - cooler: price, `specs.type`, `coolerCapacityW` (label `Cooling (est.)`), `specs.height`
  - case: price, `maxGpuLength`, `maxCoolerHeight`, `specs.includedFans`
  - fans: price, `specs.size`, `specs.count`; paste: price, `specs.amountG`
  - Name is always the first column (not in the list). `null`/`undefined`/0-for-derived → `—`.
- `PartTable({ rows, columns, sort, onSort, onPick, currentId })` where `rows` = `filterParts` output items `{ part, compatible, reason, locked, lockReason }`.

- [ ] **Step 1: Write the failing tests**
  - `partColumns`: every category in `CATEGORIES` returns ≥2 columns; every column's `value` returns non-throwing for every catalogue part of its category; cooler column label is `Cooling (est.)`.
  - `PartSelector` with matchMedia stubbed true: renders a `table`; clicking the `Price` header sorts ascending then descending (first row name checks against the catalogue's min/max price GPU); a locked row has `aria-disabled="true"` and shows its reason; pressing Enter on a focused unlocked row calls `onSelect`; the sort `<select>` is absent. Without the stub, existing card tests still pass.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**
  - `PartSelector`: `const desktop = useIsDesktop()`; dialog class at desktop `max-w-6xl max-h-[88vh]`; desktop renders `PartTable` instead of the card grid and drops the `<select>`; sort state `{ key, dir }` local; sort by the column's `value` (nulls last), name column by name. Keep search, "Show N pricier parts" / "Hide pricier parts" (as rows spanning the table under it).
  - `PartTable`: `<table>` with sticky `<thead>`; header cells are `<button>`s with `aria-sort`; rows `tabIndex={0}`, click/Enter selects unless locked; locked rows `opacity-50` with the reason in a muted line under the name; current part marked with the brass rule. Numeric columns right-aligned, `tabular-nums`. Row height ≥ 40px.
  - Resolution for GPU fps-per-£ comes from `useBuilderStore((s) => s.resolution)`.
- [ ] **Step 4: Run, expect PASS** (`npx vitest run src/tests/partColumns.test.js src/tests/PartSelector.test.jsx`).
- [ ] **Step 5: Commit** — `feat(picker): sortable spec table on desktop`

---

### Task 7: Budget pill with no budget; peripherals four across

**Files:**
- Modify: `src/components/DynamicBars.jsx:16-20`, `src/components/TopBar.jsx:74-78`, `src/components/PeripheralsPanel.jsx:115,200`
- Test: `src/tests/DynamicBars.test.jsx`, `src/tests/TopBar.test.jsx`, `src/tests/PeripheralsPanel.test.jsx`

- [ ] **Step 1: Write the failing tests**
  - `<DynamicBars value={999.41000000000001} max={0} label="Budget" unit="£" />` shows `£999`.
  - TopBar with `budget: 0` and parts selected: no text matching `/left/`.
  - PeripheralsPanel grid has class `lg:grid-cols-4`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — no-max £ display `£${value.toFixed(0)}`; TopBar hides the `£X left` group when `budget <= 0`; peripherals container `max-w-6xl`, grid `lg:grid-cols-4`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `fix: budget pill with no budget; four peripherals per row on desktop`

---

### Task 8: Keyboard shortcuts

**Files:**
- Modify: `src/screens/BuilderScreen.jsx` (near `useHashView` at :53), `src/components/PartSelector.jsx`
- Test: `src/tests/BuilderScreenViews.test.jsx`, `src/tests/PartSelector.test.jsx`

**Interfaces:**
- Consumes: `stepsFor(path)` from `src/hooks/useHashView.js` — on the game path only `['peripherals','summary']`, so `1`/`2` map to those and `3`/`4` do nothing. (The spec says 1–4 = Build/Performance/Peripherals/Summary; numbering the visible step row instead is the plan's call, so the keys match the numbers shown on screen.)

- [ ] **Step 1: Write the failing tests**
  - parts path: `keyDown(document, { key: '2' })` → Performance view shown; `'4'` → Summary.
  - game path: `'1'` → Peripherals; `'3'` → no change.
  - With focus in an `<input>`, `'2'` does nothing (Review Focus 5).
  - Modifier held (`ctrlKey`) → nothing.
  - PartSelector: `keyDown(dialog, { key: '/' })` focuses the search input and does not type `/` into it.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — one `keydown` listener on `document` in BuilderScreen; ignore when `e.target` is an input/textarea/select/contenteditable, when any modifier is held, or when a dialog is open (`document.querySelector('[role=dialog]')`). PartSelector handles `/` on its dialog element with `preventDefault()`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `feat: 1-4 switch builder tabs, / searches the part picker`

---

### Task 9: Whole-branch verification

- [ ] `npx vitest run` — all pass.
- [ ] `npm run lint` — clean (note: lint also scans `scratch/`).
- [ ] `npm run build` — succeeds.
- [ ] `npx playwright test` (stop any `:4184` server first) — all pass.
- [ ] Screenshots at 1440×900 and 375×812 of: home, Build for a game with results (Fortnite 1080p Epic, 240 fps, £1000 — expect a Cheapest card well under £1000), CPU picker, peripherals. Phone shots match pre-change layout.
- [ ] Run `scratch/audit-a11y.js` checks on the new screens: 0 text <12px, 0 targets <24px.
- [ ] Commit any prerender/test fixture changes. Do not push.
