# Matte-black + Copper Board UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "near-black + one orange accent" palette with a matte-black board palette whose metals carry state, reserve orange for the wordmark alone, and draw every part slot as the connector it plugs into.

**Architecture:** All colour lives as CSS custom properties in `src/index.css`, mapped to semantic Tailwind classes in `tailwind.config.js`. Components never name a hex. The change lands in four stages — tokens, then the semantic migration of 184 `accent` call sites, then the connector slot, then a sweep — each independently judgeable in the running app.

**Tech Stack:** React 19, Vite, Tailwind 3.4, Zustand, Vitest + Testing Library, Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-08-16-matte-black-copper-board-ui-design.md`

---

## Critical context for the engineer

Read these before touching anything. Each has cost real time here before.

1. **Semantic tokens take NO opacity modifier.** `bg-surface/85`, `border-gold/60`, `bg-bad/[0.07]` compile to **nothing at all** — Tailwind cannot compose an alpha onto a bare `var(--x)` holding a hex, so it drops the utility silently. No error, no warning, no rule. `src/tests/tokenOpacity.test.js` fails the build for it. **Always use a whole token.** That is why `--gold-soft` exists as its own token rather than `gold/15`.

2. **Contrast must be computed on linearised channels.** Averaging raw sRGB bytes is the classic silent error. `paletteContrast.test.js` already does it correctly and anchors itself on two independently-measured reference figures before asserting anything. Do not "simplify" that function.

3. **Source files are CRLF.** A Node edit script matching an LF anchor finds nothing. Normalise with `.replace(/\r\n/g,'\n')` before matching and restore on write.

4. **Python is NOT installed.** Any throwaway script must be Node.

5. **Never `git checkout --` a file with uncommitted work.** To undo a mutation, copy to the scratchpad and copy back, then verify with `diff -q`.

6. **The dev server** is `preview_start{name:'custompc-dev'}` (port 5173, pinned). To see a build in the app, seed `localStorage['custompc-builder-v1']` with `{state:{budget,selectedParts,selectedPeripherals,resolution,useCase,flow},version:2}` — the field is **`selectedParts`**, holding **whole part objects**, and `flow` must be `'builder'`. Fetch `/src/data/partsData.json` from the dev server to pick real ones.

7. **Baseline to preserve:** 126 test files / 1248 tests passing, lint clean, build green.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/index.css` | the single source of every colour value | modify `:root` |
| `tailwind.config.js` | maps CSS vars to semantic class names | add metal + wash tokens |
| `src/tests/paletteContrast.test.js` | proves every text token clears WCAG AA | extend to the new tokens |
| `src/tests/accentIsBrandOnly.test.js` | **new** — guards that orange is wordmark-only | create |
| `src/lib/uiTokens.js` | shared class strings (`PANEL`, `BTN_PRIMARY`, `ELEV_*`, `RAIL_ACTIVE`) | remap to metals |
| `src/components/PartSlot.jsx` | **new** — the connector treatment for one slot | create |
| `src/tests/PartSlot.test.jsx` | **new** — the connector's behaviour and states | create |
| `src/components/CategoryList.jsx` | renders the part slots | use `PartSlot` |
| `src/components/TopBar.jsx` | the wordmark | keep `text-accent` here |
| `src/components/ErrorBoundary.jsx` | the crash-page wordmark | keep `text-accent` here |
| `src/fonts.css` + `public/fonts/` | self-hosted faces | Archivo in, Bricolage out |
| 32 further components | consume the tokens | migrate `accent` → metals |

---

## Stage 1 — Tokens

### Task 1: Add the metal and wash tokens

**Files:**
- Modify: `src/index.css:16-38`
- Modify: `tailwind.config.js:10-24`
- Test: `src/tests/paletteContrast.test.js`

- [ ] **Step 1: Write the failing test**

In `src/tests/paletteContrast.test.js`, replace the `BACKGROUNDS` / `TEXT` constants (lines 34-36) with:

```js
const BACKGROUNDS = ['ground', 'surface', 'surface-2', 'gold-soft']
// Every token that renders as body text somewhere in the app. The metals and the
// signal trio are all used as text — none of them were covered before, and two
// candidate values (true copper #B87333 at 4.00, and a redder error #D9453C at
// 3.52) FAILED here and were changed because of it. That is what this is for.
const TEXT = ['ink', 'muted', 'faint', 'accent', 'copper', 'gold', 'tech', 'good', 'ok', 'bad']
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tests/paletteContrast.test.js`
Expected: FAIL — `--copper not found in index.css, or is no longer a plain hex colour`

