# Case Catalogue Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 59 catalogue cases up to the component research standard — `expansionSlots` and `radiatorSupport` added, `maxGpuLength` / `maxCoolerHeight` / `supportedFormFactors` re-verified — each with a recorded source, then switch the case ratchet on.

**Architecture:** One preparatory code task makes the provenance ratchet per-category and teaches the coverage report about cases. Seven data tranches then research the catalogue brand by brand, each a single commit with the full suite green. A final task switches the ratchet on so no future case can regress.

**Tech Stack:** Node 22 ESM scripts, Vitest, JSON data files (`src/data/partsData.json`, `data/partSources.json`), the in-app Browser MCP for reading manufacturer pages.

---

## Required reading before Task 1

- `docs/superpowers/specs/2026-08-30-case-catalogue-research-design.md` — the spec this implements. The Decisions table is binding.
- `docs/superpowers/specs/2026-08-27-component-spec-schema-and-compatibility-design.md` — the schema these fields belong to.
- `src/lib/specRules.js` — rules 2 and 4 are the consumers. Read `gpuThickness` and `radiatorFit`.

## File structure

| file | responsibility | change |
|---|---|---|
| `scripts/catalog-coverage-core.mjs` | pure coverage + ratchet rules, I/O-free so it can be unit-tested | **Modify** — add `EXPECTED.case`, `RATCHETED_KEYS` map, `missingRatchetSources()` |
| `src/tests/catalogCoverage.test.js` | unit tests for the pure core | **Modify** — tests for the case expectations and the ratchet helper |
| `src/tests/partSources.test.js` | provenance guards over the real data | **Modify** — ratchet test becomes a thin caller of the helper |
| `src/data/partsData.json` | the catalogue | **Modify** — 59 case rows gain two spec fields; some top-level values corrected |
| `data/partSources.json` | provenance, authoring-only, never bundled | **Modify** — 5 entries per case |

⚠️ `data/partSources.json` must never be imported from `src/` outside `src/tests/`. A test greps for this. Do not "helpfully" wire it into the app.

---

## Research protocol R

**Every row in Tasks 2–8 follows this exact protocol. It is defined once here and referenced by name; do not improvise a shortcut.**

For each case id:

1. **Open the maker's own product or spec page** for that exact model. Use the in-app Browser: `preview_start {url: "<page>"}` then `javascript_tool` to read the DOM, or `get_page_text`. ⚠️ `WebFetch` fails on several vendor sites — do not conclude a spec is unpublished because `WebFetch` returned nothing.
2. **Read five values off the page:**
   - `maxGpuLength` — the maker's stated maximum GPU/VGA clearance, **unobstructed**. If the page gives a second, smaller figure for "with front radiator/fans", the field takes the **larger, unobstructed** number and the smaller one goes in that entry's `note`.
   - `maxCoolerHeight` — maximum CPU cooler height.
   - `supportedFormFactors` — the board sizes the maker lists, mapped to the catalogue's vocabulary: `"ATX"`, `"mATX"`, `"ITX"`. ⚠️ Drop anything outside that set (E-ATX, SSI-EEB); no catalogue board uses them, and adding a fourth token would change nothing but risk a mismatch in `compatibility.js`.
   - `expansionSlots` — the number of rear expansion slots (integer).
   - `radiatorSupport` — an object keyed by the maker's own mount names, each an array of radiator sizes in mm.
3. **Cross-check the two clearance numbers** against one reliable secondary source (a review with measurements, or PCPartPicker). PCPartPicker is **never** the source of truth.
4. **Write the values** into `src/data/partsData.json` and a source entry per field into `data/partSources.json`.
5. **If the maker does not publish a figure**, record it as unverifiable and **remove the field** if present:
   ```json
   { "checkedOn": "2026-08-30", "result": "unverifiable", "note": "Fractal publishes no rear slot count for this model; not stated on the spec tab or in the manual" }
   ```
   An unverifiable entry must have `checkedOn` and a non-empty `note`, and must **not** carry a `url` — the test enforces all three. ⚠️ Deleting a top-level field has downstream reach: a missing `maxGpuLength` makes `partPages.js` and `partQuality.js` fall back to `?? 0`. Check the rendered copy for that case before committing.
