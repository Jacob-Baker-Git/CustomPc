# Component spec schema and compatibility engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the catalogue somewhere to put verified hardware specs, and give the compatibility engine eight new rules that say "unverified" rather than silently passing when the data is not there.

**Architecture:** `checkCompatibility` keeps its existing early-return blocking checks untouched and gains a `status` field. A new `src/lib/specRules.js` holds the six blocking rules as small pure functions, aggregated with the precedence `blocked` > `unverified` > `ok`. Advisory rules and the cooler thermal rule go through `buildWarnings.js` instead, because they must never affect selectability. Provenance lives in `data/partSources.json`, which is never imported by `src/`.

**Tech Stack:** React 19 + Vite, Vitest, plain JS. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-27-component-spec-schema-and-compatibility-design.md`

---

## Before you start: things that will bite you

- **Tailwind tokens take NO opacity modifier.** `bg-steel/60` emits no CSS at all and `tokenOpacity.test.js` fails the build for it. Use whole tokens only. Valid tokens: `ground surface surface-2 line line-strong ink muted faint accent brass gold gold-soft tech steel good ok bad`.
- **Do not rename or reword any existing `reason` string.** `src/tests/compatibility.test.js` matches on them.
- **A build holds exactly one part per category.** `selectedParts` is `{ [category]: part }`. Never write slot-allocation logic across several drives; it cannot arise.
- Run a single test file with `npx vitest run src/tests/<file>.test.js`.
- Full suite: `npx vitest run`. Lint: `npm run lint`.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/specRules.js` **(create)** | The six blocking rules and their aggregation. One exported entry point. |
| `src/lib/compatibility.js` **(modify)** | Gains `status`; delegates new rules to `specRules.js`. Existing checks unchanged. |
| `src/lib/buildWarnings.js` **(modify)** | Cooler thermal warning; the two advisories at a new `note` level. |
| `src/components/BuildWarnings.jsx` **(modify)** | Render the `note` level distinctly. |
| `data/partSources.json` **(create)** | Provenance. Never imported by `src/`. |
| `src/tests/specRules.test.js` **(create)** | Per-rule tests, including the unverified case for every rule. |
| `src/tests/partSources.test.js` **(create)** | Provenance drift guard. |

---

### Task 1: Add the three-state verdict, changing no behaviour

**Files:**
- Modify: `src/lib/compatibility.js`
- Test: `src/tests/compatibility.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/compatibility.test.js`:

```js
describe('three-state verdict', () => {
  it('reports status ok when nothing blocks', () => {
    const r = checkCompatibility({ motherboard: mbAM5 }, cpuAM5)
    expect(r.status).toBe('ok')
    expect(r.compatible).toBe(true)
  })

  it('reports status blocked when a check fails, and keeps compatible false', () => {
    const r = checkCompatibility({ motherboard: mbAM5 }, cpuIntel)
    expect(r.status).toBe('blocked')
    expect(r.compatible).toBe(false)
  })

  it('derives compatible from status rather than carrying an independent flag', () => {
    // compatible must never disagree with status, for every part in the
    // catalogue against a realistic build.
    for (const part of partsData) {
      const r = checkCompatibility({ motherboard: mbAM5, cpu: cpuAM5 }, part)
      expect(r.compatible).toBe(r.status !== 'blocked')
    }
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/compatibility.test.js`
Expected: FAIL — `expected undefined to be 'ok'`.

- [ ] **Step 3: Add the status field**

In `src/lib/compatibility.js`, add these two helpers just above `checkCompatibility`:

```js
// ⚠️ `compatible` is DERIVED, never stored independently. Two fields that can
// disagree is how the PSU equality bug survived in three places at once.
const blocked = (reason) => ({ status: 'blocked', compatible: false, reason })
const ok = () => ({ status: 'ok', compatible: true, reason: '' })
```

Then replace every `return { compatible: false, reason: X }` in the function with `return blocked(X)`, leaving the message expressions exactly as they are. Replace the final `return { compatible: true, reason: '' }` with `return ok()`.

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run`
Expected: PASS, 1479+ tests. If any existing test fails, a `reason` string was altered — restore it verbatim.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compatibility.js src/tests/compatibility.test.js
git commit -m "refactor: give compatibility a three-state verdict, deriving compatible from it"
```

---

### Task 2: The specRules module and its precedence, with zero rules

**Files:**
- Create: `src/lib/specRules.js`
- Create: `src/tests/specRules.test.js`
- Modify: `src/lib/compatibility.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/specRules.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { evaluateSpecRules, aggregate } from '../lib/specRules'

describe('specRules aggregation', () => {
  it('is ok when every rule is satisfied or inapplicable', () => {
    expect(aggregate([null, null])).toEqual({ status: 'ok', reason: '' })
  })

  it('reports unverified when a rule could not run', () => {
    const r = aggregate([null, { status: 'unverified', reason: 'GPU thickness unknown' }])
    expect(r.status).toBe('unverified')
    expect(r.reason).toBe('GPU thickness unknown')
  })

  // ⚠️ THE assertion of this whole design. A satisfied rule must never mask an
  // unverified one, and an unverified one must never mask a block.
  it('lets blocked win over unverified, and unverified win over ok', () => {
    const results = [
      null,
      { status: 'unverified', reason: 'unknown thing' },
      { status: 'blocked', reason: 'real failure' },
    ]
    expect(aggregate(results)).toEqual({ status: 'blocked', reason: 'real failure' })
  })

  it('returns ok for an empty build', () => {
    expect(evaluateSpecRules({}, { category: 'gpu', specs: {} }).status).toBe('ok')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/specRules.test.js`
