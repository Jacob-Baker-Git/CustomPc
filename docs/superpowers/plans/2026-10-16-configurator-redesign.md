# Configurator Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the circuit-board / RAM-stick look with the approved "configurator" look, and make every phone screen lead with its answer: a step header on top, a pinned dock at the bottom, and detail folded one tap away with its key numbers showing.

**Architecture:** Two new primitives carry most of it. `Fold` is a native `<details>` that is closed on phones and open on desktop, with a sticky header and a headline summary. `BuilderChrome` is the slim top bar, the step header and the phone dock. Each screen then swaps its RAM-box panels and board background for plain hairline-divided sections, and wraps its detail in `Fold`s. Pure helpers (`dockTotalLabel`, `firstFew`, `perfFoldSummaries`) hold the logic so it is unit-tested apart from layout.

**Tech Stack:** React 19, Vite 8, Tailwind 3 (tokens in `src/index.css` + `tailwind.config.js`), Zustand 5, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-configurator-redesign-design.md`
**Visual reference:** `.superpowers/brainstorm/1258-1792174037/content/configurator-direction.html` (git-ignored; the three phone mockups the user approved)

## Global Constraints

- Branch `feat/configurator-redesign` off `feat/new-flow` (head `427f6bf`). **Never push.** Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Palette:** keep the existing tokens in `src/index.css` (`--ground #0E0F11`, `--ink`, `--muted`, `--faint`, `--line`, `--brass #E0A93B`). They already match the mockup within its "starting point" tolerance and are AA-pinned by `paletteContrast.test.js`. Brass is the only accent. The orange `--accent` stays wordmark-only (`accentIsBrandOnly.test.js`). Dark only.
- **Type:**
  - Headings: wide Archivo (`font-wide`, width 125%).
  - Body: Hanken Grotesk.
  - Tags and scale labels: JetBrains Mono.
  - Text is never under 11px.
  - Body contrast is AA at least.
- **Bracket tags** (`[ ultra / 1440p ]`) are the one PC signature. Use them sparingly, no more than 2 per screen.
- **No boxes per row:** rows are split by 1px `border-line` hairlines, with no rounded card per row, no icon-in-a-box rows and no glows.
- **Phone** means below `lg` (1024px); **desktop** means `lg` and up. Desktop keeps its wide layouts.
- **3D:** stays opt-in on coarse-pointer devices (`Deferred3D`, no 11 MB download unasked), and lives on Summary only.
- **Fonts:** self-hosted only (`font-src 'self'`). Report the added bytes.
- **Folds:** at most two disclosure levels; a fold's summary always shows its key numbers.
- **Names:** no renames. The tabs and hashes stay `build`, `performance`, `peripherals` and `summary`, and the visible labels are "Build", "Performance", "Peripherals" and "Summary".
- **Gate:**
  - `npm run lint && npx vitest run && npm run build`
  - `npx playwright test` (never at the same time as vitest)
  - `npm run prerender`, then commit the fragments.
- **CRLF:** the working tree is CRLF; `prerendered/*.html` are LF. Scripted edits detect the line ending.

## Review Focus

1. **A picked peripheral outside the first 4** stays visible, not hidden behind "Show all". Pinned in Task 7.
2. **A search, filter or non-default sort on Peripherals** shows every match, with no cap. Pinned in Task 7.
3. **The Peripherals tab with peripherals chosen:** the dock reads "Build £X + desk £Y", never one silently merged figure. Pinned in Task 4.
4. **The Summary tab with an empty build:** the dock's "Save build" is disabled and the dock shows £0, with nothing broken. Pinned in Task 4.
5. **A fold mounted at desktop width** starts open, and at phone width starts closed. A user who opens one keeps it open across re-renders. Pinned in Task 3.

---

### Task 1: Wide display face and the tag

**Files:**
- Create: `public/fonts/archivo-wide-latin.woff2`
- Create: `src/components/ui/Tag.jsx`
- Modify: `src/fonts.css` (new `@font-face`), `tailwind.config.js` (`fontFamily.wide`)
- Test: `src/tests/wideFont.test.js`, `src/tests/Tag.test.jsx`

**Interfaces:**
- Produces:
  - the Tailwind class `font-wide` (family `'Archivo Wide'`);
  - `<Tag>{children}</Tag>`, which renders `[ children ]` in mono at 11.5px, `text-muted`. A `<b>` inside it is brass.

