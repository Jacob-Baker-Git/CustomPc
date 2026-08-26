# Builder Tabs Onto The System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the builder putting readable text on bare board, and bring its tabs into the hardware language the rest of the site already speaks.

**Architecture:** The mechanism already exists and was never wired up. `uiTokens.js` defines an elevation scale (`ELEV_GROUP` / `ELEV_ACTIVE` / `RAIL_ACTIVE`) that `FrameRateTable` uses correctly and `Section` / `StatPanel` ignore. This applies it to the containers, adds `PartSlot`-vocabulary designators to the panels that own exactly one part, reworks the Summary tab's rows and button hierarchy, and adds the e2e guard whose absence let the defect ship.

**Tech Stack:** React 19, Tailwind, Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-26-builder-tabs-onto-the-system-design.md`

---

## Measured starting point

At 1257px on a £1600 auto-build, glyph runs over an edge-pinned hardware layer
with nothing painted behind them:

| tab | offenders |
|---|---|
| performance | 28 |
| build | 1 (`Building this PC for`) |
| peripherals | 4 (`Filters`, `Monitor`, `The one part you actually look at`, `36 options`) |
| summary | 0 |

⚠️ **Three ways this measurement lies. All three were hit while writing the spec,
and each one moved the number a lot.**

1. **An ancestor walk that reaches `body`** counts the page ground as
   protection. `html { background: var(--ground) }` paints *below* the `-z-10`
   board. Stop at `body`. Reported **0** where there were 32.
2. **`sr-only` text returns a client rect** from its 1px clipped box.
   `BuilderScreen` has one (`<h1 class="sr-only">Your PC build</h1>`), which
   added a phantom offender to every tab.
3. **Gradient surfaces are `background-image`, not `background-color`.**
   `RamBox` paints its body with a gradient, so a colour-only check reports
   every DIMM-shaped panel as bare board. This alone inflated build 1 → 22 and
   peripherals 4 → 9.

The guard in Task 1 encodes all three. **Do not simplify its `covered()` or
`hidden()` helpers** — each line is load-bearing.

---

## File Structure

| file | responsibility |
|---|---|
| `e2e/builderLegibility.spec.js` *(create)* | The guard. Every visible glyph on every builder tab has something painted behind it. |
| `src/components/performance/Section.jsx` *(modify)* | Becomes an opaque module carrying its own heading. |
| `src/components/performance/StatPanel.jsx` *(modify)* | Gains an optional designator. Stays transparent — see Task 4. |
| `src/components/performance/PerformanceScreen.jsx` *(modify)* | Page header onto a surface; designators passed to the five owning panels. |
| `src/components/UseCaseChips.jsx` *(modify)* | One stray label onto its panel's surface. |
| `src/components/PeripheralsPanel.jsx` *(modify)* | Category header + blurb onto a surface. |
| `src/components/PeripheralFilterPanel.jsx` *(modify)* | `Filters` heading onto the panel surface. |
| `src/components/BuildSummary.jsx` *(modify)* | Rows in `PartSlot` language, link on hover/focus, score rail, button hierarchy. |
| `src/tests/performanceChrome.test.jsx` *(create)* | Unit cover for the designator rule and the opaque module. |

`boardPlan.js`, `BoardBackground.jsx` and `boardGeometry.js` are **not touched**.
Phase 1 is merged and this work sits on top of it.

---

### Task 1: The guard

Written first and left red until Task 5. It is the artefact whose absence let
this ship.

**Files:**
- Create: `e2e/builderLegibility.spec.js`

- [ ] **Step 1: Write the failing test**

Create `e2e/builderLegibility.spec.js`:

```js
import { test, expect } from '@playwright/test'
import { generateBuild, openTab } from './helpers.js'

