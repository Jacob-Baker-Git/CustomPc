# Chunk B — Data & 3D Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the catalog to ~120+ real parts (incl. a new Case Fans category and CPU/GPU performance scores), add search + smarter filtering to the selector, fix the GPU-under-motherboard layout bug, and add a case transparency toggle.

**Architecture:** A large curated `partsData.json` snapshot. A pure `partFilter.js` drives the selector's default/search behaviour. `assemblyLayout.js` gains a fans position and a corrected GPU position. The case's transparency lives in the store and is read directly by `CaseModel` (zustand is context-free, so it works inside the R3F Canvas).

**Tech Stack:** React, React Three Fiber, Zustand, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-14-builder-overhaul-design.md`

**Note:** `node`/`npx` are NOT on PATH. In PowerShell prepend: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`. Commit locally; do NOT push/deploy. Depends on Chunk A (the `fans` category metadata).

---

## File Map

| File | Responsibility |
|---|---|
| `src/data/partsData.json` | Expanded catalog + perfScore + fans |
| `src/lib/partFilter.js` | Pure selector filter (default + search) |
| `src/tests/partFilter.test.js` | Tests for the filter |
| `src/tests/compatibility.test.js` | + fans-always-compatible test |
| `src/components/models/FansModel.jsx` | Case fans 3D model |
| `src/components/models/partModelRegistry.js` | Register fans |
| `src/lib/assemblyLayout.js` | Fans position + GPU fix |
| `src/tests/assemblyLayout.test.js` | Update GPU expectation + fans |
| `src/components/PartSelector.jsx` | Search bar + filter wiring |
| `src/components/SearchBar.jsx` | Reusable search input |
| `src/store/useBuilderStore.js` | `caseTransparent` + toggle |
| `src/components/models/CaseModel.jsx` | Read transparency flag |
| `src/components/CaseToggle.jsx` | Transparency switch |
| `src/screens/BuilderScreen.jsx` | Render CaseToggle |

---

### Task B1: Expand the Catalog

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `src/tests/compatibility.test.js`

This is a data-authoring task. Keep the EXISTING part objects (and their existing fields) intact; add more.

- [ ] **Step 1: Add `perfScore` to every existing and new CPU and GPU**

`perfScore` is an integer 0–100 representing real-world relative performance, normalized within the category (the strongest current CPU ≈ 100, the strongest current GPU ≈ 100). Use real benchmark rankings to set sensible relative values. Examples to anchor the scale:
- CPUs: `cpu-i9-13900k` ≈ 100, `cpu-ryzen-9-7950x` ≈ 98, `cpu-ryzen-7-7700x` ≈ 80, `cpu-i5-13600k` ≈ 78, `cpu-ryzen-5-7600x` ≈ 70.
- GPUs: `gpu-rtx-4090` ≈ 100, `gpu-rx-7900xtx` ≈ 88, `gpu-rtx-4070ti` ≈ 72, `gpu-rtx-4060ti` ≈ 50, `gpu-rx-7600` ≈ 42.

- [ ] **Step 2: Expand each category to 12–18 real options**

For each of the 8 existing categories (cpu, gpu, motherboard, ram, storage, psu, case, cooler), add real current parts until each has **12–18 entries**, spanning budget → mid → high-end at realistic UK prices (£). Follow the existing object shape per category exactly (same fields the current entries use — e.g. CPUs need `socket`,`tdp`,`perfScore`,`specs`; GPUs need `tdp`,`length`,`perfScore`,`specs`; motherboards need `socket`,`formFactor`,`ramType`,`tdp`; cases need `supportedFormFactors`,`maxGpuLength`; coolers need `sockets`; psus need `wattage`; ram needs `ramType`,`speed`,`capacityGb`; storage needs `storageType`,`capacityGb`). Use unique `id`s and the existing `modelPath` values per category.

- [ ] **Step 3: Add the Case Fans category (12–18 entries)**

Add fan entries with this shape:
```json
{
  "id": "fans-arctic-p12-3pack", "category": "fans", "name": "Arctic P12 PWM (3-pack)",
  "price": 24.99, "tdp": 6, "modelPath": "/models/fans.glb",
  "specs": { "size": "120mm", "count": 3, "rgb": false }
}
```
Range from a single 120mm fan (~£6, tdp ~2) to RGB 3-packs (~£60, tdp ~8). 12–18 entries. Fans need NO socket/form-factor fields (they are universally compatible).

- [ ] **Step 4: Add a fans-always-compatible test**

