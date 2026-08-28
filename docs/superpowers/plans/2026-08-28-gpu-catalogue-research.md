# GPU catalogue research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 79 catalogue GPUs up to the research standard — every length, TDP, slot thickness, PCIe generation and power connector traced to a named manufacturer page, or deleted and recorded as unverifiable.

**Architecture:** Tooling first, data second. Provenance learns to record a *negative* result, so "researched, nothing published" is distinguishable from "not yet researched". A coverage report and a verdict-spread snapshot make progress and behaviour change visible. Then six tranches of research, gated by a user review after the first six cards. A per-category ratchet is switched on last, so the standard becomes enforceable exactly where it has been met.

**Tech Stack:** Node ESM scripts, Vitest, `WebFetch` / `WebSearch` for research. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-28-gpu-catalogue-research-design.md`

---

## Before you start: things that will bite you

- **`npx vite-node` is NOT installed locally.** It appears to work because npx fetches it from the registry. A committed script must never rely on it. Anything that needs to import `src/lib/*` (which uses extensionless imports node cannot resolve) has to run under Vitest.
- **Every field you add appears on the public info sheet.** `specSheetContent.specRows` prints every entry in `part.specs`. `specSheetNonScalar.test.js` will fail the build if a value renders as `[object Object]`.
- **`id` is frozen.** Changing one silently breaks shared build links (`buildCodec.js`), 41 `gpuId` references in `data/benchmarks/entries.json`, and `/parts/<id>` in the sitemap. Change `name` only.
- **TechPowerUp returns HTTP 403 to `WebFetch`.** Use a different secondary source; do not waste calls retrying it.
- **Tailwind tokens take no opacity modifier** — irrelevant here, but `tokenOpacity.test.js` will fail the build if you touch UI.
- Run one test file: `npx vitest run src/tests/<file>.test.js`. Full suite: `npx vitest run`. Lint: `npm run lint`.
- **Nothing reaches users until `npm run catalog:push -- --apply`**, which the user runs. Every tranche ends by saying how many rows are waiting.

## File structure

| File | Responsibility |
|---|---|
| `src/tests/partSources.test.js` **(modify)** | Learns the `unverifiable` record; gains the category ratchet |
| `data/partSources.json` **(modify)** | Gains `unverifiable` records and every researched source |
| `scripts/catalog-coverage-core.mjs` **(create)** | Pure: how much of a category is researched. No I/O |
| `scripts/catalog-coverage.mjs` **(create)** | CLI wrapper that reads the files and prints the table |
| `src/tests/catalogCoverage.test.js` **(create)** | Tests for the pure core |
| `src/tests/verdictSpread.test.js` **(create)** | Snapshots how many parts are ok / blocked / unverified |
| `src/data/partsData.json` **(modify)** | The researched figures, and the renames |

---

### Task 1: Provenance can record that a figure does not exist

The spec says an unverifiable figure is deleted. Nothing then distinguishes
"researched, nothing published" from "not yet researched", so the coverage report
cannot be trusted and those cards look permanently incomplete. Provenance needs a
negative result.

**Files:**
- Modify: `src/tests/partSources.test.js`
- Modify: `data/partSources.json`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/partSources.test.js`:

```js
// A researched figure that turns out not to be published anywhere is a RESULT,
// not an absence of work. Recording it is what lets the coverage report tell
// "we looked and there is nothing" apart from "nobody has looked yet", and it
// is the only way a legacy card whose page is gone can ever be counted as done.
describe('unverifiable records', () => {
  const unverifiable = (entry) => entry?.result === 'unverifiable'

  it('lets a source describe an absent field when the result is unverifiable', () => {
    const byId = new Map(partsData.map((p) => [p.id, p]))
    const orphans = []
    for (const [partId, specs] of Object.entries(sources)) {
      if (partId.startsWith('_')) continue
      const part = byId.get(partId)
      if (!part) continue
      for (const [key, entry] of Object.entries(specs)) {
        const present = part.specs?.[key] !== undefined || part[key] !== undefined
        if (!present && !unverifiable(entry)) orphans.push(`${partId}.${key}`)
      }
    }
    expect(orphans, `sources describing nothing:\n${orphans.join('\n')}`).toEqual([])
  })

  // ⚠️ An unverifiable record must carry a reason. "We could not find it" with
  // no explanation is indistinguishable from not having tried.
  it('requires a checkedOn date and a note, and forbids a bare url claim', () => {
    for (const [partId, specs] of Object.entries(sources)) {
      if (partId.startsWith('_')) continue
      for (const [key, entry] of Object.entries(specs)) {
        if (!unverifiable(entry)) continue
        expect(entry.checkedOn, `${partId}.${key}`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(String(entry.note ?? ''), `${partId}.${key} needs a note`).not.toBe('')
      }
    }
  })

  // The field must actually be gone. Recording "unverifiable" while leaving the
  // old guessed number in place is the worst of both worlds.
  it('refuses an unverifiable record for a field that is still present', () => {
    const byId = new Map(partsData.map((p) => [p.id, p]))
    const contradictions = []
    for (const [partId, specs] of Object.entries(sources)) {
      if (partId.startsWith('_')) continue
      const part = byId.get(partId)
      if (!part) continue
      for (const [key, entry] of Object.entries(specs)) {
        if (!unverifiable(entry)) continue
        const present = part.specs?.[key] !== undefined || part[key] !== undefined
        if (present) contradictions.push(`${partId}.${key}`)
      }
    }
    expect(contradictions, `marked unverifiable but still carrying a value:\n${contradictions.join('\n')}`).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and watch the first test fail**

Run: `npx vitest run src/tests/partSources.test.js`

Expected: the existing `has no provenance entry for an absent field` test and the
new one both pass (nothing is unverifiable yet), so **the suite is green**. That
is correct and expected — these tests are vacuous until Step 3 proves otherwise.

- [ ] **Step 3: Prove the new tests actually bite**

Temporarily add this to `data/partSources.json`, inside the top-level object:

```json
  "gpu-gtx-1650": {
    "length": { "checkedOn": "2026-08-28", "result": "unverifiable" }
  },
```

Run: `npx vitest run src/tests/partSources.test.js`

Expected: **FAIL** on `gpu-gtx-1650.length needs a note`, and **FAIL** on
`marked unverifiable but still carrying a value` (the card still has
`length: 229`).

⚠️ Do not skip this. Both new guards start vacuous, and a vacuous guard is worth
nothing.

- [ ] **Step 4: Remove the temporary entry and re-run**

Delete the `gpu-gtx-1650` block you just added.

Run: `npx vitest run src/tests/partSources.test.js`
Expected: PASS.

- [ ] **Step 5: Replace the old orphan test with the new one**

The original `has no provenance entry for an absent field` test is now a strict
subset of the new one and will contradict it the moment a real unverifiable
record lands. Delete the whole `describe('every recorded source describes a spec that exists', ...)`
block, keeping the new `describe('unverifiable records', ...)` block.

Run: `npx vitest run src/tests/partSources.test.js`
Expected: PASS.

- [ ] **Step 6: Document the shape in the file itself**

In `data/partSources.json`, replace the `_README` string with:

```
"Provenance for researched hardware specs. Build/authoring input ONLY - never imported by src/, so it never reaches the browser. Same rule as data/benchmarks/. Keyed part id -> spec key -> {url, checkedOn} for a verified figure, or {checkedOn, result: 'unverifiable', note} when the figure is not published anywhere and the field has been DELETED from partsData.json."
```

- [ ] **Step 7: Run the full suite and commit**

Run: `npx vitest run`
Expected: PASS.

```bash
git add src/tests/partSources.test.js data/partSources.json
git commit -m "test: let provenance record that a figure is not published anywhere"
```

---

### Task 2: The coverage core

**Files:**
- Create: `scripts/catalog-coverage-core.mjs`
- Create: `src/tests/catalogCoverage.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/catalogCoverage.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { coverageFor, EXPECTED } from '../../scripts/catalog-coverage-core.mjs'

const gpu = (id, fields = {}, specs = {}) => ({ id, category: 'gpu', ...fields, specs })
const src = (url = 'https://example.com/x') => ({ url, checkedOn: '2026-08-28' })

describe('catalogue coverage', () => {
  it('knows which fields a GPU is expected to carry', () => {
    expect(EXPECTED.gpu.required).toContain('length')
    expect(EXPECTED.gpu.required).toContain('slotsThick')
    // ⚠️ adapterFrom is OPTIONAL: most cards ship no adapter, and a missing one
    // is a fact about the card, not a gap in the research.
    expect(EXPECTED.gpu.optional).toContain('adapterFrom')
    expect(EXPECTED.gpu.required).not.toContain('adapterFrom')
  })

  it('counts a part with no sources as unverified', () => {
    const c = coverageFor('gpu', [gpu('a', { length: 300, tdp: 200 })], {})
    expect(c.total).toBe(1)
    expect(c.verified).toBe(0)
    expect(c.fields.length.present).toBe(1)
    expect(c.fields.length.sourced).toBe(0)
  })

  it('counts a fully sourced part as verified', () => {
    const part = gpu('a',
      { length: 300, tdp: 200 },
      { slotsThick: 3, pcieGen: 4, powerConnectors: { pcie8: 2 }, vram: 12, memType: 'GDDR6X' })
    const sources = { a: Object.fromEntries(EXPECTED.gpu.required.map((k) => [k, src()])) }
    expect(coverageFor('gpu', [part], sources).verified).toBe(1)
  })

  // The whole point of Task 1: a deliberately deleted field, recorded as
  // unverifiable, is DONE — not an outstanding gap.
  it('treats a field recorded as unverifiable as researched', () => {
    const part = gpu('a',
      { tdp: 200 },   // no length at all
      { slotsThick: 3, pcieGen: 4, powerConnectors: { pcie8: 2 }, vram: 12, memType: 'GDDR6X' })
    const sources = {
      a: {
        ...Object.fromEntries(EXPECTED.gpu.required.filter((k) => k !== 'length').map((k) => [k, src()])),
        length: { checkedOn: '2026-08-28', result: 'unverifiable', note: 'page retired' },
      },
    }
    expect(coverageFor('gpu', [part], sources).verified).toBe(1)
  })

  it('does not count a missing optional field against a part', () => {
    const part = gpu('a',
      { length: 300, tdp: 200 },
      { slotsThick: 3, pcieGen: 4, powerConnectors: { pcie8: 2 }, vram: 12, memType: 'GDDR6X' })
    const sources = { a: Object.fromEntries(EXPECTED.gpu.required.map((k) => [k, src()])) }
    expect(coverageFor('gpu', [part], sources).verified).toBe(1)
  })

  it('ignores parts of other categories', () => {
    const parts = [gpu('a', { length: 300, tdp: 200 }), { id: 'b', category: 'psu', specs: {} }]
    expect(coverageFor('gpu', parts, {}).total).toBe(1)
  })

  it('returns null for a category with no expectations yet', () => {
    expect(coverageFor('paste', [], {})).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/catalogCoverage.test.js`
Expected: FAIL — cannot resolve `../../scripts/catalog-coverage-core.mjs`.

- [ ] **Step 3: Write the core**

Create `scripts/catalog-coverage-core.mjs`:

```js
// How much of a category has actually been researched to the standard in
// docs/superpowers/specs/2026-08-27-component-spec-schema-and-compatibility-design.md
//
// Pure and I/O-free so it can be unit-tested, like catalog-diff-core.mjs.

// What each category is expected to carry once researched. Categories are added
// here as their research is specced — GPUs first.
//
// ⚠️ `optional` is for fields whose ABSENCE is itself a fact: most cards ship no
// power adapter, so a missing `adapterFrom` is not an outstanding gap.
export const EXPECTED = {
  gpu: {
    required: ['length', 'tdp', 'slotsThick', 'pcieGen', 'powerConnectors', 'vram', 'memType'],
    optional: ['adapterFrom'],
  },
}

const hasField = (part, key) =>
  part.specs?.[key] !== undefined || part[key] !== undefined

// A field counts as researched when it is present WITH a source, or absent and
// explicitly recorded as unpublished. Both are finished states.
const isResearched = (part, sources, key) => {
  const entry = sources[part.id]?.[key]
  if (!entry) return false
  if (entry.result === 'unverifiable') return !hasField(part, key)
  return hasField(part, key)
}

export function coverageFor(category, parts, sources) {
  const spec = EXPECTED[category]
  if (!spec) return null

  const rows = parts.filter((p) => p.category === category)
  const fields = {}
  for (const key of [...spec.required, ...spec.optional]) {
    let present = 0
    let sourced = 0
    for (const part of rows) {
      if (hasField(part, key)) present++
      if (isResearched(part, sources, key)) sourced++
    }
    fields[key] = { present, sourced, optional: spec.optional.includes(key) }
  }

  const verified = rows.filter((part) =>
    spec.required.every((key) => isResearched(part, sources, key))
  ).length

  return { category, total: rows.length, verified, fields }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/tests/catalogCoverage.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/catalog-coverage-core.mjs src/tests/catalogCoverage.test.js
git commit -m "feat: measure how much of a category is researched, counting unpublished as done"
```

---

### Task 3: The coverage CLI

**Files:**
- Create: `scripts/catalog-coverage.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the CLI**

Create `scripts/catalog-coverage.mjs`:

```js
// Prints how far the catalogue research has got.
//
//   npm run catalog:coverage
//
// Reads partsData.json and partSources.json, so it cannot drift from reality —
// there is no checklist for anybody to forget to update.
import { readFileSync } from 'node:fs'
import { EXPECTED, coverageFor } from './catalog-coverage-core.mjs'

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'))
const parts = read('src/data/partsData.json')
const sources = read('data/partSources.json')

for (const category of Object.keys(EXPECTED)) {
  const c = coverageFor(category, parts, sources)
  const pct = c.total === 0 ? 0 : Math.round((c.verified / c.total) * 100)
  console.log(`\n${category}: ${c.verified}/${c.total} parts fully researched (${pct}%)`)
  for (const [key, f] of Object.entries(c.fields)) {
    const tag = f.optional ? ' (optional)' : ''
    console.log(`  ${key.padEnd(16)} present ${String(f.present).padStart(3)}/${c.total}   researched ${String(f.sourced).padStart(3)}/${c.total}${tag}`)
  }
}
console.log('')
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `scripts`:

```json
    "catalog:coverage": "node scripts/catalog-coverage.mjs",
```

- [ ] **Step 3: Run it**

Run: `npm run catalog:coverage`

Expected: `gpu: 1/79 parts fully researched (1%)` or similar — the RTX 4090 is
partly done from `750ce88` but has no `tdp` source yet, so **0/79 or 1/79 are
both plausible**. Read the per-field lines to see which is which. Record the
starting numbers; every later tranche is measured against them.

- [ ] **Step 4: Commit**

```bash
git add scripts/catalog-coverage.mjs package.json
git commit -m "feat: report catalogue research coverage per category"
```

---

### Task 4: Snapshot how many parts are ok, blocked and unverified

The spec requires each tranche to report how many parts moved between verdicts,
so a behaviour change is visible rather than buried. A committed snapshot does
that with no new machinery: the movement shows up in `git diff`.

**Files:**
- Create: `src/tests/verdictSpread.test.js`

- [ ] **Step 1: Write the test**

Create `src/tests/verdictSpread.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { checkCompatibility } from '../lib/compatibility'
import partsData from '../data/partsData.json'

// Research changes what the app blocks. That is the point — but it should never
// change SILENTLY. This snapshots the verdict spread against a fixed reference
// build, so every tranche's effect on selectability shows up as a diff a human
// reads and approves, rather than something discovered by a user.
//
// ⚠️ It lives under Vitest rather than in a script because `src/lib` uses
// extensionless imports that plain node cannot resolve, and `vite-node` is NOT
// a local dependency — npx fetches it from the registry.
//
// To accept a change: `npx vitest run src/tests/verdictSpread.test.js -u`, then
// READ THE DIFF before committing it.
const REFERENCE_BUILD = {
  motherboard: partsData.find((p) => p.id === 'mb-asus-x670e'),
  cpu: partsData.find((p) => p.id === 'cpu-ryzen-7-7700x'),
  case: partsData.find((p) => p.id === 'case-fractal-torrent'),
  psu: partsData.find((p) => p.id === 'psu-corsair-rm1000x'),
}

describe('verdict spread', () => {
  it('matches the committed snapshot', () => {
    const spread = {}
    for (const part of partsData) {
      const { status } = checkCompatibility(REFERENCE_BUILD, part)
      spread[part.category] ??= { ok: 0, blocked: 0, unverified: 0 }
      spread[part.category][status]++
    }
    const ordered = Object.fromEntries(Object.entries(spread).sort(([a], [b]) => a.localeCompare(b)))
    expect(ordered).toMatchSnapshot()
  })

  // ⚠️ The load-bearing invariant, independent of the snapshot: an unverified
  // rule means we could not check, which is never grounds for taking a part
  // away from somebody.
  it('never lets an unverified verdict make a part incompatible', () => {
    for (const part of partsData) {
      const r = checkCompatibility(REFERENCE_BUILD, part)
      if (r.status === 'unverified') expect(r.compatible).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run it to create the snapshot**

Run: `npx vitest run src/tests/verdictSpread.test.js`
Expected: PASS, 2 tests, and a new file
`src/tests/__snapshots__/verdictSpread.test.js.snap`.

- [ ] **Step 3: Read the snapshot**

Open `src/tests/__snapshots__/verdictSpread.test.js.snap` and check the `gpu`
line looks sane — with a Torrent case (467mm clearance) selected, most GPUs
should be `ok` or `unverified`, and very few `blocked`.

If every GPU is `blocked`, something is wrong; stop and investigate rather than
committing the snapshot.

- [ ] **Step 4: Run the full suite and commit**

Run: `npx vitest run`
Expected: PASS.

```bash
git add src/tests/verdictSpread.test.js src/tests/__snapshots__/verdictSpread.test.js.snap
git commit -m "test: snapshot the verdict spread so research cannot change blocking silently"
```

---

### Task 5: The per-category provenance ratchet

**Files:**
- Modify: `src/tests/partSources.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/partSources.test.js`:

```js
// The guard above covers `specs.*` only, which is exactly how a wrong top-level
// `length` sat in the catalogue unnoticed for months. Requiring sources for
// length and tdp across all 559 parts today would fail instantly, so it is
// switched on ONE CATEGORY AT A TIME, as each is brought up to standard.
const VERIFIED_CATEGORIES = new Set([])
const RATCHETED_KEYS = ['length', 'tdp']

describe('verified categories', () => {
  it('requires a source for top-level length and tdp once a category is verified', () => {
    const missing = []
    for (const part of partsData) {
      if (!VERIFIED_CATEGORIES.has(part.category)) continue
      for (const key of RATCHETED_KEYS) {
        if (part[key] === undefined) continue
        if (!sources[part.id]?.[key]) missing.push(`${part.id}.${key}`)
      }
    }
    expect(missing, `verified-category fields with no source:\n${missing.join('\n')}`).toEqual([])
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/tests/partSources.test.js`
Expected: PASS — `VERIFIED_CATEGORIES` is empty, so the loop never runs.

- [ ] **Step 3: Prove the ratchet bites**

Temporarily change the set to `new Set(['gpu'])`.

Run: `npx vitest run src/tests/partSources.test.js`

Expected: **FAIL**, listing exactly **157** entries — 79 cards × `length` and
`tdp` is 158, less the RTX 4090's `length`, which is the only one sourced so far.
Every GPU currently has both fields defined, so none are exempt.

⚠️ Do not skip this. An empty allowlist makes this guard vacuous by
construction, and the whole point is that it will bite later.

- [ ] **Step 4: Put the set back to empty and re-run**

Restore `const VERIFIED_CATEGORIES = new Set([])`.

Run: `npx vitest run src/tests/partSources.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tests/partSources.test.js
git commit -m "test: add the per-category ratchet for top-level length and tdp"
```

---

### Task 6: Pilot — six cards, then STOP

Six cards chosen to hit every hard case once. If the convention is wrong, it is
wrong after six cards instead of seventy-nine.

| id | why it is in the pilot |
|---|---|
| `gpu-rtx-4090` | **Already done** at `750ce88` — the worked example. Only needs a `tdp` source added |
| `gpu-rtx-4070ti` | NVIDIA never made a Founders Edition → must be renamed to a partner card |
| `gpu-rtx-2060` | Legacy; the manufacturer page may be gone → likely the first `unverifiable` record |
| `gpu-rx-7900xtx` | AMD reference design exists → name unchanged |
| `gpu-rx-7600` | AMD made no reference card → must be renamed to a partner card |
| `gpu-intel-arc-a770` | Intel's own Limited Edition is the reference card |

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

- [ ] **Step 1: Research each card**

For each of the six, in order:

1. **Find the exact product page.**
   - NVIDIA reference: `https://www.nvidia.com/en-gb/geforce/graphics-cards/<series>/<model>/`
   - AMD reference: `https://www.amd.com/en/products/graphics/...`
   - Intel: `https://www.intel.com/content/www/us/en/products/sku/...`
   - Partner card: the maker's own page (ASUS, MSI, Gigabyte, Sapphire, PowerColor, XFX).
2. **Read these figures verbatim:** length (mm), slot thickness, board power / TGP
   (W), PCIe generation, power connectors, whether an adapter is in the box,
   VRAM (GB), memory type.
3. **Cross-check `length` and `tdp` against one reliable secondary.**
   ⚠️ TechPowerUp returns HTTP 403 to `WebFetch` — do not retry it. Use a review
   outlet instead (The FPS Review, Tom's Hardware, AnandTech archive).
4. **On disagreement, prefer the manufacturer** and say so in the note.
5. **If a figure is not published anywhere: DELETE the field** from
   `partsData.json` and write an `unverifiable` record. Never guess, never carry
   the old value forward.

- [ ] **Step 2: Record the result**

For a card with no reference design, change `name` and **leave `id` alone**:

```json
    "id": "gpu-rtx-4070ti",
    "name": "ASUS Dual GeForce RTX 4070 Ti OC",
```

Specs go in the shape the rules already read — this is the RTX 4090, already in
the file, as the worked example:

```json
    "length": 304,
    "specs": {
      "vram": 24,
      "memType": "GDDR6X",
      "slotsThick": 3,
      "pcieGen": 4,
      "powerConnectors": { "12vhpwr": 1 },
      "adapterFrom": { "pcie8": 3 }
    }
```

Provenance, one entry per field, in `data/partSources.json`:

```json
  "gpu-rtx-4070ti": {
    "length": { "url": "https://www.asus.com/…", "checkedOn": "2026-08-28" },
    "tdp": { "url": "https://www.asus.com/…", "checkedOn": "2026-08-28" }
  }
```

And for a figure that does not exist anywhere:

```json
  "gpu-rtx-2060": {
    "length": { "checkedOn": "2026-08-28", "result": "unverifiable", "note": "NVIDIA retired the RTX 2060 product page; no reference dimensions published" }
  }
```

⚠️ `adapterFrom` records that an adapter **ships in the box**. No adapter, no
field. It is not a fallback and not a guess.

- [ ] **Step 3: Run the guards**

Run: `npx vitest run`

Expected: PASS. If `partSources` fails, a source is missing or describes a field
you deleted without an `unverifiable` record. If `specSheetNonScalar` fails, a
spec value renders as `[object Object]` — a connector map needs to be an object
of counts, not an array.

- [ ] **Step 4: Look at what changed about blocking**

Run: `npx vitest run src/tests/verdictSpread.test.js`

If it fails, the snapshot moved. **Read the diff.** A handful of GPUs moving from
`unverified` to `ok` or `blocked` is expected. Every GPU becoming `blocked` is
not — investigate before accepting.

Accept with: `npx vitest run src/tests/verdictSpread.test.js -u`

- [ ] **Step 5: Check coverage**

Run: `npm run catalog:coverage`
Expected: `gpu: 6/79` (or fewer, if a card could not be fully researched).

- [ ] **Step 6: Commit**

```bash
git add src/data/partsData.json data/partSources.json src/tests/__snapshots__/verdictSpread.test.js.snap
git commit -m "data: research the pilot six GPUs to the standard"
```

- [ ] **Step 7: 🛑 STOP. Hand back to the user.**

Report, and wait for approval before starting Task 7:

- The six cards, each with its old and new `length` / `tdp`.
- Which cards were **renamed**, and to what.
- Any figure recorded as **unverifiable**, and why.
- The verdict-spread diff: how many parts moved, and in which direction.
- Coverage before and after.
- That **rows are waiting for `npm run catalog:push -- --apply`**, which is theirs to run.

⚠️ Do not begin Task 7 without that approval. The whole purpose of the pilot is
that a wrong convention is caught here.

---

### Task 7: Tranche 1 — NVIDIA, current, 27 cards

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

- [ ] **Step 1: List the tranche**

Run:

```bash
node -e "const d=require('./src/data/partsData.json');const s=require('./data/partSources.json');for(const p of d.filter(p=>p.category==='gpu'&&p.brand==='NVIDIA'&&!p.legacy)){if(!s[p.id])console.log(p.id+' | '+p.name+' | '+p.length+'mm | '+p.tdp+'W')}"
```

Expected: 27 cards (the 29 NVIDIA current, less the 2 done in the pilot).

- [ ] **Step 2: Research each card**

Follow exactly the procedure in Task 6 Step 1 — manufacturer page first, one
reliable secondary for `length` and `tdp`, exact SKU never product family, and a
rename to a named partner card wherever NVIDIA published no Founders Edition.
⚠️ TechPowerUp returns HTTP 403 to `WebFetch`; do not retry it.

Record results in the shape shown in Task 6 Step 2. Delete any figure that is
not published and write an `unverifiable` record carrying a note.

Work in batches of about 8 cards, committing each batch, so a mistake costs one
batch rather than the tranche.

- [ ] **Step 3: Run the guards**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Accept the verdict-spread change**

Run: `npx vitest run src/tests/verdictSpread.test.js`

Read the diff. Accept with `-u` only once you can explain the movement.

- [ ] **Step 5: Check coverage and commit**

Run: `npm run catalog:coverage`
Expected: `gpu: 33/79`.

```bash
git add src/data/partsData.json data/partSources.json src/tests/__snapshots__/verdictSpread.test.js.snap
git commit -m "data: research the current NVIDIA GPUs to the standard"
```

---

### Task 8: Tranche 2 — AMD, current, 21 cards

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

- [ ] **Step 1: List the tranche**

Run:

```bash
node -e "const d=require('./src/data/partsData.json');const s=require('./data/partSources.json');for(const p of d.filter(p=>p.category==='gpu'&&p.brand==='AMD'&&!p.legacy)){if(!s[p.id])console.log(p.id+' | '+p.name+' | '+p.length+'mm | '+p.tdp+'W')}"
```

Expected: 21 cards.

⚠️ **This tranche contains the 267mm bucket** — 19 AMD cards share that one
length today, spanning an RX 6500 XT to an RX 9070 XT. Expect nearly every value
here to change. AMD published reference designs for the flagship RX 6000/7000
cards but not for most mid-range SKUs, so expect many renames to Sapphire,
PowerColor or XFX cards.

- [ ] **Step 2: Research each card**

Follow exactly the procedure in Task 6 Step 1 — manufacturer page first, one
reliable secondary for `length` and `tdp`, exact SKU never product family, and a
rename to a named partner card wherever AMD published no reference design. ⚠️ **Change `name` only — `id` stays frozen**, or you silently break shared build links, 41 benchmark corpus references and the sitemap.
⚠️ **Change `name` only — `id` stays frozen**, or you silently break shared build links, 41 benchmark corpus references and the sitemap.
⚠️ TechPowerUp returns HTTP 403 to `WebFetch`; do not retry it.

Record results in the shape shown in Task 6 Step 2. Batches of about 8, commit
each batch.

- [ ] **Step 3: Run the guards**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Accept the verdict-spread change**

Run: `npx vitest run src/tests/verdictSpread.test.js`, read the diff, then `-u`.

- [ ] **Step 5: Check coverage and commit**

Run: `npm run catalog:coverage`
Expected: `gpu: 54/79`.

```bash
git add src/data/partsData.json data/partSources.json src/tests/__snapshots__/verdictSpread.test.js.snap
git commit -m "data: research the current AMD GPUs to the standard"
```

---

### Task 9: Tranche 3 — Intel Arc, 5 cards

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

- [ ] **Step 1: List the tranche**

Run:

```bash
node -e "const d=require('./src/data/partsData.json');const s=require('./data/partSources.json');for(const p of d.filter(p=>p.category==='gpu'&&p.brand==='Intel')){if(!s[p.id])console.log(p.id+' | '+p.name+' | '+p.length+'mm | '+p.tdp+'W')}"
```

Expected: 5 cards (6 Intel, less the A770 done in the pilot).

⚠️ `gpu-arc-a580` currently carries **267mm** — the AMD bucket value on an Intel
card, which is more evidence these numbers were never measured. Intel published
Limited Edition reference cards for the A770 and A750 only; the A380, A580 and
B-series are AIB-only and will need renaming.

- [ ] **Step 2: Research each card**

Follow exactly the procedure in Task 6 Step 1 — Intel's ARK product page first,
one reliable secondary for `length` and `tdp`, exact SKU never product family,
and a rename to a named partner card (ASRock, Sparkle, Acer Predator BiFrost)
wherever Intel published no reference card. ⚠️ **Change `name` only — `id` stays frozen**, or you silently break shared build links, 41 benchmark corpus references and the sitemap.
⚠️ TechPowerUp returns HTTP 403 to `WebFetch`; do not retry it.

⚠️ Intel ARK often gives no physical dimensions at all. Where it does not, the
partner card's page is the manufacturer page for that SKU — that is the point of
naming a specific card. If neither publishes it, delete the field and record it
as unverifiable.

- [ ] **Step 3: Run the guards**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Accept the verdict-spread change**

Run: `npx vitest run src/tests/verdictSpread.test.js`, read the diff, then `-u`.

- [ ] **Step 5: Check coverage and commit**

Run: `npm run catalog:coverage`
Expected: `gpu: 59/79`.

```bash
git add src/data/partsData.json data/partSources.json src/tests/__snapshots__/verdictSpread.test.js.snap
git commit -m "data: research the Intel Arc GPUs to the standard"
```

---

### Task 10: Tranche 4 — legacy, 20 cards

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

- [ ] **Step 1: List the tranche**

Run:

```bash
node -e "const d=require('./src/data/partsData.json');const s=require('./data/partSources.json');for(const p of d.filter(p=>p.category==='gpu'&&p.legacy)){if(!s[p.id])console.log(p.id+' | '+p.name+' | '+p.length+'mm | '+p.tdp+'W')}"
```

Expected: 20 cards (21 legacy, less the RTX 2060 done in the pilot).

- [ ] **Step 2: Check how many pages still exist BEFORE researching all 20**

Try the manufacturer page for the first **five** cards only.

⚠️ **If three or more of the five have no live manufacturer page, STOP and ask
the user.** The spec flagged this: if most legacy pages are gone, this tranche
mostly deletes fields, and whether that is the outcome they want is their call,
not yours. Report how many pages resolved and what deleting would do to the
verdict spread.

- [ ] **Step 3: Research each card**

Follow exactly the procedure in Task 6 Step 1 — manufacturer page first, one
reliable secondary for `length` and `tdp`, exact SKU never product family.
⚠️ TechPowerUp returns HTTP 403 to `WebFetch`; do not retry it.

Expect `unverifiable` records to be common here. That is a correct outcome, not
a failure: a deleted `length` makes the fit rule report `unverified`, which
blocks nothing, which is honest.

- [ ] **Step 4: Run the guards**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Accept the verdict-spread change**

Run: `npx vitest run src/tests/verdictSpread.test.js`, read the diff, then `-u`.

⚠️ Expect movement **towards** `unverified` in this tranche, unlike the others.
Deleting an unverifiable length means the app stops claiming it checked the fit.

- [ ] **Step 6: Check coverage and commit**

Run: `npm run catalog:coverage`
Expected: `gpu: 79/79`.

```bash
git add src/data/partsData.json data/partSources.json src/tests/__snapshots__/verdictSpread.test.js.snap
git commit -m "data: research the legacy GPUs to the standard"
```

---

### Task 11: Switch the ratchet on, and verify everything

**Files:**
- Modify: `src/tests/partSources.test.js`

- [ ] **Step 1: Add gpu to the allowlist**

In `src/tests/partSources.test.js`:

```js
// gpu joined 2026-08-28: every card researched to the standard, so its
// top-level length and tdp can no longer change without a recorded source.
const VERIFIED_CATEGORIES = new Set(['gpu'])
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/tests/partSources.test.js`

Expected: PASS. If it fails, the listed cards have a `length` or `tdp` with no
source — finish those before continuing. **Do not remove them from the
allowlist to make it pass.**

- [ ] **Step 3: Prove the ratchet is live**

⚠️ **Be clear about what this guard does and does not catch.** It requires a
source to EXIST for a field. It cannot tell whether the recorded number is
*right* — editing `length` from 304 to 999 while leaving the source in place
passes, and nothing automated will ever catch that. What it stops is a field
being added or changed *without anybody recording where it came from*, which is
the hole the wrong 4090 length came through.

So prove it the right way: temporarily delete the `length` entry from any GPU's
record in `data/partSources.json`, leaving the card's `length` in place.

Run: `npx vitest run src/tests/partSources.test.js`

Expected: **FAIL**, naming that card's `length`. Restore the entry and re-run;
expected PASS.

⚠️ Do not skip this. `VERIFIED_CATEGORIES` was empty from Task 5 until now, so
until this moment the guard has never actually run against anything.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 5: Full unit suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: `built in ...` then `apply-prerender: wrote 7 pre-rendered pages into dist/`.

- [ ] **Step 7: Confirm provenance still never ships**

Run: `grep -rl "partSources" dist/ || echo "NOT SHIPPED - correct"`
Expected: `NOT SHIPPED - correct`

- [ ] **Step 8: e2e**

Run: `npm run test:e2e`
Expected: 101 passed.

⚠️ Never set `PORT` when running Playwright here — `playwright.config.js`
declares `webServer` as an array and starts every entry regardless of
`--project`.

- [ ] **Step 9: Both drift checks**

⚠️ Stop any running preview server first, and **check the exit code, not just
the diff** — a failed prerender leaves `prerendered/` untouched, so `git diff`
reports "clean" when the check did not run at all.

```bash
npm run sitemap && git diff --exit-code -- public/sitemap.xml
npm run prerender && git diff --exit-code -- prerendered/
```

Expected: both exit 0.

- [ ] **Step 10: Report the drift waiting to ship**

Run: `npm run catalog:check`

Expected: exit 1, listing every researched GPU as changed. **This is correct** —
it is the whole catalogue waiting to reach users.

- [ ] **Step 11: Commit**

```bash
git add src/tests/partSources.test.js
git commit -m "test: switch on the provenance ratchet for GPUs"
```

- [ ] **Step 12: Hand back to the user**

Report: coverage `79/79`, the total verdict movement across all tranches, how
many cards were renamed, how many figures were recorded as unverifiable, and
that **`npm run catalog:push -- --apply` is theirs to run** — nothing reaches
users until it does.

---

## What this plan deliberately does NOT do

- **Push to Supabase.** It needs a service role key and writes to the database
  behind a live site. The user runs it.
- **Touch `perfScore` or `price`.** A curated ranking and a figure that is stale
  by nature; neither is a manufacturer spec.
- **Research any other category.** PSUs and cases are the natural next spec —
  they are the other half of the connector and clearance rules.
- **Re-check that a chosen partner card is still purchasable.** `checkedOn` is
  the only signal and nothing enforces freshness.
- **Decide whether `pcieGen` and `slotsThick` belong on the shopper's info
  sheet.** They render there now. Worth asking once the data is real.

## Follow-on

A spec and plan for PSUs and cases, which complete the connector rule (PSU
`connectors`) and the clearance rules (case `expansionSlots`, `radiatorSupport`).
Until those land, the GPU `powerConnectors` and `slotsThick` researched here
still report `unverified` in most builds, because the other side of each
comparison is missing.
