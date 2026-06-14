# Chunk A — Builder UX & State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the OrbitRing into a full build manager (all categories, deselect, recommended-order guidance) and make the budget editable in place, with modern interactive polish.

**Architecture:** A pure `recommendedOrder.js` provides the canonical build order and the "next" suggestion. OrbitRing is rewritten to render all 9 categories as slots (filled = part + ✕ deselect; empty = + Add; recommended-next glows). TopBar's budget becomes click-to-edit, reusing the store's existing `setBudget`/`removePart`.

**Tech Stack:** React, Zustand, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-14-builder-overhaul-design.md`

**Note:** `node`/`npx` are NOT on PATH. In PowerShell prepend: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`. Per project preference, commit locally but do NOT push/deploy.

---

## File Map

| File | Responsibility |
|---|---|
| `src/lib/recommendedOrder.js` | `RECOMMENDED_ORDER` constant + `nextRecommended(selectedParts)` |
| `src/tests/recommendedOrder.test.js` | Unit tests for the above |
| `src/components/CategoryPicker.jsx` | Add `fans` (Case Fans) to `CATEGORIES` |
| `src/components/OrbitRing.jsx` | Full rewrite — build-manager slots |
| `src/components/TopBar.jsx` | Editable budget |
| `src/screens/BuilderScreen.jsx` | Pass `removePart` to OrbitRing |

---

### Task A1: Recommended Order (TDD)

**Files:**
- Create: `src/lib/recommendedOrder.js`
- Test: `src/tests/recommendedOrder.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/recommendedOrder.test.js`:
```js
import { RECOMMENDED_ORDER, nextRecommended } from '../lib/recommendedOrder'

describe('recommendedOrder', () => {
  it('lists all 9 categories starting with motherboard and ending with fans', () => {
    expect(RECOMMENDED_ORDER[0]).toBe('motherboard')
    expect(RECOMMENDED_ORDER[RECOMMENDED_ORDER.length - 1]).toBe('fans')
    expect(RECOMMENDED_ORDER).toHaveLength(9)
  })

  it('returns motherboard first when nothing is selected', () => {
    expect(nextRecommended({})).toBe('motherboard')
  })

  it('skips selected categories and returns the next gap in order', () => {
    expect(nextRecommended({ motherboard: { id: 'm' } })).toBe('cpu')
    expect(nextRecommended({ motherboard: { id: 'm' }, cpu: { id: 'c' } })).toBe('cooler')
  })

  it('returns null when every category is filled', () => {
    const full = {}
    for (const c of RECOMMENDED_ORDER) full[c] = { id: c }
    expect(nextRecommended(full)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/recommendedOrder.test.js`
Expected: FAIL — "Cannot find module '../lib/recommendedOrder'"

- [ ] **Step 3: Implement**

Create `src/lib/recommendedOrder.js`:
```js
export const RECOMMENDED_ORDER = [
  'motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case', 'fans',
]

export function nextRecommended(selectedParts = {}) {
  for (const category of RECOMMENDED_ORDER) {
    if (!selectedParts[category]) return category
  }
  return null
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/recommendedOrder.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run` → 33 + 4 = 37 pass.
```bash
git add src/lib/recommendedOrder.js src/tests/recommendedOrder.test.js
git commit -m "feat: add recommendedOrder module with next-step helper"
```

---

### Task A2: Fans Category + OrbitRing Build Manager

**Files:**
- Modify: `src/components/CategoryPicker.jsx` (add fans to CATEGORIES)
- Modify: `src/components/OrbitRing.jsx` (full rewrite)
- Modify: `src/screens/BuilderScreen.jsx` (pass removePart)

- [ ] **Step 1: Add the fans category**

In `src/components/CategoryPicker.jsx`, the `CATEGORIES` array currently ends with the cooler entry:
```jsx
  { id: 'cooler',      label: 'CPU Cooler',   icon: '❄️' },
]
```
Change it to add a fans entry:
```jsx
  { id: 'cooler',      label: 'CPU Cooler',   icon: '❄️' },
  { id: 'fans',        label: 'Case Fans',    icon: '🌀' },
]
```

- [ ] **Step 2: Rewrite OrbitRing as a build manager**