- [ ] **Step 1: Write the failing tests.** In `wideFont.test.js`, read `src/fonts.css` and assert:
  - an `@font-face` with `font-family: 'Archivo Wide'`, `font-stretch: 125%` and `src: url(/fonts/archivo-wide-latin.woff2)`;
  - the file exists;
  - `statSync(...).size < 60_000`.

  In `Tag.test.jsx`, `render(<Tag>ultra / 1440p</Tag>)` has the text content `[ ultra / 1440p ]`.
- [ ] **Step 2: Run them.** `npx vitest run src/tests/wideFont.test.js src/tests/Tag.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Get the font.** **Ask the user first**, naming the file, its source and the size reported by the CSS API.
  - Fetch `https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,700..900&display=swap` with a Chrome user-agent so it returns woff2.
  - Take the `/* latin */` block's URL and save it as `public/fonts/archivo-wide-latin.woff2`.
  - Add the `@font-face` with family `'Archivo Wide'`, `font-weight: 700 900`, `font-stretch: 125%`, `font-display: swap` and the latin `unicode-range`.
  - Add `wide: ['Archivo Wide', 'Archivo', ...]` to `tailwind.config.js`. This is a config change, so restart the dev server.
- [ ] **Step 4: Implement `Tag` in `src/components/ui/Tag.jsx`.**
- [ ] **Step 5: Run the tests.** Expected: PASS. Note the font byte size for the final report.
- [ ] **Step 6: Commit.** `feat(ui): wide display face and bracket tag`

### Task 2: Remove the circuit-board background

**Files:**
- Delete: `src/components/BoardBackground.jsx`, `src/lib/boardPlan.js`, `src/tests/BoardBackground.test.jsx`, `src/tests/boardPlan.test.js`, `e2e/boardBackground.spec.js`
- Modify: `src/components/MainMenu.jsx`, `src/components/SiteChrome.jsx`, `src/components/SiteFooter.jsx`, `src/components/performance/Section.jsx`, `src/screens/BuilderScreen.jsx`, `src/lib/boardGeometry.js` (keep only what is still imported; delete it if nothing is), `src/tests/indexHtml.test.js`, `src/tests/performanceChrome.test.jsx`, `e2e/builderLegibility.spec.js`
- Test: `src/tests/noHardwareMotifs.test.js`

**Interfaces:** Produces nothing new. The page background is plain `--ground`.

- [ ] **Step 1: Write the failing test.** `noHardwareMotifs.test.js` globs `src/**/*.{js,jsx}` (excluding `src/tests/`) and asserts that no file contains `BoardBackground` or `data-board`. Leave a `describe` for Tasks 5 and 6 to extend.
- [ ] **Step 2: Run it.** Expected: FAIL, listing the five importers.
- [ ] **Step 3: Remove the background.** Remove each `<BoardBackground …/>`, along with the scrim and z-index comments that existed only because of it, and delete the files listed above.
  - `indexHtml.test.js` and `performanceChrome.test.jsx`: drop only the assertions about the board.
  - `builderLegibility.spec.js` keeps its intent (no text sits directly on the page background without a surface) but loses its board-layer selectors. Read its `offenders()` and retarget it at `--ground`.
- [ ] **Step 4: Run the tests.** `npx vitest run` and `npx playwright test e2e/builderLegibility.spec.js e2e/footer.spec.js`. Expected: PASS.
- [ ] **Step 5: Commit.** `refactor(ui): drop the circuit-board background`

### Task 3: `Fold`, the one disclosure primitive

**Files:**
- Create: `src/components/ui/Fold.jsx`, `src/hooks/useIsDesktop.js`
- Test: `src/tests/Fold.test.jsx`

**Interfaces:**
- Produces:
  - `useIsDesktop(): boolean`, which reads `matchMedia('(min-width: 1024px)')` once at mount and returns false where `matchMedia` is missing (jsdom).
  - `<Fold title: string, summary: ReactNode, openOnDesktop = true, id?: string>{children}</Fold>`, a native `<details>`. Its `<summary>` holds the `title` in bold, the `summary` in muted text on the line below, and a `+`/`−` mark. Hairline top border.

- [ ] **Step 1: Write the failing tests.**
  - `'starts closed on a phone'`: with `matchMedia` absent, the `details` has no `open` attribute.
  - `'starts open on desktop'`: stub `window.matchMedia = () => ({ matches: true })`, and `open` is present.
  - `'shows the key numbers while closed'`: the text `132 W gaming` is in the `summary`.
  - `'keeps the user's choice across re-renders'`: open it, `rerender` with the same props, and it is still open (Review Focus 5).
  - `'pins its header while open'`: the `summary` has the classes `sticky` and `top-0`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `open` is the initial value only. Don't control it after mount: let `<details>` own it via `onToggle`, and don't re-apply the default.
  - Opening must not scroll the page, so no `scrollIntoView`.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(ui): Fold - closed on phones, open on desktop, headline always shown`

### Task 4: Builder chrome (slim top bar, step header, phone dock)

**Files:**
- Create: `src/components/StepHeader.jsx`, `src/components/Dock.jsx`, `src/lib/dock.js`, `src/hooks/useBuildActions.js`
- Modify: `src/components/TopBar.jsx` (one row below `lg`: back, wordmark, editable budget; `DynamicBars` only at `lg`+), `src/screens/BuilderScreen.jsx`, `src/components/BuildSummary.jsx` (Save/Share/Clear handlers move into `useBuildActions`)
- Delete: `src/components/ViewTabs.jsx`, `src/components/NextStep.jsx`, `src/tests/NextStep.test.jsx`
- Modify: `e2e/helpers.js` (`openTab` targets the step header), `e2e/topBar.spec.js` (re-measure the new header; keep the one-row guard)
- Test: `src/tests/dock.test.js`, `src/tests/StepHeader.test.jsx`, `src/tests/Dock.test.jsx`

**Interfaces:**
- Consumes: `VIEWS` and `stepsFor(path)` from `src/hooks/useHashView.js`, `selTotalSpent` and `selPeripheralsTotal` from the store.
- Produces:
  - `dockTotalLabel({ view, build: number, desk: number }): string`. It returns `Build £1,576`, or `Build £1,576 + desk £120` when `view === 'peripherals'`, or when `view === 'summary' && desk > 0`. Uses en-GB grouping and no pence.
  - `dockAction({ view, path }): { label: string, to?: string } | null`. It returns `Next: Performance` → `performance`, and so on, following `stepsFor(path)`, and `null` on `summary`, where the dock renders Save and Share instead.
  - `useBuildActions(): { save(name?), share(), canSave: boolean }`. `canSave` is false when the build is empty.
  - `<StepHeader view onChange />` renders all four `VIEWS` as `01 Build · 02 Performance · 03 Peripherals · 04 Summary` buttons:
    - The current one has `aria-current="page"`, bold text and a brass underline.
    - Earlier ones are muted.
    - It scrolls sideways when it doesn't fit.
  - `<Dock view onChange />` is fixed to the bottom and hidden at `lg`+. On desktop, the in-page Next button replaces `NextStep`: `<Dock inline />` renders just the action, right-aligned, at `lg`+.

- [ ] **Step 1: Write the failing tests.**
  - `dock.test.js`:
    - `dockTotalLabel({view:'build',build:1576,desk:0})` is `'Build £1,576'`.
    - On peripherals with desk 120 it is `'Build £1,576 + desk £120'` (Review Focus 3).
    - On summary with desk 0 it is `'Build £1,576'`.
    - `dockAction({view:'build',path:'parts'})` is `{label:'Next: Performance',to:'performance'}`.
    - With `path:'game'` and `view:'build'`, `to` is `'peripherals'`.
    - On summary it is `null`.
  - `StepHeader.test.jsx`:
    - Four buttons named `/build/i`, `/performance/i`, `/peripherals/i` and `/summary/i`.
    - The current one has `aria-current="page"`.
    - Clicking "Summary" calls `onChange('summary')`.
  - `Dock.test.jsx`:
    - On `summary` with an empty build, the "Save build" button is disabled and `Build £0` is shown (Review Focus 4).
    - On `performance` it shows "Next: Peripherals".
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement the pieces.**
  - The helpers in `src/lib/dock.js`.
  - `useBuildActions`, extracted from `BuildSummary` without changing its behaviour.
  - `StepHeader` and `Dock`.
  - Wire them into `BuilderScreen`: `TopBar`, then `StepHeader` under it at every width, then the view, then `Dock`. Remove the `ViewTabs` bar and its `pb-16`; add bottom padding equal to the dock height below `lg`.
- [ ] **Step 4: Run the tests.** `npx vitest run`, then `npx playwright test e2e/topBar.spec.js e2e/wizard.spec.js e2e/mobileLayout.spec.js`. Fix only selectors and re-measured heights; don't loosen intent.
- [ ] **Step 5: Commit.** `feat(builder): slim top bar, step header and phone dock`

### Task 5: Replace the RAM-stick panels and board designators

**Files:**
- Create: `src/components/ui/Block.jsx`
- Delete: `src/components/RamBox.jsx`, `src/lib/ramBoxGeometry.js`, `src/tests/RamBox.test.jsx`, `src/tests/ramBoxGeometry.test.js`, `e2e/ramBox.spec.js`
- Modify: every `RamBox` importer (`MainMenu`, `SelectedPartsPanel`, `SavedBuilds`, `BuildRatingPanel`, `BuildWarnings`, `BuildSummary`, `PeripheralsPanel`), `src/lib/uiTokens.js` (drop RamBox references), `src/components/art/PartArt.jsx` (comment only), `src/components/performance/StatPanel.jsx` (drop the `designator` prop), `src/components/performance/PerformanceScreen.jsx` (drop the `designator=` props), `src/components/PartSlot.jsx` (drop `CONNECTOR`, `Pad` and the designator label; keep the slot row, now as a hairline row)
- Modify tests: `MainMenu.test.jsx` (drop the RAM-blade describe, keep the three-button tests), `BuildWarnings.test.jsx`, `PeripheralsPanel.test.jsx`, `SelectedPartsPanel.test.jsx`, `PartSlot.test.jsx`
- Test: extend `noHardwareMotifs.test.js`

**Interfaces:**
- Produces `<Block as="section" title?: string, aside?: ReactNode, className?>`: a plain section with an optional `font-wide` heading row (with `aside` on the right) and children below. No border box and no radius; a hairline top border separates blocks.

- [ ] **Step 1: Extend the guard.** No file in `src/` (outside `src/tests/`) contains `RamBox`, `ramBoxGeometry`, `data-designator`, `DIMM_A2`, `PCIEX16` or `CPU_FAN`.
- [ ] **Step 2: Run it.** Expected: FAIL, listing the importers.
- [ ] **Step 3: Swap the panels.** Replace each `<RamBox …>` with `<Block>`, moving any heading inside it into `title`. Remove the designators and pads. Delete the listed files.
- [ ] **Step 4: Run the tests.** `npx vitest run`, then `npx playwright test`. Fix selectors that targeted `[data-ram-box]` or blades; delete assertions that only described the stick.
- [ ] **Step 5: Commit.** `refactor(ui): plain hairline blocks replace RAM-stick panels and board designators`

### Task 6: Performance tab — answer first, the rest folded with numbers

**Files:**
- Create: `src/lib/perfFoldSummaries.js`
- Modify: `src/components/performance/PerformanceScreen.jsx`, `src/components/performance/GameEstimate.jsx` (restyle: `font-wide` game name and figure, a `Tag` for `[ preset / res ]`)
- Test: `src/tests/perfFoldSummaries.test.js`, `src/tests/PerformanceScreen.test.jsx`

**Interfaces:**
- Consumes: `Fold` (Task 3), `Tag` (Task 1).
- Produces `perfFoldSummaries({ report, power, thermals, memory, gpuCap, answered, total }): { holding: string, power: string, hardware: string, games: string }`. Examples, which are the test values:
  - `power`: `'132 W gaming · supply has 58% spare'`. With no PSU it is `'132 W gaming · no supply chosen'`.
  - `hardware`: `'8 GB DDR4 · one stick'` (from `memory.capacityGb`, `memory.type` and `channels === 'single'`).
  - `games`: `'53 of 60 games answered'`.
  - `holding`: `'Graphics-limited in 5 of 5 games'` from `report.bottleneck`, or `'Needs benchmark data'` when there is none.

- [ ] **Step 1: Write the failing tests.**
  - `perfFoldSummaries.test.js` covers the four strings above, plus the no-PSU and no-bottleneck variants.
  - In `PerformanceScreen.test.jsx`:
    - `'folds every section under the estimate'`: four `details` elements whose summaries contain those strings.
    - `'shows the estimate before any fold'`: the estimate heading comes before the first `details` in the document.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Restructure the tab.**
  - `GameEstimate` stays unfolded at the top.
  - Then `Fold`s:
    - "What's holding it back"
    - "Power and cooling"
    - "The hardware"
    - "Every game at once", which now also contains `SummaryStrip` and `BasisBar`, replacing the existing `<details>`.
  - Each `Section`'s blurb moves inside its fold.
- [ ] **Step 4: Run the tests.** `npx vitest run src/tests/perfFoldSummaries.test.js src/tests/PerformanceScreen.test.jsx`, then `npx playwright test e2e/performance.spec.js`. `openAllGames` in `e2e/helpers.js` now opens the "Every game at once" fold.
- [ ] **Step 5: Commit.** `feat(performance): estimate first, every other section folded with its headline numbers`

### Task 7: Peripherals — four per category, show all on request

**Files:**
- Modify: `src/lib/peripheralFilter.js` (add `firstFew`), `src/components/PeripheralsPanel.jsx` (cards become hairline rows; the header block becomes a `Block` with `title="Peripherals"` and the subtotal as `aside`)
- Test: `src/tests/peripheralFilter.test.js` (or a new `firstFew.test.js`), `src/tests/PeripheralsPanel.test.jsx`

**Interfaces:**
- Produces `firstFew(items, { pickedId?: string, capped: boolean, limit = 4 }): { visible: Item[], hidden: number }`.
  - When `capped`, it returns the first `limit` items, plus the picked item if it sits outside them (keeping list order), and `hidden` = the rest.
  - When not capped, it returns all items and `hidden: 0`.

- [ ] **Step 1: Write the failing tests.**
  - `firstFew` with 36 items and `capped: true` gives 4 visible and 32 hidden.
  - With the picked item at index 20, 5 are visible and it is among them (Review Focus 1).
  - With `capped: false`, all 36 are visible (Review Focus 2).
  - Panel test: with no filters, the monitor section shows 4 items and a button named `Show all 36 monitors`. Clicking it shows 36.
  - Panel test: after typing in the search box, the 4-item cap no longer applies.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** `capped = !anyFilter && !expanded[id]`; `anyFilter` already exists in the panel. Keep `SpecSheet` behind the Info toggle.
- [ ] **Step 4: Run the tests.** `npx vitest run src/tests/PeripheralsPanel.test.jsx`, then `npx playwright test e2e/peripherals.spec.js`.
- [ ] **Step 5: Commit.** `feat(peripherals): first four per category, the rest one tap away`

### Task 8: Summary — score and price first, score once, 3D as the picture

**Files:**
- Modify: `src/screens/BuilderScreen.jsx` (Summary grid; the 3D panel goes edge to edge with the ground fade, no bordered panel), `src/components/BuildSummary.jsx` (remove its duplicate score block; the parts list shows 4 below `lg` with a `+N more parts` button; Save/Share move to the dock on phones and stay in-page on desktop through `useBuildActions`), `src/components/BuildRatingPanel.jsx` (the score row restyled in `font-wide`; "Best next move" stays open; the per-part breakdown goes inside a `Fold`)
- Test: `src/tests/BuilderScreenViews.test.jsx`, `src/tests/BuildSummary.test.jsx`

**Interfaces:**
- Consumes: `Fold`, `Tag`, `Block` and `useBuildActions` (Tasks 1, 3, 4 and 5).

- [ ] **Step 1: Write the failing tests.**
  - In `BuilderScreenViews.test.jsx`: `'shows the score once on Summary'` — exactly one `/100` text.
  - In `BuildSummary.test.jsx`, with `useIsDesktop` false: 4 part rows plus a button named `/\+5 more parts/`. Clicking it shows all 9.
- [ ] **Step 2: Run them.** Expected: FAIL (two `/100`; 9 rows).
- [ ] **Step 3: Implement.**
  - Order on phones: score and price, then best next move, then the parts list, then the 3D panel (opt-in on touch, as today).
  - Desktop keeps 3D beside the score.
- [ ] **Step 4: Run the tests.** `npx vitest run`, then `npx playwright test e2e/wizard.spec.js e2e/share.spec.js e2e/mobileLayout.spec.js`.
- [ ] **Step 5: Commit.** `feat(summary): score and price first, one score, the PC as the picture`

### Task 9: Welcome and Build-for-a-game

**Files:**
- Create: `scripts/capture-welcome-render.mjs`, `public/img/welcome-pc.webp`
- Modify: `src/components/MainMenu.jsx` (the mockup's layout), `src/screens/TargetScreen.jsx` (`BuildOption`: fps, price and "Use this build" in one row at the top; the parts list inside `<details>` titled "9 parts")
- Test: `src/tests/MainMenu.test.jsx`, `src/tests/TargetScreen.test.jsx`

**Interfaces:**
- The capture script runs under the repo's `@playwright/test` from the repo root. It builds a PC through "Build for a game" (Cyberpunk 2077, £1600) and screenshots the Summary 3D panel. It then re-encodes the image to WebP in-page (draw onto a 2D canvas, `toDataURL('image/webp', 0.8)`), crops it to the model, and writes `public/img/welcome-pc.webp`. It must be ≤ 300 KB.

- [ ] **Step 1: Write the failing tests.**
  - `MainMenu.test.jsx`:
    - `'shows the PC picture'`: an `img` with `src="/img/welcome-pc.webp"` and `alt=""` (it's decorative).
    - `'states the benchmark coverage'`: the text `[ 60 games benchmarked ]`, with the count from `perfGames.json`'s length, not hard-coded.
    - The existing exactly-three-buttons test stays green.
  - `TargetScreen.test.jsx`, `'leads each option with fps, price and the button'`: inside the first option, the "Use this build" button comes before the `details` holding the parts.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement both screens.** Run the capture script with the dev server up and report the image bytes. Then `npm run prerender`; the hub fragment changes.
- [ ] **Step 4: Run the tests.** `npx vitest run src/tests/MainMenu.test.jsx src/tests/TargetScreen.test.jsx src/tests/headingStructure.test.jsx src/tests/landmarks.test.jsx`, then `npx playwright test e2e/wizard.spec.js e2e/csp.spec.js`.
- [ ] **Step 5: Commit.** `feat(welcome): the PC as the picture, wide headline, two paths` (include `prerendered/`)

### Task 10: Content pages, Saved builds and the shared chrome

**Files:**
- Modify: `src/components/SiteChrome.jsx` (header in the new style; `font-wide` page titles), `src/components/SavedBuilds.jsx`, `src/components/HelpPage.jsx`, `src/components/GlossaryPage.jsx`, `src/components/LegalPage.jsx`, `src/components/FeedbackPage.jsx`, `src/components/PartsBrowser.jsx`, `src/components/PartPage.jsx`, `src/components/SiteFooter.jsx`, `src/App.jsx` (404 view)
- Test: `src/tests/pageTitles.test.jsx`

**Interfaces:** Consumes `Block` and `Tag`.

- [ ] **Step 1: Write the failing test.** `pageTitles.test.jsx` renders each content page inside `SiteChrome` and asserts that its `h1` has the class `font-wide`.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Restyle each page** within the system: hairline-divided lists and FAQ rows (FAQ entries as `Fold`s), `Tag`s at most twice per page, and no boxes per row.
- [ ] **Step 4: Run the tests.** `npx vitest run`, `npm run prerender`, `npx playwright test e2e/partPages.spec.js e2e/partsBrowser.spec.js e2e/footer.spec.js`.
- [ ] **Step 5: Commit.** `feat(ui): content pages and saved builds in the configurator style` (include `prerendered/`)

### Task 11: Measure, verify, report

**Files:**
- Create: `scripts/measure-mobile-heights.mjs` (the recon script from the brainstorm, kept: iPhone 13 device and a path-2 build, recording each screen's height in screens, with folds closed)

- [ ] **Step 1: Measure.** Run it against `feat/new-flow` (check that branch out in a temporary `git worktree` and start its dev server on another port) and against this branch. Record both tables in the final report.
  - Expected on this branch: Peripherals ≤ 3 screens; Performance and Summary ≤ 2.
  - If a screen misses, report the number and what pushes it over. Do not change the target.
- [ ] **Step 2: Screenshot each screen** at 390×844 and 1440×900 into `scratch/out/redesign/`, and check them against the mockup.
- [ ] **Step 3: Run the full gate.** Lint, vitest, build, prerender (with no drift after the commit), `npx playwright test` (both projects).
- [ ] **Step 4: Commit the script.** `chore: phone screen-height measurement script`