6. **Where a re-verified number disagrees with what is there**, change it, and name the old value in the commit message.

### The shape a finished case takes

⚠️ **SHAPE ONLY — every number below is illustrative. Never copy these values into the catalogue; they must come from the maker's page.**

In `src/data/partsData.json`:

```json
{
  "id": "case-example",
  "category": "case",
  "name": "Example Tower",
  "brand": "Example",
  "price": 99.99,
  "supportedFormFactors": ["ATX", "mATX", "ITX"],
  "maxGpuLength": 400,
  "maxCoolerHeight": 170,
  "tdp": 0,
  "specs": {
    "type": "Mid Tower",
    "expansionSlots": 7,
    "radiatorSupport": { "top": [120, 240, 280], "front": [120, 240, 280, 360], "rear": [120] }
  }
}
```

In `data/partSources.json`:

```json
"case-example": {
  "maxGpuLength": { "url": "https://example.com/tower/spec", "checkedOn": "2026-08-30", "note": "395 mm with a front radiator fitted" },
  "maxCoolerHeight": { "url": "https://example.com/tower/spec", "checkedOn": "2026-08-30" },
  "supportedFormFactors": { "url": "https://example.com/tower/spec", "checkedOn": "2026-08-30" },
  "expansionSlots": { "url": "https://example.com/tower/spec", "checkedOn": "2026-08-30" },
  "radiatorSupport": { "url": "https://example.com/tower/spec", "checkedOn": "2026-08-30" }
}
```

⚠️ `tdp: 0` stays exactly as it is on every case. It means "draws nothing", it is not researched, and it must never get a source entry.

---

### Task 1: Make the ratchet per-category and teach coverage about cases

**Files:**
- Modify: `scripts/catalog-coverage-core.mjs:12-17`
- Modify: `src/tests/catalogCoverage.test.js`
- Modify: `src/tests/partSources.test.js:134-147`

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/catalogCoverage.test.js`:

```js
import { coverageFor, EXPECTED, RATCHETED_KEYS, missingRatchetSources } from '../../scripts/catalog-coverage-core.mjs'

const pcCase = (id, fields = {}, specs = {}) => ({ id, category: 'case', tdp: 0, ...fields, specs })

describe('case expectations', () => {
  it('expects the five fields the compatibility engine actually reads', () => {
    expect(EXPECTED.case.required).toEqual([
      'maxGpuLength', 'maxCoolerHeight', 'supportedFormFactors', 'expansionSlots', 'radiatorSupport',
    ])
    expect(EXPECTED.case.optional).toEqual([])
  })

  it('counts a fully sourced case as verified', () => {
    const part = pcCase('c',
      { maxGpuLength: 400, maxCoolerHeight: 170, supportedFormFactors: ['ATX'] },
      { expansionSlots: 7, radiatorSupport: { top: [240] } })
    const sources = { c: Object.fromEntries(EXPECTED.case.required.map((k) => [k, src()])) }
    expect(coverageFor('case', [part], sources).verified).toBe(1)
  })
})

