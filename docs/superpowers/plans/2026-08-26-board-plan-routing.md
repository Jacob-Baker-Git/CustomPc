# Board Plan & Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the motherboard page background so it reads as a routed ATX board rather than decorative circuitry, without touching the measured contrast contract that keeps text legible over it.

**Architecture:** A new pure module `src/lib/boardPlan.js` owns the geometry: the ATX landmark table plus three generators (`bus`, `serpentine`, `via`) that emit SVG path data obeying the 45°-corners and constant-pitch rules by construction. `BoardBackground.jsx` becomes a consumer that maps those outputs to `<path>`/`<rect>` elements. Because the generators are pure and return path strings, the routing rules are unit-testable by parsing what they emit — no snapshots.

**Tech Stack:** React 19, plain SVG, Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-26-board-plan-routing-design.md`

---

## File Structure

| file | responsibility |
|---|---|
| `src/lib/boardPlan.js` *(create)* | ATX landmark table + routing generators + path-inspection helpers. Pure, no React. |
| `src/tests/boardPlan.test.js` *(create)* | Unit tests for every generator and the plan's own consistency. |
| `src/components/BoardBackground.jsx` *(modify)* | `Lines()` rewritten to render from `boardPlan`. Layer split, weights and `CRISP` untouched. |
| `src/tests/BoardBackground.test.jsx` *(modify)* | Keeps the no-solid-fill assertion; gains a non-scaling-stroke assertion. |

`src/lib/boardGeometry.js` is **not** modified — it owns the presentation contract (scrim alpha, fill ceiling, `hardwareWidth`), which is a different concern from the plan.

---

### Task 1: Path inspection primitives

Everything downstream is tested by parsing emitted path data, so these come first.

**Files:**
- Create: `src/lib/boardPlan.js`
- Create: `src/tests/boardPlan.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { segmentsOf, pathLength, isOrthoOr45 } from '../lib/boardPlan'

