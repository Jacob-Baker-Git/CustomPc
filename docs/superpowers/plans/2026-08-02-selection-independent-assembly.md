# Selection-Independent 3D Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every selected part render at its final assembled position regardless of what else is selected, so parts never jump into place when a motherboard is added and fans show without a case.

**Architecture:** `partCentre(category)` in `assemblyGeometry.js` already returns each part's real assembled position, derived only from fixed references (board at origin, case interior, CPU socket) — never from the current selection. The only thing introducing selection-dependence is a `FALLBACK` scatter map in `assemblyLayout.js` used when no motherboard is present, plus a fan-render gate in `BuildCanvas.jsx`. Delete both.

**Tech Stack:** React 19, React Three Fiber, Vitest. Node lives at `C:\Program Files\nodejs` — prepend it in the shell (`export PATH="/c/Program Files/nodejs:$PATH"`).

---

### Task 1: Make `assemblyLayout` selection-independent

**Files:**
- Modify: `src/lib/assemblyLayout.js` (whole file)
- Test: `src/tests/assemblyLayout.test.js` (whole file)

- [ ] **Step 1: Rewrite the test around the new contract**

Replace the entire contents of `src/tests/assemblyLayout.test.js` with:

```javascript
import { assemblyLayout } from '../lib/assemblyLayout'
import { partCentre } from '../lib/assemblyGeometry'
import { PART_SPECS } from '../lib/partSpecs'

// Every part that mounts to the board. `case` is positioned separately (on the
// case interior) and is checked on its own below.
const MOUNTED = ['motherboard', 'cpu', 'cooler', 'ram', 'storage', 'gpu', 'psu']

describe('assemblyLayout', () => {
  it('places the motherboard at the origin', () => {
    expect(assemblyLayout('motherboard').position).toEqual([0, 0, 0])
  })

  it('stands the motherboard vertical (non-zero rotation)', () => {
    expect(assemblyLayout('motherboard').rotation.some((v) => v !== 0)).toBe(true)
  })

  it('positions every mounted part at its real partCentre, oriented by its spec', () => {
    for (const cat of MOUNTED) {
      expect(assemblyLayout(cat).position, cat).toEqual(partCentre(cat))
      expect(assemblyLayout(cat).rotation, cat).toEqual(PART_SPECS[cat].rotation ?? [0, 0, 0])
    }
  })

  // The whole point of the change: the position must not depend on what else is
  // selected. Passing wildly different selections must yield an identical result.
  it('is selection-independent — same position whatever else is selected', () => {
    const selections = [undefined, {}, { motherboard: { id: 'mb' } }, { gpu: { id: 'g' }, psu: { id: 'p' } }]
    for (const cat of [...MOUNTED, 'case']) {
      const positions = selections.map((sel) => assemblyLayout(cat, sel).position)
      for (const p of positions) expect(p, cat).toEqual(positions[0])
    }
  })

  it('mounts the cooler sitting on the CPU (same Z or further toward the glass)', () => {
    expect(assemblyLayout('cooler').position[2]).toBeGreaterThanOrEqual(assemblyLayout('cpu').position[2])
  })

  it('mounts the GPU in front of the board plane so it is visible', () => {
    expect(assemblyLayout('gpu').position[2]).toBeGreaterThan(0)
  })

  it('centres the case on its interior', () => {
    const t = assemblyLayout('case')
    expect(t.position).toHaveLength(3)
    expect(t.rotation).toEqual([0, 0, 0])
  })

  it('returns a default transform for an unknown category', () => {
    const t = assemblyLayout('banana')
    expect(t.position).toEqual([0, 0, 0])
    expect(t.rotation).toEqual([0, 0, 0])
  })

  it('always returns a position and rotation triple', () => {
    for (const cat of [...MOUNTED, 'case', 'fans', 'paste']) {
      const t = assemblyLayout(cat)
      expect(t.position, cat).toHaveLength(3)
      expect(t.rotation, cat).toHaveLength(3)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="/c/Program Files/nodejs:$PATH"; npx vitest run src/tests/assemblyLayout.test.js`
Expected: FAIL. The `is selection-independent` test fails because the current
implementation returns a `FALLBACK` scatter position when no motherboard is in
the selection, which differs from the mounted position.

- [ ] **Step 3: Rewrite the implementation**

Replace the entire contents of `src/lib/assemblyLayout.js` with:

```javascript
// All transforms are relative to the motherboard anchored at the origin.
// The board stands VERTICAL (PCB in the XY plane), components facing the viewer (+Z).

import { partCentre, caseInterior } from './assemblyGeometry'
import { PART_SPECS } from './partSpecs'

// Every part renders at its real assembled position. partCentre derives that
// from fixed references only — the board at the origin, the case interior, the
// CPU socket the cooler sits on — never from what is currently selected. So a
// part appears exactly where it belongs the instant it is picked, alone or in a
// full build, and nothing already placed moves when another part is added or
// removed. There is deliberately no "scatter until a motherboard exists" mode:
// that snap-into-place was the jump this change removes.
const MOUNTED_CATEGORIES = ['motherboard', 'cpu', 'cooler', 'ram', 'storage', 'gpu', 'psu']

const DEFAULT_TRANSFORM = { position: [0, 0, 0], rotation: [0, 0, 0] }

// `category` is all this needs — no selection argument. Callers may still pass
// one (it is ignored), which is what proves the result is selection-independent.
export function assemblyLayout(category) {
  if (MOUNTED_CATEGORIES.includes(category)) {
    return {
      position: partCentre(category),
      rotation: PART_SPECS[category]?.rotation ?? [0, 0, 0],
    }
  }

  if (category === 'case') {
    const inner = caseInterior()
    return {
      position: inner.min.map((v, i) => (v + inner.max[i]) / 2),
      rotation: [0, 0, 0],
    }
  }

  return DEFAULT_TRANSFORM
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="/c/Program Files/nodejs:$PATH"; npx vitest run src/tests/assemblyLayout.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Run the full suite to confirm nothing relied on the old behaviour**

Run: `export PATH="/c/Program Files/nodejs:$PATH"; npx vitest run`
Expected: PASS. `assemblyRenderRotation.test.js` composes `assemblyLayout`'s
rotation and is unaffected (rotations are unchanged). If any other test fails,
it was asserting the removed `FALLBACK` scatter — update it to the new contract.

- [ ] **Step 6: Commit**

```bash
git add src/lib/assemblyLayout.js src/tests/assemblyLayout.test.js
git commit -m "feat: render every part at its real assembled position, always

assemblyLayout no longer scatters parts into a FALLBACK layout when no
motherboard is selected, then snaps them into place once one is added.
partCentre is already selection-independent, so it now returns that for
every part unconditionally. Nothing jumps as a build is assembled."
```

---

### Task 2: Render every selected part in place, and ungate the fans

**Files:**
- Modify: `src/components/PartModel.jsx:13`, `src/components/PartModel.jsx:18`
- Modify: `src/components/BuildCanvas.jsx:48-54`

- [ ] **Step 1: Drop the `selectedParts` plumbing in `PartModel`**

`PartModel` only used `selectedParts` to pass to `assemblyLayout`, which no
longer takes it. In `src/components/PartModel.jsx`, change the signature on
line 13 from:

```javascript
export default function PartModel({ part, selectedParts }) {
```

to:

```javascript
export default function PartModel({ part }) {
```

and change the `assemblyLayout` call on line 18 from:

```javascript
  const { position, rotation } = assemblyLayout(part.category, selectedParts)
```

to:

```javascript
  const { position, rotation } = assemblyLayout(part.category)
```

- [ ] **Step 2: Stop passing `selectedParts` to `PartModel`, and ungate the fans**

In `src/components/BuildCanvas.jsx`, replace this block (lines 48-54):

```javascript
        {parts.map((part) => (
          <PartModel key={part.id} part={part} selectedParts={selectedParts} />
        ))}
        <CableHarness selectedParts={selectedParts} />
        {selectedParts.case && selectedParts.motherboard && (
          <FanSystem filled={Boolean(selectedParts.fans)} />
        )}
```

with:

```javascript
        {parts.map((part) => (
          <PartModel key={part.id} part={part} />
        ))}
        <CableHarness selectedParts={selectedParts} />
        {/* Fans render at their mount points whenever fans are selected, case or
            not. With a case but no fans, the empty slot outlines show where they
            go — the outlines belong to the case, which is the thing with the
            mounts. Cables stay driven by selectedParts: they only appear when
            both parts they connect are present. */}
        {(selectedParts.fans || selectedParts.case) && (
          <FanSystem filled={Boolean(selectedParts.fans)} />
        )}
```

- [ ] **Step 3: Run the full suite and lint**

Run: `export PATH="/c/Program Files/nodejs:$PATH"; npx vitest run`
Expected: PASS (654 tests).

Run: `npm run lint`
Expected: clean, no errors (no unused `selectedParts` warnings).

- [ ] **Step 4: Verify in the render**

Start the dev server (do NOT use a raw `node` server — use the project's dev
config) and open the Build view. The WebGL context is exhaustible, so take the
screenshots you need without excessive reloads. Check, and screenshot each:

1. Starting empty, add parts ONE AT A TIME in a random order (e.g. GPU first,
   then PSU, then motherboard, then RAM). Expected: each part appears in its
   final assembled spot the moment it is added, and **nothing already on screen
   moves** when the next part (including the motherboard) is added.
2. From a complete build, deselect the motherboard. Expected: the board mesh
   disappears and **every other part stays exactly where it was** — no jump.
3. Select case fans with no case. Expected: the fans render in their mount
   positions (this was previously blank).
4. Select a case with no fans. Expected: the empty fan-slot outlines appear.
5. Select neither case nor fans. Expected: no fan geometry at all.

If anything jumps or fails to appear, stop and diagnose against
`assemblyLayout.js` / `BuildCanvas.jsx` before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/components/PartModel.jsx src/components/BuildCanvas.jsx
git commit -m "feat: show each selected part in place and fans without a case

PartModel no longer threads selectedParts into assemblyLayout (it takes
none now). BuildCanvas renders the fan system whenever fans OR a case are
selected — fans in place when fans are picked, empty slot outlines when a
case is picked without them — fixing 'pick fans, no case, nothing shows'."
```

---

## Notes

- The plan document itself stays untracked (`docs/superpowers/*` is not committed
  in this repo); only the code and test files are committed, per the steps above.
- No change to `CableHarness`/`cableRoutes` (already gated on real endpoints) or
  the camera framing (fixed on the case region by design).
