# Industrial Utilitarian UI Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the PC-builder workspace to an Industrial Utilitarian / HUD aesthetic — polished orbit pills, de-SaaS'd panels, monospace telemetry numbers, and a radial canvas backdrop — with zero behaviour changes.

**Architecture:** Centralize the look in `src/lib/uiTokens.js` (a `PANEL` surface token + a `TELEMETRY` mono token), load JetBrains Mono and wire it into Tailwind's `font-mono`, then apply tokens across the floating UI. The orbit rework keeps the existing per-frame 3D-position tracking but hides connector lines until a pill is hovered.

**Tech Stack:** React 19, Vite 8, Tailwind 3.4, Zustand, React Three Fiber, Vitest 4 + Testing Library (jsdom).

**Conventions for every task:**
- All `npm` commands assume Node on PATH. On this machine Node is at `C:\Program Files\nodejs`. In PowerShell, run once per shell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`. (Or use the Bash tool with the same prepend.)
- Full test run: `npm run test:run` (vitest one-shot). Baseline is **75 passing tests**; it must stay green after every task (one new test is added in Task 6 → 77).
- Work directly on `main` locally; commit each task; **do not push** (project convention).

---

### Task 1: Telemetry font + token foundation

**Files:**
- Modify: `index.html`
- Modify: `tailwind.config.js`
- Modify: `src/lib/uiTokens.js` (full rewrite — current exports are unused dead code)

- [ ] **Step 1: Load JetBrains Mono**

In `index.html`, add inside `<head>` (after the viewport meta on line 6):

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Register the mono family in Tailwind**

Replace `tailwind.config.js` entirely:

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Rewrite the token module**

Replace `src/lib/uiTokens.js` entirely:

```js
// Shared Tailwind class strings for the Industrial Utilitarian look. Literal
// strings so Tailwind's content scanner emits the classes; components compose
// them via template literals.

// De-SaaS'd panel surface: sharp corners, 1px low-opacity border, translucent
// dark glass. Replaces the old rounded-2xl SaaS cards.
export const PANEL = 'bg-slate-950/30 backdrop-blur-md border border-slate-800/60 rounded-sm'

// More opaque variant for popovers / floating menus that sit over busy content.
export const PANEL_STRONG = 'bg-slate-950/60 backdrop-blur-md border border-slate-800/60 rounded-sm'

// Monospace telemetry — apply to live-updating numbers only (labels stay sans).
export const TELEMETRY = 'font-mono'

// Restrained accent helpers.
export const ACCENT_TEXT = 'text-cyan-300'
export const ACCENT_GRAD = 'bg-gradient-to-r from-cyan-500 to-blue-600'
```

- [ ] **Step 4: Verify the suite still passes**

Run: `npm run test:run`
Expected: PASS — 75 tests (no behaviour changed; this is config + dead-code replacement).

- [ ] **Step 5: Commit**

```bash
git add index.html tailwind.config.js src/lib/uiTokens.js
git commit -m "feat(ui): load JetBrains Mono + Industrial Utilitarian tokens"
```

---

### Task 2: De-SaaS the Bottleneck + Performance panels

**Files:**
- Modify: `src/components/BottleneckIndicator.jsx`
- Modify: `src/components/PerformancePanel.jsx`

- [ ] **Step 1: Restyle BottleneckIndicator**

In `src/components/BottleneckIndicator.jsx`:

Add the import after line 3:
```js
import { PANEL, TELEMETRY } from '../lib/uiTokens'
```

Replace the container `<div>` (line 13):
```jsx
    <div className={`absolute top-4 left-4 w-72 ${PANEL} p-4`}>
```

Replace the balance paragraph (lines 31-34) so only the number is mono:
```jsx
          <p className="text-xs text-gray-300">
            <span className={`${TELEMETRY} font-semibold text-cyan-300`}>{result.balancePct}%</span>{' '}
            balanced. {result.verdict}
          </p>
```

Sharpen the bar — in the track div (line 22) change `rounded-full` → `rounded-sm`, and in the fill div (line 24) change `rounded-full` → `rounded-sm`.

- [ ] **Step 2: Restyle PerformancePanel**

In `src/components/PerformancePanel.jsx`:

Add after line 3:
```js
import { PANEL, TELEMETRY } from '../lib/uiTokens'
```

Replace the container `<div>` (line 20):
```jsx
    <div className={`absolute top-44 left-4 w-72 ${PANEL} p-4`}>