describe('path inspection', () => {
  it('splits a path into absolute segments', () => {
    expect(segmentsOf('M10 20 H30 V40 L50 60')).toEqual([
      [10, 20, 30, 20],
      [30, 20, 30, 40],
      [30, 40, 50, 60],
    ])
  })

  it('measures total path length', () => {
    // 20 across, then 20 down: 40.
    expect(pathLength('M0 0 H20 V20')).toBeCloseTo(40, 6)
  })

  it('accepts axis-aligned and 45 degree segments, rejects anything else', () => {
    expect(isOrthoOr45([0, 0, 10, 0])).toBe(true)
    expect(isOrthoOr45([0, 0, 0, 10])).toBe(true)
    expect(isOrthoOr45([0, 0, 10, 10])).toBe(true)
    expect(isOrthoOr45([0, 0, 10, 4])).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/boardPlan.test.js`
Expected: FAIL — `Failed to resolve import "../lib/boardPlan"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/boardPlan.js`:

```js
// Geometry for the motherboard page background.
//
// Pure and React-free on purpose: the routing rules this file exists to enforce
// (45 degree corners, constant bus pitch, length-matched memory traces) are only
// checkable if the thing under test is the path data itself. A component that
// hand-draws paths can only be snapshot-tested, which pins the drawing instead
// of the rules — and hand-drawn paths are exactly how the previous version's
// bundles drifted apart.

const TOL = 1e-6

// Absolute segments [x1,y1,x2,y2] from a path built of M/H/V/L only.
// The generators below emit nothing else, deliberately: curves cannot be
// checked against the 45 degree rule.
export function segmentsOf(d) {
  const out = []
  let x = 0
  let y = 0
  for (const token of String(d).match(/[MHVL][^MHVL]*/g) ?? []) {
    const nums = token.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number)
    switch (token[0]) {
      case 'M': [x, y] = nums; break
      case 'H': out.push([x, y, nums[0], y]); x = nums[0]; break
      case 'V': out.push([x, y, x, nums[0]]); y = nums[0]; break
      case 'L': out.push([x, y, nums[0], nums[1]]); [x, y] = nums; break
      default: break
    }
  }
  return out
}

export function pathLength(d) {
  return segmentsOf(d).reduce((sum, [x1, y1, x2, y2]) => sum + Math.hypot(x2 - x1, y2 - y1), 0)
}

export function isOrthoOr45([x1, y1, x2, y2]) {
  const dx = Math.abs(x2 - x1)
  const dy = Math.abs(y2 - y1)
  return dx < TOL || dy < TOL || Math.abs(dx - dy) < TOL
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/boardPlan.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/boardPlan.js src/tests/boardPlan.test.js
git commit -m "feat: add path inspection primitives for the board plan"
```

---

### Task 2: `bus` — parallel traces that keep their pitch

**Files:**
- Modify: `src/lib/boardPlan.js`
- Modify: `src/tests/boardPlan.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/boardPlan.test.js` (and add `bus` to the import on line 2):

```js
describe('bus', () => {
  const spec = { fromX: 100, fromY: 50, toX: 200, count: 4, pitch: 6, rise: 12 }

  it('emits one trace per conductor, each ending on a via', () => {
    const { paths, vias } = bus(spec)
    expect(paths).toHaveLength(4)
    expect(vias).toHaveLength(4)
    for (const v of vias) expect(v.x).toBe(200)
  })

  it('holds constant pitch from the first trace to the last, across the dogleg', () => {
    const { vias } = bus(spec)
    const gaps = vias.slice(1).map((v, i) => v.y - vias[i].y)
    for (const g of gaps) expect(g).toBeCloseTo(6, 6)
  })

  it('turns only at right angles or 45 degrees', () => {
    for (const d of bus(spec).paths) {
      for (const seg of segmentsOf(d)) {
        expect(isOrthoOr45(seg), `${d} -> ${seg}`).toBe(true)
      }
    }
  })

  it('routes straight through when there is no rise', () => {
    const { paths } = bus({ ...spec, rise: 0 })
    expect(paths[0]).toBe('M100 50 H200')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/boardPlan.test.js`
Expected: FAIL — `bus is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/boardPlan.js`:

```js
// `count` parallel traces leaving a component edge at `fromX`, stepping
// vertically by `rise` and terminating at `toX`.
//
// The dogleg is STAGGERED by the pitch — trace i turns pitch further along than
// trace i-1 — which is what keeps the bundle parallel through the corner. Turn
// them all at the same x and the diagonals converge, which is the exact defect
// that made the old drawing read as loose squiggles rather than a bus.
export function bus({ fromX, fromY, toX, count, pitch, lead = 8, rise = 0 }) {
  const dir = Math.sign(toX - fromX) || 1
  const paths = []
  const vias = []
  for (let i = 0; i < count; i += 1) {
    const y0 = fromY + i * pitch
    const y1 = y0 + rise
    if (rise === 0) {
      paths.push(`M${fromX} ${y0} H${toX}`)
    } else {
      const dogX = fromX + dir * (lead + i * pitch)
      const turnX = dogX + dir * Math.abs(rise)
      paths.push(`M${fromX} ${y0} H${dogX} L${turnX} ${y1} H${toX}`)
    }
    vias.push({ x: toX, y: y1 })
  }
  return { paths, vias }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/boardPlan.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Prove the pitch test can fail**

Using the `Edit` tool (never a string-replace script — a previous session's
falsification silently matched nothing and printed success), change `const dogX
= fromX + dir * (lead + i * pitch)` to `const dogX = fromX + dir * lead`, then
re-read the file to confirm the edit landed.

Run: `npx vitest run src/tests/boardPlan.test.js`
Expected: FAIL on "holds constant pitch". Restore the line with `Edit`, re-run, expect PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/boardPlan.js src/tests/boardPlan.test.js
git commit -m "feat: route parallel buses that keep pitch through a dogleg"
```

---

### Task 3: `serpentine` — length-matched memory traces

**Files:**
- Modify: `src/lib/boardPlan.js`
- Modify: `src/tests/boardPlan.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/boardPlan.test.js` (add `serpentine`, `pathLength` to imports):

```js
describe('serpentine', () => {
  // Four traces that must reach pins at different distances — the situation a
  // real DDR fan-out is in, and the reason length-matching exists.
  const spec = { fromX: 100, fromY: 40, ends: [180, 165, 150, 140], pitch: 5, amplitude: 3 }

  it('brings every trace in the bundle to the same length', () => {
    const lengths = serpentine(spec).paths.map(pathLength)
    const longest = Math.max(...lengths)
    for (const l of lengths) {
      // Tolerance is half a cycle's gain: cycles are whole, so exact equality
      // is not achievable and claiming it would be a lie about the model.
      expect(Math.abs(l - longest)).toBeLessThan(2)
    }
  })

  it('leaves the already-longest trace straight', () => {
    expect(serpentine(spec).paths[0]).toBe('M100 40 H180')
  })

  it('turns only at right angles or 45 degrees', () => {
    for (const d of serpentine(spec).paths) {
      for (const seg of segmentsOf(d)) {
        expect(isOrthoOr45(seg), `${d} -> ${seg}`).toBe(true)
      }
    }
  })

  it('never wiggles further than the run it has to play with', () => {
    for (const [i, d] of serpentine(spec).paths.entries()) {
      for (const [x1, , x2] of segmentsOf(d)) {
        expect(Math.max(x1, x2)).toBeLessThanOrEqual(spec.ends[i])
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/boardPlan.test.js`
Expected: FAIL — `serpentine is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/boardPlan.js`:

```js
// A 45 degree triangular detour advances 2a horizontally while covering
// 2a*sqrt(2) of copper, so each cycle buys this much extra length per unit of
// amplitude. This constant is why the wiggle is triangular rather than square:
// a square detour would break the 45 degree rule.
const CYCLE_GAIN = 2 * (Math.SQRT2 - 1)

// Length-matching. Every trace in a bundle is padded with detours until it is
// as long as the longest, which is what keeps a parallel bus in time. Applied
// only where a real board has one — a serpentine on a power trace would be
// decoration imitating structure.
export function serpentine({ fromX, fromY, ends, pitch, amplitude }) {
  const target = Math.max(...ends) - fromX
  const paths = []
  const vias = []
  ends.forEach((endX, i) => {
    const y = fromY + i * pitch
    const run = endX - fromX
    const wanted = Math.round((target - run) / (amplitude * CYCLE_GAIN))
    // A detour consumes 2a of run, so a trace can never carry more cycles than
    // its own run affords, however much length it is short by.
    const cycles = Math.max(0, Math.min(wanted, Math.floor(run / (2 * amplitude))))
    let d = `M${fromX} ${y}`
    let x = fromX
    for (let c = 0; c < cycles; c += 1) {
      d += ` L${x + amplitude} ${y - amplitude} L${x + 2 * amplitude} ${y}`
      x += 2 * amplitude
    }
    d += ` H${endX}`
    paths.push(d)
    vias.push({ x: endX, y })
  })
  return { paths, vias }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/boardPlan.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/boardPlan.js src/tests/boardPlan.test.js
git commit -m "feat: length-match the memory bus with 45 degree serpentines"
```

---

### Task 4: The ATX landmark plan

**Files:**
- Modify: `src/lib/boardPlan.js`
- Modify: `src/tests/boardPlan.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/boardPlan.test.js` (add `LANDMARKS` to imports):

```js
describe('the ATX plan', () => {
  const byId = Object.fromEntries(LANDMARKS.map((l) => [l.id, l]))

  it('places every landmark inside the board viewBox', () => {
    for (const l of LANDMARKS) {
      expect(l.x, l.id).toBeGreaterThanOrEqual(0)
      expect(l.y, l.id).toBeGreaterThanOrEqual(0)
      expect(l.x + l.w, l.id).toBeLessThanOrEqual(640)
      expect(l.y + l.h, l.id).toBeLessThanOrEqual(420)
    }
  })

  it('does not overlap any two landmarks', () => {
    for (const a of LANDMARKS) {
      for (const b of LANDMARKS) {
        if (a.id >= b.id) continue
        const clear = a.x + a.w <= b.x || b.x + b.w <= a.x
          || a.y + a.h <= b.y || b.y + b.h <= a.y
        expect(clear, `${a.id} overlaps ${b.id}`).toBe(true)
      }
    }
  })

  // The adjacencies are the whole point: this is what makes it read as an ATX
  // board rather than as rectangles. Positions are relative truth, not
  // millimetre-accurate, so the assertions are about ORDER, not coordinates.
  it('puts the DIMM bank to the right of the socket', () => {
    expect(byId['dimm-0'].x).toBeGreaterThan(byId.socket.x + byId.socket.w)
  })

  it('puts the PCIe stack below the socket', () => {
    expect(byId['pcie-x16-1'].y).toBeGreaterThan(byId.socket.y + byId.socket.h)
  })

  it('puts the rear I/O in the top-left corner', () => {
    expect(byId['rear-io'].x).toBeLessThan(64)
    expect(byId['rear-io'].y).toBeLessThan(42)
  })

  it('keeps the four DIMM slots on one pitch', () => {
    const xs = [0, 1, 2, 3].map((i) => byId[`dimm-${i}`].x)
    const gaps = xs.slice(1).map((x, i) => x - xs[i])
    for (const g of gaps) expect(g).toBe(gaps[0])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/boardPlan.test.js`
Expected: FAIL — `LANDMARKS is not defined`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/boardPlan.js`:

```js
// The board viewBox. The full-bleed layer renders at this and is cropped by
// preserveAspectRatio="slice", so these are proportions, not millimetres.
export const BOARD = { w: 640, h: 420 }

// ATX landmarks, rear I/O top-left, which is how an ATX board is conventionally
// drawn in landscape. `weight` selects the stroke group in BoardBackground:
// 'signal' | 'outline' | 'power', matching the three tuned weights.
//
// ⚠️ These are OUTLINES ONLY. Solid gold pads live in the edge-pinned hardware
// layers and are not planned here — nothing readable can sit on solid gold
// (measured 1.95:1 for --ink), so the full-bleed layer carries no fills.
export const LANDMARKS = [
  { id: 'rear-io',      x: 20,  y: 18,  w: 100, h: 52,  weight: 'outline' },
  { id: 'vrm',          x: 132, y: 18,  w: 68,  h: 40,  weight: 'outline' },
  { id: 'eps-8pin',     x: 214, y: 18,  w: 36,  h: 16,  weight: 'power' },
  { id: 'socket',       x: 210, y: 88,  w: 100, h: 100, weight: 'outline' },
  { id: 'dimm-0',       x: 340, y: 70,  w: 8,   h: 140, weight: 'outline' },
  { id: 'dimm-1',       x: 356, y: 70,  w: 8,   h: 140, weight: 'outline' },
  { id: 'dimm-2',       x: 372, y: 70,  w: 8,   h: 140, weight: 'outline' },
  { id: 'dimm-3',       x: 388, y: 70,  w: 8,   h: 140, weight: 'outline' },
  { id: 'atx-24pin',    x: 432, y: 78,  w: 30,  h: 72,  weight: 'power' },
  { id: 'm2-1',         x: 150, y: 224, w: 180, h: 8,   weight: 'outline' },
  { id: 'pcie-x16-1',   x: 150, y: 250, w: 270, h: 12,  weight: 'outline' },
  { id: 'm2-2',         x: 150, y: 274, w: 180, h: 8,   weight: 'outline' },
  { id: 'pcie-x1',      x: 150, y: 286, w: 110, h: 8,   weight: 'outline' },
  { id: 'pcie-x16-2',   x: 150, y: 310, w: 230, h: 12,  weight: 'outline' },
  { id: 'chipset',      x: 400, y: 280, w: 70,  h: 70,  weight: 'outline' },
  { id: 'sata',         x: 480, y: 228, w: 40,  h: 64,  weight: 'outline' },
  { id: 'front-panel',  x: 300, y: 388, w: 62,  h: 12,  weight: 'outline' },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/boardPlan.test.js`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/boardPlan.js src/tests/boardPlan.test.js
git commit -m "feat: lay the background out as a real ATX board plan"
```

---

### Task 5: Render the plan in `BoardBackground`

**Files:**
- Modify: `src/components/BoardBackground.jsx` (replace the `Lines()` function; leave `Hardware()`, `hardwareWidth` and the scrim untouched)
- Modify: `src/tests/BoardBackground.test.jsx`

- [ ] **Step 1: Write the failing test**

Append inside the existing top-level `describe` in `src/tests/BoardBackground.test.jsx`:

```js
  it('gives every stroked group non-scaling-stroke', () => {
    const { container } = render(<BoardBackground />)
    const lines = container.querySelector('[data-board-layer="lines"]')
    const groups = [...lines.querySelectorAll('g')].filter((g) => g.getAttribute('stroke'))
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) {
      // slice runs this layer at up to 2.28x; without this the tuned widths
      // scale with it and put more bright pixels under text than the scrim is
      // sized for.
      expect(g.getAttribute('style') ?? '').toMatch(/non-scaling-stroke/)
    }
  })

  it('draws the ATX landmarks it plans', () => {
    const { container } = render(<BoardBackground />)
    const lines = container.querySelector('[data-board-layer="lines"]')
    for (const id of ['socket', 'dimm-0', 'pcie-x16-1', 'chipset', 'rear-io']) {
      expect(lines.querySelector(`[data-landmark="${id}"]`), id).toBeTruthy()
    }
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/BoardBackground.test.jsx`
Expected: FAIL on "draws the ATX landmarks it plans" — `expected null to be truthy` for `socket`.

- [ ] **Step 3: Write the implementation**

In `src/components/BoardBackground.jsx`, add to the import block at the top:

```js
import { LANDMARKS, BOARD, bus, serpentine } from '../lib/boardPlan'
```

Replace the whole `function Lines() { ... }` body with:

```js
// Stroke weights are unchanged and are not free parameters: they were tuned
// against the scrim, and collapsing the hierarchy returns the board to a
// wireframe. See the 2026-08-16 spec.
const WEIGHTS = {
  signal:  { strokeOpacity: '0.2',  strokeWidth: '0.6' },
  outline: { strokeOpacity: '0.4',  strokeWidth: '1' },
  power:   { strokeOpacity: '0.68', strokeWidth: '2' },
}

const at = (id) => LANDMARKS.find((l) => l.id === id)

// Every bundle on the board, generated rather than drawn. Each one starts on a
// component edge and ends on a via, so no trace finishes in empty copper.
function routes() {
  const socket = at('socket')
  const dimm0 = at('dimm-0')
  const chipset = at('chipset')
  const pcie = at('pcie-x16-1')

  // Memory bus: socket east edge to the DIMM bank, length-matched. The DIMM
  // pins sit at staggered depths, which is exactly the case serpentines exist
  // for.
  const memory = serpentine({
    fromX: socket.x + socket.w,
    fromY: socket.y + 8,
    ends: [dimm0.x - 4, dimm0.x - 12, dimm0.x - 20, dimm0.x - 28],
    pitch: 6,
    amplitude: 3,
  })

  // Socket south edge down to the primary PCIe slot.
  const pcieLanes = bus({
    fromX: socket.x + 14,
    fromY: socket.y + socket.h,
    toX: pcie.x + 40,
    count: 4,
    pitch: 7,
    rise: 0,
  })

  // Chipset west edge across to the PCIe stack, stepping down.
  const chipsetLink = bus({
    fromX: chipset.x,
    fromY: chipset.y + 10,
    toX: pcie.x + pcie.w - 30,
    count: 5,
    pitch: 6,
    rise: -18,
  })

  return [
    { key: 'memory', weight: 'signal', ...memory },
    { key: 'pcie', weight: 'signal', ...pcieLanes },
    { key: 'chipset', weight: 'signal', ...chipsetLink },
  ]
}

function Lines() {
  const bundles = routes()
  const byWeight = (w) => LANDMARKS.filter((l) => l.weight === w)

  return (
    <svg
      aria-hidden="true"
      data-board-layer="lines"
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${BOARD.w} ${BOARD.h}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {['signal', 'outline', 'power'].map((weight) => (
        <g key={weight} data-trace={weight} fill="none" stroke={GOLD} style={CRISP} {...WEIGHTS[weight]}>
          {byWeight(weight).map((l) => (
            <rect key={l.id} data-landmark={l.id} x={l.x} y={l.y} width={l.w} height={l.h} rx="1" />
          ))}
          {bundles
            .filter((b) => b.weight === weight)
            .flatMap((b) => b.paths.map((d, i) => <path key={`${b.key}${i}`} d={d} />))}
        </g>
      ))}

      {/* The socket pin field, using the existing generator. */}
      <g data-trace="signal" fill={GOLD} fillOpacity={LINE_FILL_CEILING} stroke="none">
        {grid({ x: at('socket').x + 12, y: at('socket').y + 12, cols: 9, rows: 9, pitch: 9, r: 1.1, key: 'sock' })}
      </g>

      {/* Vias. Capped at LINE_FILL_CEILING — this layer carries no solid fill. */}
      <g fill={GOLD} fillOpacity={LINE_FILL_CEILING} stroke="none">
        {bundles.flatMap((b) => b.vias.map((v, i) => (
          <circle key={`${b.key}v${i}`} cx={v.x} cy={v.y} r="1.4" />
        )))}
      </g>
    </svg>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/BoardBackground.test.jsx`
Expected: PASS. The pre-existing "no solid fill in the line layer" assertion must still pass — if it fails, a `fill` was added without `LINE_FILL_CEILING`.

- [ ] **Step 5: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/components/BoardBackground.jsx src/tests/BoardBackground.test.jsx
git commit -m "feat: draw the page background from the ATX plan"
```

---

### Task 6: Verify against the contract and refresh the pre-render

**Files:**
- Modify: `prerendered/*.html` (generated)

- [ ] **Step 1: Run the board-background e2e contract**

Run: `npx playwright test e2e/boardBackground.spec.js`
Expected: PASS, 5 widths x 4 routes. This is the assertion that no glyph sits over a hardware layer and every glyph is inside the scrim's flat core. It is unchanged by this work and must stay green.

⚠️ Do not run this concurrently with `npx vitest` — CPU contention here produces timeouts that look exactly like layout bugs.

- [ ] **Step 2: Run the whole e2e suite**

Run: `npx playwright test`
Expected: 91 passed.

- [ ] **Step 3: Lint and build**

Run: `npx eslint . && npm run build`
Expected: clean, build succeeds.

- [ ] **Step 4: Refresh the pre-rendered fragments**

Run: `npm run prerender`

Then: `git diff --stat -- prerendered/`

Expected: **all seven fragments change.** This is shared UI on every page. A fragment that does *not* change is the suspicious outcome and means the capture did not pick the change up.

- [ ] **Step 5: Confirm the fragments are idempotent**

```bash
before=$(sha256sum prerendered/*.html | sha256sum)
npm run prerender
after=$(sha256sum prerendered/*.html | sha256sum)
[ "$before" = "$after" ] && echo IDEMPOTENT || echo STILL DRIFTING
```

Expected: `IDEMPOTENT`. Note `git diff --exit-code` is the wrong check here — the fragments legitimately differ from HEAD until committed.

- [ ] **Step 6: Look at it**

Start the dev server via `preview_start` with the `custompc-dev` config, then screenshot `/`, `/help` and the builder at 1440 and at 1024.

Judge two things, and judge the second by measurement rather than by eye:
1. Does it read as a board? Landmarks recognisable, buses parallel, nothing ending in mid-air.
2. Is it busier than what it replaced? If so the fix is **fewer bundles, not thinner strokes** — the widths are tuned against the scrim.

- [ ] **Step 7: Commit**

```bash
git add prerendered/
git commit -m "chore: re-capture pre-rendered fragments after the board rewrite"
```

---

## Self-Review

**Spec coverage:** Landmarks → Task 4. `bus` → Task 2. `serpentine` → Task 3. `via`/pad termination → Tasks 2–3 (`vias` returned alongside paths, so a trace cannot be emitted without one). 45° rule → Tasks 1–3. Layer split, three weights, `CRISP` → Task 5 (preserved and asserted). e2e contract → Task 6 Step 1. Pre-render risk → Task 6 Steps 4–5. Density risk → Task 6 Step 6.

**Placeholders:** none. Every code step carries the code.

**Type consistency:** `bus` and `serpentine` both return `{ paths: string[], vias: {x,y}[] }`, spread identically in `routes()`. `LANDMARKS` entries carry `{id,x,y,w,h,weight}` and every consumer reads only those. `segmentsOf` returns `[x1,y1,x2,y2]` tuples, matching `isOrthoOr45`'s parameter destructuring.

**One gap found and closed during review:** the spec lists a `via(x, y)` helper. The generators return their own vias, so a standalone `via` would be an unused export — YAGNI. Pad termination is still guaranteed, by the return shape rather than by a separate function.