Replace `src/components/OrbitRing.jsx` ENTIRELY with:
```jsx
import { useRef, useLayoutEffect, useState } from 'react'
import { CATEGORIES } from './CategoryPicker'
import { RECOMMENDED_ORDER, nextRecommended } from '../lib/recommendedOrder'

const ORDERED = RECOMMENDED_ORDER
  .map((id) => CATEGORIES.find((c) => c.id === id))
  .filter(Boolean)

export default function OrbitRing({ selectedParts, onSelectCategory, onDeselect }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 600 })

  useLayoutEffect(() => {
    function update() {
      if (containerRef.current)
        setSize({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const next = nextRecommended(selectedParts)
  const cx = size.w / 2
  const cy = size.h / 2
  const radius = Math.min(size.w, size.h) * 0.40

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <svg width={size.w} height={size.h} className="absolute inset-0">
        {ORDERED.map((cat, i) => {
          const angle = (i / ORDERED.length) * 2 * Math.PI - Math.PI / 2
          const x = cx + radius * Math.cos(angle)
          const y = cy + radius * Math.sin(angle)
          const selected = Boolean(selectedParts[cat.id])
          return (
            <line key={cat.id} x1={cx} y1={cy} x2={x} y2={y}
              stroke={selected ? 'rgba(96,165,250,0.45)' : 'rgba(255,255,255,0.12)'}
              strokeWidth={selected ? 1.5 : 1} />
          )
        })}
      </svg>
      {ORDERED.map((cat, i) => {
        const angle = (i / ORDERED.length) * 2 * Math.PI - Math.PI / 2
        const x = cx + radius * Math.cos(angle)
        const y = cy + radius * Math.sin(angle)
        const part = selectedParts[cat.id]
        const isNext = cat.id === next
        const order = i + 1

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

- [ ] **Step 3: Wire deselect in BuilderScreen**

In `src/screens/BuilderScreen.jsx`:

Add `removePart` to the store reads (it currently reads `selectedParts` and `addPart`):
```jsx
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const addPart       = useBuilderStore((s) => s.addPart)
  const removePart    = useBuilderStore((s) => s.removePart)
```

Pass `onDeselect` to OrbitRing (currently `<OrbitRing selectedParts={selectedParts} onSelectCategory={handleCategorySelect} />`):
```jsx
            <OrbitRing
              selectedParts={selectedParts}
              onSelectCategory={handleCategorySelect}
              onDeselect={removePart}
            />
```

- [ ] **Step 4: Verify build + tests**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → 37 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/CategoryPicker.jsx src/components/OrbitRing.jsx src/screens/BuilderScreen.jsx
git commit -m "feat: orbit ring build manager with deselect and recommended-next guidance"
```

---

### Task A3: Editable Budget in TopBar

**Files:**
- Modify: `src/components/TopBar.jsx`

- [ ] **Step 1: Make the budget click-to-edit**

Replace `src/components/TopBar.jsx` ENTIRELY with:
```jsx
import { useState } from 'react'
import useBuilderStore, {
  selTotalSpent, selTotalPower, selPsuWattage
} from '../store/useBuilderStore'
import DynamicBars from './DynamicBars'

export default function TopBar() {
  const budget     = useBuilderStore((s) => s.budget)
  const setBudget  = useBuilderStore((s) => s.setBudget)
  const totalSpent = useBuilderStore(selTotalSpent)
  const totalPower = useBuilderStore(selTotalPower)
  const psuwattage = useBuilderStore(selPsuWattage)
  const remaining  = budget - totalSpent

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit() {
    setDraft(String(budget))
    setEditing(true)
  }

  function commit() {
    const num = parseFloat(draft)
    if (num > 0) setBudget(num)
    setEditing(false)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-8">
      <span className="text-white font-bold text-lg tracking-tight">PC Builder</span>
      <div className="flex items-center gap-2 text-sm text-gray-300">
        {editing ? (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">£</span>
            <input
              autoFocus
              type="number"
              min="1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
              className="w-24 bg-gray-800 text-white px-2 py-0.5 rounded border border-blue-500 focus:outline-none"
            />
          </span>
        ) : (
          <button
            onClick={startEdit}
            title="Click to edit your budget"
            className="text-white font-semibold hover:text-blue-300 border-b border-dashed border-gray-600 hover:border-blue-400"
          >
            £{budget.toFixed(0)}
          </button>
        )}
        <span className="text-gray-500">budget</span>
        <span className="text-gray-600 mx-1">|</span>
        <span className={remaining < 0 ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
          £{remaining.toFixed(0)}
        </span>
        <span className="text-gray-500">remaining</span>
        <span className="text-gray-600 mx-1">|</span>
        <span className="text-amber-400 font-semibold">{totalPower}W</span>
      </div>
      <div className="flex gap-6 ml-auto">
        <DynamicBars value={totalSpent} max={budget} label="Budget" unit="£" />
        <DynamicBars value={totalPower} max={psuwattage} label="Power" unit="W" />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verify build + tests**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → 37 pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/TopBar.jsx
git commit -m "feat: make top-bar budget click-to-edit"
```

---

## Self-Review

**Spec coverage (Chunk A):** ring-as-build-manager with all categories + deselect ✕ (A2) ✓; recommended order + glow on next (A1 + A2) ✓; order badges (A2) ✓; editable budget (A3) ✓; modern polish — transitions, glow, hover, truncation (A2/A3) ✓; fans category metadata added so the ring shows all 9 (A2) ✓.

**Type consistency:** `nextRecommended(selectedParts)` used in OrbitRing matches A1 signature. `onDeselect(categoryId)` wired to store `removePart(category)`. `RECOMMENDED_ORDER` ids match CATEGORIES ids (incl. new `fans`).

**Placeholders:** none — full code in every step.

**Note:** the `fans` slot opens an empty selector until Chunk B adds fans data — acceptable short-lived gap, resolved next chunk.