```

Add `${TELEMETRY}` to the FPS value span (line 23):
```jsx
        <span className={`${TELEMETRY} text-3xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent`}>{fps}</span>
```

Add `${TELEMETRY}` to the value span (line 27):
```jsx
        Value: <span className={`${TELEMETRY} text-cyan-300 font-semibold`}>{value.toFixed(1)}</span> FPS per £100 @ {resLabel}
```

- [ ] **Step 3: Verify**

Run: `npm run test:run`
Expected: PASS — 75 tests.

- [ ] **Step 4: Commit**

```bash
git add src/components/BottleneckIndicator.jsx src/components/PerformancePanel.jsx
git commit -m "feat(ui): de-SaaS Bottleneck + Performance panels, mono metrics"
```

---

### Task 3: Top bar + power/budget bars telemetry

**Files:**
- Modify: `src/components/TopBar.jsx`
- Modify: `src/components/DynamicBars.jsx`

- [ ] **Step 1: Restyle the header surface + mono numbers in TopBar**

In `src/components/TopBar.jsx`:

Replace the `<header>` className (line 30):
```jsx
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/30 backdrop-blur-md border-b border-slate-800/60 px-6 py-3 flex items-center gap-8">
```

Replace the budget `<input>` className (line 44) — mono + sharp:
```jsx
              className="w-24 bg-slate-900/80 text-white font-mono px-2 py-0.5 rounded-sm border border-cyan-400 focus:outline-none focus:shadow-[0_0_15px_rgba(34,211,238,0.35)]"
```

Replace the budget button (lines 48-54) — add `font-mono` to the number:
```jsx
          <button
            onClick={startEdit}
            title="Click to edit your budget"
            className="text-white font-mono font-semibold hover:text-cyan-300 border-b border-dashed border-gray-600 hover:border-cyan-400 transition-colors"
          >
            £{budget.toFixed(0)}
          </button>
```

Replace the remaining span (lines 58-60) — add `font-mono`:
```jsx
        <span className={remaining < 0 ? 'text-red-400 font-mono font-semibold' : 'text-green-400 font-mono font-semibold'}>
          £{remaining.toFixed(0)}
        </span>
```

Replace the power span (line 63) — add `font-mono`:
```jsx
        <span className="text-amber-400 font-mono font-semibold">{totalPower}W</span>
```

- [ ] **Step 2: Mono readouts in DynamicBars**

In `src/components/DynamicBars.jsx`, replace the readout row (lines 14-17) so the value is mono and the label stays sans:
```jsx
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-mono text-gray-300">{display}</span>
      </div>
```

Sharpen the bar — line 18 `rounded-full` → `rounded-sm`, line 20 `rounded-full` → `rounded-sm`.

- [ ] **Step 3: Verify**

Run: `npm run test:run`
Expected: PASS — 75 tests.

- [ ] **Step 4: Commit**

```bash
git add src/components/TopBar.jsx src/components/DynamicBars.jsx
git commit -m "feat(ui): telemetry mono on top bar + power/budget readouts"
```

---

### Task 4: Remaining surfaces + PartCard price

**Files:**
- Modify: `src/components/PartCard.jsx`
- Modify: `src/components/UpgradeSuggestion.jsx`
- Modify: `src/components/CaseToggle.jsx`
- Modify: `src/components/InfoDisclaimer.jsx`
- Modify: `src/components/ResolutionToggle.jsx`
- Modify: `src/screens/BuilderScreen.jsx` (view toggle only)

- [ ] **Step 1: Mono price + sharp corners on PartCard**

In `src/components/PartCard.jsx`:

Line 8 — change `rounded-2xl` → `rounded-sm`.

Replace the price div (line 15) — add `font-mono`:
```jsx
      <div className="font-mono font-bold text-cyan-300">£{part.price.toFixed(2)}</div>
```

- [ ] **Step 2: De-SaaS UpgradeSuggestion**

In `src/components/UpgradeSuggestion.jsx`:

Add after line 3:
```js
import { PANEL, TELEMETRY } from '../lib/uiTokens'
```

Replace the container `<div>` (line 20):
```jsx
    <div className={`absolute bottom-6 left-6 w-80 ${PANEL} p-4`}>