In `src/tests/compatibility.test.js`, inside the existing `describe('checkCompatibility', ...)` block, add:
```js
  it('treats case fans as always compatible', () => {
    const fan = { id: 'fan-x', category: 'fans', price: 20, tdp: 4 }
    expect(checkCompatibility({ motherboard: mbAM5, cpu: cpuAM5 }, fan).compatible).toBe(true)
    expect(checkCompatibility({}, fan).compatible).toBe(true)
  })
```

- [ ] **Step 5: Validate the data**

Run this PowerShell check and confirm output:
```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
$d = Get-Content src/data/partsData.json -Raw | ConvertFrom-Json
"total: $($d.Count)"
$d | Group-Object category | ForEach-Object { "$($_.Name): $($_.Count)" }
"dupe ids: $($d.Count - ($d.id | Sort-Object -Unique).Count)"
"cpu/gpu missing perfScore: $(($d | Where-Object { ($_.category -eq 'cpu' -or $_.category -eq 'gpu') -and $null -eq $_.perfScore }).Count)"
```
Expected: each category 12–18; 9 categories incl. `fans`; total ≥ 108; dupe ids 0; missing perfScore 0.

- [ ] **Step 6: Run tests + commit**

Run: `npx vitest run` → all pass (existing 37 from Chunk A + 1 new compat test = 38).
```bash
git add src/data/partsData.json src/tests/compatibility.test.js
git commit -m "feat: expand catalog to 120+ parts with perfScores and case fans"
```

---

### Task B2: Fans Model + GPU Position Fix

**Files:**
- Create: `src/components/models/FansModel.jsx`
- Modify: `src/components/models/partModelRegistry.js`
- Modify: `src/lib/assemblyLayout.js`
- Modify: `src/tests/assemblyLayout.test.js`

- [ ] **Step 1: Update the assemblyLayout tests for the GPU fix + fans**

In `src/tests/assemblyLayout.test.js`, REPLACE the test titled `'mounts the GPU below the board plane (negative Y) when a motherboard is present'` with:
```js
  it('mounts the GPU above the board so it is visible, not hidden under it', () => {
    expect(assemblyLayout('gpu', withMb).position[1]).toBeGreaterThanOrEqual(0)
  })

  it('gives case fans a mount position when a motherboard is present', () => {
    const t = assemblyLayout('fans', withMb)
    expect(t.position).toHaveLength(3)
    expect(t.rotation).toHaveLength(3)
  })
```
Also, in the existing `'always returns a position and rotation triple'` test, add `'fans'` to the category list array.

- [ ] **Step 2: Run to verify the GPU test fails**

Run: `npx vitest run src/tests/assemblyLayout.test.js`
Expected: FAIL — the GPU position is still negative (`-0.25`).

- [ ] **Step 3: Fix GPU position + add fans in assemblyLayout**

In `src/lib/assemblyLayout.js`, in the `MOUNTED` map, change the `gpu` line and add a `fans` line:
```js
  gpu:         { position: [0, 0.22, 0.55],  rotation: [0, 0, 0] },
  storage:     { position: [-0.5, 0.06, 0.2], rotation: [0, 0, 0] },
  psu:         { position: [0, -1.1, -0.6],   rotation: [0, 0, 0] },
  case:        { position: [0, -0.3, 0],      rotation: [0, 0, 0] },
  fans:        { position: [0, 0.7, 1.25],    rotation: [0, 0, 0] },
```
And in the `FALLBACK` map add:
```js
  case:    [0, 0, 0],
  fans:    [1.4, 1.2, 0],
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/assemblyLayout.test.js`
Expected: PASS.

- [ ] **Step 5: Create FansModel**

Create `src/components/models/FansModel.jsx`:
```jsx
export default function FansModel() {
  return (
    <group>
      {/* fan frame */}
      <mesh>
        <boxGeometry args={[0.6, 0.6, 0.12]} />
        <meshStandardMaterial color="#222222" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* hub */}
      <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 20]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      {/* blades */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[0, 0, 0.06]} rotation={[0, 0, (i / 7) * Math.PI * 2]}>
          <boxGeometry args={[0.26, 0.08, 0.02]} />
          <meshStandardMaterial color="#5577aa" metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 6: Register the fans model**

In `src/components/models/partModelRegistry.js`, add the import and entry:
```js
import FansModel from './FansModel'
```
and add to `MODEL_REGISTRY`:
```js
  fans: FansModel,
