# Chunk F — Rotation-Tracking Orbit Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filled-slot orbit lines point to each part's real on-screen position and follow it as the build rotates; empty-slot lines still meet at the center.

**Architecture:** A pure `ndcToPixel` helper converts projected coordinates to pixels. A module singleton holds each part's live screen position. A `ScreenTracker` inside the R3F Canvas projects part world positions every frame and writes them. OrbitRing runs a `requestAnimationFrame` loop that moves each filled line's endpoint to its part — mutating SVG attributes directly, no React re-render per frame.

**Tech Stack:** React Three Fiber, Three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-14-builder-realism-ui-design.md`

**Note:** `node`/`npx` are NOT on PATH. In PowerShell prepend: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`. Commit locally; do NOT push/deploy. Depends on Chunks D & E.

---

### Task F1: Projection Helper (TDD)

**Files:**
- Create: `src/lib/projectToScreen.js`
- Test: `src/tests/projectToScreen.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/projectToScreen.test.js`:
```js
import { ndcToPixel } from '../lib/projectToScreen'

describe('ndcToPixel', () => {
  it('maps NDC center (0,0) to the middle of the container', () => {
    expect(ndcToPixel(0, 0, 800, 600)).toEqual({ x: 400, y: 300 })
  })

  it('maps NDC top-left (-1, 1) to pixel (0, 0)', () => {
    expect(ndcToPixel(-1, 1, 800, 600)).toEqual({ x: 0, y: 0 })
  })

  it('maps NDC bottom-right (1, -1) to the far corner', () => {
    expect(ndcToPixel(1, -1, 800, 600)).toEqual({ x: 800, y: 600 })
  })

  it('flips the Y axis (NDC up = pixel down)', () => {
    expect(ndcToPixel(0, 1, 800, 600).y).toBe(0)
    expect(ndcToPixel(0, -1, 800, 600).y).toBe(600)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/projectToScreen.test.js`
Expected: FAIL — "Cannot find module '../lib/projectToScreen'"

- [ ] **Step 3: Implement**

Create `src/lib/projectToScreen.js`:
```js
// Convert Normalized Device Coordinates (-1..1, y up) to container pixels (y down).
export function ndcToPixel(ndcX, ndcY, width, height) {
  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (1 - (ndcY * 0.5 + 0.5)) * height,
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/projectToScreen.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run` → all pass.
```bash
git add src/lib/projectToScreen.js src/tests/projectToScreen.test.js
git commit -m "feat: add pure ndcToPixel projection helper"
```

---

### Task F2: Screen Position Singleton + Tracker

**Files:**
- Create: `src/lib/partScreenPositions.js`
- Create: `src/components/ScreenTracker.jsx`
- Modify: `src/components/BuildCanvas.jsx`

- [ ] **Step 1: Create the singleton**

Create `src/lib/partScreenPositions.js`:
```js
// Shared, mutable store of each selected part's live screen position, written
// every frame by ScreenTracker (inside the Canvas) and read by OrbitRing's rAF
// loop. Kept outside React state so per-frame updates don't trigger re-renders.
export const partScreenPositions = { positions: {}, size: { w: 0, h: 0 } }
```

- [ ] **Step 2: Create ScreenTracker**

Create `src/components/ScreenTracker.jsx`:
```jsx
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { assemblyLayout } from '../lib/assemblyLayout'
import { ndcToPixel } from '../lib/projectToScreen'
import { partScreenPositions } from '../lib/partScreenPositions'

const v = new Vector3()

export default function ScreenTracker({ selectedParts }) {
  const { camera, size } = useThree()

  useFrame(() => {
    partScreenPositions.size = { w: size.width, h: size.height }
    const next = {}
    for (const category of Object.keys(selectedParts)) {
      if (!selectedParts[category]) continue
      const { position } = assemblyLayout(category, selectedParts)
      v.set(position[0], position[1], position[2]).project(camera)
      next[category] = ndcToPixel(v.x, v.y, size.width, size.height)
    }
    partScreenPositions.positions = next
  })

  return null
}
```