describe('the ratchet', () => {
  // ⚠️ THE TRAP THIS ENCODES: every case carries `tdp: 0`, meaning "draws
  // nothing". It is a sentinel, not a researched figure. The old global
  // ['length','tdp'] would have demanded a source for 59 zeros.
  it('never demands a source for a case tdp', () => {
    const part = pcCase('c', { maxGpuLength: 400, maxCoolerHeight: 170, supportedFormFactors: ['ATX'] })
    const sources = {
      c: { maxGpuLength: src(), maxCoolerHeight: src(), supportedFormFactors: src() },
    }
    expect(missingRatchetSources([part], sources, new Set(['case']))).toEqual([])
  })

  it('reports a case field that carries no source', () => {
    const part = pcCase('c', { maxGpuLength: 400, maxCoolerHeight: 170, supportedFormFactors: ['ATX'] })
    expect(missingRatchetSources([part], {}, new Set(['case']))).toEqual([
      'c.maxGpuLength', 'c.maxCoolerHeight', 'c.supportedFormFactors',
    ])
  })

  it('still demands length and tdp for a gpu', () => {
    const g = { id: 'g', category: 'gpu', length: 300, tdp: 200, specs: {} }
    expect(missingRatchetSources([g], {}, new Set(['gpu']))).toEqual(['g.length', 'g.tdp'])
  })

  it('ignores a category that is not yet verified', () => {
    const part = pcCase('c', { maxGpuLength: 400 })
    expect(missingRatchetSources([part], {}, new Set(['gpu']))).toEqual([])
  })

  it('ignores a field the part does not carry', () => {
    const part = pcCase('c', { maxGpuLength: 400 })
    const sources = { c: { maxGpuLength: src() } }
    expect(missingRatchetSources([part], sources, new Set(['case']))).toEqual([])
  })

  it('keeps gpu on length and tdp only', () => {
    expect(RATCHETED_KEYS.gpu).toEqual(['length', 'tdp'])
  })
})
```

⚠️ `src` and `describe`/`it`/`expect` are already imported at the top of this file; merge the import line rather than adding a duplicate.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: FAIL — `RATCHETED_KEYS` and `missingRatchetSources` are not exported, plus `EXPECTED.case` is undefined.

- [ ] **Step 3: Implement in the pure core**

In `scripts/catalog-coverage-core.mjs`, add to `EXPECTED` after the `gpu` entry:

```js
  // The five fields the compatibility engine reads off a case. Nothing here is
  // optional: unlike a GPU's adapterFrom, a case that omits one of these has a
  // gap, not a fact.
  case: {
    required: ['maxGpuLength', 'maxCoolerHeight', 'supportedFormFactors', 'expansionSlots', 'radiatorSupport'],
    optional: [],
  },
```

Then append to the same file:

```js
// Which top-level fields a category owes a source once it is ratcheted.
//
// ⚠️ PER-CATEGORY, and it must stay that way. A case carries `tdp: 0` meaning
// "draws nothing" — a sentinel nobody measured. The global ['length','tdp']
// this replaced would have demanded provenance for 59 such zeros.
export const RATCHETED_KEYS = {
  gpu: ['length', 'tdp'],
  case: ['maxGpuLength', 'maxCoolerHeight', 'supportedFormFactors'],
}