```

- [ ] **Step 7: Verify build + tests + commit**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → all pass.
```bash
git add src/components/models/FansModel.jsx src/components/models/partModelRegistry.js src/lib/assemblyLayout.js src/tests/assemblyLayout.test.js
git commit -m "fix: raise GPU above board (was hidden under it); add fans model and position"
```

---

### Task B3: Selector Search + Smart Filtering (TDD)

**Files:**
- Create: `src/lib/partFilter.js`
- Test: `src/tests/partFilter.test.js`
- Create: `src/components/SearchBar.jsx`
- Modify: `src/components/PartSelector.jsx`

- [ ] **Step 1: Write the failing filter test**

Create `src/tests/partFilter.test.js`:
```js
import { filterParts } from '../lib/partFilter'
import partsData from '../data/partsData.json'

const cpus = partsData.filter((p) => p.category === 'cpu')
const mbAM5 = partsData.find((p) => p.id === 'mb-asus-x670e')

describe('filterParts', () => {
  it('default view hides incompatible parts', () => {
    // With an AM5 motherboard, Intel (LGA1700) CPUs are incompatible
    const res = filterParts(cpus, { motherboard: mbAM5 }, 5000, '')
    const ids = res.map((r) => r.part.id)
    expect(ids).not.toContain('cpu-i7-13700k')
    expect(ids).toContain('cpu-ryzen-7-7700x')
  })

  it('default view hides parts over 70% of budget', () => {
    const cheap = { id: 'x1', category: 'cpu', name: 'Cheap', price: 100, socket: 'AM5', tdp: 50 }
    const dear  = { id: 'x2', category: 'cpu', name: 'Dear',  price: 800, socket: 'AM5', tdp: 50 }
    const res = filterParts([cheap, dear], { motherboard: mbAM5 }, 1000, '')
    const ids = res.map((r) => r.part.id)
    expect(ids).toContain('x1')      // 100 <= 700
    expect(ids).not.toContain('x2')  // 800 > 700
  })

  it('search reveals matching parts even if incompatible', () => {
    const res = filterParts(cpus, { motherboard: mbAM5 }, 5000, 'i7-13700')
    const ids = res.map((r) => r.part.id)
    expect(ids).toContain('cpu-i7-13700k')
    expect(res.find((r) => r.part.id === 'cpu-i7-13700k').compatible).toBe(false)
  })

  it('search reveals matching parts even if over budget', () => {
    const dear = { id: 'x2', category: 'cpu', name: 'Dear CPU', price: 800, socket: 'AM5', tdp: 50 }
    const res = filterParts([dear], { motherboard: mbAM5 }, 1000, 'dear')
    expect(res.map((r) => r.part.id)).toContain('x2')
  })

  it('with budget 0 the 70% rule does not hide anything', () => {
    const res = filterParts(cpus.filter((c) => c.socket === 'AM5'), { motherboard: mbAM5 }, 0, '')
    expect(res.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/partFilter.test.js`
Expected: FAIL — "Cannot find module '../lib/partFilter'"

- [ ] **Step 3: Implement the filter**

Create `src/lib/partFilter.js`:
```js
import { checkCompatibility } from './compatibility'

// Returns [{ part, compatible, reason }]. Default view: compatible + within 70%
// of total budget. When a search query is present, returns every name match
// regardless of compatibility/budget (so they're findable, shown marked).
export function filterParts(parts, selectedParts, budget, query) {
  const q = (query || '').trim().toLowerCase()
  const maxPrice = budget * 0.7

  const annotated = parts.map((part) => {
    const { compatible, reason } = checkCompatibility(selectedParts, part)
    return { part, compatible, reason }
  })

  if (q) {
    return annotated.filter(({ part }) => part.name.toLowerCase().includes(q))
  }

  return annotated.filter(({ part, compatible }) => {
    if (!compatible) return false
    if (budget > 0 && part.price > maxPrice) return false
    return true
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/partFilter.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Create SearchBar**

Create `src/components/SearchBar.jsx`:
```jsx
export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500"
    />
  )
}
```

- [ ] **Step 6: Wire search + filter into PartSelector**

Replace `src/components/PartSelector.jsx` ENTIRELY with:
```jsx
import { useMemo, useState } from 'react'
import useBuilderStore, { selRemainingBudget } from '../store/useBuilderStore'
import { filterParts } from '../lib/partFilter'
import PartCard from './PartCard'
import SearchBar from './SearchBar'
import partsData from '../data/partsData.json'

export default function PartSelector({ category, onSelect, onClose }) {
  const selectedParts   = useBuilderStore((s) => s.selectedParts)
  const budget          = useBuilderStore((s) => s.budget)
  const remainingBudget = useBuilderStore(selRemainingBudget)
  const [query, setQuery] = useState('')

  const parts = useMemo(
    () => partsData.filter((p) => p.category === category),
    [category]
  )

  const visible = useMemo(
    () => filterParts(parts, selectedParts, budget, query),
    [parts, selectedParts, budget, query]
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 gap-4">
          <h2 className="text-white text-xl font-bold capitalize whitespace-nowrap">{category}</h2>
          <div className="flex-1 max-w-sm">
            <SearchBar value={query} onChange={setQuery} placeholder={`Search ${category}...`} />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {visible.length === 0 && (
            <p className="col-span-full text-center text-gray-500 py-8">No parts match.</p>
          )}
          {visible.map(({ part, compatible, reason }) => {
            const overBudget = part.price > remainingBudget
            const locked     = !compatible || overBudget
            const lockReason = !compatible ? reason : 'Over remaining budget'
            return (
              <PartCard
                key={part.id}
                part={part}
                locked={locked}
                lockReason={lockReason}
                onSelect={(p) => { onSelect(p); onClose() }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Verify build + tests + commit**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → all pass.
```bash
git add src/lib/partFilter.js src/tests/partFilter.test.js src/components/SearchBar.jsx src/components/PartSelector.jsx
git commit -m "feat: selector search bar, 70% budget filter, hide-incompatible-unless-searched"
```

---

### Task B4: Case Transparency Toggle

**Files:**
- Modify: `src/store/useBuilderStore.js`
- Modify: `src/components/models/CaseModel.jsx`
- Create: `src/components/CaseToggle.jsx`
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Add transparency state to the store**

In `src/store/useBuilderStore.js`, add to the store object (after `removePart`):
```js
  caseTransparent: true,
  toggleCaseTransparency: () =>
    set((state) => ({ caseTransparent: !state.caseTransparent })),
```

- [ ] **Step 2: Make CaseModel read the flag**

Replace `src/components/models/CaseModel.jsx` ENTIRELY with:
```jsx
import useBuilderStore from '../../store/useBuilderStore'

export default function CaseModel() {
  const transparent = useBuilderStore((s) => s.caseTransparent)

  return (
    <group>
      <mesh>
        <boxGeometry args={[3.2, 3.0, 3.2]} />
        <meshStandardMaterial
          color={transparent ? '#88aadd' : '#2b2f36'}
          transparent
          opacity={transparent ? 0.12 : 0.95}
          metalness={0.4}
          roughness={transparent ? 0.1 : 0.5}
          side={2}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[3.2, 3.0, 3.2]} />
        <meshBasicMaterial color="#5577aa" wireframe />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 3: Create CaseToggle**

Create `src/components/CaseToggle.jsx`:
```jsx
import useBuilderStore from '../store/useBuilderStore'

export default function CaseToggle() {
  const transparent = useBuilderStore((s) => s.caseTransparent)
  const toggle      = useBuilderStore((s) => s.toggleCaseTransparency)
  const hasCase     = useBuilderStore((s) => Boolean(s.selectedParts.case))

  if (!hasCase) return null

  return (
    <button
      onClick={toggle}
      className="absolute bottom-6 right-6 bg-gray-800/90 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-full border border-gray-600 transition-all flex items-center gap-2"
    >
      <span>{transparent ? '👁️ See-through case' : '📦 Solid case'}</span>
    </button>
  )
}
```

- [ ] **Step 4: Render CaseToggle in BuilderScreen**

In `src/screens/BuilderScreen.jsx`, add the import:
```jsx
import CaseToggle from '../components/CaseToggle'
```
and render it inside the relative builder view, right after `<OrbitRing ... />` (before the "View All Categories" button):
```jsx
            <CaseToggle />
```

- [ ] **Step 5: Verify build + tests + commit**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → all pass.
```bash
git add src/store/useBuilderStore.js src/components/models/CaseModel.jsx src/components/CaseToggle.jsx src/screens/BuilderScreen.jsx
git commit -m "feat: add case transparency toggle (see-through vs solid)"
```

---

## Self-Review

**Spec coverage (Chunk B):** large curated catalog ~12–18/category + perfScore (B1) ✓; case fans category + data + model + position (B1, B2) ✓; search bar (B3) ✓; 70%-budget hide (B3) ✓; hide-incompatible-unless-searched (B3) ✓; GPU-under-motherboard fix (B2) ✓; case transparency toggle (B4) ✓.

**Type consistency:** `filterParts(parts, selectedParts, budget, query)` returns `[{part, compatible, reason}]`, consumed identically in PartSelector. `caseTransparent`/`toggleCaseTransparency` used in CaseModel + CaseToggle match the store. `fans` registry/position/category id consistent across files and with Chunk A's CATEGORIES + RECOMMENDED_ORDER.

**Placeholders:** none for logic/components. B1 is a curation task with schema, anchor examples, and numeric validation criteria — the authored data is verified by the Step 5 check.