```

Replace the FPS-gain span (line 28) — add `${TELEMETRY}`:
```jsx
        <span className={`${TELEMETRY} text-emerald-300 font-semibold`}>+{s.fpsGain} FPS</span> at {resLabel} ({cost}).
```

Replace the Apply button className (line 32) — sharpen:
```jsx
        className="mt-3 w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium py-1.5 rounded-sm hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all"
```

- [ ] **Step 3: De-SaaS CaseToggle**

In `src/components/CaseToggle.jsx`, replace the button className (line 13):
```jsx
      className="absolute bottom-6 right-6 bg-slate-950/30 backdrop-blur-md hover:border-cyan-400/60 text-slate-100 text-sm px-4 py-2 rounded-sm border border-slate-800/60 transition-all flex items-center gap-2"
```

- [ ] **Step 4: De-SaaS InfoDisclaimer**

In `src/components/InfoDisclaimer.jsx`:

Replace the badge button className (line 16) — keep the round icon badge, swap surface colours:
```jsx
        className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-950/30 backdrop-blur-md border border-slate-800/60 text-cyan-300 text-sm italic font-semibold hover:border-cyan-400/60 hover:shadow-[0_0_12px_rgba(34,211,238,0.4)] transition-all"
```

Replace the popover `<div>` className (line 21):
```jsx
        <div className="absolute right-0 mt-2 w-64 bg-slate-950/60 backdrop-blur-md border border-slate-800/60 rounded-sm p-3 text-xs text-gray-300">
```

- [ ] **Step 5: Sharpen the toggles**

In `src/components/ResolutionToggle.jsx`, replace the wrapper (line 14) and both button rounded classes:
- Line 14: `inline-flex rounded-full bg-white/5 border border-white/10 p-0.5` → `inline-flex rounded-sm bg-slate-950/30 border border-slate-800/60 p-0.5`
- Line 19-22 button: change `rounded-full` → `rounded-sm` (both the active gradient state and the base class).

In `src/screens/BuilderScreen.jsx`, the build/peripherals view toggle:
- Line 30: `inline-flex rounded-full bg-gray-900/70 backdrop-blur-md border border-white/10 p-0.5` → `inline-flex rounded-sm bg-slate-950/30 backdrop-blur-md border border-slate-800/60 p-0.5`
- Line 35-38 button: change `rounded-full` → `rounded-sm`.

- [ ] **Step 6: Verify (PartCard test exercises the price)**

Run: `npm run test:run`
Expected: PASS — 75 tests (PartCard "renders part name and price" still matches `/299/`; only font class changed).

- [ ] **Step 7: Commit**

```bash
git add src/components/PartCard.jsx src/components/UpgradeSuggestion.jsx src/components/CaseToggle.jsx src/components/InfoDisclaimer.jsx src/components/ResolutionToggle.jsx src/screens/BuilderScreen.jsx
git commit -m "feat(ui): adopt PANEL token across remaining surfaces, mono PartCard price"
```

---

### Task 5: Radial canvas backdrop

**Files:**
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Add the backdrop layer behind the canvas**

In `src/screens/BuilderScreen.jsx`, in the build-view branch, insert the backdrop as the **first child** of `<div className="relative w-full h-full">` (before `<BuildCanvas ... />` on line 46). The R3F canvas renders with a transparent clear, so this glow shows through the empty space around the tower:

```jsx
          <div className="relative w-full h-full">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 55% 55% at 50% 45%, rgba(45,120,160,0.18), rgba(2,6,23,0) 70%)' }}
            />
            <BuildCanvas selectedParts={selectedParts} />
```

(Leave the rest of the children unchanged — DOM order keeps the backdrop painted beneath the canvas, panels, and orbit.)

- [ ] **Step 2: Verify**

Run: `npm run test:run`
Expected: PASS — 75 tests.

- [ ] **Step 3: Commit**

```bash
git add src/screens/BuilderScreen.jsx
git commit -m "feat(ui): radial slate-cyan backdrop behind the 3D canvas"
```

---

### Task 6: Polished orbit with hover-reveal connector lines (TDD)

**Files:**
- Create: `src/tests/OrbitRing.test.jsx`
- Modify: `src/components/OrbitRing.jsx` (full rewrite)

- [ ] **Step 1: Write the failing test**

Create `src/tests/OrbitRing.test.jsx`:

```jsx
import { render, fireEvent } from '@testing-library/react'
import OrbitRing from '../components/OrbitRing'