Expected: FAIL — cannot resolve `../lib/specRules`.

- [ ] **Step 3: Create the module**

Create `src/lib/specRules.js`:

```js
// The compatibility rules that depend on specs researched to the standard in
// docs/superpowers/specs/2026-08-27-component-spec-schema-and-compatibility-design.md
//
// Every rule is a pure function (selectedParts, candidate) => null | {status, reason}.
// `null` means the rule does not apply to this pairing at all — a GPU rule
// against a candidate PSU, say. That is DIFFERENT from 'unverified', which means
// the rule applies and the data to run it is missing.
//
// ⚠️ Absent data must NEVER produce 'ok'. The whole point of this module is that
// the app stops claiming it checked things it could not check.

// Precedence: a real failure outranks an unrunnable check, which outranks
// silence. Without this, one satisfied rule would mask an unverified one.
const RANK = { blocked: 0, unverified: 1 }

export function aggregate(results) {
  const real = results.filter(Boolean)
  if (real.length === 0) return { status: 'ok', reason: '' }
  const worst = real.sort((a, b) => RANK[a.status] - RANK[b.status])[0]
  return { status: worst.status, reason: worst.reason }
}

// Rules are appended here as they are implemented.
const RULES = []

export function evaluateSpecRules(selectedParts, candidate) {
  return aggregate(RULES.map((rule) => rule(selectedParts, candidate)))
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/tests/specRules.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Wire it into compatibility.js**

In `src/lib/compatibility.js`, add the import at the top:

```js
import { evaluateSpecRules } from './specRules'
```

Then replace the final `return ok()` with:

```js
  // ⚠️ Reached only when every existing check passed, so a block here cannot be
  // masking one above it. New rules may still block, or report unverified.
  const spec = evaluateSpecRules(selectedParts, candidate)
  if (spec.status === 'blocked') return blocked(spec.reason)
  if (spec.status === 'unverified')
    return { status: 'unverified', compatible: true, reason: spec.reason }
  return ok()
```

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS. No behaviour has changed — `RULES` is empty.

- [ ] **Step 7: Commit**

```bash
git add src/lib/specRules.js src/tests/specRules.test.js src/lib/compatibility.js
git commit -m "feat: add the spec-rule aggregator, where unknown data reports unverified"
```

---

### Task 3: Rule 1 — the PSU must have the connectors the build needs

**Files:**
- Modify: `src/lib/specRules.js`
- Test: `src/tests/specRules.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/specRules.test.js`:

```js
const psu = (connectors) => ({ id: 'p', category: 'psu', specs: connectors ? { connectors } : {} })
const gpu = (specs) => ({ id: 'g', category: 'gpu', specs })

describe('rule 1: power connectors', () => {
  it('blocks a PSU that cannot feed the GPU', () => {
    const parts = { gpu: gpu({ powerConnectors: { pcie8: 3 } }) }
    const r = evaluateSpecRules(parts, psu({ pcie8: 2 }))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/8-pin/i)
  })

  it('passes a PSU that has enough', () => {
    const parts = { gpu: gpu({ powerConnectors: { pcie8: 3 } }) }
    expect(evaluateSpecRules(parts, psu({ pcie8: 4 })).status).toBe('ok')
  })

  // The RTX 4090 FE case: socket is 12VHPWR, but a 3x8-pin adapter is in the box.
  it('accepts a bundled adapter in place of a native cable', () => {
    const parts = { gpu: gpu({ powerConnectors: { '12vhpwr': 1 }, adapterFrom: { pcie8: 3 } }) }
    expect(evaluateSpecRules(parts, psu({ pcie8: 3 })).status).toBe('ok')
  })

  it('blocks when neither the native cable nor the adapter can be satisfied', () => {
    const parts = { gpu: gpu({ powerConnectors: { '12vhpwr': 1 }, adapterFrom: { pcie8: 3 } }) }
    expect(evaluateSpecRules(parts, psu({ pcie8: 2 })).status).toBe('blocked')
  })

  it('is unverified when the GPU lists no connectors', () => {
    const r = evaluateSpecRules({ gpu: gpu({}) }, psu({ pcie8: 4 }))
    expect(r.status).toBe('unverified')
  })

  it('is unverified when the PSU lists no connectors', () => {
    const r = evaluateSpecRules({ gpu: gpu({ powerConnectors: { pcie8: 3 } }) }, psu(null))
    expect(r.status).toBe('unverified')
  })

  // The CPU side of the same question: the board's EPS headers must be fed too.
  it('blocks a PSU with one EPS cable on a board needing two', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { epsConnectors: 2 } }
    const r = evaluateSpecRules({ motherboard: b }, psu({ eps8: 1 }))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/EPS/i)
  })

  it('passes a PSU with enough EPS cables', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { epsConnectors: 2 } }
    expect(evaluateSpecRules({ motherboard: b }, psu({ eps8: 2 })).status).toBe('ok')
  })

  it('is unverified when the board does not state its EPS headers', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: {} }
    expect(evaluateSpecRules({ motherboard: b }, psu({ eps8: 2 })).status).toBe('unverified')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/specRules.test.js`
Expected: FAIL — every case returns `ok`, because `RULES` is empty.

- [ ] **Step 3: Implement the rule**

Add to `src/lib/specRules.js`, above `const RULES = []`:

```js
const LABEL = { pcie8: '8-pin PCIe', pcie6: '6-pin PCIe', '12vhpwr': '16-pin 12VHPWR', eps8: '8-pin EPS' }

