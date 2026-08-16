# RAM-stick boxes and zoned board background — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic `PANEL` container with a `RamBox` that draws itself as a DIMM, give it seated/empty and closed/open (unseating) states, and put a zoned motherboard background behind the page.

**Architecture:** One geometry module holds every tuned number so the percentage-blade decision has a single place to be revisited. One presentational `RamBox` owns chrome only — fins, caps, body, lit bar, contacts, socket — and knows nothing about builds or parts. Seven `PANEL` call sites migrate to it. A separate `BoardBackground` paints SVG traces in the page gutters only. Two unrelated bugs ride along because they touch the same test surfaces.

**Tech Stack:** React 19, Vite, Tailwind 3.4 (semantic tokens over CSS vars), Zustand, Vitest + Testing Library, Playwright.

**Read first:** `docs/superpowers/specs/2026-08-16-ram-stick-boxes-and-board-background-design.md`

---

## Critical constraints

Read these before writing a line. Each has already caused a real bug in this repo.

1. **Never put a `/NN` opacity modifier on a palette token.** `bg-surface/85` emits *no CSS at all* — Tailwind cannot decompose a bare `var()` holding a hex. `tokenOpacity.test.js` fails the build for it. This plan uses inline gradients and `box-shadow` that name CSS vars directly, which sidesteps the trap entirely.
2. **jsdom computes no layout.** No unit test can assert a blade is 12px tall or that a box does not overflow. Anything geometric goes in `e2e/`.
3. **Brand orange (`--accent`) is wordmark-only.** `accentIsBrandOnly.test.js` guards four sites. Nothing in this work may use it.
4. **`prerendered/*.html` goes stale silently.** This changes every shared panel. Task 11 re-runs the capture; the suite passing proves nothing about it.

---

## File structure

**Create**
- `src/lib/ramBoxGeometry.js` — blade spans, heights, rake, fixed heights. The single place the percentage decision lives.
- `src/components/RamBox.jsx` — chrome only. Props: `designator`, `seated`, `open`, `children`, `className`.
- `src/components/BoardBackground.jsx` — zoned SVG traces for the gutters.
- `src/tests/ramBoxGeometry.test.js`
- `src/tests/RamBox.test.jsx`
- `src/tests/BoardBackground.test.jsx`
- `src/tests/tokenResolves.test.js` — the second opacity guard (bug 2).
- `e2e/ramBox.spec.js` — blade count, contrast against traces, per-element overflow at 1280px.

**Modify**
- `src/lib/uiTokens.js` — note that `PANEL` is now for non-part surfaces only.
- `src/components/BuildRatingPanel.jsx:68`, `BuildSummary.jsx:132`, `BuildWarnings.jsx:11`, `PeripheralsPanel.jsx:113`, `SavedBuilds.jsx:106`, `SelectedPartsPanel.jsx:28`, `SetupFlow.jsx:205`
- `src/components/TopBar.jsx:100` — the 1280px clip (bug 1).
- `src/components/SiteChrome.jsx` — mount `BoardBackground`.

---

## Task 1: Blade geometry module

**Files:**
- Create: `src/lib/ramBoxGeometry.js`
- Test: `src/tests/ramBoxGeometry.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/tests/ramBoxGeometry.test.js
import { describe, it, expect } from 'vitest'
import { BLADES, RAKE_DEG, FIN_ROW_HEIGHT, CONTACT_HEIGHT, bladeStyle } from '../lib/ramBoxGeometry'

describe('ramBoxGeometry', () => {
  it('carries five blades in two opposed banks', () => {
    expect(BLADES).toHaveLength(5)
    expect(BLADES.filter((b) => b.rake === 'left')).toHaveLength(3)
    expect(BLADES.filter((b) => b.rake === 'right')).toHaveLength(2)
  })

  it('pins the tuned spans and heights', () => {
    expect(BLADES.map((b) => [b.left, b.width])).toEqual([
      [2, 16], [22, 10], [36, 21], [64, 18], [85, 15],
    ])
    expect(BLADES.filter((b) => b.rake === 'left').every((b) => b.height === 12)).toBe(true)
    expect(BLADES.filter((b) => b.rake === 'right').every((b) => b.height === 16)).toBe(true)
  })

  it('never lets a blade run past the part', () => {
    for (const b of BLADES) expect(b.left + b.width).toBeLessThanOrEqual(100)
  })

  it('leaves a gap between every pair of blades', () => {
    for (let i = 1; i < BLADES.length; i++) {
      expect(BLADES[i].left).toBeGreaterThan(BLADES[i - 1].left + BLADES[i - 1].width)
    }
  })

  it('skews the two banks in opposite directions', () => {
    expect(bladeStyle(BLADES[0]).transform).toBe(`skewX(${RAKE_DEG}deg)`)
    expect(bladeStyle(BLADES[4]).transform).toBe(`skewX(-${RAKE_DEG}deg)`)
  })

  it('expresses position as a percentage, not pixels', () => {
    // The decision recorded in the spec: percentage keeps all five blades at
    // every box width. If this ever becomes 'px', that was a deliberate
    // reversal and the spec needs updating with it.
    expect(bladeStyle(BLADES[0]).left).toBe('2%')
    expect(bladeStyle(BLADES[0]).width).toBe('16%')
  })

  it('holds fins and contacts at a fixed height', () => {
    expect(FIN_ROW_HEIGHT).toBe(18)
    expect(CONTACT_HEIGHT).toBe(13)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/ramBoxGeometry.test.js`
