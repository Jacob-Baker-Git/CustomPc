# Chunk D — Flow & Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open straight to the 3D ring builder (no landing screen), drop the budget hide-rule to 60%, and expand the catalog further.

**Architecture:** Move the shared `CATEGORIES` constant to its own module, delete the `CategoryPicker` landing screen, and simplify `BuilderScreen` to always render the builder. A one-line constant change drops the filter to 60%. The catalog grows with more curated parts.

**Tech Stack:** React, Vite, Zustand, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-14-builder-realism-ui-design.md`

**Note:** `node`/`npx` are NOT on PATH. In PowerShell prepend: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`. Commit locally; do NOT push/deploy.

---

### Task D1: Skip Landing + Extract CATEGORIES

**Files:**
- Create: `src/lib/categories.js`
- Modify: `src/components/OrbitRing.jsx` (import path)
- Modify: `src/screens/BuilderScreen.jsx` (remove landing)
- Delete: `src/components/CategoryPicker.jsx`

- [ ] **Step 1: Create the categories module**

Create `src/lib/categories.js`:
```js
export const CATEGORIES = [
  { id: 'cpu',         label: 'CPU',         icon: '⚙️' },
  { id: 'gpu',         label: 'GPU',          icon: '🖥️' },
  { id: 'motherboard', label: 'Motherboard',  icon: '🔌' },
  { id: 'ram',         label: 'RAM',          icon: '📊' },
  { id: 'storage',     label: 'Storage',      icon: '💾' },
  { id: 'psu',         label: 'PSU',          icon: '⚡' },
  { id: 'case',        label: 'Case',         icon: '📦' },
  { id: 'cooler',      label: 'CPU Cooler',   icon: '❄️' },
  { id: 'fans',        label: 'Case Fans',    icon: '🌀' },
]
```

- [ ] **Step 2: Point OrbitRing at the new module**

In `src/components/OrbitRing.jsx`, change the import line:
```jsx
import { CATEGORIES } from './CategoryPicker'
```
to:
```jsx
import { CATEGORIES } from '../lib/categories'
```

- [ ] **Step 3: Simplify BuilderScreen to skip the landing**