// Can `supply` satisfy every entry in `need`?
const covers = (supply, need) =>
  Object.entries(need).every(([type, count]) => (supply[type] ?? 0) >= count)

const missingFrom = (supply, need) =>
  Object.entries(need)
    .filter(([type, count]) => (supply[type] ?? 0) < count)
    .map(([type, count]) => `${count}x ${LABEL[type] ?? type}`)
    .join(', ')

// Rule 1. The PSU side and the GPU side are the same question asked from two
// directions, because either part can be the candidate.
function powerConnectors(selectedParts, candidate) {
  const psu = candidate.category === 'psu' ? candidate : selectedParts.psu
  const gpu = candidate.category === 'gpu' ? candidate : selectedParts.gpu
  if (!psu || !gpu) return null

  const need = gpu.specs?.powerConnectors
  const supply = psu.specs?.connectors
  if (!need) return { status: 'unverified', reason: `Power connectors for ${gpu.name ?? 'this GPU'} are not verified` }
  if (!supply) return { status: 'unverified', reason: `Connectors on ${psu.name ?? 'this PSU'} are not verified` }

  if (covers(supply, need)) return null

  // A bundled adapter is a legitimate second way to satisfy the card.
  const adapter = gpu.specs?.adapterFrom
  if (adapter && covers(supply, adapter)) return null

  return { status: 'blocked', reason: `PSU is missing ${missingFrom(supply, need)}` }
}
```

Add the CPU side as its own rule, because it pairs the PSU with the board rather
than with the GPU:

```js
// Rule 1b. The board's EPS headers. A supply that can run the graphics card and
// not the CPU is just as dead a build.
function epsConnectors(selectedParts, candidate) {
  const psu = candidate.category === 'psu' ? candidate : selectedParts.psu
  const board = candidate.category === 'motherboard' ? candidate : selectedParts.motherboard
  if (!psu || !board) return null

  const need = board.specs?.epsConnectors
  const supply = psu.specs?.connectors
  if (typeof need !== 'number') return { status: 'unverified', reason: `EPS headers on ${board.name ?? 'this motherboard'} are not verified` }
  if (!supply) return { status: 'unverified', reason: `Connectors on ${psu.name ?? 'this PSU'} are not verified` }

  if ((supply.eps8 ?? 0) >= need) return null
  return { status: 'blocked', reason: `Board needs ${need}x 8-pin EPS; PSU has ${supply.eps8 ?? 0}` }
}
```

Then set:

```js
const RULES = [powerConnectors, epsConnectors]
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/tests/specRules.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS. No catalogue part carries `powerConnectors` yet, so every real pairing reports `unverified`, which is `compatible: true` and therefore blocks nothing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/specRules.js src/tests/specRules.test.js
git commit -m "feat: check the PSU has the connectors the GPU needs, adapters included"
```

---

### Task 4: Rule 2 — a GPU must fit the case's expansion slots

**Files:**
- Modify: `src/lib/specRules.js`
- Test: `src/tests/specRules.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/specRules.test.js`:

```js
const box = (specs) => ({ id: 'c', category: 'case', specs })