- [ ] **Step 3: Add the tokens**

In `src/index.css`, replace the `:root` block (lines 16-38) with:

```css
:root {
  /* ---- Board ------------------------------------------------------------
     Matte-black board substrate. The previous ground was #0F1114 — a neutral
     near-black with one bright accent, which is one of the three looks
     AI-generated design defaults to. The palette below is deliberately not
     that: state is carried by desaturated METALS, and only genuine
     interruptions are saturated. */
  --ground: #0E0F11;       /* app background — board substrate */
  --surface: #17191D;      /* cards / panels — a group */
  --surface-2: #22262D;    /* the ACTIVE thing — open group, target column */
  --line: #2A2E35;         /* hairline borders */
  --line-strong: #3A404B;  /* emphasised borders / dividers */

  /* ---- Text -------------------------------------------------------------
     UNCHANGED, and deliberately so. All three were re-measured against the new
     surfaces and pass AA with the hierarchy intact (12.47 > 5.76 > 4.61 on
     --surface-2). A dimmer muted (#8C929C) was tried and left only a +0.24 gap
     over faint, collapsing three steps into two. */
  --ink: #EDEFF2;          /* primary text */
  --muted: #99A0AB;        /* secondary text / labels */
  /* Tertiary text / disabled. Was #6B7280, which measured 3.17-3.91:1 and is
     used at 10-11px so the large-text exemption cannot apply. Pinned by
     paletteContrast.test.js — do not darken it back. */
  --faint: #878E9C;        /* tertiary text / disabled */

  /* ---- Brand ------------------------------------------------------------
     The wordmark and NOTHING ELSE. This is the only fully saturated colour on
     the site, which is what makes it read as identity rather than as one more
     UI accent. Guarded by accentIsBrandOnly.test.js. */
  --accent: #F26B3A;
  --accent-ink: #0E0F11;   /* text/icon on a solid metal fill */

  /* ---- Metals: desaturated, they carry STATE ---------------------------- */
  --copper: #C4813C;       /* action — primary buttons, power */
  --gold: #C9A86B;         /* seated / active — filled slots, the active rail */
  --gold-soft: #2A2416;    /* the selected wash (replaces --accent-soft) */
  --tech: #56C8D8;         /* technical — reference designators, data labels */
  --steel: #5E6672;        /* neutral secondary meter / muted bar */

  /* ---- Signals: saturated, they INTERRUPT -------------------------------
     Shifted clear of the metals and the brand. --ok used to be #F2B84B, which
     sat almost on top of gold; --bad used to be #F26A5A, almost on top of the
     wordmark orange. */
  --good: #45C182;         /* rating: strong */
  --ok: #F5B62E;           /* rating: ok */
  --bad: #E8695C;          /* rating: weak */
}
```

- [ ] **Step 4: Map them in Tailwind**

In `tailwind.config.js`, replace the `colors` block (lines 10-24) with:

```js
      colors: {
        // Board design system. Values live as CSS vars in src/index.css so they
        // can be tuned in one place.
        //
        // ⚠️ Every one of these is a bare var() holding a hex, so NONE of them
        // accepts an opacity modifier — `bg-gold/60` emits no CSS at all.
        // tokenOpacity.test.js fails the build for it. Use a whole token; that
        // is why gold.soft exists.
        ground: 'var(--ground)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)' },
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        // Brand — wordmark only. See accentIsBrandOnly.test.js.
        accent: { DEFAULT: 'var(--accent)', ink: 'var(--accent-ink)' },
        // Metals — state.
        copper: 'var(--copper)',
        gold: { DEFAULT: 'var(--gold)', soft: 'var(--gold-soft)' },
        tech: 'var(--tech)',
        steel: 'var(--steel)',
        // Signals — interruption.
        good: 'var(--good)',
        ok: 'var(--ok)',
        bad: 'var(--bad)',
      },
```

Note `accent.soft` is **removed**. That is intentional and will break 16 call sites, fixed in Stage 2.

- [ ] **Step 5: Run the contrast test to verify it passes**

Run: `npx vitest run src/tests/paletteContrast.test.js`
Expected: PASS — 41 tests (1 calibration + 10 tokens × 4 backgrounds).

- [ ] **Step 6: Verify the calibration anchors still hold**