const parts = {
  gpu: { id: 'gpu-x', category: 'gpu', name: 'Test GPU', price: 500 },
  cpu: { id: 'cpu-x', category: 'cpu', name: 'Test CPU', price: 300 },
}

const noop = () => {}

describe('OrbitRing connector lines', () => {
  it('hides every connector line by default', () => {
    const { container } = render(
      <OrbitRing selectedParts={parts} onSelectCategory={noop} onDeselect={noop} />
    )
    const lines = container.querySelectorAll('line[data-cat]')
    expect(lines.length).toBeGreaterThan(0)
    lines.forEach((ln) => {
      expect(ln.getAttribute('class') || '').toContain('opacity-0')
    })
  })

  it('reveals only the hovered pill\'s line on mouse enter', () => {
    const { container } = render(
      <OrbitRing selectedParts={parts} onSelectCategory={noop} onDeselect={noop} />
    )
    fireEvent.mouseEnter(container.querySelector('[data-pill="gpu"]'))
    expect(container.querySelector('line[data-cat="gpu"]').getAttribute('class')).toContain('opacity-100')
    expect(container.querySelector('line[data-cat="cpu"]').getAttribute('class')).toContain('opacity-0')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run src/tests/OrbitRing.test.jsx`
Expected: FAIL — current `OrbitRing` lines have no `data-cat` attribute and no `opacity-*` classes, so `lines.length` is 0 / selectors return null.

- [ ] **Step 3: Rewrite OrbitRing**

Replace `src/components/OrbitRing.jsx` entirely:

```jsx
import { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { CATEGORIES } from '../lib/categories'
import { RECOMMENDED_ORDER, nextRecommended } from '../lib/recommendedOrder'
import { partScreenPositions } from '../lib/partScreenPositions'

const ORDERED = RECOMMENDED_ORDER
  .map((id) => CATEGORIES.find((c) => c.id === id))
  .filter(Boolean)

export default function OrbitRing({ selectedParts, onSelectCategory, onDeselect }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [hoveredCat, setHoveredCat] = useState(null)
  const lineRefs = useRef({})
  const geomRef = useRef({ cx: 400, cy: 300 })

  useLayoutEffect(() => {
    function update() {
      if (containerRef.current)
        setSize({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const cx = size.w / 2
  const cy = size.h / 2
  const radius = Math.min(size.w, size.h) * 0.40
  geomRef.current = { cx, cy }

  const next = nextRecommended(selectedParts)

  const slots = ORDERED.map((cat, i) => {
    const angle = (i / ORDERED.length) * 2 * Math.PI - Math.PI / 2
    return { cat, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), order: i + 1 }
  })

  // Every frame, aim each filled slot's line endpoint at its part's live screen
  // position; empty slots keep the endpoint at the center.
  useEffect(() => {
    let raf
    function tick() {
      const { cx, cy } = geomRef.current
      for (const cat of ORDERED) {
        const line = lineRefs.current[cat.id]
        if (!line) continue
        const tracked = selectedParts[cat.id] ? partScreenPositions.positions[cat.id] : null
        line.setAttribute('x1', tracked ? tracked.x : cx)
        line.setAttribute('y1', tracked ? tracked.y : cy)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selectedParts])

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <svg width={size.w} height={size.h} className="absolute inset-0">
        {/* Faint orbital guide path the pills sit on */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="rgba(56,189,248,0.18)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
        {slots.map(({ cat, x, y }) => (
          <line
            key={cat.id}
            data-cat={cat.id}
            ref={(el) => { lineRefs.current[cat.id] = el }}
            x1={cx} y1={cy} x2={x} y2={y}
            stroke="rgba(56,189,248,0.6)"
            strokeWidth="1"
            className={`transition-opacity duration-300 ${hoveredCat === cat.id ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
      </svg>
      {slots.map(({ cat, x, y, order }) => {
        const part = selectedParts[cat.id]
        const isNext = cat.id === next
        const far = y < cy - 1 // upper/back arc → slight depth dim
        return (
          <div
            key={cat.id}
            data-pill={cat.id}
            onMouseEnter={() => setHoveredCat(cat.id)}
            onMouseLeave={() => setHoveredCat(null)}
            style={{ left: x, top: y, pointerEvents: 'auto' }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 transition-opacity ${far ? 'opacity-70 hover:opacity-100' : ''}`}
          >
            {part ? (
              <div className={`flex items-center gap-1.5 rounded-sm border bg-slate-950/70 backdrop-blur-sm pl-1.5 pr-1 py-1 transition-all
                ${isNext ? 'border-cyan-400' : 'border-slate-700/70'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isNext ? 'bg-cyan-300' : 'bg-cyan-400/70'}`} />
                <button
                  onClick={() => onSelectCategory(cat.id)}
                  className="flex items-center gap-1.5 text-slate-100 text-xs whitespace-nowrap hover:text-cyan-300"
                  title={part.name}
                >
                  <span>{cat.icon}</span>
                  <span className="max-w-[120px] truncate">{part.name}</span>
                  <span className="font-mono text-cyan-300">£{part.price.toFixed(0)}</span>
                </button>
                <button
                  onClick={() => onDeselect(cat.id)}
                  aria-label={`Remove ${cat.label}`}
                  className="ml-0.5 w-5 h-5 flex items-center justify-center rounded-sm text-slate-400 hover:text-white hover:bg-red-500/80 text-sm leading-none"
                >
                  &times;
                </button>
              </div>
            ) : (
              <button
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs whitespace-nowrap transition-all
                  ${isNext
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/50 animate-pulse'
                    : 'border-slate-700/70 bg-slate-950/50 backdrop-blur-sm text-slate-300 hover:border-slate-500 hover:bg-slate-900/70'}`}
              >
                <span className="flex items-center justify-center w-4 h-4 rounded-sm bg-slate-800 text-[10px] font-mono text-slate-300">{order}</span>
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the new test + full suite**

Run: `npm run test:run`
Expected: PASS — 77 tests (the 2 new OrbitRing assertions plus the existing 75).

- [ ] **Step 5: Commit**

```bash
git add src/tests/OrbitRing.test.jsx src/components/OrbitRing.jsx
git commit -m "feat(ui): polished orbit pills with hover-reveal connector lines"
```

---

### Task 7: Final verification (visual)

**Files:** none (verification only)

- [ ] **Step 1: Full suite green**

Run: `npm run test:run`
Expected: PASS — 77 tests.

- [ ] **Step 2: Production build sanity**

Run: `npm run build`
Expected: build completes with no errors (confirms Tailwind emits `font-mono`, `rounded-sm`, and the arbitrary classes; no broken imports).

- [ ] **Step 3: Visual check in the dev server**

Start the dev server (`npm run dev`) and load the build view. Confirm:
- Orbit pills sit on a faint dashed ring; filled pills show a cyan index dot + mono `£` price; connector line is hidden until you hover a pill, then fades in and tracks the part in the case.
- Bottleneck / Performance / top bar / upgrade card read as sharp, translucent, hairline-bordered panels (no large rounded SaaS cards, no heavy glow).
- FPS, wattage, budget/remaining, %, and prices render in JetBrains Mono; labels stay sans.
- A faint slate-cyan glow sits behind the tower, fading to near-black at the edges.

Capture before/after screenshots of the build view for the summary.

---

## Self-Review

- **Spec coverage:** Improvement 1 → Task 6; Improvement 2 → Task 2 (+ Task 4 cohesion); Improvement 3 → Tasks 2/3/4/6; Improvement 4 → Task 5; token foundation + font → Task 1; verification → Task 7. All four spec improvements + both cross-cutting decisions (JetBrains Mono, app-wide scope) are covered.
- **Placeholders:** none — every edit shows exact old→new code and exact file:line anchors.
- **Type/name consistency:** `PANEL`, `PANEL_STRONG`, `TELEMETRY`, `ACCENT_TEXT`, `ACCENT_GRAD` defined in Task 1 are the only token names referenced later. Orbit test selectors (`line[data-cat]`, `[data-pill]`) match the rewritten component exactly (lines carry `data-cat`, pill wrappers carry `data-pill` — deliberately different attributes so `querySelector` can't confuse a line for a pill).