describe('rule 2: GPU thickness', () => {
  it('blocks a 4-slot card in a case with 2 expansion slots', () => {
    const r = evaluateSpecRules({ case: box({ expansionSlots: 2 }) }, gpu({ slotsThick: 4 }))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/slot/i)
  })

  it('passes a 3-slot card in a 7-slot case', () => {
    expect(evaluateSpecRules({ case: box({ expansionSlots: 7 }) }, gpu({ slotsThick: 3 })).status).toBe('ok')
  })

  it('is unverified when the case does not state its slot count', () => {
    expect(evaluateSpecRules({ case: box({}) }, gpu({ slotsThick: 3 })).status).toBe('unverified')
  })

  it('is unverified when the GPU does not state its thickness', () => {
    expect(evaluateSpecRules({ case: box({ expansionSlots: 7 }) }, gpu({})).status).toBe('unverified')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/specRules.test.js`
Expected: FAIL — the blocking case returns `unverified` from rule 1 or `ok`.

- [ ] **Step 3: Implement the rule**

Add to `src/lib/specRules.js`:

```js
// Rule 2. Card thickness against the case's expansion-slot budget. This is the
// clearance that `maxGpuLength` does not cover: a 4-slot card can be short
// enough to fit lengthwise and still foul the bottom of the case.
function gpuThickness(selectedParts, candidate) {
  const pcCase = candidate.category === 'case' ? candidate : selectedParts.case
  const gpu = candidate.category === 'gpu' ? candidate : selectedParts.gpu
  if (!pcCase || !gpu) return null

  const thick = gpu.specs?.slotsThick
  const budget = pcCase.specs?.expansionSlots
  if (typeof thick !== 'number') return { status: 'unverified', reason: `Slot thickness for ${gpu.name ?? 'this GPU'} is not verified` }
  if (typeof budget !== 'number') return { status: 'unverified', reason: `Expansion slots on ${pcCase.name ?? 'this case'} are not verified` }

  if (thick <= budget) return null
  return { status: 'blocked', reason: `GPU needs ${thick} slots; case has ${budget}` }
}
```

Update the array:

```js
const RULES = [powerConnectors, epsConnectors, gpuThickness]
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/tests/specRules.test.js`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/specRules.js src/tests/specRules.test.js
git commit -m "feat: check a GPU's slot thickness against the case's expansion slots"
```

---

### Task 5: Rule 3 — an M.2 drive needs a slot that accepts it

**Files:**
- Modify: `src/lib/specRules.js`
- Test: `src/tests/specRules.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/specRules.test.js`:

```js
const board = (specs) => ({ id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs })
const drive = (specs) => ({ id: 's', category: 'storage', storageType: 'NVMe SSD', specs })

describe('rule 3: M.2 interface', () => {
  it('blocks a SATA M.2 drive when every slot is PCIe-only', () => {
    const b = board({ m2Slots: [{ pcieGen: 5, sata: false }, { pcieGen: 4, sata: false }] })
    const r = evaluateSpecRules({ motherboard: b }, drive({ m2FormFactor: '2280', m2Sata: true }))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/SATA/i)
  })

  it('passes a SATA M.2 drive when one slot accepts SATA', () => {
    const b = board({ m2Slots: [{ pcieGen: 5, sata: false }, { pcieGen: 4, sata: true }] })
    expect(evaluateSpecRules({ motherboard: b }, drive({ m2FormFactor: '2280', m2Sata: true })).status).toBe('ok')
  })

  it('blocks any M.2 drive on a board with no M.2 slots at all', () => {
    const r = evaluateSpecRules({ motherboard: board({ m2Slots: [] }) }, drive({ m2FormFactor: '2280', m2Sata: false }))
    expect(r.status).toBe('blocked')
  })

  it('is unverified when the board does not list its M.2 slots', () => {
    expect(evaluateSpecRules({ motherboard: board({}) }, drive({ m2FormFactor: '2280' })).status).toBe('unverified')
  })

  it('checks a 2.5in SATA drive against SATA ports, not M.2 slots', () => {
    const b = board({ m2Slots: [], sataPorts: 4 })
    const sata = { id: 's2', category: 'storage', storageType: 'SATA SSD', specs: {} }
    expect(evaluateSpecRules({ motherboard: b }, sata).status).toBe('ok')
  })

  it('blocks a 2.5in SATA drive on a board with no SATA ports', () => {
    const b = board({ m2Slots: [{ pcieGen: 5, sata: false }], sataPorts: 0 })
    const sata = { id: 's2', category: 'storage', storageType: 'SATA SSD', specs: {} }
    const r = evaluateSpecRules({ motherboard: b }, sata)
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/SATA port/i)
  })

  it('is unverified when the board does not state its SATA ports', () => {
    const b = board({ m2Slots: [] })
    const sata = { id: 's2', category: 'storage', storageType: 'SATA SSD', specs: {} }
    expect(evaluateSpecRules({ motherboard: b }, sata).status).toBe('unverified')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/specRules.test.js`
Expected: FAIL — blocking cases return `ok`.

- [ ] **Step 3: Implement the rule**

Add to `src/lib/specRules.js`:

```js
// Rule 3. ⚠️ "Does ANY slot on this board accept this drive", NOT slot
// allocation. A build holds exactly one part per category, so there is never a
// second drive competing for a slot.
function m2Interface(selectedParts, candidate) {
  const board = candidate.category === 'motherboard' ? candidate : selectedParts.motherboard
  const storage = candidate.category === 'storage' ? candidate : selectedParts.storage
  if (!board || !storage) return null

  // A 2.5in SATA drive needs a SATA port, not an M.2 slot. Different question,
  // same rule, because both answer "can this board physically attach it".
  if (!/nvme|m\.2/i.test(storage.storageType ?? '')) {
    const ports = board.specs?.sataPorts
    if (typeof ports !== 'number') return { status: 'unverified', reason: `SATA ports on ${board.name ?? 'this motherboard'} are not verified` }
    if (ports > 0) return null
    return { status: 'blocked', reason: 'This board has no SATA ports' }
  }

  const slots = board.specs?.m2Slots
  if (!Array.isArray(slots)) return { status: 'unverified', reason: `M.2 slots on ${board.name ?? 'this motherboard'} are not verified` }

  const needsSata = storage.specs?.m2Sata === true
  const usable = slots.filter((s) => (needsSata ? s.sata === true : true))
  if (usable.length > 0) return null

  return {
    status: 'blocked',
    reason: needsSata
      ? 'This is a SATA M.2 drive; no M.2 slot on this board accepts SATA'
      : 'This board has no M.2 slot',
  }
}
```

Update the array:

```js
const RULES = [powerConnectors, epsConnectors, gpuThickness, m2Interface]
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/tests/specRules.test.js`
Expected: PASS, 26 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/specRules.js src/tests/specRules.test.js
git commit -m "feat: check an M.2 drive against the board's slot interfaces"
```

---

### Task 6: Rule 4 — an AIO radiator must fit a mount in the case

**Files:**
- Modify: `src/lib/specRules.js`
- Test: `src/tests/specRules.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/specRules.test.js`:

```js
const aio = (radiatorMm) => ({ id: 'k', category: 'cooler', sockets: ['AM5'], specs: { type: 'AIO', radiatorMm } })

describe('rule 4: radiator fit', () => {
  it('blocks a 420mm radiator in a case that tops out at 360', () => {
    const c = box({ radiatorSupport: { top: [240, 360], front: [240, 280] } })
    const r = evaluateSpecRules({ case: c }, aio(420))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/420/)
  })

  it('passes a 360mm radiator when a mount supports it', () => {
    const c = box({ radiatorSupport: { top: [240, 360], front: [240] } })
    expect(evaluateSpecRules({ case: c }, aio(360)).status).toBe('ok')
  })

  it('is unverified when the case does not state radiator support', () => {
    expect(evaluateSpecRules({ case: box({}) }, aio(360)).status).toBe('unverified')
  })

  it('is unverified when the AIO does not state its radiator size', () => {
    const c = box({ radiatorSupport: { top: [360] } })
    expect(evaluateSpecRules({ case: c }, aio(undefined)).status).toBe('unverified')
  })

  it('does not apply to an air cooler', () => {
    const air = { id: 'a', category: 'cooler', sockets: ['AM5'], specs: { type: 'Air', height: 165 } }
    expect(evaluateSpecRules({ case: box({ radiatorSupport: { top: [240] } }) }, air).status).toBe('ok')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/specRules.test.js`
Expected: FAIL — the 420mm case returns `ok`.

- [ ] **Step 3: Implement the rule**

Add to `src/lib/specRules.js`:

```js
// Rule 4. AIOs only — an air cooler is already governed by maxCoolerHeight in
// compatibility.js.
function radiatorFit(selectedParts, candidate) {
  const pcCase = candidate.category === 'case' ? candidate : selectedParts.case
  const cooler = candidate.category === 'cooler' ? candidate : selectedParts.cooler
  if (!pcCase || !cooler) return null
  if (cooler.specs?.type !== 'AIO') return null

  const size = cooler.specs?.radiatorMm
  const support = pcCase.specs?.radiatorSupport
  if (typeof size !== 'number') return { status: 'unverified', reason: `Radiator size for ${cooler.name ?? 'this cooler'} is not verified` }
  if (!support) return { status: 'unverified', reason: `Radiator support in ${pcCase.name ?? 'this case'} is not verified` }

  const fitsSomewhere = Object.values(support).some((sizes) => Array.isArray(sizes) && sizes.includes(size))
  if (fitsSomewhere) return null
  return { status: 'blocked', reason: `No mount in this case takes a ${size}mm radiator` }
}
```

Update the array:

```js
const RULES = [powerConnectors, epsConnectors, gpuThickness, m2Interface, radiatorFit]
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/tests/specRules.test.js`
Expected: PASS, 31 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/specRules.js src/tests/specRules.test.js
git commit -m "feat: check an AIO radiator against the case's mounts"
```

---

### Task 7: Rule 5 — RAM must fit the board's slots and capacity

**Files:**
- Modify: `src/lib/specRules.js`
- Test: `src/tests/specRules.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/specRules.test.js`:

```js
const kit = (capacityGb, sticks, speed) => ({
  id: 'r', category: 'ram', ramType: 'DDR5', capacityGb, speed, specs: { sticks },
})

describe('rule 5: RAM slots and capacity', () => {
  it('blocks a 4-stick kit on a 2-slot board', () => {
    const b = board({ ramSlots: 2, maxRamGb: 96 })
    const r = evaluateSpecRules({ motherboard: b }, kit(64, 4, 6000))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/slot/i)
  })

  it('blocks a kit larger than the board takes', () => {
    const b = board({ ramSlots: 4, maxRamGb: 64 })
    const r = evaluateSpecRules({ motherboard: b }, kit(128, 4, 6000))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/128|capacity/i)
  })

  it('passes a kit that fits both', () => {
    const b = board({ ramSlots: 4, maxRamGb: 192 })
    expect(evaluateSpecRules({ motherboard: b }, kit(64, 2, 6000)).status).toBe('ok')
  })

  it('is unverified when the board does not state its slots', () => {
    expect(evaluateSpecRules({ motherboard: board({}) }, kit(32, 2, 6000)).status).toBe('unverified')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/specRules.test.js`
Expected: FAIL — blocking cases return `ok`.

- [ ] **Step 3: Implement the rule**

Add to `src/lib/specRules.js`:

```js
// Rule 5. Speed is deliberately NOT here — a kit faster than the board's rated
// maximum still runs, at a lower speed or via XMP/EXPO. That is an advisory in
// buildWarnings, not a block.
function ramFit(selectedParts, candidate) {
  const board = candidate.category === 'motherboard' ? candidate : selectedParts.motherboard
  const ram = candidate.category === 'ram' ? candidate : selectedParts.ram
  if (!board || !ram) return null

  const slots = board.specs?.ramSlots
  const maxGb = board.specs?.maxRamGb
  if (typeof slots !== 'number') return { status: 'unverified', reason: `Memory slots on ${board.name ?? 'this motherboard'} are not verified` }

  const sticks = ram.specs?.sticks
  if (typeof sticks !== 'number') return { status: 'unverified', reason: `Stick count for ${ram.name ?? 'this kit'} is not verified` }

  if (sticks > slots) return { status: 'blocked', reason: `Kit has ${sticks} sticks; board has ${slots} slots` }

  if (typeof maxGb !== 'number') return { status: 'unverified', reason: `Maximum memory for ${board.name ?? 'this motherboard'} is not verified` }
  if (ram.capacityGb > maxGb) return { status: 'blocked', reason: `${ram.capacityGb}GB exceeds this board's ${maxGb}GB maximum` }

  return null
}
```

Update the array:

```js
const RULES = [powerConnectors, epsConnectors, gpuThickness, m2Interface, radiatorFit, ramFit]
```

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/specRules.js src/tests/specRules.test.js
git commit -m "feat: check a RAM kit against the board's slot count and capacity limit"
```

---

### Task 8: getLockedReasons must never lock on unverified

**Files:**
- Modify: `src/lib/compatibility.js`
- Test: `src/tests/compatibility.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/compatibility.test.js`:

```js
describe('getLockedReasons', () => {
  // ⚠️ If this ever fails, the catalogue has become unusable: no part carries
  // the researched specs yet, so locking on unverified would lock everything.
  it('locks on blocked but never on unverified', () => {
    const boardNoSlots = { ...mbAM5, specs: { ...mbAM5.specs } }
    const locked = getLockedReasons({ motherboard: boardNoSlots }, partsData)
    for (const part of partsData) {
      const { status } = checkCompatibility({ motherboard: boardNoSlots }, part)
      if (status === 'unverified') expect(locked[part.id]).toBeUndefined()
    }
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/tests/compatibility.test.js`
Expected: PASS already, because `getLockedReasons` tests `!compatible` and unverified sets `compatible: true`.

This test locks in behaviour that is currently correct by accident. If it fails, the derivation in Task 1 was wrong — fix that rather than this test.

- [ ] **Step 3: Make the intent explicit in the code**

In `src/lib/compatibility.js`, replace the body of `getLockedReasons` with:

```js
export function getLockedReasons(selectedParts, allParts) {
  const reasons = {}
  for (const part of allParts) {
    const { status, reason } = checkCompatibility(selectedParts, part)
    // ⚠️ 'blocked' ONLY. An unverified rule means we could not check, which is
    // not grounds for taking the part away from someone.
    if (status === 'blocked') reasons[part.id] = reason
  }
  return reasons
}
```

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compatibility.js src/tests/compatibility.test.js
git commit -m "fix: lock a part only when a rule blocks it, never when one could not run"
```

---

### Task 9: Rule 6 — warn when the cooler is rated below the CPU

**Files:**
- Modify: `src/lib/buildWarnings.js`
- Test: `src/tests/buildWarnings.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/buildWarnings.test.js`:

```js
describe('cooler thermal headroom', () => {
  it('warns when the cooler is rated below the CPU TDP', () => {
    const cpu = { id: 'c', category: 'cpu', socket: 'AM5', tdp: 170, specs: {} }
    const cooler = { id: 'k', category: 'cooler', sockets: ['AM5'], tdp: 5, specs: { type: 'Air', height: 150, ratedTdpW: 95 } }
    const w = getBuildWarnings({ cpu, cooler })
    expect(w.some((x) => x.level === 'warning' && /cooler/i.test(x.message))).toBe(true)
  })

  it('says nothing when the cooler is rated above the CPU TDP', () => {
    const cpu = { id: 'c', category: 'cpu', socket: 'AM5', tdp: 105, specs: {} }
    const cooler = { id: 'k', category: 'cooler', sockets: ['AM5'], tdp: 5, specs: { type: 'Air', height: 150, ratedTdpW: 250 } }
    const w = getBuildWarnings({ cpu, cooler })
    expect(w.some((x) => /rated for/i.test(x.message))).toBe(false)
  })

  // ⚠️ Most coolers publish no rating at all. Silence, not a warning.
  it('says nothing when the cooler publishes no rating', () => {
    const cpu = { id: 'c', category: 'cpu', socket: 'AM5', tdp: 170, specs: {} }
    const cooler = { id: 'k', category: 'cooler', sockets: ['AM5'], tdp: 5, specs: { type: 'Air', height: 150 } }
    const w = getBuildWarnings({ cpu, cooler })
    expect(w.some((x) => /rated for/i.test(x.message))).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/buildWarnings.test.js`
Expected: FAIL — the first case produces no cooler warning.

- [ ] **Step 3: Implement it**

In `src/lib/buildWarnings.js`, add after the "Add storage." line:

```js
  // Thermal, not physical, so this warns rather than blocking selection.
  // ⚠️ Only fires on a PUBLISHED rating. partSynergy.coolerCapacityW derives an
  // estimate from a ladder for the parts that have none; that estimate is not
  // firm enough to tell somebody their build is wrong.
  const rated = cooler?.specs?.ratedTdpW
  if (cpu && typeof rated === 'number' && typeof cpu.tdp === 'number' && rated < cpu.tdp) {
    warnings.push({
      level: 'warning',
      message: `Cooler is rated for ${rated}W; the ${cpu.name ?? 'CPU'} draws ${cpu.tdp}W.`,
    })
  }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/tests/buildWarnings.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/buildWarnings.js src/tests/buildWarnings.test.js
git commit -m "feat: warn when a cooler's published rating is below the CPU's TDP"
```

---

### Task 10: Rules 7 and 8 — advisories that never block

**Files:**
- Modify: `src/lib/buildWarnings.js`
- Modify: `src/components/BuildWarnings.jsx:18`
- Test: `src/tests/buildWarnings.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/buildWarnings.test.js`:

```js
describe('advisories', () => {
  // ⚠️ PCIe is backward compatible. Blocking here would invent an
  // incompatibility that does not exist.
  it('notes a Gen5 GPU in a Gen4 board without warning or blocking', () => {
    const mb = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { pcieGen: 4 } }
    const gpu = { id: 'g', category: 'gpu', tdp: 300, specs: { pcieGen: 5 } }
    const w = getBuildWarnings({ motherboard: mb, gpu })
    const note = w.find((x) => /PCIe/i.test(x.message))
    expect(note).toBeDefined()
    expect(note.level).toBe('note')
  })

  it('notes RAM faster than the board is rated for', () => {
    const mb = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { maxRamSpeed: 5600 } }
    const ram = { id: 'r', category: 'ram', ramType: 'DDR5', speed: 8000, capacityGb: 32, specs: { sticks: 2 } }
    const w = getBuildWarnings({ motherboard: mb, ram })
    expect(w.find((x) => /8000/.test(x.message))?.level).toBe('note')
  })

  it('sorts notes below warnings and criticals', () => {
    const mb = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { pcieGen: 4 } }
    const gpu = { id: 'g', category: 'gpu', tdp: 300, specs: { pcieGen: 5 } }
    const w = getBuildWarnings({ motherboard: mb, gpu })
    const levels = w.map((x) => x.level)
    expect(levels.indexOf('note')).toBe(levels.length - 1)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/buildWarnings.test.js`
Expected: FAIL — no note is produced.

- [ ] **Step 3: Implement it**

In `src/lib/buildWarnings.js`, change the rank table:

```js
// 'note' is informational only — a thing that is true and worth knowing, and
// which is NOT a problem. It sorts last so it never crowds out a real warning.
const RANK = { critical: 0, warning: 1, note: 2 }
```

Add before the `return`:

```js
  // ⚠️ Both of these are BACKWARD COMPATIBLE. A Gen5 card in a Gen4 slot runs at
  // Gen4 and is completely fine; saying otherwise would be inventing a fault.
  const boardGen = motherboard?.specs?.pcieGen
  const gpuGen = gpu?.specs?.pcieGen
  if (typeof boardGen === 'number' && typeof gpuGen === 'number' && gpuGen > boardGen) {
    warnings.push({
      level: 'note',
      message: `GPU supports PCIe ${gpuGen}; this board runs it at PCIe ${boardGen}. It works, with a little less bandwidth.`,
    })
  }

  const maxSpeed = motherboard?.specs?.maxRamSpeed
  if (typeof maxSpeed === 'number' && typeof ram?.speed === 'number' && ram.speed > maxSpeed) {
    warnings.push({
      level: 'note',
      message: `RAM is rated ${ram.speed} MT/s; this board is rated to ${maxSpeed}. It will run slower unless the board's own profile supports it.`,
    })
  }
```

- [ ] **Step 4: Give the note its own dot**

In `src/components/BuildWarnings.jsx`, line 18, replace the binary ternary:

```jsx
            <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${w.level === 'critical' ? 'bg-bad' : w.level === 'note' ? 'bg-steel' : 'bg-ok'}`} />
```

⚠️ `bg-steel`, with **no** opacity modifier. `tokenOpacity.test.js` fails the build for `bg-steel/60`, which emits no CSS at all.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/buildWarnings.js src/components/BuildWarnings.jsx src/tests/buildWarnings.test.js
git commit -m "feat: note backward-compatible PCIe and RAM-speed mismatches without warning"
```

---

### Task 11: The provenance file and its drift guard

**Files:**
- Create: `data/partSources.json`
- Create: `src/tests/partSources.test.js`

- [ ] **Step 1: Create the file with one real, verified entry**

Create `data/partSources.json`. The RTX 4090 figures below were read from NVIDIA's official page on 2026-08-27:

```json
{
  "_README": "Provenance for researched hardware specs. Build/authoring input ONLY - never imported by src/, so it never reaches the browser. Same rule as data/benchmarks/. Keyed part id -> spec key -> {url, checkedOn}.",
  "gpu-rtx-4090": {
    "slotsThick": { "url": "https://www.nvidia.com/en-gb/geforce/graphics-cards/40-series/rtx-4090/", "checkedOn": "2026-08-27" },
    "pcieGen": { "url": "https://www.nvidia.com/en-gb/geforce/graphics-cards/40-series/rtx-4090/", "checkedOn": "2026-08-27" },
    "powerConnectors": { "url": "https://www.nvidia.com/en-gb/geforce/graphics-cards/40-series/rtx-4090/", "checkedOn": "2026-08-27" },
    "adapterFrom": { "url": "https://www.nvidia.com/en-gb/geforce/graphics-cards/40-series/rtx-4090/", "checkedOn": "2026-08-27" }
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `src/tests/partSources.test.js`:

```js
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'

const sources = JSON.parse(readFileSync(resolve(process.cwd(), 'data/partSources.json'), 'utf8'))

// Every spec added under the research standard. A spec listed here MUST carry a
// source; the plain fields that predate the standard are exempt because they
// have not been verified yet - see the follow-on task in the design doc.
const RESEARCHED_KEYS = [
  'slotsThick', 'pcieGen', 'powerConnectors', 'adapterFrom',
  'ramSlots', 'maxRamGb', 'maxRamSpeed', 'epsConnectors', 'sataPorts', 'm2Slots',
  'expansionSlots', 'radiatorSupport',
  'ratedTdpW', 'radiatorMm',
  'connectors', 'formFactor',
  'm2FormFactor', 'm2Sata',
]

describe('partSources.json', () => {
  it('has a source for every researched spec on every part', () => {
    const missing = []
    for (const part of partsData) {
      for (const key of RESEARCHED_KEYS) {
        if (part.specs?.[key] === undefined) continue
        if (!sources[part.id]?.[key]) missing.push(`${part.id}.${key}`)
      }
    }
    expect(missing, `specs with no recorded source:\n${missing.join('\n')}`).toEqual([])
  })

  it('gives every source a URL and an ISO date', () => {
    for (const [partId, specs] of Object.entries(sources)) {
      if (partId.startsWith('_')) continue
      for (const [key, entry] of Object.entries(specs)) {
        expect(entry.url, `${partId}.${key}`).toMatch(/^https:\/\//)
        expect(entry.checkedOn, `${partId}.${key}`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  // ⚠️ This file must never ship. partsData.json already costs every visitor
  // 163 kB; provenance URLs are for us, not for them.
  it('is not imported anywhere in src/', () => {
    const walk = (dir) => {
      const { readdirSync, statSync } = require('node:fs')
      return readdirSync(dir).flatMap((f) => {
        const p = resolve(dir, f)
        return statSync(p).isDirectory() ? walk(p) : [p]
      })
    }
    const offenders = walk(resolve(process.cwd(), 'src'))
      .filter((f) => /\.(js|jsx)$/.test(f))
      .filter((f) => !f.endsWith('partSources.test.js'))
      .filter((f) => readFileSync(f, 'utf8').includes('partSources.json'))
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 3: Run it**

Run: `npx vitest run src/tests/partSources.test.js`
Expected: PASS, 3 tests. No part carries a researched spec yet, so the first test passes vacuously — that is correct, and it starts failing the moment somebody adds a spec without a source.

- [ ] **Step 4: Prove the guard actually bites**

Temporarily add `"slotsThick": 3` to the `gpu-rtx-4080` entry in `src/data/partsData.json`, then run the test again.

Expected: FAIL, listing `gpu-rtx-4080.slotsThick`.

Remove the temporary edit and re-run. Expected: PASS.

⚠️ Do not skip this step. A vacuously-passing guard is worth nothing, and this one starts out vacuous by design.

- [ ] **Step 5: Commit**

```bash
git add data/partSources.json src/tests/partSources.test.js
git commit -m "feat: record spec provenance in a file that never reaches the browser"
```

---

### Task 12: Final verification

**Files:** none

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: exit 0, no output beyond the banner.

- [ ] **Step 2: Full unit suite**

Run: `npx vitest run`
Expected: PASS. Test count should be 1479 plus roughly 40 new ones.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `built in ...` then `apply-prerender: wrote 7 pre-rendered pages into dist/`.

- [ ] **Step 4: Confirm the provenance file did not reach the browser**

Run: `grep -rl "partSources" dist/ || echo "NOT SHIPPED - correct"`
Expected: `NOT SHIPPED - correct`

This is the assertion that matters. `partsData.json` already costs every visitor
163 kB; provenance URLs are authoring data and must never be added to that.

- [ ] **Step 5: e2e**

Run: `npm run test:e2e`
Expected: 101 passed.

⚠️ Never set `PORT` when running Playwright here. `playwright.config.js` declares `webServer` as an array and starts every entry regardless of `--project`; setting `PORT` binds one server to the wrong port and the run times out after 120s with a successful build logged above it.

- [ ] **Step 6: Both drift checks**

⚠️ Stop any running preview server first — `scripts/prerender.mjs` starts its own on 4183 and dies with "Port 4183 is already in use", which reads exactly like drift and is not.

```bash
npm run sitemap && git diff --exit-code -- public/sitemap.xml
npm run prerender && git diff --exit-code -- prerendered/
```

Expected: both exit 0.

- [ ] **Step 7: Commit anything the drift checks regenerated**

Only if a diff appeared:

```bash
git add public/sitemap.xml prerendered/
git commit -m "chore: re-capture generated artefacts"
```

---

## What this plan deliberately does NOT do

- **CPU ↔ chipset/BIOS compatibility.** Deferred by decision: it needs a per-board CPU support list with minimum BIOS versions, which goes stale with every BIOS release.
- **Any research into the 559 existing parts.** Every new rule reports `unverified` for all of them until the follow-on task runs. That is the designed behaviour, not an omission.
- **Correcting `gpu-rtx-4090`'s wrong `length` (336mm; NVIDIA's card is 304mm).** The user asked for existing-data correction to be handled separately. It is recorded in the design doc's follow-on section.

## Follow-on

A separate spec and plan for verifying the whole catalogue to the research standard, sequenced GPUs → PSUs and cases → motherboards → the rest, covering the existing `length` / `tdp` / `socket` values as well as the new fields.
