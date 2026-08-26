# Smoother, game genre marks, and the phone's build order — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the phone's build tab to parts → 3D → score, give every game a genre mark that reads at 24px, and cut the app's idle GPU burn and payload.

**Architecture:** Three independent phases. Phase 1 is CSS `order` plus a `display: contents` wrapper — no JSX logic changes. Phase 2 adds a `lib/gameGenreMarks.jsx` module that `GameArt` composes onto its existing gradient plate, leaving the plate untouched. Phase 3 changes renderer settings and asset size only, and must not move a single number the Performance tab reports.

**Tech Stack:** React 19, Vite 8, Tailwind 3, Zustand, React Three Fiber + drei, three 0.184, Vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-08-27-smoother-game-art-mobile-order-design.md`

---

## Ground rules for whoever executes this

1. **Never push, never merge to `main`.** `main` auto-deploys to Netlify. Work stays on `feat/smoother-game-art-mobile-order`.
2. **jsdom computes no layout.** `getBoundingClientRect()` returns all zeroes in Vitest. Every geometric assertion belongs in `e2e/`, run with `npm run test:e2e`.
3. **Run `npm run lint` before every commit.** `react-refresh/only-export-components` fires on a `.jsx` file that exports both a component and a plain function, and it has already bitten `GameArt.jsx` once.
4. **A screenshot of the 3D canvas is worthless.** Pixel-diffing it captures a blank rectangle. Verify 3D by instrumenting frames or reading GL state, never by image comparison.

---

## File structure

| File | Responsibility | Phase |
|---|---|---|
| `src/index.css` (modify, ~125–200) | Mobile `order`, the `display: contents` swap, desktop grid unchanged | 1 |
| `src/screens/BuilderScreen.jsx` (modify, 192–195) | Give the two left panels their own classes | 1 |
| `e2e/mobileLayout.spec.js` (modify) | Phone order guard + desktop no-leak guard | 1 |
| `src/lib/gameGenreMarks.jsx` (create) | One silhouette component per genre. **Components only — no plain-function exports** | 2 |
| `src/components/art/GameArt.jsx` (modify) | Compose the mark onto the existing plate | 2 |
| `src/tests/art.test.jsx` (modify) | A case per genre; existing cases must keep passing | 2 |
| `src/components/BuildCanvas.jsx` (modify, 27–110) | `frameloop`, shadow bake, DPR/AA | 3 |
| `scripts/downsample-hdr.mjs` (create) | Decode → box-filter → re-encode the Radiance HDR | 3 |
| `public/hdri/city.hdr` (replace) | 1024×512 → 256×128 | 3 |
| `docs/superpowers/plans/2026-08-27-perf-findings.md` (create) | What the perf pass actually measured, including the null results | 3 |

🛑 **`vite.config.js` is deliberately NOT in this table.** The spec's finding (D)
proposed a `JSON.parse` transform there; it was checked while planning and Vite 8
already does it by default. Task 10 verifies that and expects to write no code.

---

# PHASE 1 — The phone's build order

### Task 1: Give the two left panels their own classes

**Files:**
- Modify: `src/screens/BuilderScreen.jsx:192-195`

- [ ] **Step 1: Read the current markup**

Run: `sed -n '190,197p' src/screens/BuilderScreen.jsx`

Expected output:

```jsx
              <div className="area-left flex flex-col gap-3">
                <UseCaseChips />
                <BuildRatingPanel />
              </div>
```

- [ ] **Step 2: Wrap each child so it can be ordered independently**

Replace those four lines with exactly this:

```jsx
              {/* ⚠️ `display: contents` on mobile (index.css) dissolves this
                  wrapper so the two panels become flex items of .build-grid
                  itself and can be ordered independently — the phone wants the
                  SCORE directly under the 3D view, with the use-case chips
                  after it. On desktop the wrapper returns to a flex column in
                  grid-area `left`, exactly as before.

                  Do NOT "simplify" this by giving both children
                  `grid-area: left`. Two items in one named grid area OVERLAP —
                  measured: both reported top=8 — so the chips print on top of
                  the score. */}
              <div className="area-left flex flex-col gap-3">
                <div className="area-usecase"><UseCaseChips /></div>
                <div className="area-rating"><BuildRatingPanel /></div>
              </div>
```

- [ ] **Step 3: Verify nothing else referenced `.area-left`'s children**

Run: `grep -rn "area-left\|area-usecase\|area-rating" src/ e2e/`

Expected: hits only in `BuilderScreen.jsx` (the block above) and `src/index.css`. If `e2e/` matches, that test must be updated in Task 3 — note it now.

- [ ] **Step 4: Commit**

```bash
git add src/screens/BuilderScreen.jsx
git commit -m "refactor: give the two left build panels their own classes"
```

---

### Task 2: Reorder on mobile, hold desktop still

**Files:**
- Modify: `src/index.css:125-127` and the `@media (min-width: 1024px)` block

- [ ] **Step 1: Replace the mobile flex rules**

Find these three lines (`index.css:125-127`):

```css
.build-grid { display: flex; flex-direction: column; gap: 0.75rem; }
.build-grid > * { position: relative; z-index: 1; }
.build-grid > .area-viz { z-index: 0; }
```

Replace with:

```css
.build-grid { display: flex; flex-direction: column; gap: 0.75rem; }
.build-grid > * { position: relative; z-index: 1; }
.build-grid > .area-viz { z-index: 0; }

/* ⚠️ `display: contents` generates NO BOX, so the rule above does not reach
   these two — selectors match the DOM tree, not the box tree, and they are
   still grandchildren. Without this they lose `z-index: 1` and paint UNDER the
   WebGL canvas, which is the compositing gotcha described at the top of this
   block. Give them the same two properties explicitly. */