The two anchors on lines 44-45 use literal hexes (`#6B7280` on `#22252C`, `#99A0AB` on `#0F1114`) and are independent of the palette — they are reference computations, not assertions about current tokens. They must still pass unchanged. If either fails, the luminance function was altered; revert that.

- [ ] **Step 7: Commit**

```bash
git add src/index.css tailwind.config.js src/tests/paletteContrast.test.js
git commit -m "feat: add the board palette's metal and signal tokens"
```

---

### Task 2: Prove `bg-accent-soft` is gone

**Files:**
- Test: `src/tests/tokenOpacity.test.js` (no change — it should still pass)

- [ ] **Step 1: Run the whole suite to see the damage**

Run: `npm run test:run`
Expected: FAIL. Every component using `bg-accent-soft` still compiles (Tailwind emits nothing for an unknown class rather than erroring), so **tests will mostly still pass** — the breakage is visual, not assertive. Record the exact pass count.

- [ ] **Step 2: Confirm the class is genuinely dead**

Run: `npx tailwindcss -c tailwind.config.js -i src/index.css -o /tmp/probe.css --content src/components/MainMenu.jsx`
Then: `grep -c 'bg-accent-soft' /tmp/probe.css`
Expected: `0` — the class emits no rule now that `accent.soft` is unmapped. This is why the migration in Stage 2 cannot be skipped or deferred.

- [ ] **Step 3: Commit nothing**

This task is verification only. It exists so the engineer sees that a missing token fails *silently*, which is the whole hazard of this migration.

---

## Stage 2 — The accent migration (semantic, not mechanical)

**185 `accent` usages across 34 files. Exactly two are the wordmark** (`TopBar.jsx:47`, `ErrorBoundary.jsx:45`). Every other site must be reclassified.

### The mapping rule — apply per site, by meaning

| Old | Meaning | New |
|---|---|---|
| `bg-accent` + `text-accent-ink` | a primary **action** (button) | `bg-copper` + `text-accent-ink` |
| `border-accent` on a **selected** card/chip | **seated / chosen** | `border-gold` |
| `bg-accent-soft` | the selected **wash** | `bg-gold-soft` |
| `text-accent` on a **selected** label | **seated / chosen** | `text-gold` |
| `text-accent` on a **hover** affordance | an action hint | `hover:text-copper` |
| `text-accent` on a **spec / designator / unit** | **technical** | `text-tech` |
| `ring-accent` | selection ring | `ring-gold` |

**Do not find-and-replace.** A button and a selected chip both say `accent` today and must diverge.

### Task 3: Migrate the build-tab components

**Files (with current `accent` counts):**
- Modify: `src/components/CategoryList.jsx` (6)
- Modify: `src/components/PartCard.jsx` (6)
- Modify: `src/components/PartSelector.jsx` (3)
- Modify: `src/components/PartsBrowser.jsx` (6)
- Modify: `src/components/SelectedPartsPanel.jsx` (1)
- Modify: `src/components/BuildSummary.jsx` (8)
- Modify: `src/components/BuildRatingPanel.jsx` (4)
- Modify: `src/components/AutoBuildButton.jsx` (1)
- Modify: `src/components/GeneratedBanner.jsx` (2)
- Modify: `src/components/ScoreInfo.jsx` (1)

Confirm the list is complete before starting — the counts above were taken on
2026-08-16 and a file may have gained a site since:

```bash
grep -rnoE '(bg|text|border|ring|from|via|to)-accent(-soft|-ink)?\b' src/components src/lib | grep -v accent-ink
```

- [ ] **Step 1: Apply the mapping rule to each site**

Worked example — `src/components/PartCard.jsx:15`, a **selected** state:

```jsx
// before
? 'border-accent bg-accent-soft ring-1 ring-accent'
// after
? 'border-gold bg-gold-soft ring-1 ring-gold'
```

Worked example — `src/components/AutoBuildButton.jsx:52`, an **action**:

```jsx
// before
className="text-xs px-3.5 py-2 rounded-lg bg-accent hover:brightness-110 text-accent-ink font-semibold transition-colors"
// after
className="text-xs px-3.5 py-2 rounded-lg bg-copper hover:brightness-110 text-accent-ink font-semibold transition-colors"
```

Worked example — `src/components/CategoryList.jsx:70`, the **next-to-do** slot, which is a prompt to act rather than a selection:

```jsx
// before
? 'border-accent bg-accent-soft text-accent hover:brightness-110'
// after
? 'border-copper bg-gold-soft text-copper hover:brightness-110'
```

- [ ] **Step 2: Run the affected tests**

Run: `npx vitest run src/tests/CategoryList.test.jsx src/tests/PartCard.test.jsx src/tests/BuildSummary.test.jsx`
Expected: PASS. Any failure naming a colour class is a test asserting the old token — update the assertion to the new token, and confirm the *meaning* matches the mapping table.

- [ ] **Step 3: Commit**

```bash
git add src/components
git commit -m "refactor: reclassify the build tab's accent uses as copper or gold"
```

### Task 4: Migrate the menu and setup flow

**Files:** `src/components/MainMenu.jsx` (12), `src/components/SetupFlow.jsx` (16), `src/components/UseCaseChips.jsx` (1), `src/components/SavedBuilds.jsx` (3)

- [ ] **Step 1: Apply the same mapping table from Stage 2's header**

These files are selection-heavy — most sites are `border-accent bg-accent-soft` on a chosen option, which becomes `border-gold bg-gold-soft`. The exceptions are the primary CTAs (`MainMenu.jsx:45`, the "start" button), which are **actions** → `bg-copper`.

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/tests/MainMenu.test.jsx src/tests/SetupFlow.test.jsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components
git commit -m "refactor: reclassify the menu and setup flow's accent uses"
```

### Task 5: Migrate the peripherals, site pages and chrome

**Files:** `PeripheralsPanel.jsx` (11), `PeripheralFilterPanel.jsx` (4), `HelpPage.jsx` (2), `LegalPage.jsx` (3), `GlossaryPage.jsx` (2), `FeedbackPage.jsx` (4), `PartPage.jsx` (8), `InfoDisclaimer.jsx` (2), `SiteChrome.jsx` (1), `SiteFooter.jsx` (1), `SearchBar.jsx` (1), `SpecSheet.jsx` (1), `DynamicBars.jsx` (1), `ViewTabs.jsx` (4), `CaseToggle.jsx` (1), `CanvasErrorBoundary.jsx` (1), `performance/SummaryStrip.jsx` (1)

- [ ] **Step 1: Apply the mapping table**

Two judgements to make consciously here:
- `ViewTabs.jsx` — the **active tab** is a selection → `bg-gold text-accent-ink` for the solid chip, `hover:text-gold` for the rest.
- `SpecSheet.jsx` and `DynamicBars.jsx` — these label **measurements** → `text-tech`.

- [ ] **Step 2: Run the tests**

Run: `npm run test:run`
Expected: PASS at the recorded baseline count.

- [ ] **Step 3: Commit**

```bash
git add src/components
git commit -m "refactor: reclassify the remaining accent uses across pages and chrome"
```

### Task 6: Remap the shared token strings

**Files:**
- Modify: `src/lib/uiTokens.js`

- [ ] **Step 1: Update `BTN_PRIMARY` and `PANEL_STRONG`**

```js
// Flat primary action — one metal, dark ink on top, no gradients or glows.
export const BTN_PRIMARY = 'bg-copper hover:brightness-110 text-accent-ink font-semibold'
```

`PANEL`, `PANEL_STRONG`, `TELEMETRY`, `ELEV_PAGE`, `ELEV_GROUP`, `ELEV_ACTIVE` need no change — they name surfaces, not accents.

- [ ] **Step 2: Update `RAIL_ACTIVE` to the metal**

```js
// The rail marks the ACTIVE thing — the open genre, the open row. An inset
// box-shadow rather than border-l-2: a border changes the box and shifts the
// row's contents 2px out of line with every row above it.
export const RAIL_ACTIVE = 'shadow-[inset_2px_0_0_0_var(--gold)]'
```

- [ ] **Step 3: Run the Instrument tests**

Run: `npx vitest run src/tests/FrameRateTableGroups.test.jsx`
Expected: PASS — the rail assertions match on `shadow-\[inset`, which is unchanged in shape.

- [ ] **Step 4: Commit**

```bash
git add src/lib/uiTokens.js
git commit -m "refactor: point the shared token strings at the metals"
```

### Task 7: Guard that orange is wordmark-only

**Files:**
- Create: `src/tests/accentIsBrandOnly.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { describe, it, expect } from 'vitest'

// --accent is the brand, and the brand is the wordmark. It is the only fully
// saturated colour on the site, which is what makes it read as identity rather
// than as one more UI accent. The moment it starts marking selections or
// buttons again, that distinction is gone and the palette is back to
// near-black-plus-one-accent — the exact generic look this redesign replaced.
//
// State belongs to the metals: copper for action, gold for seated, tech for
// technical. See the mapping table in the plan.
const WORDMARK_FILES = ['components/TopBar.jsx', 'components/ErrorBoundary.jsx']

function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'tests') sourceFiles(path, acc)
    } else if (/\.(js|jsx)$/.test(entry.name)) acc.push(path)
  }
  return acc
}