Replace `src/screens/BuilderScreen.jsx` ENTIRELY with:
```jsx
import { useState } from 'react'
import TopBar from '../components/TopBar'
import BuildCanvas from '../components/BuildCanvas'
import OrbitRing from '../components/OrbitRing'
import PartSelector from '../components/PartSelector'
import CaseToggle from '../components/CaseToggle'
import BottleneckIndicator from '../components/BottleneckIndicator'
import useBuilderStore from '../store/useBuilderStore'

export default function BuilderScreen() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const addPart       = useBuilderStore((s) => s.addPart)
  const removePart    = useBuilderStore((s) => s.removePart)
  const [activeCategory, setActiveCategory] = useState(null)

  function handlePartSelect(part) {
    addPart(part.category, part)
    setActiveCategory(null)
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <TopBar />
      <div className="pt-16 h-[calc(100vh-4rem)]">
        <div className="relative w-full h-full">
          <BuildCanvas selectedParts={selectedParts} />
          <BottleneckIndicator />
          <OrbitRing
            selectedParts={selectedParts}
            onSelectCategory={setActiveCategory}
            onDeselect={removePart}
          />
          <CaseToggle />
        </div>
      </div>
      {activeCategory && (
        <PartSelector
          category={activeCategory}
          onSelect={handlePartSelect}
          onClose={() => setActiveCategory(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Delete the landing screen**

Delete the file `src/components/CategoryPicker.jsx`.
```bash
git rm src/components/CategoryPicker.jsx
```

- [ ] **Step 5: Verify build + tests**

Run: `npx vite build` → succeeds (confirms nothing still imports CategoryPicker).
Run: `npx vitest run` → all pass (50).

- [ ] **Step 6: Commit**

```bash
git add src/lib/categories.js src/components/OrbitRing.jsx src/screens/BuilderScreen.jsx
git commit -m "feat: open straight to 3D builder; extract CATEGORIES; remove landing screen"
```

---

### Task D2: 60% Budget Rule

**Files:**
- Modify: `src/lib/partFilter.js`
- Modify: `src/tests/partFilter.test.js`

- [ ] **Step 1: Update the test to pin the 60% boundary**

In `src/tests/partFilter.test.js`, find the test titled `'default view hides parts over 70% of budget'` and REPLACE that whole `it(...)` block with:
```js
  it('default view hides parts over 60% of budget', () => {
    const cheap = { id: 'x1', category: 'cpu', name: 'Cheap', price: 550, socket: 'AM5', tdp: 50 }
    const dear  = { id: 'x2', category: 'cpu', name: 'Dear',  price: 650, socket: 'AM5', tdp: 50 }
    const res = filterParts([cheap, dear], { motherboard: mbAM5 }, 1000, '')
    const ids = res.map((r) => r.part.id)
    expect(ids).toContain('x1')      // 550 <= 600 (60% of 1000)
    expect(ids).not.toContain('x2')  // 650 > 600
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/partFilter.test.js`
Expected: FAIL — at the current 70% cap (700), the £650 "dear" part is still shown, so `not.toContain('x2')` fails.

- [ ] **Step 3: Drop the cap to 60%**

In `src/lib/partFilter.js`, change the comment and the `maxPrice` line. The current lines are:
```js
// Returns [{ part, compatible, reason }]. Default view: compatible + within 70%
// of total budget. When a search query is present, returns every name match
// regardless of compatibility/budget (so they're findable, shown marked).
export function filterParts(parts, selectedParts, budget, query) {
  const q = (query || '').trim().toLowerCase()
  const maxPrice = budget * 0.7
```
Change to:
```js
// Returns [{ part, compatible, reason }]. Default view: compatible + within 60%
// of total budget. When a search query is present, returns every name match
// regardless of compatibility/budget (so they're findable, shown marked).
export function filterParts(parts, selectedParts, budget, query) {
  const q = (query || '').trim().toLowerCase()
  const maxPrice = budget * 0.6
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/partFilter.test.js`
Expected: PASS.

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run` → all pass.
```bash
git add src/lib/partFilter.js src/tests/partFilter.test.js
git commit -m "feat: tighten default budget filter from 70% to 60%"
```

---

### Task D3: Expand the Catalog Further

**Files:**
- Modify: `src/data/partsData.json`

- [ ] **Step 1: Read the current data**

Read `src/data/partsData.json` to learn the exact field shape per category (it currently has ~12–18 per category across 9 categories, with `perfScore` on every cpu/gpu).

- [ ] **Step 2: Add more real parts**

Grow each of the 9 categories toward **20–25 entries** (add more where realistic options exist; at least 20 per category). Keep ALL existing parts and ids. Match the existing per-category field shape exactly. Every new cpu/gpu needs a real-world-relative `perfScore` (0–100, normalized within category). Keep internal consistency: each socket family (AM5, LGA1700) and RAM type (DDR4, DDR5) must retain multiple compatible motherboards/CPUs/RAM so builds stay completable. Use unique ids and the existing per-category `modelPath`.

- [ ] **Step 3: Validate**

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location "C:\Users\jacob\IdeaProjects\CustomPc"
$d = Get-Content src/data/partsData.json -Raw | ConvertFrom-Json
"total: $($d.Count)"
$d | Group-Object category | ForEach-Object { "$($_.Name): $($_.Count)" }
"dupe ids: $($d.Count - ($d.id | Sort-Object -Unique).Count)"
"cpu/gpu missing perfScore: $(($d | Where-Object { ($_.category -eq 'cpu' -or $_.category -eq 'gpu') -and $null -eq $_.perfScore }).Count)"
"AM5 mobo/cpu: $(($d|?{$_.category -eq 'motherboard' -and $_.socket -eq 'AM5'}).Count)/$(($d|?{$_.category -eq 'cpu' -and $_.socket -eq 'AM5'}).Count); LGA1700 mobo/cpu: $(($d|?{$_.category -eq 'motherboard' -and $_.socket -eq 'LGA1700'}).Count)/$(($d|?{$_.category -eq 'cpu' -and $_.socket -eq 'LGA1700'}).Count)"
```
Expected: every category ≥ 20; 9 categories; dupe ids 0; missing perfScore 0; both socket families have ≥ 2 mobos and ≥ 2 CPUs.

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run` → all pass (existing tests reference specific ids that must still exist).
```bash
git add src/data/partsData.json
git commit -m "feat: expand catalog to 20+ parts per category"
```

---

## Self-Review

**Spec coverage (Chunk D):** skip landing + remove "View All Categories" + delete CategoryPicker + move CATEGORIES (D1) ✓; 60% rule (D2) ✓; more parts (D3) ✓.

**Type consistency:** `CATEGORIES` import path updated in OrbitRing; BuilderScreen no longer imports CategoryPicker; `filterParts` signature unchanged. Existing tests reference part ids preserved in D3.

**Placeholders:** none for code; D3 is a curation task with explicit numeric validation.