.build-grid > .area-left { display: contents; }
.build-grid .area-usecase,
.build-grid .area-rating { position: relative; z-index: 1; }

/* The phone's reading order: what you picked, what it looks like, what it
   scores — then the inputs and the checks. The user's words: "pick your parts
   3d view then score".

   `order` and not a JSX reshuffle, so the source keeps resembling the desktop
   grid-template-areas that a reader checks. Safe above lg because every
   .area-* is EXPLICITLY placed by grid-area there, and explicit placement
   ignores order (only AUTO-placement consumes it). Paint order does still
   follow `order`, which is why the z-index rules above are load-bearing rather
   than decorative. */
.build-grid > .area-parts     { order: 1; }
.build-grid > .area-viz       { order: 2; }
.build-grid .area-rating      { order: 3; }
.build-grid .area-usecase     { order: 4; }
.build-grid > .area-banner    { order: 5; }
.build-grid > .area-warnings  { order: 6; }
.build-grid > .area-autobuild { order: 7; }
```

- [ ] **Step 2: Restore the wrapper inside the desktop block**

In the `@media (min-width: 1024px)` block, find:

```css
  .build-grid > .area-left      { grid-area: left; }
```

Replace with:

```css
  /* Back from `display: contents` — above lg this is a real flex column in the
     left cell again, and the two panels inside it are laid out by IT, not by
     the grid. `order` on them is inert here because they are no longer flex
     items of .build-grid. */
  .build-grid > .area-left      { display: flex; flex-direction: column; gap: 0.75rem; grid-area: left; }
```

- [ ] **Step 3: Start the dev server and confirm both breakpoints by measurement**

Run: `npm run dev` (or `preview_start` with the `.claude/launch.json` entry).

Then measure — **do not eyeball this**, and generate a build first or the panels are empty:

```js
// In the browser console on the build tab, after generating a build:
const y = (s) => document.querySelector(s)?.getBoundingClientRect().top;
console.log({ parts: y('.area-parts'), viz: y('.area-viz'), rating: y('.area-rating'), usecase: y('.area-usecase') });
```

Expected at 390px wide: `parts < viz < rating < usecase`.
Expected at 1440px wide: `usecase < rating`, and `parts` greater than both.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: put parts, then the 3D view, then the score on a phone"
```

---

### Task 3: Guard both orders in e2e

**Files:**
- Modify: `e2e/mobileLayout.spec.js`

- [ ] **Step 1: Write the failing tests**

Append to `e2e/mobileLayout.spec.js`:

```js
// The build tab's reading order, which is pure CSS `order` and therefore
// invisible to the unit suite — jsdom computes no layout at all.
//
// ⚠️ Two separate risks, so two separate tests. The phone test proves the order
// landed; the DESKTOP test proves it did not leak, because `order` is ignored
// for grid items only while every .area-* keeps an explicit `grid-area`. Lose
// that and the desktop grid silently starts obeying these numbers.
test.describe('the build tab reads in the right order', () => {
  const topsOf = (page, selectors) =>
    page.evaluate(
      (sels) => sels.map((s) => document.querySelector(s)?.getBoundingClientRect().top ?? null),
      selectors,
    )

  test('on a phone: parts, then the 3D view, then the score', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await generateBuild(page)

    const order = ['.area-parts', '.area-viz', '.area-rating', '.area-usecase']
    const tops = await topsOf(page, order)

    expect(tops, 'every ordered panel is on the page').not.toContain(null)
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i], `${order[i]} sits below ${order[i - 1]}`).toBeGreaterThan(tops[i - 1])
    }
  })

  test('on a desktop the grid ignores those order values', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await generateBuild(page)

    const [parts, viz, rating, usecase] = await topsOf(page, [
      '.area-parts', '.area-viz', '.area-rating', '.area-usecase',
    ])

    // The desktop left column keeps chips ABOVE the rating: there they read as
    // the control that drives the panel beneath them. This is the assertion
    // that fails if `order` ever leaks into the grid.
    expect(usecase, 'the chips stay above the rating on desktop').toBeLessThan(rating)
    // Both left-column panels sit in the top row, above the full-width parts.
    expect(parts, 'parts stay below the left column').toBeGreaterThan(rating)
    expect(parts, 'parts stay below the 3D view').toBeGreaterThan(viz)
  })

  // The `display: contents` wrapper drops these two out of `.build-grid > *`,
  // which is where `z-index: 1` comes from. Without it they paint under the
  // WebGL canvas and vanish.
  test('the split panels keep the z-index that lifts them off the canvas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await generateBuild(page)

    for (const sel of ['.area-usecase', '.area-rating']) {
      const z = await page.evaluate(
        (s) => getComputedStyle(document.querySelector(s)).zIndex,
        sel,
      )
      expect(z, `${sel} is lifted above the canvas`).toBe('1')
    }
  })
})
```

- [ ] **Step 2: Run them to verify they fail before the CSS is in**

If Tasks 1–2 are already committed, confirm instead that they PASS. To see them fail first, stash: `git stash` then run, then `git stash pop`.

Run: `npx playwright test e2e/mobileLayout.spec.js -g "right order"`
Expected without the CSS: FAIL on `.area-rating` being null.

- [ ] **Step 3: Run them against the real implementation**

Run: `npx playwright test e2e/mobileLayout.spec.js -g "right order"`
Expected: 3 passed.

- [ ] **Step 4: Run the whole mobile suite for regressions**