- [ ] **Step 3: Render ScreenTracker inside the Canvas**

In `src/components/BuildCanvas.jsx`, add the import:
```jsx
import ScreenTracker from './ScreenTracker'
```
and render it inside the `<Canvas>`, right after the parts `.map(...)` block (it must be a child of Canvas so it has access to the R3F camera):
```jsx
        <ScreenTracker selectedParts={selectedParts} />
```

- [ ] **Step 4: Verify build + tests + commit**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → all pass.
```bash
git add src/lib/partScreenPositions.js src/components/ScreenTracker.jsx src/components/BuildCanvas.jsx
git commit -m "feat: track each selected part's live screen position from the 3D scene"
```

---

### Task F3: OrbitRing Tracking Lines

**Files:**
- Modify: `src/components/OrbitRing.jsx` (full rewrite)

- [ ] **Step 1: Rewrite OrbitRing with tracking line endpoints**

Replace `src/components/OrbitRing.jsx` ENTIRELY with:
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
        {slots.map(({ cat, x, y }) => {
          const selected = Boolean(selectedParts[cat.id])
          return (
            <line
              key={cat.id}
              ref={(el) => { lineRefs.current[cat.id] = el }}
              x1={cx} y1={cy} x2={x} y2={y}
              stroke={selected ? 'rgba(96,165,250,0.55)' : 'rgba(255,255,255,0.12)'}
              strokeWidth={selected ? 1.5 : 1}
            />
          )
        })}
      </svg>
      {slots.map(({ cat, x, y, order }) => {
        const part = selectedParts[cat.id]
        const isNext = cat.id === next
        return (
          <div
            key={cat.id}
            style={{ left: x, top: y, pointerEvents: 'auto' }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            {part ? (
              <div className={`flex items-center gap-1 rounded-full border bg-gray-800/95 pl-2 pr-1 py-1 transition-all
                ${isNext ? 'border-blue-400' : 'border-blue-500/60'}`}>
                <button
                  onClick={() => onSelectCategory(cat.id)}
                  className="flex items-center gap-1 text-white text-xs font-medium whitespace-nowrap hover:text-blue-300"
                  title={part.name}
                >
                  <span>{cat.icon}</span>
                  <span className="max-w-[120px] truncate">{part.name}</span>
                  <span className="text-blue-300">£{part.price.toFixed(0)}</span>
                </button>
                <button
                  onClick={() => onDeselect(cat.id)}
                  aria-label={`Remove ${cat.label}`}
                  className="ml-0.5 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-red-500/80 text-sm leading-none"
                >
                  &times;
                </button>
              </div>
            ) : (
              <button
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all
                  ${isNext
                    ? 'border-blue-400 bg-blue-500/20 text-blue-200 ring-2 ring-blue-400/60 animate-pulse'
                    : 'border-gray-600 bg-gray-800 text-gray-200 hover:border-gray-400 hover:bg-gray-700'}`}
              >
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-700 text-[10px] text-gray-300">{order}</span>
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

- [ ] **Step 2: Verify build + tests**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → all pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/OrbitRing.jsx
git commit -m "feat: orbit lines track each part's live screen position through rotation"
```

---

## Self-Review

**Spec coverage (Chunk F):** pure `ndcToPixel` (F1) ✓; singleton + in-canvas per-frame tracker (F2) ✓; rAF line-endpoint tracking, empty→center / filled→part (F3) ✓; canvas and overlay share the container so pixels align ✓.

**Type consistency:** `partScreenPositions.positions[category] = { x, y }` written by ScreenTracker, read by OrbitRing. `ndcToPixel(ndcX, ndcY, w, h) → { x, y }` used in ScreenTracker. OrbitRing imports `CATEGORIES` from `../lib/categories` (Chunk D). `assemblyLayout(category, selectedParts).position` used for projection.

**Placeholders:** none — full code in every step.