// The assertion e2e/boardBackground.spec.js does not make. That spec covers
// ROUTES = ['/', '/help', '/glossary', '/parts'] and no builder tab, which is
// exactly why 28 glyph runs shipped sitting on bare board.
//
// The builder has NO SCRIM — BuilderScreen renders <BoardBackground /> with no
// column on purpose — so the contract here is different from the one over
// there. There it is "every glyph is inside the scrim's flat core". Here it is
// "every glyph has something painted behind it".

const TABS = ['build', 'performance', 'peripherals', 'summary']

// 1024 is where the hardware layers first paint (`hidden lg:block`). 1920
// because hardwareWidth's clamp grows the layers with the gutter, so clearing
// them at 1257 does not mean clearing them wide. 1257 is where the defect was
// first measured.
const WIDTHS = [1024, 1257, 1440, 1920]

async function offenders(page) {
  return page.evaluate(() => {
    const layers = [...document.querySelectorAll('[data-board-layer="hardware"]')]
      .map((l) => l.getBoundingClientRect())
      .filter((b) => b.width > 0)
    if (layers.length === 0) return { checked: 0, over: [] }

    // ⚠️ sr-only text is clipped to a 1px box and STILL returns a client rect.
    // BuilderScreen has one. Counting it adds a phantom offender to every tab.
    const hidden = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n)
        if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return true
        if ((s.clipPath && s.clipPath !== 'none') || (s.clip && s.clip !== 'auto')) return true
      }
      return false
    }

    // ⚠️ Counts background-IMAGE as well as background-colour. RamBox paints its
    // body with a gradient, so a colour-only check calls every DIMM-shaped
    // panel on the page bare board.
    //
    // ⚠️ Stops at body. html/body backgrounds paint BELOW the -z-10 board, so
    // treating them as protection reports zero collisions where there are many.
    const covered = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n)
        if (s.backgroundImage && s.backgroundImage !== 'none') return true
        const m = s.backgroundColor.match(/rgba?\(([^)]+)\)/)
        if (m && (m[1].split(',').map(Number)[3] ?? 1) > 0.5) return true
      }
      return false
    }

    const over = []
    let checked = 0
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent.trim() || hidden(n.parentElement)) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      // Per-rect, never the union: a union rect over a wrapped inline spans
      // gutters the glyphs never touch.
      for (const b of range.getClientRects()) {
        if (b.width < 3 || b.height < 3) continue
        checked += 1
        const hits = layers.some(
          (L) => b.left < L.right && b.right > L.left && b.top < L.bottom && b.bottom > L.top,
        )
        if (hits && !covered(n.parentElement)) over.push(n.textContent.trim().slice(0, 60))
      }
    }
    return { checked, over }
  })
}