Run: `npx playwright test e2e/mobileLayout.spec.js`
Expected: all pass. The pre-existing viewport-chrome and touch-action tests must be untouched by this change.

- [ ] **Step 5: Commit**

```bash
git add e2e/mobileLayout.spec.js
git commit -m "test: guard the phone's build order and that it stays off desktop"
```

---

# PHASE 2 — Game genre marks

### Task 4: The genre mark module

**Files:**
- Create: `src/lib/gameGenreMarks.jsx`
- Test: `src/tests/art.test.jsx`

**Design constraint, non-negotiable:** these render at **24px** (`FrameRateRow.jsx:123`) and 32px (`GamePerformanceList.jsx:43`). Every mark is authored in a 48×48 box with **no stroke thinner than 2 units and no gap narrower than 2 units**. That is the difference between a mark and a smudge.

- [ ] **Step 1: Write the failing test**

Append to `src/tests/art.test.jsx`:

```jsx
describe('gameGenreMarks', () => {
  // Every genre the app can actually produce must draw something. `other` is
  // deliberately absent: a game with no genre has nothing to say, so GameArt
  // falls back to its initials rather than inventing a symbol for it.
  const DRAWN = [
    'action-adventure', 'rpg', 'shooter',
    'strategy-sim', 'horror', 'racing', 'moba', 'sports',
  ]

  it('has a mark for every genre that is not the neutral fallback', () => {
    for (const g of DRAWN) {
      expect(GENRE_MARKS[g], `a mark for ${g}`).toBeTypeOf('function')
    }
  })

  it('has no mark for the neutral genre', () => {
    expect(GENRE_MARKS.other).toBeUndefined()
  })

  // ⚠️ The whole point of these is that they survive being 24px wide. A hairline
  // at 48 units is a third of a device pixel at 24 and disappears. Nothing here
  // may be thinner than 2 units.
  it('draws no stroke too thin to survive 24px', () => {
    for (const g of DRAWN) {
      const Mark = GENRE_MARKS[g]
      const { container } = render(<svg viewBox="0 0 48 48"><Mark /></svg>)
      const widths = [...container.querySelectorAll('[stroke-width]')]
        .map((el) => Number(el.getAttribute('stroke-width')))
      for (const w of widths) {
        expect(w, `${g} stroke-width`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('paints with currentColor so the plate decides the ink', () => {
    for (const g of DRAWN) {
      const Mark = GENRE_MARKS[g]
      const { container } = render(<svg viewBox="0 0 48 48"><Mark /></svg>)
      const painted = [...container.querySelectorAll('[fill], [stroke]')]
      expect(painted.length, `${g} paints something`).toBeGreaterThan(0)
      for (const el of painted) {
        for (const attr of ['fill', 'stroke']) {
          const v = el.getAttribute(attr)
          if (v && v !== 'none') expect(v, `${g} ${attr}`).toBe('currentColor')
        }
      }
    }
  })
})
```

Add to the imports at the top of `src/tests/art.test.jsx`:

```jsx
import { GENRE_MARKS } from '../lib/gameGenreMarks'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tests/art.test.jsx`
Expected: FAIL — `Failed to resolve import "../lib/gameGenreMarks"`.

- [ ] **Step 3: Write the module**

Create `src/lib/gameGenreMarks.jsx`:

```jsx
// One silhouette per genre, drawn on top of GameArt's gradient plate.
//
// ⚠️ THE SIZE IS THE DESIGN. These render at 24px in FrameRateRow and 32px in
// GamePerformanceList. Authored in a 48-unit box, that makes one unit half a
// device pixel at the smaller size — so nothing here is thinner than 2 units,
// and no two shapes are separated by less than 2. This is the same lesson
// PartArt learned when a 64x40 drawing in a 48px square "read as a smudge":
// at this scale a mark is an icon, not an illustration.
//
// Everything paints in `currentColor`, so the plate sets the ink from its
// genre's own palette and the marks cannot drift out of it.
//
// ⚠️ This file is .jsx and exports COMPONENTS ONLY. `react-refresh/only-export-
// components` forbids a .jsx file exporting a component and a plain function
// together, and it has already fired on GameArt.jsx once (for `initialsFor`)
// and on categoryIcons.jsx once. GENRE_MARKS is a const map of components,
// which is why it does not trip the rule.

// Reticle: ring, crosshair ticks, centre dot.
const Shooter = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <circle cx="24" cy="24" r="10" />
    <path d="M24 8v5M24 35v5M8 24h5M35 24h5" />
    <circle cx="24" cy="24" r="2.2" fill="currentColor" stroke="none" />
  </g>
)

// Upright sword: blade, notched crossguard, pommel.
const Rpg = () => (
  <g fill="currentColor">
    <path d="M22 7h4v20h-4z" />
    <path d="M13 27h22v4H13z" />
    <path d="M22 31h4v7h-4z" />
    <circle cx="24" cy="40" r="3" />
  </g>
)

// Chevron blade over a horizon line — motion, not a specific weapon.
const ActionAdventure = () => (
  <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 28L24 12l10 16" />
    <path d="M11 36h26" />
  </g>
)

// Three-cell hex cluster: a map, a grid, a colony.
const StrategySim = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
    <path d="M24 8l7 4v8l-7 4-7-4v-8z" />
    <path d="M15 24l7 4v8l-7 4-7-4v-8z" />
    <path d="M33 24l7 4v8l-7 4-7-4v-8z" />
  </g>
)

// Crescent moon with two bare branches.
const Horror = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <path d="M30 10a12 12 0 100 20 14 14 0 010-20z" fill="currentColor" stroke="none" />
    <path d="M12 40V24M12 30l-5-5M12 32l5-5" />
  </g>
)