Expected: FAIL — `Failed to resolve import "../lib/ramBoxGeometry"`

- [ ] **Step 3: Write the module**

```js
// src/lib/ramBoxGeometry.js
//
// Every tuned number for the RamBox silhouette, in one file on purpose.
//
// ⚠️ Positions are PERCENTAGES, and that is a decision rather than an
// oversight. Fixed-pixel blades were prototyped and compared side by side at
// three aspect ratios; they hold tooth size constant but a narrow box loses
// blades outright (a 150px box kept two of five). Percentage keeps all five
// and the tuned rhythm everywhere, at the cost of tooth size varying with box
// width. If you are about to "fix" this, read the spec first — you are
// reversing a choice, not correcting a bug.

// Left bank rakes one way, right bank the other. The opposition is the point:
// it is what stops the top edge reading as a plain comb.
export const BLADES = [
  { left: 2, width: 16, height: 12, rake: 'left' },
  { left: 22, width: 10, height: 12, rake: 'left' },
  { left: 36, width: 21, height: 12, rake: 'left' },
  { left: 64, width: 18, height: 16, rake: 'right' },
  { left: 85, width: 15, height: 16, rake: 'right' },
]

export const RAKE_DEG = 20

// Fixed. Only the heatspreader stretches — a square box is the same physical
// part with a taller body, never a scaled-up drawing.
export const FIN_ROW_HEIGHT = 18
export const CONTACT_HEIGHT = 13

// transform-origin keeps the blade's foot planted on the body while the top
// leans; without it the skew pivots about the centre and lifts the blade off.
export function bladeStyle({ left, width, height, rake }) {
  return {
    left: `${left}%`,
    width: `${width}%`,
    height: `${height}px`,
    transform: `skewX(${rake === 'left' ? '' : '-'}${RAKE_DEG}deg)`,
    transformOrigin: 'bottom left',
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/tests/ramBoxGeometry.test.js`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/ramBoxGeometry.js src/tests/ramBoxGeometry.test.js
git commit -m "feat: pin the RamBox blade geometry in one module"
```

---

## Task 2: RamBox chrome — closed and seated

**Files:**
- Create: `src/components/RamBox.jsx`
- Test: `src/tests/RamBox.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/tests/RamBox.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RamBox from '../components/RamBox'

const blades = (c) => c.querySelectorAll('[data-blade]')