test.describe('the builder never puts text on bare board', () => {
  for (const width of WIDTHS) {
    test(`every tab at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await generateBuild(page)

      const failures = []
      for (const tab of TABS) {
        await openTab(page, tab)
        await page.waitForTimeout(400)
        const { checked, over } = await offenders(page)
        // A control: if nothing was measured the assertion below is vacuous.
        expect(checked, `${tab} rendered no measurable text`).toBeGreaterThan(20)
        if (over.length) failures.push(`${tab}: ${over.length} -> ${[...new Set(over)].slice(0, 6).join(' | ')}`)
      }
      expect(failures.join('\n')).toBe('')
    })
  }
})
```

- [ ] **Step 2: Run it and record the red**

Run: `npx playwright test e2e/builderLegibility.spec.js --reporter=line`
Expected: **FAIL at every width.** At 1257 the message names `performance: 28`,
`build: 1`, `peripherals: 4`. Summary must NOT appear — it is already clean, and
if it does the probe has regressed.

⚠️ Do not run this concurrently with `npx vitest` — contention here produces
timeouts that look exactly like layout bugs.

- [ ] **Step 3: Commit the red guard**

```bash
git add e2e/builderLegibility.spec.js
git commit -m "test: assert the builder never puts text on bare board"
```

---

### Task 2: `Section` becomes an opaque module

This is the change that fixes most of the 28.

**Files:**
- Modify: `src/components/performance/Section.jsx`
- Create: `src/tests/performanceChrome.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/performanceChrome.test.jsx`:

```jsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Section from '../components/performance/Section'
import { ELEV_GROUP } from '../lib/uiTokens'

describe('Section', () => {
  it('paints an opaque surface, because the board is behind it', () => {
    // The builder passes no `column` to BoardBackground, so there is no scrim.
    // Opaque modules ARE the mechanism that keeps this page readable.
    const { container } = render(<Section title="Frame rates">body</Section>)
    expect(container.querySelector('section').className).toContain(ELEV_GROUP)
  })

  it('keeps the heading inside the module it belongs to', () => {
    // A heading rendered above the surface is exactly what was sitting on bare
    // board: "Frame rates" and its blurb were two of the offenders.
    const { container } = render(<Section title="Frame rates" blurb="A blurb">body</Section>)
    const surface = container.querySelector(`section`)
    expect(surface.querySelector('h3').textContent).toBe('Frame rates')
    expect(surface.textContent).toContain('A blurb')
  })

  it('does not go back to borders for hierarchy', () => {
    // uiTokens.js records that de-bordering this page was deliberate and that
    // depth carries hierarchy now. Re-adding a rule would reverse that.
    const { container } = render(<Section title="T">body</Section>)
    expect(container.querySelector('section').className).not.toMatch(/\bborder-t\b/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/performanceChrome.test.jsx`
Expected: FAIL — first test, className does not contain `bg-surface`; third
test fails too, since the current className carries `border-t`.

- [ ] **Step 3: Write the implementation**

In `src/components/performance/Section.jsx`, add to the imports at the top:

```js
import { ELEV_GROUP } from '../../lib/uiTokens'
```

Replace the `<section>` opening tag and its `className` with:

```jsx
    <section
      ref={ref}
      className={`mt-4 rounded-xl ${ELEV_GROUP} p-4 sm:p-5 first:mt-0 ${className}`}
    >
```

Then replace the comment block above the component — the hairline-rule
paragraph is now wrong — with:

```js
// A titled band of related panels, drawn as an opaque module.
//
// The page used to be nine identical bordered boxes in one flat grid, which
// gave every figure the same weight and buried the frame rates — the thing the
// page exists to answer — in ninth place. Grouping is what fixes that: the
// heading carries the hierarchy so the panels inside can stay quiet.
//
// ⚠️ THE SURFACE IS LOAD-BEARING, not decoration. BuilderScreen renders
// <BoardBackground /> with no `column`, so this screen has NO SCRIM — the
// board is drawn at full strength behind it. Opaque modules are the only thing
// keeping text off it, and 28 glyph runs on this tab were sitting on bare board
// when this section was transparent. e2e/builderLegibility.spec.js fails if it
// goes back.
//
// Separation was a hairline rule between sections while they were transparent.
// The gap between two opaque cards does that job now, and uiTokens.js is
// explicit that depth rather than borders carries hierarchy here.
//
// `action` is an optional control belonging to the band as a whole — the Frame
// rates section puts its resolution picker there. It sits on the heading's own
// line rather than above the table, so it reads as part of the section header
// instead of as another row of chrome.
//
// `ref` is an ordinary prop: this is React 19, so no forwardRef wrapper.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/performanceChrome.test.jsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/performance/Section.jsx src/tests/performanceChrome.test.jsx
git commit -m "fix: make the performance sections opaque modules"
```

---

### Task 3: The Performance page header onto a surface

The page title and its intro paragraph sit outside every `Section`, so Task 2
does not reach them. They are offenders 1–4.

**Files:**
- Modify: `src/components/performance/PerformanceScreen.jsx:144-153`

- [ ] **Step 1: Write the implementation**

In `src/components/performance/PerformanceScreen.jsx`, add `ELEV_GROUP` to the
existing `uiTokens` import if one is present; otherwise add:

```js
import { ELEV_GROUP } from '../../lib/uiTokens'
```

Replace the `<header className="mb-4">` block:

```jsx
      <header className="mb-4">
        <h2 className="text-lg text-ink">Performance</h2>
        <p className="mt-1 text-xs text-muted leading-relaxed">
          How this build behaves under load — what it draws, what it can shed, and
          what it renders. Everything except the frame rates is computed from the
          parts themselves.
        </p>
      </header>
```

with:

```jsx
      {/* On its own surface for the same reason the sections are: this screen
          has no scrim, so a bare heading sits directly on the board. */}
      <header className={`mb-4 rounded-xl ${ELEV_GROUP} p-4 sm:p-5`}>
        <h2 className="text-lg text-ink">Performance</h2>
        <p className="mt-1 max-w-[80ch] text-xs text-muted leading-relaxed">
          How this build behaves under load — what it draws, what it can shed, and
          what it renders. Everything except the frame rates is computed from the
          parts themselves.
        </p>
      </header>
```

- [ ] **Step 2: Check the guard moved**

Run: `npx playwright test e2e/builderLegibility.spec.js --reporter=line`
Expected: still FAIL, but `performance` is now **0** and only `build: 1` and
`peripherals: 4` remain. If performance is not 0, read the offender strings the
failure prints — they name the elements still uncovered.

- [ ] **Step 3: Commit**

```bash
git add src/components/performance/PerformanceScreen.jsx
git commit -m "fix: put the performance page header on a surface"
```

---

### Task 4: Designators on the panels that own one part

**Files:**
- Modify: `src/components/performance/StatPanel.jsx`
- Modify: `src/components/performance/PerformanceScreen.jsx`
- Modify: `src/tests/performanceChrome.test.jsx`

⚠️ `StatPanel` does **not** get `ELEV_GROUP`. Every `StatPanel` is nested inside
a `Section`, which is now opaque, so it is already covered — and giving both the
same token would put two surfaces at the same value, which is precisely the
"nothing led the eye" failure `uiTokens.js` describes. The spec says both; the
spec is wrong on this point and this is the correction.

- [ ] **Step 1: Write the failing test**

Append to `src/tests/performanceChrome.test.jsx`:

```jsx
import StatPanel from '../components/performance/StatPanel'

describe('StatPanel designators', () => {
  it('shows the designator it is given', () => {
    const { getByText } = render(<StatPanel title="Memory" designator="DIMM_A2">x</StatPanel>)
    expect(getByText('DIMM_A2')).toBeInTheDocument()
  })

  it('shows nothing when the panel does not own one part', () => {
    // "Bottleneck" is about the CPU/GPU relationship. Naming one of them would
    // be a claim the panel does not make.
    const { container } = render(<StatPanel title="Bottleneck">x</StatPanel>)
    expect(container.querySelector('[data-designator]')).toBeNull()
  })

  it('only uses designators that name a real connector', () => {
    // The value of a designator is that the same part is named the same way
    // everywhere. An invented one breaks exactly that, so the vocabulary is
    // fixed to PartSlot's CONNECTOR map.
    const ALLOWED = ['CPU_1', 'CPU_FAN', 'DIMM_A2', 'PCIEX16_1', 'M2_1', 'ATX_PWR', 'BOARD']
    const src = readFileSync(new URL('../components/performance/PerformanceScreen.jsx', import.meta.url), 'utf8')
    for (const [, used] of src.matchAll(/designator="([^"]+)"/g)) {
      expect(ALLOWED, `${used} is not a real connector`).toContain(used)
    }
  })
})
```

Add to the top of the file:

```js
import { readFileSync } from 'node:fs'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/performanceChrome.test.jsx`
Expected: FAIL — `Unable to find an element with the text: DIMM_A2`.

- [ ] **Step 3: Write the implementation**

Replace the whole of `src/components/performance/StatPanel.jsx`:

```jsx
// A titled group of stats. Kept deliberately plain: this is a data page, and
// the job is legibility down a column rather than decoration.
//
// No surface of its own. Every StatPanel sits inside a Section, which is opaque,
// so it is already covered — and two surfaces at the same value is the
// "nothing led the eye" failure uiTokens.js was written to end.
//
// `designator` is the board reference for the part this panel describes, and it
// is given ONLY where exactly one real part owns the panel. It comes from
// PartSlot's CONNECTOR map verbatim, so the same component is named the same
// way wherever it appears. A panel about a relationship (Bottleneck) or a total
// (Power) gets none — an invented designator is decoration wearing structure's
// clothes.
export default function StatPanel({ title, subtitle, children, footnote, designator }) {
  return (
    <section className="py-1">
      <header className="mb-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm text-ink">{title}</h3>
          {designator && (
            <span
              data-designator={designator}
              className="font-mono text-[10px] tracking-[0.08em] text-gold"
            >
              {designator}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted leading-relaxed">{subtitle}</p>}
      </header>
      {children}
      {footnote && (
        <p className="mt-2.5 border-t border-line pt-2 text-[10px] text-muted leading-relaxed">
          {footnote}
        </p>
      )}
    </section>
  )
}
```

In `src/components/performance/PerformanceScreen.jsx`, add the `designator` prop
to exactly these five panels and no others:

| line (approx) | current | add |
|---|---|---|
| 297 | `title="Power"` | *nothing — a total, not a part* |
| 312 | `title="Power supply"` | `designator="ATX_PWR"` |
| 332 | `title="Cooling"` | `designator="CPU_FAN"` |
| 357 | `title="Memory"` | `designator="DIMM_A2"` |
| 379 | `title="Graphics capability"` | `designator="PCIEX16_1"` |
| 405 | `title="Processor capability"` | `designator="CPU_1"` |

For example, line 357 becomes:

```jsx
          title="Memory"
          designator="DIMM_A2"
```

Leave `Bottleneck` (231) and `The parts that decide it` (280) alone.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/performanceChrome.test.jsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Prove the vocabulary test can fail**

Using the `Edit` tool (never a string-replace script — the working tree is CRLF
and a node script matching an `\n` anchor silently finds nothing and prints
success), change `designator="DIMM_A2"` to `designator="RAM_SLOT_1"`, then
re-read the file to confirm the edit landed.

Run: `npx vitest run src/tests/performanceChrome.test.jsx`
Expected: FAIL — `RAM_SLOT_1 is not a real connector`. Restore with `Edit`,
re-run, expect PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/performance/StatPanel.jsx src/components/performance/PerformanceScreen.jsx src/tests/performanceChrome.test.jsx
git commit -m "feat: name the part each stat panel describes"
```

---

### Task 5: The five stray labels on Build and Peripherals

**Files:**
- Modify: `src/components/UseCaseChips.jsx:14`
- Modify: `src/components/PeripheralsPanel.jsx`
- Modify: `src/components/PeripheralFilterPanel.jsx:68`

- [ ] **Step 1: Fix the Build tab's one label**

In `src/components/UseCaseChips.jsx`, replace the outer `<div>` opening tag:

```jsx
    <div>
```

with:

```jsx
    {/* Its own surface: this label sits outside every panel on the Build tab
        and was the one glyph run there over bare board. */}
    <div className="rounded-lg bg-surface p-3">
```

- [ ] **Step 2: Fix the Peripherals heading and blurb**

In `src/components/PeripheralsPanel.jsx`, find the element that renders the
category `label` and `blurb` from the `CATEGORIES` array declared at line 16
(`{ id: 'monitor', label: 'Monitor', blurb: 'The one part you actually look at' }`)
together with the `N options` count. Wrap that header block's outermost element
in an opaque surface by adding `rounded-lg bg-surface p-3` to its `className`.

If the heading, blurb and count are siblings without a shared wrapper, add one:

```jsx
<div className="rounded-lg bg-surface p-3">
  {/* existing heading, blurb and count, unchanged */}
</div>
```

- [ ] **Step 3: Fix the Filters heading**

In `src/components/PeripheralFilterPanel.jsx:68`, replace:

```jsx
        <h3 className="text-ink text-sm font-semibold mb-4">Filters</h3>
```

with:

```jsx
        <h3 className="text-ink text-sm font-semibold mb-4 rounded-md bg-surface px-2 py-1">Filters</h3>
```

- [ ] **Step 4: Run the guard — it must go GREEN**

Run: `npx playwright test e2e/builderLegibility.spec.js --reporter=line`
Expected: **4 passed.** This is the first point at which the guard is green.

If any width still fails, the failure message names the offending strings.
Note that 1920 can fail where 1257 passes — `hardwareWidth` grows the layers
with the gutter.

- [ ] **Step 5: Commit**

```bash
git add src/components/UseCaseChips.jsx src/components/PeripheralsPanel.jsx src/components/PeripheralFilterPanel.jsx
git commit -m "fix: cover the last five labels sitting on bare board"
```

---

### Task 6: Summary rows in `PartSlot` language

Summary has no legibility defect. This task is the brief, not the bug.

**Files:**
- Modify: `src/components/BuildSummary.jsx:25-56` (`Row` and `MissingRow`)

- [ ] **Step 1: Write the failing test**

Append to `src/tests/BuildSummary.test.jsx`, inside the existing top-level
`describe`:

```jsx
  it('names the connector each part seats in', () => {
    // The designator teaches WHERE the part goes, which is the same thing
    // PartSlot's does on the Build tab. A summary that says "GPU" twice tells
    // you less than one that says PCIEX16_1.
    renderWithBuild()
    expect(screen.getByText('PCIEX16_1')).toBeInTheDocument()
    expect(screen.getByText('CPU_1')).toBeInTheDocument()
  })

  it('keeps the retailer link reachable without a pointer', () => {
    // Revealed on hover AND focus. Hover-only would put ten links behind a
    // gesture a keyboard cannot make.
    renderWithBuild()
    const link = screen.getAllByRole('link', { name: /find best price/i })[0]
    expect(link).toBeInTheDocument()
    expect(link.closest('[data-row]').className).toMatch(/group/)
  })
```

Use whatever helper the file already uses to render a populated build; if it
renders inline, copy that setup rather than inventing a new one.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/BuildSummary.test.jsx`
Expected: FAIL — `Unable to find an element with the text: PCIEX16_1`.

- [ ] **Step 3: Write the implementation**

In `src/components/BuildSummary.jsx`, add near the top:

```js
// The same vocabulary PartSlot uses, so a part is named the same way on the
// Build tab and here.
//
// Keyed by the `label` values in src/lib/categories.js, which is what Row
// receives. Case, Case Fans and Thermal Paste are absent on purpose: they do
// not seat in a board connector, and PartSlot's CONNECTOR map has no entry for
// them either. Peripherals plug into a port rather than the board, so they fall
// through to their label too.
const DESIGNATOR = {
  CPU: 'CPU_1',
  'CPU Cooler': 'CPU_FAN',
  RAM: 'DIMM_A2',
  GPU: 'PCIEX16_1',
  Storage: 'M2_1',
  PSU: 'ATX_PWR',
  Motherboard: 'BOARD',
}
```

⚠️ These keys are the real labels, verified against `src/lib/categories.js`
(`CPU`, `GPU`, `Motherboard`, `RAM`, `Storage`, `PSU`, `Case`, `CPU Cooler`,
`Case Fans`, `Thermal Paste`). A key that never matches yields no designator
anywhere and fails silently — the test in Step 1 is what catches it.

Replace `Row`:

```jsx
function Row({ label, name, brand, price }) {
  return (
    <div data-row className="group flex items-center py-1.5 border-t border-line">
      <span className="w-28 shrink-0 pr-2 font-mono text-[11px] uppercase text-muted">
        {DESIGNATOR[label] ?? label}
      </span>
      <span className="flex-1 truncate text-sm text-ink">{name}</span>
      <span className="w-20 text-right font-mono text-sm text-muted">£{price.toFixed(2)}</span>
      {/* Revealed on hover or keyboard focus. Ten always-visible links down the
          right-hand edge was the loudest thing on a page whose job is to be
          read; focus-within is what keeps them reachable without a pointer. */}
      <a
        href={searchUrl(name, brand)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-28 whitespace-nowrap text-right text-xs text-copper opacity-0 transition-opacity hover:brightness-110 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        Find Best Price ↗
      </a>
    </div>
  )
}
```

Replace `MissingRow`'s designator cell the same way:

```jsx
      <span className="w-28 shrink-0 pr-2 font-mono text-[11px] uppercase text-muted">
        {DESIGNATOR[label] ?? label}
      </span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/BuildSummary.test.jsx`
Expected: PASS, including the file's existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildSummary.jsx src/tests/BuildSummary.test.jsx
git commit -m "feat: seat the summary rows in their real connectors"
```

---

### Task 7: Summary score rail and button hierarchy

**Files:**
- Modify: `src/components/BuildSummary.jsx:151` (score block), `:229-265` (buttons)

- [ ] **Step 1: Write the failing test**

Append to `src/tests/BuildSummary.test.jsx`:

```jsx
  it('demotes Clear build out of the button row', () => {
    // Five equal-weight buttons, one of which wipes the build. It stays a
    // <button> because it performs an action rather than navigating — only its
    // weight changes.
    renderWithBuild()
    const clear = screen.getByRole('button', { name: /clear build/i })
    expect(clear.className).not.toMatch(/border-bad/)
    expect(clear.className).toMatch(/text-muted/)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/BuildSummary.test.jsx`
Expected: FAIL — className still matches `border-bad`.

- [ ] **Step 3: Write the implementation**

Add the rail to the score block. Replace:

```jsx
                <div className="mt-4 rounded-lg border border-line bg-surface-2 px-4 py-3">
```

with:

```jsx
                {/* The rail carries the score's own colour, so the block says
                    what the number says before the number is read. */}
                <div className={`mt-4 rounded-lg border border-line bg-surface-2 px-4 py-3 ${scoreRail(rating.overall)}`}>
```

and add beside the existing `scoreText` helper:

```js
// The score's rail, in the score's own colour. An inset shadow rather than a
// border-l: a border changes the box and shifts its contents 2px out of line.
// It also sidesteps the opacity trap, since it names the CSS var directly.
const scoreRail = (n) =>
  n >= 80 ? 'shadow-[inset_2px_0_0_0_var(--good)]'
    : n >= 60 ? 'shadow-[inset_2px_0_0_0_var(--ok)]'
      : 'shadow-[inset_2px_0_0_0_var(--bad)]'
```

⚠️ Read the existing `scoreText` helper first and mirror its exact thresholds.
If they differ, the rail and the number will disagree about the same build,
which is worse than having no rail.

Then move `Clear build` out of the button row. Delete its `<button>` from inside
the `<div className="flex flex-wrap gap-2 mt-5">` block and re-add it below,
beside the saved-builds link:

```jsx
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              onClick={() => setFlow('saved')}
              className="text-xs text-muted transition-colors hover:text-copper"
            >
              View your saved builds →
            </button>
            <button
              onClick={handleClear}
              disabled={isEmpty}
              className="text-xs text-muted transition-colors hover:text-bad disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear build
            </button>
          </div>
```

and delete the standalone `View your saved builds →` button that previously
followed the row, so it is not rendered twice.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/BuildSummary.test.jsx src/tests/BuildSummaryDialogs.test.jsx`
Expected: PASS. `BuildSummaryDialogs.test.jsx` clicks `clear build` by role and
must still find it — that is why it stays a `<button>`.

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildSummary.jsx src/tests/BuildSummary.test.jsx
git commit -m "feat: rail the summary score and demote Clear build"
```

---

### Task 8: Verify the whole thing

**Files:** none — verification only.

- [ ] **Step 1: Full unit suite**

Run: `npx vitest run`
Expected: PASS. Baseline entering this work is 1423 in 137 files; this plan adds
6 in a new file plus 3 to `BuildSummary.test.jsx`.

- [ ] **Step 2: Full e2e suite**

Run: `npx playwright test`
Expected: PASS. Baseline is 91; this plan adds 4.

⚠️ Not concurrently with vitest.

- [ ] **Step 3: Lint and build**

Run: `npx eslint . && npm run build`
Expected: clean, build succeeds.

- [ ] **Step 4: Prove the guard is not vacuous**

Using the `Edit` tool, remove `${ELEV_GROUP}` from `Section.jsx`'s className,
then re-read the file to confirm the edit landed.

Run: `npx playwright test e2e/builderLegibility.spec.js --reporter=line`
Expected: **FAIL**, naming `performance` and roughly two dozen offenders.
Restore with `Edit`, re-run, expect 4 passed.

A legibility assertion that cannot fail is worse than none, because it
advertises safety it does not provide.

- [ ] **Step 5: Pre-render check — expect NO movement**

Run: `npm run prerender` then `git diff --stat -- prerendered/`

Expected: **nothing changes.** Unlike the board work, every file touched here is
builder-only, and the builder is not a pre-rendered route. If a fragment *does*
move, something shared was changed by accident — find it before committing.

⚠️ This is the opposite expectation from the phase 1 plan. Do not copy that
plan's "all seven must change" reasoning into this one.

- [ ] **Step 6: Look at it**

Start the dev server via `preview_start` with the `custompc-dev` config.
Generate a build, then screenshot all four tabs at 1257 and 1920.

Judge: do the opaque sections read as modules rather than as a wall of cards? If
the page now reads busier than it did, the fix is **fewer distinct surfaces**
— merge adjacent sections — not more transparent ones, which would reopen the
defect.

- [ ] **Step 7: Commit any screenshots-driven tweaks**

```bash
git add -A src/
git commit -m "style: settle the module rhythm on the builder tabs"
```

Skip this commit if step 6 needed no changes.

---

## Self-Review

**Spec coverage:** Opaque modules → Tasks 2, 3, 5. Designators → Task 4 (and
Task 6 for Summary). `RAIL_ACTIVE` already correct in the table → no task, noted
in the spec. Summary rows/link/rail/buttons → Tasks 6, 7. The guard → Task 1,
proven falsifiable in Task 8 Step 4. Widths 1024/1257/1440/1920 → Task 1.
`RamBox` not used for non-hardware → honoured; no task introduces one.

**Deviation from the spec, deliberate:** the spec says `Section` *and*
`StatPanel` gain `ELEV_GROUP`. Task 4 gives it to `Section` only, because every
`StatPanel` is nested inside one and two surfaces at the same value is the exact
failure `uiTokens.js` documents. Legibility is unaffected — the Section covers
them.

**Placeholders:** none. Task 5 Step 2 and Task 6 Step 3 direct the engineer to
read an existing array before editing, which is an instruction to verify rather
than a gap — both name what to look for and what goes wrong if it is skipped.

**Type consistency:** `designator` is the prop name in `StatPanel`, in
`PerformanceScreen`'s call sites, and in the `data-designator` attribute the
tests query. `DESIGNATOR` in `BuildSummary.jsx` is a separate lookup keyed by
category label, deliberately not shared — the two files disagree about what they
are keyed on, and merging them would couple the summary's row labels to the
performance tab's panel titles.