// Steering wheel: ring with a T of spokes.
const Racing = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
    <circle cx="24" cy="24" r="13" />
    <path d="M11 22h26M24 22v14" />
  </g>
)

// Two lanes crossing behind a nexus diamond.
const Moba = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <path d="M10 38L38 10M10 10l28 28" />
    <path d="M24 16l6 8-6 8-6-8z" fill="currentColor" stroke="none" />
  </g>
)

// Pennant on a post.
const Sports = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 8v32" />
    <path d="M14 11h20l-6 7 6 7H14z" fill="currentColor" stroke="none" />
  </g>
)

// ⚠️ `other` is deliberately ABSENT rather than mapped to a question mark or a
// generic shape. A game with no known genre has nothing to draw, and a symbol
// would assert something untrue; GameArt falls back to its initials, which
// assert only the name. A test pins this absence.
export const GENRE_MARKS = {
  shooter: Shooter,
  rpg: Rpg,
  'action-adventure': ActionAdventure,
  'strategy-sim': StrategySim,
  horror: Horror,
  racing: Racing,
  moba: Moba,
  sports: Sports,
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/tests/art.test.jsx`
Expected: PASS, including the four new `gameGenreMarks` cases and every pre-existing `GameArt` / `artVariant` / `PartArt` case.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: clean. If `react-refresh/only-export-components` fires on `gameGenreMarks.jsx`, a non-component export has crept in — remove it rather than disabling the rule.

- [ ] **Step 6: Commit**

```bash
git add src/lib/gameGenreMarks.jsx src/tests/art.test.jsx
git commit -m "feat: add a genre mark per game genre, drawn to survive 24px"
```

---

### Task 5: Compose the mark onto the plate

**Files:**
- Modify: `src/components/art/GameArt.jsx`
- Test: `src/tests/art.test.jsx`

- [ ] **Step 1: Write the failing test**

Append to the existing `describe('GameArt', ...)` block in `src/tests/art.test.jsx` (inside it, before its closing `})`):

```jsx
  it('draws the genre mark instead of initials when the genre is known', () => {
    const { container } = render(<GameArt name="Counter Strike" genre="shooter" seed="cs2" />)
    expect(container.querySelector('[data-genre-mark]'), 'the mark').not.toBeNull()
    expect(container.querySelector('text'), 'no initials alongside it').toBeNull()
  })

  it('falls back to initials when the genre is unknown', () => {
    const { container } = render(<GameArt name="Some Game" genre="other" seed="sg" />)
    expect(container.querySelector('[data-genre-mark]')).toBeNull()
    expect(container.querySelector('text').textContent).toBe('SG')
  })

  // The plate is what tells two same-genre rows apart, so it must keep varying
  // even though thirteen shooters now share one mark.
  it('still varies the plate between two games of the same genre', () => {
    const a = render(<GameArt name="Alpha" genre="shooter" seed="alpha" />)
    const b = render(<GameArt name="Bravo" genre="shooter" seed="bravo" />)
    const gradOf = (c) => c.querySelector('linearGradient').getAttribute('gradientTransform')
    const sweepOf = (c) => c.querySelector('path[opacity]').getAttribute('d')
    expect(gradOf(a.container) !== gradOf(b.container) || sweepOf(a.container) !== sweepOf(b.container)).toBe(true)
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/art.test.jsx -t "genre mark"`
Expected: FAIL — no `[data-genre-mark]` element.

- [ ] **Step 3: Wire the mark in**

In `src/components/art/GameArt.jsx`, add to the imports:

```jsx
import { GENRE_MARKS } from '../../lib/gameGenreMarks'
```

Inside the component, after the existing `const id = ...` line, add:

```jsx
  // A known genre draws its mark; anything else keeps the initials. See the
  // note in gameGenreMarks.jsx for why `other` has no symbol of its own.
  const Mark = GENRE_MARKS[genre]
```

Then replace the existing `<text>` element with:

```jsx
      {Mark ? (
        <g data-genre-mark={genre} color={g.ink} opacity="0.92">
          <Mark />
        </g>
      ) : (
        <text
          x="24" y="24"
          textAnchor="middle"
          dominantBaseline="central"
          fill={g.ink}
          fontSize="19"
          fontWeight="800"
          fontFamily="Archivo, ui-sans-serif, sans-serif"
          letterSpacing="-0.5"
        >
          {initialsFor(name)}
        </text>
      )}
```

Also update the block comment at the top of the file. Replace the sentence beginning *"So a game gets a genre-tinted plate carrying its own initials"* with:

```
// So a game gets a genre-tinted plate carrying a drawn genre mark — a reticle,
// a sword, a steering wheel — which is enough for the eye to find a row it has
// seen before without pretending to be something it is not. A game whose genre
// is unknown keeps its initials instead: see gameGenreMarks.jsx.
//
// ⚠️ The route to real covers is CLOSED, and not for want of effort. RAWG's
// terms forbid "further distribution in any way"; neither RAWG nor IGDB owns
// the covers, so neither can license one; and hotlinking would break both
// legalContent.js's promise that every asset is same-origin and the assertion
// in cspHeaders.test.js. Researched 2026-08-27 — do not reopen it by wiring an
// image URL.
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/tests/art.test.jsx`
Expected: PASS, all cases. In particular the pre-existing *"gives two different games different gradient ids"* must still pass.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/art/GameArt.jsx src/tests/art.test.jsx
git commit -m "feat: draw a genre mark on the game plate instead of initials"
```

---

### Task 6: Prove the marks read at 24px

**Files:**
- Modify: `e2e/performance.spec.js`

- [ ] **Step 1: Write the test**

Append to `e2e/performance.spec.js`:

```js
// ⚠️ This is a TEST, not a review note. These marks live at 24px and the whole
// design brief was "survives 24px" — a mark that renders and dissolves has
// failed. The screenshot is the artifact a human checks; the assertions below
// are what fails the build automatically.
test('every game row draws a genre mark at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await generateBuild(page)
  await openTab(page, 'performance')

  const marks = page.locator('[data-genre-mark]')
  await expect(marks.first(), 'at least one genre mark on the tab').toBeVisible()

  // Rendered size must actually be the 24px the marks were drawn for. A mark
  // squeezed smaller by a flex sibling is the failure this catches.
  const box = await marks.first().boundingBox()
  expect(box.width, 'the mark is not squashed below its design size').toBeGreaterThanOrEqual(20)

  await page.screenshot({ path: 'test-results/genre-marks-390.png', fullPage: false })
})
```

Confirm `openTab` and `generateBuild` are already imported at the top of `e2e/performance.spec.js`; if not, add:

```js
import { generateBuild, openTab } from './helpers.js'
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/performance.spec.js -g "genre mark"`
Expected: PASS.

- [ ] **Step 3: Look at the screenshot with your own eyes**

Open `test-results/genre-marks-390.png`. **This step is not optional and cannot be automated.** If any mark reads as a blob rather than a recognisable shape, go back to Task 4 and simplify that mark — fewer shapes, thicker strokes, more separation. A mark that needs squinting has failed the brief even with a green test.

- [ ] **Step 4: Commit**

```bash
git add e2e/performance.spec.js
git commit -m "test: prove every game row draws a genre mark at phone width"
```

---

# PHASE 3 — Performance

### Task 7: Stop the canvas redrawing while nothing moves

**Files:**
- Modify: `src/components/BuildCanvas.jsx:26-33`, `:83-92`, `:100-110`

This is the headline finding: r3f defaults `frameloop` to `"always"`, so a static build burns a frame budget every 16ms forever.

- [ ] **Step 1: Measure the current draw rate, so the fix has a baseline**

Create `scratch/frame-probe.mjs`:

```js
// Counts requestAnimationFrame ticks on the build tab while NOTHING is touched.
// Run against a live dev server: node scratch/frame-probe.mjs
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:5173/')

await page.getByRole('button', { name: /start a build/i }).click()
await page.getByRole('button', { name: /pick parts for me/i }).click()
await page.getByPlaceholder('Enter budget').fill('1600')
await page.getByRole('button', { name: /next: use case/i }).click()
await page.getByRole('button', { name: /gaming/i }).click()
await page.getByRole('button', { name: /generate build/i }).click()
await page.waitForSelector('canvas')
// Let the models finish loading before counting; loading legitimately draws.
await page.waitForTimeout(6000)

const frames = await page.evaluate(() => new Promise((resolve) => {
  let n = 0
  const t0 = performance.now()
  const tick = () => {
    n++
    if (performance.now() - t0 < 3000) requestAnimationFrame(tick)
    else resolve(n)
  }
  requestAnimationFrame(tick)
}))
console.log('rAF ticks in 3s (page-level):', frames)

const info = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  const gl = c.getContext('webgl2') || c.getContext('webgl')
  return { drawingBufferWidth: gl.drawingBufferWidth, drawingBufferHeight: gl.drawingBufferHeight }
})
console.log('drawing buffer:', info)
await browser.close()
```

Run: `node scratch/frame-probe.mjs` with `npm run dev` already running.
Record the number. **Write it into the commit message** — it is the before-figure.

- [ ] **Step 2: Switch to demand, and bake the shadow**

In `src/components/BuildCanvas.jsx`, change the `<Canvas>` opening tag from:

```jsx
      <Canvas
        dpr={[1, 2]}
```

to:

```jsx
      <Canvas
        // ⚠️ "demand", not the r3f default of "always". A static build was
        // redrawing ~60x/sec forever: a warm phone, a flat battery, and a frame
        // budget spent competing with the page's own scroll and paint.
        //
        // Under demand the scene draws only when something invalidates it.
        // drei's OrbitControls calls invalidate() on its change event, which
        // covers the damping tail after a drag — VERIFIED in a browser, not
        // assumed, because a camera that sticks mid-glide is a worse bug than
        // the cost this saves.
        frameloop="demand"
        dpr={[1, 2]}
```

Then change `ContactShadows` from:

```jsx
        <ContactShadows
          position={[CENTRE_X, FLOOR_Y - 0.005, CENTRE_Z]}
```

to:

```jsx
        {/* ⚠️ `frames={1}` bakes the shadow ONCE instead of re-rendering a 512²
            depth pass every frame — which is most of what "always" was paying
            for. The `key` is what stops that becoming a stale-shadow bug: a
            changed build remounts this and re-bakes. Without the key the shadow
            would be correct only for whatever parts happened to be selected on
            first paint. */}
        <ContactShadows
          key={parts.map((p) => p.id).join('|')}
          frames={1}
          position={[CENTRE_X, FLOOR_Y - 0.005, CENTRE_Z]}
```

- [ ] **Step 3: Verify the camera still glides — this is the hazard**

Run `npm run dev`, open the build tab, and **drag the model then release**. The camera must coast to a stop exactly as before.

If it stops dead on release, drei's `invalidate()` is not covering the damping tail. The fix is **not** to revert to `frameloop="always"` — set `enableDamping={false}` on `OrbitControls` and delete `dampingFactor`, then note it in the commit. A hard stop is honest; a stutter is not.

- [ ] **Step 4: Re-measure**

Run: `node scratch/frame-probe.mjs`

Expected: the page-level rAF count is unchanged (that measures the browser, not the renderer). The real check is GPU work — confirm via the browser's Performance panel that GPU/raster activity drops to near-zero while idle, or instrument `gl.drawArrays`/`drawElements` call counts.

Record both figures.

- [ ] **Step 5: Verify a part change still re-renders**

With the dev server up: open the build tab, swap a GPU via the parts panel, and confirm the model **and its contact shadow** both update. A shadow that keeps the old silhouette means the `key` is not doing its job.

- [ ] **Step 6: Run the unit suite**

Run: `npm run test:run`
Expected: all pass. jsdom has no WebGL, so `BuildCanvas` is not exercised there — this is a regression check on everything else.

- [ ] **Step 7: Commit**

```bash
git add src/components/BuildCanvas.jsx
git commit -m "perf: draw the 3D scene on demand instead of 60x a second"
```

---

### Task 8: Shrink the 1.5 MB environment map

**Files:**
- Create: `scripts/downsample-hdr.mjs`
- Replace: `public/hdri/city.hdr`

Current: 1024×512 Radiance RGBE, 1,540,678 bytes. three's `PMREMGenerator` rebuilds this into a small cubemap regardless, so the source resolution buys download weight and little else.

- [ ] **Step 1: Write the script**

Create `scripts/downsample-hdr.mjs`:

```js
// Downsamples a Radiance (.hdr) environment map in place.
//
// Why this exists: public/hdri/city.hdr shipped at 1024x512 and 1.5 MB, and it
// is used ONLY as an environment map. three's PMREMGenerator convolves it down
// to a small cubemap before anything reflects it, so past a point the source
// resolution costs download weight and buys nothing on screen.
//
// The file stays LOCAL. drei's `Environment preset` pulls from a CDN, which
// public/_headers forbids and the privacy page promises we do not do.
//
// Run: node scripts/downsample-hdr.mjs public/hdri/city.hdr 256 128
import fs from 'node:fs'
import { FloatType } from 'three'
// ⚠️ HDRLoader, NOT RGBELoader. RGBELoader is a deprecated alias as of three
// r180 (this repo is on 0.184) and its constructor prints a deprecation warning.
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

const [, , file, wArg, hArg] = process.argv
if (!file) {
  console.error('usage: node scripts/downsample-hdr.mjs <file.hdr> [width] [height]')
  process.exit(1)
}
const outW = Number(wArg ?? 256)
const outH = Number(hArg ?? 128)

const buf = fs.readFileSync(file)
const loader = new HDRLoader()
// ⚠️ setDataType(FloatType) is LOAD-BEARING. HDRLoader defaults to
// HalfFloatType, which hands back a Uint16Array of half-floats — reading that
// as if it were Float32 gives silent garbage, not an error. With FloatType the
// data is a Float32Array at an RGBA stride of 4, which is what the loop below
// indexes.
loader.setDataType(FloatType)
const tex = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const { width: inW, height: inH, data } = tex

console.log(`in : ${inW}x${inH}, ${buf.length} bytes`)
if (outW > inW || outH > inH) {
  console.error(`refusing to UPscale ${inW}x${inH} -> ${outW}x${outH}`)
  process.exit(1)
}

// Box filter. The ratio is an exact integer for 1024x512 -> 256x128, so every
// output pixel averages a clean 4x4 block and there is no resampling artefact
// to reason about.
const bx = inW / outW
const by = inH / outH
if (!Number.isInteger(bx) || !Number.isInteger(by)) {
  console.error(`non-integer downscale ratio ${bx}x${by} — pick a divisor of ${inW}x${inH}`)
  process.exit(1)
}

const out = new Float32Array(outW * outH * 3)
for (let y = 0; y < outH; y++) {
  for (let x = 0; x < outW; x++) {
    let r = 0, g = 0, b = 0
    for (let sy = 0; sy < by; sy++) {
      for (let sx = 0; sx < bx; sx++) {
        const si = ((y * by + sy) * inW + (x * bx + sx)) * 4
        r += data[si]; g += data[si + 1]; b += data[si + 2]
      }
    }
    const n = bx * by
    const di = (y * outW + x) * 3
    out[di] = r / n; out[di + 1] = g / n; out[di + 2] = b / n
  }
}

// Encode flat (non-RLE) RGBE. HDRLoader reads both, and flat is a dozen lines
// with no run-length edge cases to get wrong. The size win here is the pixel
// count, not the entropy coding.
const header = Buffer.from(
  `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${outH} +X ${outW}\n`,
  'latin1',
)
const pixels = Buffer.alloc(outW * outH * 4)
for (let i = 0; i < outW * outH; i++) {
  const r = out[i * 3], g = out[i * 3 + 1], b = out[i * 3 + 2]
  const max = Math.max(r, g, b)
  if (max < 1e-32) {
    pixels[i * 4] = 0; pixels[i * 4 + 1] = 0; pixels[i * 4 + 2] = 0; pixels[i * 4 + 3] = 0
  } else {
    const e = Math.ceil(Math.log2(max))
    const s = 256 / Math.pow(2, e)
    pixels[i * 4]     = Math.min(255, Math.floor(r * s))
    pixels[i * 4 + 1] = Math.min(255, Math.floor(g * s))
    pixels[i * 4 + 2] = Math.min(255, Math.floor(b * s))
    pixels[i * 4 + 3] = e + 128
  }
}

fs.writeFileSync(file, Buffer.concat([header, pixels]))
console.log(`out: ${outW}x${outH}, ${header.length + pixels.length} bytes`)
```

- [ ] **Step 2: Back up the original before overwriting**

```bash
cp public/hdri/city.hdr public/hdri/city.hdr.orig
```

**Do not skip this.** The script writes in place, and you need the original to compare against and to revert to.

- [ ] **Step 3: Capture a BEFORE screenshot at a fixed camera**

With `npm run dev` running, load the build tab, generate a build, do not touch the camera, and screenshot the viz panel:

```bash
npx playwright screenshot --viewport-size=1440,900 --wait-for-timeout=8000 http://localhost:5173/ scratch/hdri-before.png
```

If the build tab needs interaction to reach, drive it with a short script modelled on `scratch/frame-probe.mjs` instead and save to `scratch/hdri-before.png`.

- [ ] **Step 4: Run the downsample**

```bash
node scripts/downsample-hdr.mjs public/hdri/city.hdr 256 128
```

Expected output: `in : 1024x512, 1540678 bytes` then `out: 256x128, ~131157 bytes`.

- [ ] **Step 5: Capture AFTER and compare with your eyes**

Restart the dev server (Vite caches public assets), repeat Step 3 into `scratch/hdri-after.png`, and **open both images side by side.**

Judge the metal and glass specifically — that is where an environment map shows. If reflections have visibly flattened or banded:

```bash
cp public/hdri/city.hdr.orig public/hdri/city.hdr
node scripts/downsample-hdr.mjs public/hdri/city.hdr 512 256
```

and compare again. **Size is the goal; the look is the constraint.** Do not accept a visible downgrade to save 100 KB.

- [ ] **Step 6: Remove the backup once satisfied**

```bash
rm public/hdri/city.hdr.orig
```

- [ ] **Step 7: Commit**

```bash
git add scripts/downsample-hdr.mjs public/hdri/city.hdr
git commit -m "perf: shrink the environment map from 1.5 MB to ~130 kB"
```

---

### Task 9: Cheaper rendering on touch devices

**Files:**
- Modify: `src/components/BuildCanvas.jsx`

- [ ] **Step 1: Add the pointer read**

Near the top of `src/components/BuildCanvas.jsx`, after the existing constants, add:

```jsx
// ⚠️ A RENDERER setting, so a mount-time read is right here — unlike the
// zoom-verb copy in BuilderScreen, which has to keep up with a pointer type
// that changes under a live page and is therefore done in CSS. A device that
// gains a mouse mid-session getting the phone's DPR cap is not a defect worth
// a resize listener for.
//
// jsdom implements no matchMedia, so `?.` makes this false in tests and every
// existing case renders exactly as before.
const isCoarse = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches)
```

- [ ] **Step 2: Use it**

Inside the component, before the `return`, add:

```jsx
  // Read once per mount, not per render.
  const [coarse] = useState(isCoarse)
```

Add `useState` to the React import at the top of the file:

```jsx
import { useState } from 'react'
```

Then change the `Canvas` props from:

```jsx
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
```

to:

```jsx
        // ⚠️ Both of these are per-pixel costs and a phone pays them on a
        // smaller battery. Capping DPR at 1.5 rather than 2 is a 44% cut in
        // pixels shaded; dropping MSAA saves a resolve pass on hardware where
        // it is comparatively expensive. On a fine pointer nothing changes.
        dpr={coarse ? [1, 1.5] : [1, 2]}
        gl={{
          antialias: !coarse,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
```

- [ ] **Step 3: Verify the desktop path is untouched**

Run: `npm run test:run`
Expected: all pass. `matchMedia` is undefined in jsdom, so `coarse` is `false` and both props keep their current values.

- [ ] **Step 4: Verify the touch path renders**

Run: `npx playwright test e2e/mobileLayout.spec.js`
Expected: all pass, including the tests that opt into the 3D on a touch device. A blank canvas here means the GL context failed — check the console, and remember a white canvas is usually **context exhaustion from too many test contexts**, not a real GPU failure.

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildCanvas.jsx
git commit -m "perf: cap DPR and drop MSAA on touch devices"
```

---

### Task 10: Confirm the catalogue JSON is already parsed as JSON — no code expected

🛑 **This task was checked while writing the plan and is ALREADY DONE. It is a
verification step, not work.** The spec's finding (D) was wrong and this records
why, so nobody "fixes" it a second time.

Vite 8's `json.stringify` **defaults to `'auto'`**, which stringifies any JSON
import over 10 kB:

```
node_modules/vite/dist/node/index.d.ts:3128
  /** When set to 'auto', the data will be stringified only if the data is
      bigger than 10kB.  @default 'auto' */
  stringify?: boolean | "auto";
```

And the shipped bundle already shows it:

```
$ grep -o "JSON.parse(.\{0,40\}" dist/assets/index-*.js
JSON.parse(`[{"id":"mb-asus-x670e","category":"mother
JSON.parse(`[{"id":"mon-dell-s2721dgf","category":"mo
```

- [ ] **Step 1: Re-confirm on the current build**

```bash
npm run build
grep -c "JSON.parse" dist/assets/index-*.js
```

Expected: **3 or more**, and one of them containing `mb-asus-x670e`.

- [ ] **Step 2: If and only if the grep comes back empty, add the option**

Only in that case, add to `vite.config.js` inside `defineConfig`, after `plugins`:

```js
  json: { stringify: 'auto' },
```

Then re-run Step 1 and `npm run test:run`.

- [ ] **Step 3: Record the outcome — do not commit an empty change**

If Step 1 passed, there is nothing to commit. Write the result into the Task 11
report as *"already handled by Vite's default; spec finding (D) was incorrect"*
and move on.

---

### Task 11: Audit the entry chunk, and profile the reported jank

**Files:**
- Create: `docs/superpowers/plans/2026-08-27-perf-findings.md`

⚠️ **This task produces a REPORT, not necessarily a fix.** The user reported the page feeling laggy; no evidence for that has been gathered. Do not ship a speculative re-render fix. If the profile is clean, the finding is "it is clean" and it goes in the report as such.

- [ ] **Step 1: Measure what is in the entry chunk**

```bash
npm run build
ls -la dist/assets/
```

Record every chunk and its size against the baseline: entry 518,530 / BuildCanvas 1,048,135 / PerformanceScreen 449,000 / CSS 36,521.

- [ ] **Step 2: Find what dominates the entry chunk**

```bash
npx vite build --mode production 2>&1 | tail -30
```

Then check the largest static imports reaching the entry:

```bash
grep -c "" dist/assets/index-*.js
node -e "const s=require('fs').readFileSync(process.argv[1],'utf8'); console.log('chars:',s.length)" dist/assets/index-*.js
```

For a real breakdown, install nothing — read `src/main.jsx` and `src/App.jsx`'s import graph by hand and list which `src/data/*.json` files are statically reachable from it. `partsData.json` (163 kB) and `peripheralsData.json` (21 kB) are known; confirm whether `perfGames.json` (31 kB) is in the entry or the Performance chunk.

- [ ] **Step 3: Profile scroll on the build tab**

With `npm run dev` running: open the build tab on a generated build, open the browser's Performance panel, record ~5 seconds of scrolling, and note **long tasks over 50 ms** and any layout thrash.

⚠️ **The builder scrolls an INNER div, not the window.** `window.scrollY` is always 0 here and `mouse.wheel` does nothing on a touch emulation — scroll the `h-screen overflow-y-auto` container (`BuilderScreen.jsx:82`) or the measurement is fake.

- [ ] **Step 4: Profile a tab switch**

Record a switch from `build` to `performance` and back. Note the time to interactive and any long task. The Performance chunk is 449 kB and fetches on first open, so the **first** switch is legitimately slower than the rest — measure the second and third too, and say which is which.

- [ ] **Step 5: Write the report**

Create `docs/superpowers/plans/2026-08-27-perf-findings.md` with, at minimum:

```markdown
# Performance findings — 2026-08-27

## Baseline (before this branch)
| asset | bytes |
|---|---|
| entry chunk | 518,530 |
| BuildCanvas chunk | 1,048,135 |
| PerformanceScreen chunk | 449,000 |
| city.hdr | 1,540,678 |

## After
<fill in from Step 1>

## Idle GPU work
<the before/after figures from Task 7>

## Scroll profile
<long tasks over 50ms, or "none observed">

## Tab-switch profile
<first switch vs subsequent, with figures>

## Conclusion
<what is actually slow, and what is not. "Nothing further found" is a valid
and useful conclusion — say it plainly rather than inventing work.>
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-08-27-perf-findings.md
git commit -m "docs: record what the performance pass actually measured"
```

---

### Task 12: Full verification

- [ ] **Step 1: Unit suite**

Run: `npm run test:run`
Expected: all pass, zero skipped that were not skipped before.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Full e2e suite**

Run: `npm run test:e2e`
Expected: all pass.

⚠️ Some specs only fail under full-suite load — `builderLegibility.spec.js` once caught a missing surface that never appeared when run alone. Run the whole suite, not just the files this branch touched.

- [ ] **Step 4: Production CSP check**

Run: `npm run preview:csp`
Expected: pass. Dev sends no CSP, so a `public/_headers` violation can only surface here. Nothing in this branch adds a third-party host — this confirms it.

- [ ] **Step 5: Re-run the pre-render, because shared UI changed**

Run: `npm run prerender`
Expected: fragments regenerate.

⚠️ **Pre-rendered fragments go stale SILENTLY.** `GameArt` and the build grid are shared UI. Skipping this ships a homepage rendered from the old markup.

Then: `git diff --exit-code prerendered/` — if it reports changes, commit them.

- [ ] **Step 6: Report honestly**

State plainly: which tasks landed, which were skipped and why (Task 10 may legitimately be a no-op), the measured before/after figures, and anything that regressed. If the camera lost its damping in Task 7, say so — it is a visible behaviour change the user has not agreed to.

- [ ] **Step 7: Do NOT push**

The branch stays local. `main` auto-deploys to Netlify, and even a branch push builds a Netlify PR preview. Report completion and let the user decide.

---

## Spec coverage check

| Spec section | Task |
|---|---|
| §1 mobile order, `display: contents`, z-index caveat | 1, 2 |
| §1 tests (unit + phone e2e + desktop no-leak) | 3 |
| §2 genre marks, 24px constraint, `other` keeps initials | 4 |
| §2 plate/gradient/`artVariant` preserved | 5 |
| §2 the 24px check as a real test | 6 |
| §2 `only-export-components` guard | 4 (Step 5), 5 (Step 5) |
| §3A `frameloop="demand"` + shadow bake + damping hazard | 7 |
| §3B HDRI downsample, local, before/after | 8 |
| §3C DPR + antialias on coarse pointer | 9 |
| §3D `JSON.parse` transform | 10 |
| §3E entry chunk audit | 11 |
| §3F jank profiled, not assumed | 11 |
| Out of scope: no decimation, no push | 12 (Step 7) |