describe('RamBox', () => {
  it('renders its children', () => {
    render(<RamBox designator="DIMM_A2">Ryzen 7 9800X3D</RamBox>)
    expect(screen.getByText('Ryzen 7 9800X3D')).toBeInTheDocument()
  })

  it('shows the reference designator', () => {
    render(<RamBox designator="PCIEX16_1">x</RamBox>)
    expect(screen.getByText('PCIEX16_1')).toBeInTheDocument()
  })

  it('draws all five blades regardless of size', () => {
    const { container } = render(<RamBox designator="M2_1">x</RamBox>)
    expect(blades(container)).toHaveLength(5)
  })

  it('marks itself seated and lights the contacts', () => {
    const { container } = render(<RamBox designator="CPU_1" seated>x</RamBox>)
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-seated', 'true')
    expect(container.querySelector('[data-contacts]')).toHaveAttribute('data-contacts', 'live')
  })

  it('leaves the contacts cold when nothing is seated', () => {
    const { container } = render(<RamBox designator="CPU_1">x</RamBox>)
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-seated', 'false')
    expect(container.querySelector('[data-contacts]')).toHaveAttribute('data-contacts', 'cold')
  })

  it('shows no socket while closed', () => {
    const { container } = render(<RamBox designator="CPU_1" seated>x</RamBox>)
    expect(container.querySelector('[data-socket]')).toBeNull()
  })

  it('carries no opacity modifier on a palette token', () => {
    // The class-level half of tokenOpacity.test.js, asserted at the one
    // component most likely to reach for a translucent metal.
    const { container } = render(<RamBox designator="CPU_1" seated>x</RamBox>)
    const classes = [...container.querySelectorAll('*')]
      .flatMap((el) => (typeof el.className === 'string' ? el.className.split(/\s+/) : []))
    expect(classes.filter((c) => /-(gold|copper|surface|ground|line|ink|tech)(-\w+)?\/\d/.test(c))).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/RamBox.test.jsx`
Expected: FAIL — `Failed to resolve import "../components/RamBox"`

- [ ] **Step 3: Write the component**

```jsx
// src/components/RamBox.jsx
import { BLADES, FIN_ROW_HEIGHT, CONTACT_HEIGHT, bladeStyle } from '../lib/ramBoxGeometry'

// A panel drawn as the DIMM it stands for.
//
// This owns CHROME ONLY — fins, end caps, heatspreader, lit bar, contacts,
// socket. It knows nothing about builds, parts or prices; callers put whatever
// they like in `children`. That boundary is what lets the same component be a
// build list, a summary card and a filter rail.
//
// ⚠️ The gradients below are inline rather than Tailwind classes, deliberately.
// Every palette token is a bare `var()` holding a hex, so Tailwind cannot
// compose an opacity modifier onto one — `bg-gold/60` emits no CSS at all and
// tokenOpacity.test.js fails the build for it. Naming the var inside a gradient
// sidesteps the whole trap.
const BODY = 'linear-gradient(180deg,#2c323b 0 2px,#252a33 2px 26px,#1d2128 26px,#191c22)'
const GRAIN = 'repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px)'
const BLADE = 'linear-gradient(180deg,#333a44 0 1px,#272d36 1px 40%,#1f242b)'
const BLADE_EDGE = 'linear-gradient(90deg,#6d7683,#8992a0 40%,#4d545f)'
const CAP_L = 'linear-gradient(90deg,#4a515c,#2b3038 40%,#22262D)'
const CAP_R = 'linear-gradient(270deg,#4a515c,#2b3038 40%,#22262D)'

// Gold means SEATED. An empty slot is the same hardware, cold — the shape never
// changes, only the light.
const BAR_LIT = 'linear-gradient(90deg,#6b5730,var(--gold) 22%,#E9D0A0 48%,var(--gold) 74%,#6b5730)'
const BAR_DEAD = '#262a31'

// 3.2px pitch: pad, shadow, gap. At real size this reads as a strip of many
// fine fingers rather than a dozen tiles, which is what a DIMM edge looks like.
const LIVE = 'repeating-linear-gradient(90deg,#D9BE8A 0 1.7px,#8a6f3f 1.7px 2.1px,#13161b 2.1px 3.2px)'
const COLD = 'repeating-linear-gradient(90deg,#5c5340 0 1.7px,#3b3527 1.7px 2.1px,#13161b 2.1px 3.2px)'

function Blades() {
  return (
    <div aria-hidden="true" className="relative mx-3 -mb-px" style={{ height: FIN_ROW_HEIGHT }}>
      {BLADES.map((b, i) => (
        <span
          key={i}
          data-blade={b.rake}
          className="absolute bottom-0 rounded-t-sm"
          style={{ ...bladeStyle(b), backgroundImage: BLADE }}
        >
          <span className="absolute inset-x-0 top-0 h-px rounded-t-sm" style={{ backgroundImage: BLADE_EDGE }} />
        </span>
      ))}
    </div>
  )
}

// The contact edge runs corner to corner. The only break is the keying notch —
// the detail that actually says "this goes in one way round". The corner
// mounting notches a DIMM also has were built and removed: stamped over
// finished gold they slice live pads and read as damage rather than as outline.
// `live` rather than `seated` on purpose: by Task 3 these come apart. A box can
// be seated and still have cold contacts, because opening lifts it clear.
function Contacts({ live }) {
  return (
    <div
      aria-hidden="true"
      data-contacts={live ? 'live' : 'cold'}
      className="relative mx-3 flex items-end border border-t-0 border-line-strong bg-[#13161b]"
      style={{ height: CONTACT_HEIGHT }}
    >
      <span className="h-2 flex-1" style={{ backgroundImage: live ? LIVE : COLD }} />
      <i className="w-1.5 self-stretch bg-ground shadow-[inset_1px_0_0_var(--line-strong),inset_-1px_0_0_var(--line-strong)]" />
      <span className="h-2 flex-[2.4]" style={{ backgroundImage: live ? LIVE : COLD }} />
    </div>
  )
}

export default function RamBox({ designator, seated = false, open = false, className = '', children }) {
  return (
    <div data-ram-box data-seated={String(seated)} data-open={String(open)} className={className}>
      <div className="flex flex-col">
        <Blades />
        <div className="relative flex flex-1 px-3">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-2.5 rounded-t-sm" style={{ backgroundImage: CAP_L }} />
          <span aria-hidden="true" className="absolute inset-y-0 right-0 z-10 w-2.5 rounded-t-sm" style={{ backgroundImage: CAP_R }} />
          <div className="relative flex-1 border border-b-0 border-line-strong" style={{ backgroundImage: BODY }}>
            <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.55 }} />
            <span
              aria-hidden="true"
              className="absolute left-0 top-2 z-[4] h-[9px] w-2/5 rounded-r-sm"
              style={{
                background: seated ? BAR_LIT : BAR_DEAD,
                boxShadow: seated ? '0 0 10px 1px rgba(201,168,107,.28)' : 'none',
              }}
            />
            <div className="relative z-[2] px-4 pb-3 pt-8">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-tech">{designator}</span>
              {children}
            </div>
          </div>
        </div>
        <Contacts live={seated} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/tests/RamBox.test.jsx`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/RamBox.jsx src/tests/RamBox.test.jsx
git commit -m "feat: draw a panel as the DIMM it stands for"
```

---

## Task 3: Unseating — the open state

**Files:**
- Modify: `src/components/RamBox.jsx`
- Test: `src/tests/RamBox.test.jsx`

- [ ] **Step 1: Write the failing test** (append to the existing `describe`)

```jsx
  it('lifts clear of its socket when open', () => {
    const { container } = render(<RamBox designator="DIMM_A2" seated open>x</RamBox>)
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-open', 'true')
    expect(container.querySelector('[data-socket]')).not.toBeNull()
  })

  it('breaks the connection when it unseats', () => {
    // Gold does two jobs in this system: seated, and attended-to. Opening puts
    // them in conflict — the open box is at once the most active and the least
    // seated thing on screen. The split: the bar keeps ATTENTION, the contacts
    // lose CONNECTION.
    const { container } = render(<RamBox designator="DIMM_A2" seated open>x</RamBox>)
    expect(container.querySelector('[data-contacts]')).toHaveAttribute('data-contacts', 'cold')
    expect(container.querySelector('[data-bar]')).toHaveAttribute('data-bar', 'lit')
  })

  it('keeps the bar lit open or shut, so long as a part is seated', () => {
    const shut = render(<RamBox designator="DIMM_A2" seated>x</RamBox>)
    expect(shut.container.querySelector('[data-bar]')).toHaveAttribute('data-bar', 'lit')
  })

  it('leaves the bar dead on an empty slot even when open', () => {
    const { container } = render(<RamBox designator="DIMM_A2" open>x</RamBox>)
    expect(container.querySelector('[data-bar]')).toHaveAttribute('data-bar', 'dead')
  })

  it('rocks both retention clips outward when open', () => {
    const { container } = render(<RamBox designator="DIMM_A2" seated open>x</RamBox>)
    expect(container.querySelectorAll('[data-clip]')).toHaveLength(2)
  })
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/RamBox.test.jsx`
Expected: FAIL — `expected null not to be null` on `[data-socket]`

- [ ] **Step 3: Implement unseating**

Add above the default export in `src/components/RamBox.jsx`:

```jsx
// The socket the part came out of. It renders as a SIBLING below the box, not
// inside it — a slot is not part of the part. Its gold is the same gold that
// left the contacts: the eye follows the part out of its seat.
function Socket() {
  return (
    <div
      aria-hidden="true"
      data-socket
      className="relative mx-1 h-[15px] rounded-b-sm border border-t-0 border-[#4a4335] bg-[linear-gradient(180deg,#1a1d23,#101318)] shadow-[inset_0_3px_7px_-2px_rgba(201,168,107,.5)]"
    >
      <i className="absolute inset-y-0.5 left-[34%] w-[5px] rounded-sm bg-ground shadow-[inset_1px_0_0_var(--line),inset_-1px_0_0_var(--line)]" />
    </div>
  )
}

// 9x22px bars at the outer edges. Shut they stand upright gripping the caps;
// open they rock out, which is the physical tell that the part is free.
function Clip({ side, open }) {
  const deg = open ? (side === 'left' ? -26 : 26) : 0
  return (
    <span
      aria-hidden="true"
      data-clip={side}
      className="absolute bottom-0 z-20 h-[22px] w-[9px] rounded-sm bg-[linear-gradient(180deg,#454c57,#262b33)] transition-transform duration-200"
      style={{ [side]: '-3px', transform: `rotate(${deg}deg)`, transformOrigin: 'bottom center' }}
    />
  )
}
```

Then replace the component body's outer `div` and bar span:

```jsx
export default function RamBox({ designator, seated = false, open = false, className = '', children }) {
  // Contacts are cold whenever the part is not electrically home — either
  // because nothing is seated, or because opening lifted it clear.
  const connected = seated && !open

  return (
    <div data-ram-box data-seated={String(seated)} data-open={String(open)} className={`relative ${className}`}>
      <div className={`flex flex-col transition-transform duration-200 ${open ? '-translate-y-2' : ''}`}>
        <Blades />
        <div className="relative flex flex-1 px-3">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-2.5 rounded-t-sm" style={{ backgroundImage: CAP_L }} />
          <span aria-hidden="true" className="absolute inset-y-0 right-0 z-10 w-2.5 rounded-t-sm" style={{ backgroundImage: CAP_R }} />
          <div className="relative flex-1 border border-b-0 border-line-strong" style={{ backgroundImage: BODY }}>
            <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.55 }} />
            <span
              aria-hidden="true"
              data-bar={seated ? 'lit' : 'dead'}
              className="absolute left-0 top-2 z-[4] h-[9px] w-2/5 rounded-r-sm"
              style={{
                background: seated ? BAR_LIT : BAR_DEAD,
                boxShadow: seated ? '0 0 10px 1px rgba(201,168,107,.28)' : 'none',
              }}
            />
            <div className="relative z-[2] px-4 pb-3 pt-8">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-tech">{designator}</span>
              {children}
            </div>
          </div>
        </div>
        <Contacts live={connected} />
      </div>
      {open && <Socket />}
      <Clip side="left" open={open} />
      <Clip side="right" open={open} />
    </div>
  )
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/tests/RamBox.test.jsx`
Expected: PASS — 12 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/RamBox.jsx src/tests/RamBox.test.jsx
git commit -m "feat: unseat a box when it opens"
```

---

## Task 4: Migrate the four simple panels

**Files:**
- Modify: `src/components/BuildWarnings.jsx:11`, `SelectedPartsPanel.jsx:28`, `PeripheralsPanel.jsx:113`, `SetupFlow.jsx:205`
- Test: existing `BuildWarnings.test.jsx`, `SelectedPartsPanel.test.jsx`, `PeripheralsPanel.test.jsx`, `SetupFlow.test.jsx`

These four never expand, so they take `RamBox` with `open` left alone.

- [ ] **Step 1: Write the failing test**

Append to `src/tests/BuildWarnings.test.jsx`:

```jsx
  it('renders as a RamBox rather than a plain panel', () => {
    // …inside whatever render helper the file already uses for a build with
    // at least one warning. Reuse it rather than building a second fixture.
    const { container } = renderWithWarnings()
    expect(container.querySelector('[data-ram-box]')).not.toBeNull()
    expect(container.querySelectorAll('[data-blade]')).toHaveLength(5)
  })
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/BuildWarnings.test.jsx`
Expected: FAIL — `expected null not to be null`

- [ ] **Step 3: Migrate the four call sites**

`src/components/BuildWarnings.jsx` — replace the import and the wrapper:

```jsx
import useBuilderStore from '../store/useBuilderStore'
import { getBuildWarnings } from '../lib/buildWarnings'
import RamBox from './RamBox'

export default function BuildWarnings() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const warnings = getBuildWarnings(selectedParts)
  if (warnings.length === 0) return null

  return (
    <RamBox designator="CHK_1">
      <div className="mb-2 mt-2 text-[11px] uppercase tracking-wider text-muted">Build checks</div>
      <ul className="space-y-1.5">
        {warnings.map((w, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted">
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${w.level === 'critical' ? 'bg-bad' : 'bg-ok'}`} />
            <span>{w.message}</span>
          </li>
        ))}
      </ul>
    </RamBox>
  )
}
```

Apply the same shape to the other three: drop `PANEL` from the import, wrap in `RamBox`, and remove the now-duplicated padding class (`p-4` / `p-5`) since `RamBox` supplies its own. Designators: `SelectedPartsPanel` → `BUILD_1`, `PeripheralsPanel` → `USB_1`, `SetupFlow` → `SETUP_1`.

- [ ] **Step 4: Run the four suites**

Run: `npx vitest run src/tests/BuildWarnings.test.jsx src/tests/SelectedPartsPanel.test.jsx src/tests/PeripheralsPanel.test.jsx src/tests/SetupFlow.test.jsx`
Expected: PASS. If a test asserted on a `PANEL` class string, update it to assert `[data-ram-box]` — that is the contract now.

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildWarnings.jsx src/components/SelectedPartsPanel.jsx src/components/PeripheralsPanel.jsx src/components/SetupFlow.jsx src/tests
git commit -m "feat: seat the four static panels in their slots"
```

---

## Task 5: Migrate the three expandable panels

**Files:**
- Modify: `src/components/BuildRatingPanel.jsx:68`, `BuildSummary.jsx:132`, `SavedBuilds.jsx:106`
- Test: `src/tests/BuildRatingPanel.test.jsx`, `BuildSummary.test.jsx`, `SavedBuilds.test.jsx`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/BuildSummary.test.jsx`:

```jsx
  it('unseats when the user opens it', async () => {
    const user = userEvent.setup()
    const { container } = renderSummary()  // the file's existing helper
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-open', 'false')
    expect(container.querySelector('[data-socket]')).toBeNull()

    await user.click(screen.getByRole('button', { name: /details/i }))

    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-open', 'true')
    expect(container.querySelector('[data-socket]')).not.toBeNull()
    expect(container.querySelector('[data-contacts]')).toHaveAttribute('data-contacts', 'cold')
  })
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/BuildSummary.test.jsx`
Expected: FAIL — `expected null not to be null` on `[data-ram-box]`

- [ ] **Step 3: Wire each panel's existing open state into `RamBox`**

Each of these three already tracks an expanded boolean. Pass it straight through — do **not** add a second source of truth:

```jsx
// BuildSummary.jsx — the existing state stays exactly as it is
const [showDetails, setShowDetails] = useState(false)

return (
  <RamBox designator="SUM_1" seated={hasBuild} open={showDetails}>
    {/* the panel's existing contents, unchanged */}
  </RamBox>
)
```

`BuildRatingPanel` → designator `RATE_1`, `seated` when a build exists. `SavedBuilds` → `SAVE_1`, `seated` when at least one build is saved.

- [ ] **Step 4: Run the three suites**

Run: `npx vitest run src/tests/BuildRatingPanel.test.jsx src/tests/BuildSummary.test.jsx src/tests/SavedBuilds.test.jsx`
Expected: PASS

- [ ] **Step 5: Record what `PANEL` is now for**

All seven part-shaped call sites have moved. `PANEL` still has legitimate users, so it stays — but the next person needs to know which surfaces get a DIMM and which do not. In `src/lib/uiTokens.js`, replace the `PANEL` comment:

```js
// Solid card surface for anything that is NOT a seated part — popovers,
// dialogs, floating menus.
//
// ⚠️ The seven part-shaped panels moved to RamBox on 2026-08-16. Reach for
// RamBox when the thing on screen stands for hardware that plugs in; reach for
// PANEL when it does not. PANEL_STRONG stays a plain panel for exactly this
// reason — a floating menu is not a seated part, and giving it contacts would
// be decoration pretending to be structure.
export const PANEL = 'bg-surface border border-line rounded-xl'
```

- [ ] **Step 6: Run the whole suite for collateral damage**

Run: `npm run test:run`
Expected: PASS. Baseline before this work is **128 files / 1293 tests**; the count should only grow.

- [ ] **Step 7: Commit**

```bash
git add src/components src/lib/uiTokens.js src/tests
git commit -m "feat: unseat the three expandable panels on open"
```

---

## Task 6: The zoned board background

**Files:**
- Create: `src/components/BoardBackground.jsx`
- Test: `src/tests/BoardBackground.test.jsx`
- Modify: `src/components/SiteChrome.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/tests/BoardBackground.test.jsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import BoardBackground from '../components/BoardBackground'

describe('BoardBackground', () => {
  it('is invisible to assistive tech', () => {
    const { container } = render(<BoardBackground />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws traces and vias', () => {
    const { container } = render(<BoardBackground />)
    expect(container.querySelectorAll('path').length).toBeGreaterThan(4)
    expect(container.querySelectorAll('circle').length).toBeGreaterThan(2)
  })

  it('paints a clear column so prose never sits on artwork', () => {
    // The whole argument for zoning: /help, /glossary and the legal pages carry
    // long prose, and gold traces under body text fail on a phone in daylight.
    const { container } = render(<BoardBackground />)
    expect(container.querySelector('[data-clear-column]')).not.toBeNull()
  })

  it('never uses the brand orange', () => {
    // accentIsBrandOnly.test.js guards four wordmark sites. Artwork is not one.
    const { container } = render(<BoardBackground />)
    expect(container.innerHTML).not.toMatch(/--accent\b|#F26B3A/i)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/BoardBackground.test.jsx`
Expected: FAIL — `Failed to resolve import "../components/BoardBackground"`

- [ ] **Step 3: Write the component**

```jsx
// src/components/BoardBackground.jsx

// Board artwork in the page GUTTERS only, with the content column painted flat.
//
// Whisper (8% everywhere) and full Board (30% everywhere) were both built and
// rejected. Board photographs best and is the one that would hurt: /help,
// /glossary and the legal pages carry long prose, and gold traces under body
// text read fine on a 27" monitor and badly on a phone in daylight. Zoning buys
// the full board where there is nothing to read and protects the column where
// there is — and on wide screens the gutters are large, so it shows MORE board
// than the full-bleed option, not less.
//
// ⚠️ paletteContrast.test.js measures text against a FLAT token colour and is
// blind to a pattern. The trace opacities below are chosen so the darkest text
// still clears AA against the BRIGHTEST trace pixel; e2e/ramBox.spec.js is what
// actually proves it. If a value ever fails, darken the trace — do not brighten
// the text.
const TRACE = 0.3
const VIA = 0.34
const SLOT = 0.22

export default function BoardBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-ground">
      <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 400 290" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="var(--gold)" strokeOpacity={SLOT}>
          <rect x="6" y="130" width="46" height="10" rx="2" />
          <rect x="348" y="160" width="46" height="10" rx="2" />
        </g>
        <g fill="none" stroke="var(--gold)" strokeOpacity={TRACE} strokeWidth="1.1">
          <path d="M0 30 H40 L60 50 V120 M0 70 H26 M0 80 H26 M0 90 H26" />
          <path d="M0 180 H30 L55 205 V290" />
          <path d="M400 40 H360 L340 60 V140 M400 90 H374 M400 100 H374" />
          <path d="M400 210 H352 L332 230 V290" />
        </g>
        <g fill="var(--gold)" fillOpacity={VIA}>
          <circle cx="60" cy="50" r="2.8" />
          <circle cx="55" cy="205" r="2.8" />
          <circle cx="340" cy="60" r="2.8" />
          <circle cx="332" cy="230" r="2.8" />
        </g>
        {/* The protected column. Everything readable lives on flat --ground. */}
        <rect data-clear-column x="72" y="0" width="256" height="290" fill="var(--ground)" />
      </svg>
    </div>
  )
}
```

- [ ] **Step 4: Mount it**

In `src/components/SiteChrome.jsx`, import it and render it as the first child of the outer `div`:

```jsx
import { ArrowLeft } from 'lucide-react'
import SiteFooter from './SiteFooter'
import BoardBackground from './BoardBackground'

export default function SiteChrome({ onBack, children }) {
  return (
    <div className="min-h-screen bg-ground text-ink">
      <BoardBackground />
      {/* …the rest of the file unchanged… */}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run src/tests/BoardBackground.test.jsx`
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/components/BoardBackground.jsx src/components/SiteChrome.jsx src/tests/BoardBackground.test.jsx
git commit -m "feat: put a board in the gutters and keep the column clean"
```

---

## Task 7: Prove the geometry and the contrast in a real browser

**Files:**
- Create: `e2e/ramBox.spec.js`

jsdom computes no layout, so this is the only place any of this can be checked.

- [ ] **Step 1: Write the spec**

```js
// e2e/ramBox.spec.js
import { test, expect } from '@playwright/test'
import { generateBuild } from './helpers.js'

test.describe('RamBox in a real browser', () => {
  test('keeps all five blades at every box width', async ({ page }) => {
    await generateBuild(page)
    const boxes = page.locator('[data-ram-box]')
    const n = await boxes.count()
    expect(n).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) {
      await expect(boxes.nth(i).locator('[data-blade]')).toHaveCount(5)
    }
  })

  test('fins and contacts hold a fixed height as the body stretches', async ({ page }) => {
    await generateBuild(page)
    const heights = await page.evaluate(() =>
      [...document.querySelectorAll('[data-contacts]')].map((el) => Math.round(el.getBoundingClientRect().height)),
    )
    expect(new Set(heights).size).toBe(1)
  })

  test('text clears AA against the brightest trace pixel, not against --ground', async ({ page }) => {
    // paletteContrast.test.js measures against a flat token and cannot see a
    // pattern. This is the check that actually covers the artwork.
    await page.goto('/help')
    const worst = await page.evaluate(() => {
      const lum = (r, g, b) => {
        const f = (c) => {
          c /= 255
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      // --gold at full strength is the brightest pixel any trace can reach.
      const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()
      const [gr, gg, gb] = [1, 3, 5].map((i) => parseInt(gold.slice(i, i + 2), 16))
      const faint = getComputedStyle(document.documentElement).getPropertyValue('--faint').trim()
      const [fr, fg, fb] = [1, 3, 5].map((i) => parseInt(faint.slice(i, i + 2), 16))
      const a = lum(gr, gg, gb) + 0.05
      const b = lum(fr, fg, fb) + 0.05
      return Math.max(a, b) / Math.min(a, b)
    })
    expect(worst).toBeGreaterThanOrEqual(4.5)
  })

  test('opening a box unseats it', async ({ page }) => {
    await generateBuild(page)
    const box = page.locator('[data-ram-box][data-open="false"]').first()
    const before = await box.locator('[data-contacts]').getAttribute('data-contacts')
    await box.getByRole('button').first().click()
    await expect(page.locator('[data-ram-box][data-open="true"] [data-socket]')).toBeVisible()
    expect(before).not.toBe('cold')
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/ramBox.spec.js`
Expected: PASS. If the contrast test fails, **darken the trace opacity in `BoardBackground.jsx`** — do not touch `--faint`. It protects 31 call sites and is guarded separately.

- [ ] **Step 3: Commit**

```bash
git add e2e/ramBox.spec.js
git commit -m "test: prove the box geometry and trace contrast in a browser"
```

---

## Task 8: Bug 1 — the silent 1280px top-bar clip

**Files:**
- Modify: `src/components/TopBar.jsx:100`
- Test: `e2e/ramBox.spec.js` (append)

At exactly `xl`, the `hidden xl:flex` budget/power group extends to 1415px inside a 1280px viewport and the POWER figure is cut off. It fails **silently**: `scrollWidth === clientWidth`, so no scrollbar appears and a page-level overflow check reports clean. The probe has to be **per-element**.

- [ ] **Step 1: Write the failing test**

```js
test('nothing overflows the viewport at exactly 1280', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await generateBuild(page)

  // Per-element, NOT per-document. document.scrollWidth === clientWidth here
  // even while content is being clipped, which is why this went unnoticed.
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .map((el) => `${el.tagName}.${el.className}`.slice(0, 80)),
  )
  expect(clipped).toEqual([])
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx playwright test e2e/ramBox.spec.js -g "1280"`
Expected: FAIL — a non-empty array naming the budget/power group

- [ ] **Step 3: Fix the top bar**

In `src/components/TopBar.jsx:100`, raise the breakpoint at which the group appears so it only shows once there is genuinely room, and stop it forcing the row wider than the viewport:

```jsx
{/* Was `hidden xl:flex`, which at exactly 1280 pushed the row to 1415px and
    clipped POWER with no scrollbar to signal it. min-w-0 lets the group
    shrink instead of forcing overflow; the higher breakpoint keeps it out
    until the space is really there. */}
<div className="hidden min-w-0 min-[1440px]:flex gap-3">
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx playwright test e2e/ramBox.spec.js -g "1280"`
Expected: PASS

- [ ] **Step 5: Check the breakpoint above and below**

Run: `npx playwright test e2e/ramBox.spec.js`
Expected: PASS. Also confirm by hand at 1439 (group hidden) and 1441 (group visible, nothing clipped).

- [ ] **Step 6: Commit**

```bash
git add src/components/TopBar.jsx e2e/ramBox.spec.js
git commit -m "fix: stop the top bar clipping POWER at exactly 1280"
```

---

## Task 9: Bug 2 — the tokenOpacity blind spot

**Files:**
- Create: `src/tests/tokenResolves.test.js`

`tokenOpacity.test.js` builds its regex **from the Tailwind config**, so a class whose token has been *removed* is invisible to it: `bg-accent-soft/40` returns zero violations once `accent.soft` is gone. It proves "no live token carries a dead modifier"; it cannot prove "every class in `src` resolves to a live token".

- [ ] **Step 1: Write the test**

```js
// src/tests/tokenResolves.test.js
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

// The gap tokenOpacity.test.js cannot close. It reads the token list OUT of the
// config, so once a token is DELETED every call site still using it becomes
// invisible — the guard and the token leave together. This compiles Tailwind
// for real and asks the only question that matters: did a rule come out?
function compile(markup) {
  const dir = mkdtempSync(join(tmpdir(), 'twprobe-'))
  const content = join(dir, 'probe.html')
  const out = join(dir, 'out.css')
  writeFileSync(content, markup)
  execFileSync('npx', ['tailwindcss', '-c', 'tailwind.config.js', '-i', 'src/index.css', '-o', out, '--content', content], {
    stdio: 'pipe',
    shell: process.platform === 'win32',
  })
  return readFileSync(out, 'utf8')
}

describe('every class in src resolves to a live token', () => {
  it('emits a rule for a known-good class', () => {
    // ⚠️ THE CONTROL, and it is load-bearing. The compiled output is
    // UNMINIFIED — `.bg-surface {` with a space — so a naive `\.cls\{` pattern
    // returns zero for LIVE classes too and the whole check passes silently.
    // If this assertion ever fails, the matcher is broken, not the palette.
    expect(compile('<div class="bg-surface">')).toMatch(/\.bg-surface\s*\{/)
  })

  it('emits nothing for a class whose token was deleted', () => {
    // --accent-soft was removed by the board repalette. Sixteen call sites
    // survived it and were caught by the migration, not by any test.
    expect(compile('<div class="bg-accent-soft">')).not.toMatch(/\.bg-accent-soft\s*\{/)
  })

  it('emits a rule for every colour class used in src', () => {
    // Scan the real source for colour utilities, compile them all in one pass,
    // and require a rule for each. This is the assertion the whole file exists
    // for — the two above only prove the matcher works.
    const files = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) { if (e.name !== 'tests') walk(p) }
        else if (/\.jsx?$/.test(e.name)) files.push(p)
      }
    }
    walk(resolve(process.cwd(), 'src'))

    const PREFIX = '(?:bg|text|border|ring|divide|outline|fill|stroke|from|via|to)'
    const found = new Set()
    for (const f of files) {
      const source = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
      for (const m of source.matchAll(new RegExp(`(?<![\\w-])${PREFIX}-[a-z0-9-]+(?![\\w-])`, 'g'))) {
        found.add(m[0])
      }
    }
    expect(found.size).toBeGreaterThan(10)

    const css = compile(`<div class="${[...found].join(' ')}">`)
    const dead = [...found].filter((c) => {
      const esc = c.replace(/[-]/g, '\\-')
      return !new RegExp(`\\.${esc}\\s*[,{]`).test(css)
    })
    // Tailwind's own palette classes (bg-black, text-white) resolve too, so a
    // survivor here is genuinely a class pointing at a token that no longer
    // exists — exactly what the accent-soft removal left behind.
    expect(dead).toEqual([])
  }, 120_000)
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/tests/tokenResolves.test.js`
Expected: PASS — 3 tests. The compile step is slow; the 60s timeout is deliberate.

- [ ] **Step 3: Prove it catches the real bug**

Temporarily add `<div className="bg-accent-soft" />` to `src/components/BuildWarnings.jsx`, then run the suite. The second assertion documents that the class emits nothing — confirming the class is dead in the build even though `tokenOpacity.test.js` stays green. Revert the edit.

- [ ] **Step 4: Commit**

```bash
git add src/tests/tokenResolves.test.js
git commit -m "test: close the tokenOpacity blind spot for deleted tokens"
```

---

## Task 10: Full verification

**Files:** none

- [ ] **Step 1: Unit suite**

Run: `npm run test:run`
Expected: PASS, **more** than the 1293 baseline.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 4: E2E**

Run: `npm run test:e2e`
Expected: PASS across all specs, not just the new one.

- [ ] **Step 5: Look at it**

Start the dev server and walk Build / Performance / Peripherals / Summary, plus `/help` and `/parts`. Judge colour by `getComputedStyle`, **never by screenshot** — compression has twice made copper `#C4813C` read as brand orange `#F26B3A` in this repo and sent someone chasing a bug that did not exist. Also check `el.matches(':hover')` before believing a hover state; the pointer sits wherever it was last left.

---

## Task 11: Re-capture the pre-render

**Files:** `prerendered/*.html`

This changed every shared panel. `prerendered/*.html` is committed source injected into `dist/` at build time, so it is what every content page paints **before React hydrates** — and **no test knows when it was last captured**. The full suite passed green through the last staleness incident while the fragments held classes that had been deleted from the config and emitted no CSS, which would have rendered those elements invisible until hydration.

- [ ] **Step 1: Re-capture**

Run: `npm run prerender`
Expected: ~1 min, own port 4183, seven fragments rewritten.

- [ ] **Step 2: Prove it actually changed**

```bash
git diff --stat prerendered/
grep -c "data-ram-box" prerendered/help.html
```
Expected: a non-empty diff, and a non-zero count if `/help` renders any migrated panel. An empty diff means the capture did not pick up the change — investigate rather than proceeding.

- [ ] **Step 3: Commit**

```bash
git add prerendered/
git commit -m "fix: recapture the pre-rendered pages against the RamBox panels"
```

---

## Done means

- `npm run test:run`, `npm run lint`, `npm run build`, `npm run test:e2e` all green.
- Five blades on every box at every width, verified in a browser.
- Opening a box unseats it: socket appears, contacts cold, bar still lit.
- Board artwork in the gutters, flat ground behind prose, contrast measured.
- Nothing clipped at 1280px, proven by a per-element probe.
- `prerendered/` re-captured and committed.
- **No push, no deploy.** `main` is already 16 commits ahead of origin and unpushed; that stays the user's call.