// `accent-ink` is the text colour that sits ON a metal fill — it is not the
// brand and is allowed anywhere. Only bare `accent` is restricted.
const ACCENT_CLASS = /(?<![\w-])(?:bg|text|border|ring|divide|outline|from|via|to)-accent(?![\w-])/g

function offenders() {
  return sourceFiles(resolve(process.cwd(), 'src')).flatMap((file) => {
    const rel = file.replace(/\\/g, '/').split('/src/')[1]
    if (WORDMARK_FILES.includes(rel)) return []
    const found = readFileSync(file, 'utf8').match(ACCENT_CLASS) ?? []
    return found.map((cls) => `${rel} — ${cls}`)
  })
}

describe('the brand accent is reserved for the wordmark', () => {
  it('matches a bare accent class but not accent-ink', () => {
    expect('bg-accent'.match(ACCENT_CLASS)).toHaveLength(1)
    expect('text-accent-ink'.match(ACCENT_CLASS)).toBeNull()
    expect('border-accent'.match(ACCENT_CLASS)).toHaveLength(1)
  })

  it('appears nowhere outside the wordmark components', () => {
    expect(offenders()).toEqual([])
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/tests/accentIsBrandOnly.test.js`
Expected: PASS if Tasks 3-6 were complete. **If it lists offenders, those are sites the migration missed** — go back and classify each by the mapping table rather than blanket-replacing.

- [ ] **Step 3: Verify the guard is not vacuous**

Temporarily change `src/components/ViewTabs.jsx` to use `text-accent` somewhere. Re-run. Expected: FAIL naming that file. Then restore it by copying back from the scratchpad — **not** with `git checkout --`.

- [ ] **Step 4: Commit**

```bash
git add src/tests/accentIsBrandOnly.test.js
git commit -m "test: fail the build when the brand accent escapes the wordmark"
```

### Task 8: Look at it

- [ ] **Step 1: Start the dev server and seed a build**

`preview_start{name:'custompc-dev'}`, then seed `localStorage` per point 6 of the critical context, then reload.

- [ ] **Step 2: Check every tab**

Build, Performance, Peripherals, Summary, plus `/help` and the main menu. Look for: anything still orange that is not the wordmark, and anything that has gone invisible (a dead `bg-accent-soft` renders as nothing).

- [ ] **Step 3: Check the 3D scene**

The ground moved `#0F1114` → `#0E0F11`. Confirm the scene still reads correctly against it. ⚠️ WebGL context is exhaustible (~10-15 reloads per session) — take the screenshot early.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A src/
git commit -m "fix: correct the sites the accent migration missed"
```

---

## Stage 3 — The connector slot

### Task 9: Build `PartSlot`

**Files:**
- Create: `src/components/PartSlot.jsx`
- Create: `src/tests/PartSlot.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PartSlot from '../components/PartSlot'

describe('PartSlot', () => {
  it('names the connector a part plugs into, not the category', () => {
    // The designator is what teaches a beginner WHERE the part goes. It is
    // structure that encodes something true, not decoration.
    render(<PartSlot category="gpu" />)
    expect(screen.getByText('PCIEX16_1')).toBeInTheDocument()
  })

  it('says a slot is empty rather than leaving it blank', () => {
    render(<PartSlot category="ram" />)
    expect(screen.getByText(/empty/i)).toBeInTheDocument()
  })

  it('names the seated part and drops the empty state', () => {
    render(<PartSlot category="ram" part={{ name: 'Vengeance 32GB' }} />)
    expect(screen.getByText('Vengeance 32GB')).toBeInTheDocument()
    expect(screen.queryByText(/empty/i)).toBeNull()
  })

  it('rails a seated slot in gold and leaves an empty one unrailed', () => {
    const { container: seated } = render(<PartSlot category="ram" part={{ name: 'X' }} />)
    expect(seated.firstChild.className).toMatch(/shadow-\[inset/)
    const { container: empty } = render(<PartSlot category="ram" />)
    expect(empty.firstChild.className).not.toMatch(/shadow-\[inset/)
  })

  it('falls back to the category when a connector is unknown', () => {
    // Not every category plugs into a named connector — a case does not.
    render(<PartSlot category="case" />)
    expect(screen.queryByText('undefined')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/tests/PartSlot.test.jsx`
Expected: FAIL — `Failed to resolve import "../components/PartSlot"`

- [ ] **Step 3: Implement it**

```jsx
import { ELEV_GROUP, RAIL_ACTIVE } from '../lib/uiTokens'

// A part slot drawn as the connector the part actually plugs into.
//
// An empty slot reads as a hole in the build rather than as another grey row,
// and the designator teaches WHERE the part goes — which is information a
// beginner genuinely needs, so the label is structure rather than decoration.
//
// ⚠️ No `/NN` opacity modifiers on these tokens. `bg-gold/60` emits no CSS at
// all on this palette; tokenOpacity.test.js fails the build for it.
const CONNECTOR = {
  cpu: { designator: 'CPU_1', notch: 'square' },
  cooler: { designator: 'CPU_FAN', notch: 'square' },
  ram: { designator: 'DIMM_A2', notch: 'edge' },
  gpu: { designator: 'PCIEX16_1', notch: 'edge' },
  storage: { designator: 'M2_1', notch: 'edge' },
  psu: { designator: 'ATX_PWR', notch: 'pins' },
  motherboard: { designator: 'BOARD', notch: 'square' },
}

export default function PartSlot({ category, part, onClick }) {
  const connector = CONNECTOR[category]
  const seated = Boolean(part)

  return (
    <div className={`rounded-lg ${ELEV_GROUP} ${seated ? RAIL_ACTIVE : ''}`}>
      {/* Two spans, not one string. Testing Library's getByText matches the
          whole normalised text of an element, so "PCIEX16_1" and "— empty"
          concatenated into one span makes BOTH assertions unfindable. */}
      {connector && (
        <span className="block px-3 pt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-tech">
          <span>{connector.designator}</span>
          {!seated && <span className="text-faint"> — empty</span>}
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors
          ${seated
            ? 'text-ink hover:brightness-110'
            : 'border border-dashed border-line-strong text-muted hover:border-copper hover:text-copper'}`}
      >
        <span
          aria-hidden="true"
          className={`relative h-3 w-12 shrink-0 rounded-sm ${seated ? 'bg-gold' : 'bg-surface-2'}`}
        >
          {connector?.notch === 'edge' && (
            <i className="absolute inset-y-0 left-[34%] w-[3px] bg-ground" />
          )}
        </span>
        {seated ? part.name : `Choose a ${category}`}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/tests/PartSlot.test.jsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Verify the tests are not vacuous**

Change `text-tech` to `text-muted` in the designator span and re-run — the designator tests still pass (they assert text, not colour), which is correct. Then delete the `{connector.designator}` expression: expect FAIL on two tests. Restore from the scratchpad.

- [ ] **Step 6: Commit**

```bash
git add src/components/PartSlot.jsx src/tests/PartSlot.test.jsx
git commit -m "feat: draw a part slot as the connector its part plugs into"
```

### Task 10: Use `PartSlot` in the build list

**Files:**
- Modify: `src/components/CategoryList.jsx`
- Test: `src/tests/CategoryList.test.jsx`

- [ ] **Step 1: Run the existing tests and record what they assert**

Run: `npx vitest run src/tests/CategoryList.test.jsx`
Expected: PASS. Read them first — `CategoryList` has three documented slot states (Missing / Pick one / Optional-with-reason) and **thermal paste being optional is a signed-off decision**. The connector treatment must preserve all three; it changes how a slot looks, not which states exist.

- [ ] **Step 2: Give `PartSlot` a `tone` prop**

`CategoryList` keeps its state logic (`flagged` / `explained` / `isNext`) and
passes the result down. Do NOT move that logic into `PartSlot` — `PartSlot`
draws one connector; deciding which slots are urgent belongs to the list.

Add to `PartSlot`, replacing the `className` on the inner `<button>`:

```jsx
// `tone` is decided by the caller. A slot knows how to draw itself; it does not
// know whether the build needs it next.
const TONE = {
  seated: 'text-ink hover:brightness-110',
  flagged: 'border border-dashed border-bad text-ink hover:brightness-110',
  next: 'border border-dashed border-copper text-copper hover:brightness-110',
  optional: 'border border-dashed border-line-strong text-muted hover:border-copper hover:text-copper',
  empty: 'border border-dashed border-line-strong text-muted hover:border-copper hover:text-copper',
}
```

```jsx
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors
          ${TONE[seated ? 'seated' : (tone ?? 'empty')]}`}
```

and take `tone` in the signature: `export default function PartSlot({ category, part, tone, onClick })`.

- [ ] **Step 2b: Pin the tone mapping with a test**

Add to `src/tests/PartSlot.test.jsx`:

```jsx
  it('draws a flagged slot differently from a merely optional one', () => {
    // These two were a single grey row once, and the missing part read as
    // "unavailable" rather than as "you still need this".
    const { container: bad } = render(<PartSlot category="gpu" tone="flagged" />)
    const { container: opt } = render(<PartSlot category="cooler" tone="optional" />)
    expect(bad.querySelector('button').className).toMatch(/border-bad/)
    expect(opt.querySelector('button').className).not.toMatch(/border-bad/)
  })
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/tests/CategoryList.test.jsx`
Expected: PASS. Update any assertion that matched the old markup shape, keeping the same behavioural claim.

- [ ] **Step 4: Look at it in the app**

Confirm all three states still read distinctly, and that an empty slot reads as a hole rather than a row.

- [ ] **Step 5: Commit**

```bash
git add src/components/CategoryList.jsx src/tests/CategoryList.test.jsx
git commit -m "feat: give the build list its connector slots"
```

---

## Stage 4 — Type and sweep

### Task 11: Swap the display face to Archivo

⚠️ **GATE: this task downloads a font file. Ask the user before starting it.** The spec records this as the one open question. Bricolage is 105 KB of the current 200 KB — that is the number to beat, and it must be measured, not assumed.

**Files:**
- Add: `public/fonts/archivo-latin.woff2`, `public/fonts/archivo-latin-ext.woff2`
- Delete: `public/fonts/bricolage-grotesque-latin.woff2`, `public/fonts/bricolage-grotesque-latin-ext.woff2`
- Modify: `src/fonts.css`, `tailwind.config.js:7`

- [ ] **Step 1: Measure the subset**

Report both files' byte sizes against Bricolage's 105 KB before going further. If Archivo is materially larger, stop and raise it.

- [ ] **Step 2: Register the face**

Follow the exact `@font-face` pattern already in `src/fonts.css` — two blocks per weight range, `font-display: swap`, and the same two `unicode-range` values (latin and latin-ext) copied verbatim from the Bricolage blocks.

- [ ] **Step 3: Point the display family at it**

```js
        display: ['Archivo', 'Hanken Grotesk', 'ui-sans-serif', 'sans-serif'],
```

- [ ] **Step 4: Verify no CSP or font-host regression**

Run: `npx vitest run src/tests/cspHeaders.test.js`
Expected: PASS. ⚠️ Fonts must stay self-hosted — pulling from `fonts.googleapis.com` reintroduces a GDPR problem and breaks two CSP tests.

- [ ] **Step 5: Commit**

```bash
git add public/fonts src/fonts.css tailwind.config.js
git commit -m "feat: swap the display face to Archivo"
```

### Task 12: Full verification

- [ ] **Step 1: Run everything**

```bash
npm run lint
npm run test:run
npm run build
```
Expected: lint clean; **at or above 126 files / 1248 tests** (this plan adds ~10); build green.

- [ ] **Step 2: Confirm no dead utilities crept in**

Run: `npx vitest run src/tests/tokenOpacity.test.js src/tests/accentIsBrandOnly.test.js src/tests/paletteContrast.test.js`
Expected: PASS.

- [ ] **Step 3: Check the app at 375px and 1280px**

`resize_window` to mobile and desktop. The build list, the Performance table and the top bar are the three that have broken at 375px before.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify the board UI across the app"
```

---

## Out of scope

Recorded so they are not smuggled in:

- **The full board-map layout.** Explored, shown, deliberately deferred.
- **Structural density work.** Connectors-as-slots improves how a slot reads without reducing what is on screen; "too dense" was one of four stated drivers and this plan only partly answers it.
- **The Performance tab's Instrument pass** — already built, and it survives unchanged in shape. Only its colours move, in Task 6.
- **Any perf-engine, routing or 3D-geometry change.**