// Every "<id>.<field>" in a verified category that carries a value but no source.
export function missingRatchetSources(parts, sources, verifiedCategories) {
  const missing = []
  for (const part of parts) {
    if (!verifiedCategories.has(part.category)) continue
    for (const key of RATCHETED_KEYS[part.category] ?? []) {
      if (part[key] === undefined) continue
      if (!sources[part.id]?.[key]) missing.push(`${part.id}.${key}`)
    }
  }
  return missing
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: PASS, all cases green.

- [ ] **Step 5: Point the real-data ratchet at the helper**

Replace the `VERIFIED_CATEGORIES` / `RATCHETED_KEYS` block and the `verified categories` describe in `src/tests/partSources.test.js` with:

```js
// Switched on ONE CATEGORY AT A TIME, as each is brought up to standard.
// The keys each category owes live in catalog-coverage-core.mjs.
const VERIFIED_CATEGORIES = new Set(['gpu'])

describe('verified categories', () => {
  it('requires a source for every ratcheted field once a category is verified', () => {
    const missing = missingRatchetSources(partsData, sources, VERIFIED_CATEGORIES)
    expect(missing, `verified-category fields with no source:\n${missing.join('\n')}`).toEqual([])
  })
})
```

Add to the imports at the top of that file:

```js
import { missingRatchetSources } from '../../scripts/catalog-coverage-core.mjs'
```

- [ ] **Step 6: Run the full suite**

```bash
npm run test:run
```

Expected: PASS. The GPU ratchet must still be enforced — this step is the regression guard on the refactor.

- [ ] **Step 7: Confirm coverage now reports cases**

```bash
npm run catalog:coverage
```

Expected: a `case: 0/59 parts fully researched (0%)` section appears, with `expansionSlots` and `radiatorSupport` at `present 0/59` and the three top-level fields at `present 59/59  researched 0/59`.

- [ ] **Step 8: Commit**

```bash
git add scripts/catalog-coverage-core.mjs src/tests/catalogCoverage.test.js src/tests/partSources.test.js
git commit -m "feat: make the provenance ratchet per-category, and expect five fields of a case"
```

---

### Task 2: Fractal Design (10 rows) — PILOT, stops for review

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

Rows, with the values currently in the catalogue for comparison:

| id | current gpu / cooler / boards |
|---|---|
| `case-fractal-torrent` | 467 / 188 / ATX, mATX, ITX |
| `case-fractal-north` | 355 / 170 / ATX, mATX, ITX |
| `case-fractal-meshify-2` | 461 / 185 / ATX, mATX, ITX |
| `case-fractal-pop-air` | 405 / 170 / ATX, mATX, ITX |
| `case-fractal-terra` | 322 / 77 / ITX |
| `case-fractal-define-7` | 467 / 185 / ATX, mATX, ITX |
| `case-meshify-2-compact` | 341 / 169 / ATX, mATX, ITX |
| `case-fractal-north-xl` | 413 / 170 / ATX, mATX, ITX |
| `case-fractal-pop-mini-air` | 365 / 160 / mATX, ITX |
| `case-fractal-ridge` | 325 / 70 / ITX |

- [ ] **Step 1: Run protocol R for all ten rows**

Start at `https://www.fractal-design.com/products/cases/` and navigate to each model's Specifications tab. Fractal publishes a full clearance table per product, including radiator support per mount and rear slot count.

⚠️ `case-meshify-2-compact` is the odd id out — it has no `fractal` in the id but is a Fractal product. Do not skip it when grepping by id prefix.

- [ ] **Step 2: Verify the data shape before testing**

```bash
node -e "const a=require('./src/data/partsData.json');const s=require('./data/partSources.json');const ids=a.filter(p=>p.brand==='Fractal Design').map(p=>p.id);for(const id of ids){const p=a.find(x=>x.id===id);const e=s[id]||{};const need=['maxGpuLength','maxCoolerHeight','supportedFormFactors','expansionSlots','radiatorSupport'];const gaps=need.filter(k=>!e[k]);console.log((gaps.length?'GAP ':'ok  ')+id+(gaps.length?' missing source: '+gaps.join(','):''))}"
```

Expected: ten `ok` lines and no `GAP`.

- [ ] **Step 3: Run the full suite**

```bash
npm run test:run
```

Expected: PASS. A spec field added without a source fails `partSources.json > has a source for every researched spec on every part` by name.

- [ ] **Step 4: Check coverage moved**

```bash
npm run catalog:coverage
```

Expected: `case: 10/59 parts fully researched (17%)`.

- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the ten Fractal Design cases"
```

⚠️ Name any corrected value in the commit body, in the form `case-fractal-north maxGpuLength 355 -> 373 (Fractal spec tab)`.

- [ ] **Step 6: STOP for user review**

Report to the user: how many of the 50 re-verified values were wrong, any unverifiable records and why, and any case whose corrected clearance changes which GPUs fit. Do not start Task 3 until they respond.

---

### Task 3: Lian Li (10 rows)

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

| id | current gpu / cooler / boards |
|---|---|
| `case-lian-li-o11` | 426 / 167 / ATX, mATX, ITX |
| `case-lian-li-a4-h2o` | 322 / 67 / ITX |
| `case-lian-li-o11-mini` | 362 / 170 / ATX, mATX, ITX |
| `case-lianli-lancool-216` | 392 / 180 / ATX, mATX, ITX |
| `case-lianli-lancool-207` | 372 / 165 / ATX, mATX, ITX |
| `case-lianli-o11-evo-xl` | 460 / 167 / ATX, mATX, ITX |
| `case-lianli-o11-vision` | 455 / 167 / ATX, mATX, ITX |
| `case-lianli-lancool-217` | 392 / 180 / ATX, mATX, ITX |
| `case-lianli-lancool-3` | 435 / 187 / ATX, mATX, ITX |
| `case-lianli-q58` | 320 / 67 / ITX |

- [ ] **Step 1: Run protocol R for all ten rows**

Start at `https://lian-li.com/product-category/cases/`. ⚠️ Two id spellings are in use (`lian-li-` and `lianli-`); both are Lian Li and both are in this tranche.

⚠️ The O11 family lists board support including E-ATX. Per protocol R step 2, record only `ATX` / `mATX` / `ITX`.

- [ ] **Step 2: Verify the data shape before testing**

```bash
node -e "const a=require('./src/data/partsData.json');const s=require('./data/partSources.json');const ids=a.filter(p=>p.brand==='Lian Li').map(p=>p.id);for(const id of ids){const p=a.find(x=>x.id===id);const e=s[id]||{};const need=['maxGpuLength','maxCoolerHeight','supportedFormFactors','expansionSlots','radiatorSupport'];const gaps=need.filter(k=>!e[k]);console.log((gaps.length?'GAP ':'ok  ')+id+(gaps.length?' missing source: '+gaps.join(','):''))}"
```

Expected: ten `ok` lines and no `GAP`.

- [ ] **Step 3: Run the full suite**

```bash
npm run test:run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the ten Lian Li cases"
```

---

### Task 4: NZXT and HYTE (8 rows)

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

| id | current gpu / cooler / boards |
|---|---|
| `case-nzxt-h510` | 381 / 165 / ATX, mATX, ITX |
| `case-nzxt-h7-flow` | 400 / 185 / ATX, mATX, ITX |
| `case-nzxt-h9-flow` | 435 / 165 / ATX, mATX, ITX |
| `case-nzxt-h5-flow-2024` | 365 / 165 / ATX, mATX, ITX |
| `case-nzxt-h6-flow` | 365 / 163 / ATX, mATX, ITX |
| `case-nzxt-h5-elite` | 365 / 165 / ATX, mATX, ITX |
| `case-nzxt-h210` | 325 / 165 / ITX |
| `case-hyte-y60` | 375 / 160 / ATX, mATX, ITX |

- [ ] **Step 1: Run protocol R for all eight rows**

NZXT: `https://nzxt.com/collections/cases`. HYTE: `https://hyte.com/`.

⚠️ `case-nzxt-h5-flow-2024` is the **2024 revision**, a different case from the original H5 Flow with different clearances. Rule 4 of the standard — exact model, never the family. If the maker has retired the page for the revision being modelled, record the affected fields as `unverifiable` rather than substituting the current model's numbers.

⚠️ `case-nzxt-h210` is discontinued. If NZXT's page is gone, the manual PDF is still a manufacturer source; a review is a secondary, not a substitute.

- [ ] **Step 2: Verify the data shape before testing**

```bash
node -e "const a=require('./src/data/partsData.json');const s=require('./data/partSources.json');const ids=a.filter(p=>p.brand==='NZXT'||p.brand==='HYTE').map(p=>p.id);for(const id of ids){const e=s[id]||{};const need=['maxGpuLength','maxCoolerHeight','supportedFormFactors','expansionSlots','radiatorSupport'];const gaps=need.filter(k=>!e[k]);console.log((gaps.length?'GAP ':'ok  ')+id+(gaps.length?' missing source: '+gaps.join(','):''))}"
```

Expected: eight `ok` lines and no `GAP`. A field deliberately recorded as `unverifiable` counts as `ok` here — the entry exists.

- [ ] **Step 3: Run the full suite**

```bash
npm run test:run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the NZXT and HYTE cases"
```

---

### Task 5: Corsair (7 rows)

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

| id | current gpu / cooler / boards |
|---|---|
| `case-corsair-4000d` | 360 / 170 / ATX, mATX, ITX |
| `case-corsair-3000d` | 360 / 170 / ATX, mATX, ITX |
| `case-corsair-5000d` | 420 / 170 / ATX, mATX, ITX |
| `case-corsair-6500x` | 400 / 170 / ATX, mATX, ITX |
| `case-corsair-2500x` | 400 / 165 / mATX, ITX |
| `case-corsair-4000d-rs` | 360 / 170 / ATX, mATX, ITX |
| `case-corsair-icue-2500x` | 400 / 165 / mATX, ITX |

- [ ] **Step 1: Run protocol R for all seven rows**

Start at `https://www.corsair.com/us/en/c/pc-cases`.

⚠️ **This tranche holds the strongest lead in the spec.** Four of these sit at exactly 400 mm, including two micro towers (`case-corsair-2500x`, `case-corsair-icue-2500x`) that share the figure with a mid tower. Check each independently against Corsair's own spec tab; do not let one page's number stand in for the family.

⚠️ `case-corsair-2500x` and `case-corsair-icue-2500x` are genuinely different SKUs (the iCUE LINK variant ships different hardware). Research both pages separately even if the clearances turn out identical — an identical figure with two sources is a finding, a copied figure is not.

- [ ] **Step 2: Verify the data shape before testing**

```bash
node -e "const a=require('./src/data/partsData.json');const s=require('./data/partSources.json');const ids=a.filter(p=>p.brand==='Corsair'&&p.category==='case').map(p=>p.id);for(const id of ids){const e=s[id]||{};const need=['maxGpuLength','maxCoolerHeight','supportedFormFactors','expansionSlots','radiatorSupport'];const gaps=need.filter(k=>!e[k]);console.log((gaps.length?'GAP ':'ok  ')+id+(gaps.length?' missing source: '+gaps.join(','):''))}"
```

Expected: seven `ok` lines and no `GAP`. ⚠️ The `category==='case'` filter matters here — Corsair also makes PSUs and peripherals in this catalogue.

- [ ] **Step 3: Run the full suite**

```bash
npm run test:run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the seven Corsair cases"
```

---

### Task 6: Cooler Master (6 rows)

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

| id | current gpu / cooler / boards |
|---|---|
| `case-cm-q300l` | 270 / 159 / mATX, ITX |
| `case-cm-nr200` | 330 / 155 / ITX |
| `case-cm-nr200-max` | 336 / 155 / ITX |
| `case-cm-td500-mesh` | 410 / 165 / ATX, mATX, ITX |
| `case-cm-td300-mesh` | 344 / 159 / mATX, ITX |
| `case-cm-haf-500` | 410 / 165 / ATX, mATX, ITX |

- [ ] **Step 1: Run protocol R for all six rows**

Start at `https://www.coolermaster.com/en-global/products/?category=cases`.

⚠️ `case-cm-nr200` and `case-cm-nr200-max` are different products — the MAX ships with a bundled PSU and AIO and has different clearances. Two pages, two sets of figures.

⚠️ The NR200 family lists GPU clearance separately for the standard and tempered-glass side panels. Take the unobstructed maximum per protocol R and put the other figure in the `note`.

- [ ] **Step 2: Verify the data shape before testing**

```bash
node -e "const a=require('./src/data/partsData.json');const s=require('./data/partSources.json');const ids=a.filter(p=>p.brand==='Cooler Master'&&p.category==='case').map(p=>p.id);for(const id of ids){const e=s[id]||{};const need=['maxGpuLength','maxCoolerHeight','supportedFormFactors','expansionSlots','radiatorSupport'];const gaps=need.filter(k=>!e[k]);console.log((gaps.length?'GAP ':'ok  ')+id+(gaps.length?' missing source: '+gaps.join(','):''))}"
```

Expected: six `ok` lines and no `GAP`.

- [ ] **Step 3: Run the full suite**

```bash
npm run test:run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the six Cooler Master cases"
```

---

### Task 7: Phanteks (6 rows)

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

| id | current gpu / cooler / boards |
|---|---|
| `case-phanteks-g360a` | 400 / 162 / ATX, mATX, ITX |
| `case-phanteks-p400a` | 420 / 161 / ATX, mATX, ITX |
| `case-phanteks-nv5` | 435 / 185 / ATX, mATX, ITX |
| `case-phanteks-xt-pro-ultra` | 400 / 185 / ATX, mATX, ITX |
| `case-phanteks-g500a` | 435 / 190 / ATX, mATX, ITX |
| `case-phanteks-shift-2` | 335 / 82 / ITX |

- [ ] **Step 1: Run protocol R for all six rows**

Start at `https://phanteks.com/Enclosures.html`.

⚠️ `case-phanteks-shift-2` is a vertical ITX case; its 82 mm cooler limit is plausible but is exactly the kind of figure worth cross-checking, since a wrong value here silently blocks every tower cooler.

- [ ] **Step 2: Verify the data shape before testing**

```bash
node -e "const a=require('./src/data/partsData.json');const s=require('./data/partSources.json');const ids=a.filter(p=>p.brand==='Phanteks'&&p.category==='case').map(p=>p.id);for(const id of ids){const e=s[id]||{};const need=['maxGpuLength','maxCoolerHeight','supportedFormFactors','expansionSlots','radiatorSupport'];const gaps=need.filter(k=>!e[k]);console.log((gaps.length?'GAP ':'ok  ')+id+(gaps.length?' missing source: '+gaps.join(','):''))}"
```

Expected: six `ok` lines and no `GAP`.

- [ ] **Step 3: Run the full suite**

```bash
npm run test:run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the six Phanteks cases"
```

---

### Task 8: The tail — Montech, be quiet!, Thermaltake, Kolink, Aerocool, Antec (12 rows)

**Files:**
- Modify: `src/data/partsData.json`
- Modify: `data/partSources.json`

| id | current gpu / cooler / boards |
|---|---|
| `case-montech-air-903` | 400 / 176 / ATX, mATX, ITX |
| `case-montech-sky-two` | 400 / 168 / ATX, mATX, ITX |
| `case-montech-king-95-pro` | 400 / 173 / ATX, mATX, ITX |
| `case-montech-xr` | 400 / 175 / ATX, mATX, ITX |
| `case-bequiet-pb500` | 369 / 190 / ATX, mATX, ITX |
| `case-bequiet-silentbase-802` | 432 / 185 / ATX, mATX, ITX |
| `case-bequiet-pure-base-501` | 430 / 190 / ATX, mATX, ITX |
| `case-thermaltake-versa-h18` | 350 / 155 / mATX, ITX |
| `case-thermaltake-view-270` | 380 / 165 / ATX, mATX, ITX |
| `case-kolink-observatory-lite` | 330 / 160 / ATX, mATX, ITX |
| `case-aerocool-cylon` | 371 / 155 / ATX, mATX, ITX |
| `case-antec-c8` | 450 / 175 / ATX, mATX, ITX |

- [ ] **Step 1: Run protocol R for all twelve rows**

Makers: `https://www.montechpc.com/`, `https://www.bequiet.com/en/case`, `https://www.thermaltake.com/`, `https://kolink.eu/`, `https://aerocool.io/`, `https://www.antec.com/`.

⚠️ **All four Montech cases sit at exactly 400 mm** — the largest single cluster in the catalogue, across four different models. Research each page independently.

⚠️ This tranche holds the budget and regional brands most likely to have thin or retired spec pages (Kolink and Aerocool especially). Expect the first `unverifiable` records of the project here. That is a result, not a failure — record it per protocol R step 5 with a note saying what was checked.

- [ ] **Step 2: Verify every remaining case is accounted for**

```bash
node -e "const a=require('./src/data/partsData.json');const s=require('./data/partSources.json');const need=['maxGpuLength','maxCoolerHeight','supportedFormFactors','expansionSlots','radiatorSupport'];let bad=0;for(const p of a.filter(x=>x.category==='case')){const e=s[p.id]||{};const gaps=need.filter(k=>!e[k]);if(gaps.length){bad++;console.log('GAP '+p.id+' '+gaps.join(','))}}console.log(bad===0?'all 59 cases have an entry for every field':bad+' case(s) incomplete')"
```

Expected: `all 59 cases have an entry for every field`.

- [ ] **Step 3: Run the full suite**

```bash
npm run test:run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the last twelve cases - the catalogue is now 59/59"
```

---

### Task 9: Switch the case ratchet on

**Files:**
- Modify: `src/tests/partSources.test.js`

- [ ] **Step 1: Confirm coverage is complete first**

```bash
npm run catalog:coverage
```

Expected: `case: 59/59 parts fully researched (100%)`. If it is not 59/59, stop — the ratchet must not be switched on over a gap.

- [ ] **Step 2: Add the category**

In `src/tests/partSources.test.js`:

```js
const VERIFIED_CATEGORIES = new Set(['gpu', 'case'])
```

- [ ] **Step 3: Run the full suite**

```bash
npm run test:run
```

Expected: PASS. If it fails, the named `<id>.<field>` in the output has a value with no source — fix the data, never the ratchet.

- [ ] **Step 4: Prove the ratchet is not vacuous**

Temporarily delete one source entry — say `case-fractal-north.maxGpuLength` — and re-run:

```bash
npm run test:run
```

Expected: FAIL, naming `case-fractal-north.maxGpuLength`. **Restore the entry** and re-run to confirm PASS. A guard nobody has seen fail is not known to work.

- [ ] **Step 5: Commit**

```bash
git add src/tests/partSources.test.js
git commit -m "feat: switch the case ratchet on - a case now owes a source for its clearances"
```

---

### Task 10: Refresh the pre-render and report

**Files:**
- Modify: `prerendered/` (generated)

- [ ] **Step 1: Rebuild the pre-rendered fragments**

```bash
npm run prerender
```

⚠️ Part-page copy quotes these numbers ("Up to 400 mm, so N of 79 cards fit"), and fragments go stale **silently**. ⚠️ A failed run leaves the folder untouched, so `git diff` showing nothing is not proof it ran — read the command's own output.

- [ ] **Step 2: Lint and build**

```bash
npm run lint && npm run build
```

Expected: both clean.

- [ ] **Step 3: Commit any fragment changes**

```bash
git add prerendered
git commit -m "chore: re-render part pages against the researched case data"
```

If `git diff --cached` is empty, skip the commit — no case copy changed.

- [ ] **Step 4: Report to the user, and stop**

Report:
- how many of the 177 re-verified values were wrong, with the largest correction named;
- any `unverifiable` records and what was checked;
- coverage now `case: 59/59`, and rule 2 (`gpuThickness`) live end to end;
- ⚠️ that rule 4 (`radiatorFit`) is still dark until the 22 AIOs carry a numeric `radiatorMm`.

🛑 **Do not push and do not run the catalogue push.** Both reach real users, and both are the user's to run:

```bash
npm run catalog:push
```

is the safe dry run that shows what would change. Offer it; do not run the `--apply` form.
