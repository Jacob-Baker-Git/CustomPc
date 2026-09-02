# Cooler catalogue research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 53 coolers up to the research standard, so rule 4 answers for every AIO and no part in the catalogue reports `unverified`.

**Architecture:** Three code changes bracket seven data tranches. Task 1 teaches the coverage core its first *conditional* category — an air cooler owes a height, an AIO owes a radiator size — and lands inert. Tasks 2–8 research 53 coolers against their makers' pages under protocol R, writing `src/data/partsData.json` and `data/partSources.json`. Task 9 deletes the unverified `specs.radiator` string and rewires the four production sites that read it. Task 10 switches the ratchet on.

**Tech Stack:** Node 22 ESM scripts, Vitest, ESLint, the in-app Browser (`mcp__Claude_Browser__*`) for research, `scripts/house-json.mjs` for every JSON write.

**Spec:** `docs/superpowers/specs/2026-09-02-cooler-catalogue-research-design.md`

---

## Before you start: things that will bite you

1. 🛑 **`WebFetch` is not enough and believing it was has already cost hours.** It cannot reach several vendor sites (empty body or 403). Drive the in-app Browser instead: `preview_start {url}`, then `get_page_text` or `javascript_tool`. A `WebFetch` that returns nothing is **not** evidence that a spec is unpublished.

2. 🛑 **Never write these JSON files with `JSON.stringify(obj, null, 2)`.** The repo inlines flat objects below a per-file depth and writes CRLF. Plain stringify reformats all 8310 lines and buries a nine-row change in a 3236-line diff. Use `scripts/house-json.mjs`, which proves a byte-for-byte round trip before it writes.

3. 🛑 **`radiatorMm` is already enforced.** It is in `RESEARCHED_KEYS` at `src/tests/partSources.test.js:16`. Writing it onto a part without a matching `data/partSources.json` entry fails the suite **today**, before any change in this plan.

4. ⚠️ **`height` and `type` must NOT be added to `RESEARCHED_KEYS` until Task 10.** All 53 rows carry them unsourced right now, so adding either early fails instantly against 53 values. This is the `rating` precedent the test file already documents from the PSU project.

5. 🛑 **Do not delete `specs.radiator` before Task 9.** `partSynergy.coolerCapacityW` parses it to pick a capacity rung. Delete it early and every AIO reports **0 W capacity** — which does not throw, it silently blanks the capacity row and the throttle advisory.

6. ⚠️ **A first-match regex over `document.body.innerText` reads the wrong product's specs** on a series page. Anchor extraction to the product's own SKU block and check the SKU belongs to the page you opened. This shipped a silent error in the case pilot.

7. ⚠️ **A maker's support KB outranks its product spec table.** A spec table can publish a *constrained* figure with no label on it. A cooler height that looks low for the model is the tell — go and find the KB article before believing it.

8. ⚠️ **Record the URL of a page you actually opened.** A search-result snippet is a lead, not a citation.

9. ⚠️ **`node -e` in the Bash tool eats backticks and apostrophes and can half-apply while printing ok.** Write a `.mjs` file to the scratchpad and run it.

10. ⚠️ **Do not push.** `git push`, `npm run catalog:push` and any deploy are the user's to run. A push to `main` **is** a deploy.

## File structure

| file | responsibility | tasks |
|---|---|---|
| `scripts/catalog-coverage-core.mjs` | `EXPECTED`, `RATCHETED_KEYS`, `coverageFor`, and the new `requiredFor` | 1 |
| `scripts/catalog-coverage.mjs` | the CLI; prints per-field denominators | 1 |
| `src/tests/catalogCoverage.test.js` | tests for the above | 1 |
| `src/data/partsData.json` | the 53 cooler rows | 2–8, 9 |
| `data/partSources.json` | one provenance entry per researched field | 2–8 |
| `src/lib/partSynergy.js` | `coolerCapacityW` reads the number; local parser retired | 9 |
| `src/lib/partStats.js` | the `Radiator` row | 9 |
| `src/lib/specSheetContent.js` | the summary sentence and the `LABELS` map | 9 |
| `src/lib/partPages.js` | pre-rendered `Case clearance` copy | 9 |
| `src/tests/partStats.test.js` | the capacity cross-check's failure label | 9 |
| `prerendered/*.html` | the seven committed page fragments; go stale silently | 9 |
| `src/tests/partSources.test.js` | `RESEARCHED_KEYS`, `VERIFIED_CATEGORIES` | 10 |
| `src/tests/__snapshots__/verdictSpread.test.js.snap` | the headline outcome | 10 |

---

## Research protocol C

**Every row in Tasks 2–8 follows this exact protocol.** It is protocol R from `docs/superpowers/plans/2026-08-30-case-catalogue-research.md` — which remains binding in full — with the cooler-specific values named here. Do not improvise a shortcut.

For each cooler id:

1. **Open the maker's own product or spec page for that exact model.** Use the in-app Browser. Check the maker's current line-up first: **thirteen catalogue rows across four categories have named a product nobody makes.** If the row's name is wrong, re-point it and **keep the id** — saved builds and `/part/` URLs depend on it — and name the old value in the commit message.

2. **Read three values off the page:**

   - **`sockets`** — the mounting list, mapped into the catalogue's closed five-token vocabulary: `AM4`, `AM5`, `LGA1200`, `LGA1700`, `LGA1851`. **Drop everything outside that set** (LGA1150, LGA2066, sTRX4, TR4). No CPU or board in the catalogue uses them, and a sixth token would change nothing but risk a mismatch.

     ⚠️ **Verify the list as a whole, not by spot-check.** The block runs in four directions in `compatibility.js:97`–`:114`: an omitted socket refuses a valid pairing just as loudly as an invented one refuses nothing.

     ⚠️ **The bracket rule.** A socket the maker supports with a bracket **in the box, or free on request**, counts. A socket needing a **separately purchased** kit does not. Record which case applies in the entry's `note`. This is the single most likely place for a wrong value: nearly every row currently claims the identical five sockets, which is a copying tell, not a finding.

   - **`specs.type`** — `"Air"` or `"AIO"`. Required, not assumed: it **selects which rule runs**. `compatibility.js:11` skips the height check for anything typed `AIO`, and rule 4 skips anything not typed `AIO`. A mislabelled cooler is checked by neither and blocks nothing.

   - **Air only — `specs.height`** — the **assembled height in millimetres, with the stock fan at its shipped position.** Where a maker publishes both a bare-heatsink and an assembled figure, the assembled one is the fact and the bare one goes in the `note`. Where a fan can be raised to clear tall memory, the **shipped** position is the fact.

   - **AIO only — `specs.radiatorMm`** — the **nominal radiator length as the maker names the product**: `240`, `280`, `360`, `420`. 🛑 **Not the measured length.** Rule 4 tests this integer against the 59 researched `radiatorSupport` arrays, which hold exactly `92, 120, 140, 200, 240, 280, 360, 420`. A measured 277 mm for a "240" would match nothing and block every AIO in the catalogue. Put the measured dimensions in the `note`.

3. **Cross-check the height or radiator size against one reliable secondary source** (a review with measurements, or PCPartPicker). PCPartPicker is **never** the source of truth.

4. **Write the values** into `src/data/partsData.json` and one source entry per field into `data/partSources.json`, using the writer in Task 2 Step 2.

5. **If the maker does not publish a figure**, record it as unverifiable and **remove the field** if present:

   ```json
   { "checkedOn": "2026-09-02", "result": "unverifiable", "note": "Scythe publishes no assembled height for this model; not on the spec tab or in the manual" }
   ```

   An unverifiable entry must have `checkedOn` and a non-empty `note`, and must **not** carry a `url` — `partSources.test.js` enforces all three.

6. **Where a re-verified number disagrees with what is there, change it, and name the old value in the commit message.**

### The shape a finished cooler takes

⚠️ **SHAPE ONLY — every value below is illustrative. Never copy these into the catalogue.**

```json
{
  "id": "cooler-example-aio",
  "category": "cooler",
  "name": "Example Liquid 360",
  "brand": "Example",
  "price": 149.99,
  "sockets": ["AM5", "LGA1700", "LGA1851"],
  "tdp": 5,
  "specs": { "type": "AIO", "radiatorMm": 360 }
}
```

```json
"cooler-example-aio": {
  "sockets": { "url": "https://example.com/liquid-360/spec", "checkedOn": "2026-09-02", "note": "LGA1851 via the bracket in the box" },
  "type": { "url": "https://example.com/liquid-360/spec", "checkedOn": "2026-09-02" },
  "radiatorMm": { "url": "https://example.com/liquid-360/spec", "checkedOn": "2026-09-02", "note": "radiator 394 x 120 x 27 mm; nominal 360" }
}
```

⚠️ **`tdp` stays exactly as it is and must never get a source entry.** The 2–5 W on each cooler is the app's own estimate of fan and pump draw, in the same family as a motherboard's `tdp: 12`–`15`. No maker publishes it.

⚠️ **`specs.radiator` stays in place until Task 9.** During Tasks 2–8 an AIO carries *both* `radiator` and `radiatorMm`. That is deliberate — see gotcha 5.

---

## Task 1: Coverage learns a conditional category

**Files:**
- Modify: `scripts/catalog-coverage-core.mjs:11-66` (`EXPECTED`, `RATCHETED_KEYS`), `:92-113` (`coverageFor`)
- Modify: `scripts/catalog-coverage.mjs:20`
- Test: `src/tests/catalogCoverage.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `src/tests/catalogCoverage.test.js`. First extend the import on line 2:

```js
import { coverageFor, EXPECTED, RATCHETED_KEYS, missingRatchetSources, requiredFor } from '../../scripts/catalog-coverage-core.mjs'
```

Then append these two blocks to the end of the file:

```js
describe('cooler expectations', () => {
  const cooler = (id, type, specs = {}, fields = {}) =>
    ({ id, category: 'cooler', tdp: 3, sockets: ['AM5'], ...fields, specs: { type, ...specs } })

  it('asks an air cooler for its height and an AIO for its radiator size', () => {
    expect(requiredFor(EXPECTED.cooler, cooler('a', 'Air', { height: 165 })))
      .toEqual(['sockets', 'type', 'height'])
    expect(requiredFor(EXPECTED.cooler, cooler('b', 'AIO', { radiatorMm: 360 })))
      .toEqual(['sockets', 'type', 'radiatorMm'])
  })

  it('counts a fully sourced air cooler and a fully sourced AIO as verified', () => {
    const parts = [cooler('a', 'Air', { height: 165 }), cooler('b', 'AIO', { radiatorMm: 360 })]
    const sources = {
      a: { sockets: src(), type: src(), height: src() },
      b: { sockets: src(), type: src(), radiatorMm: src() },
    }
    expect(coverageFor('cooler', parts, sources).verified).toBe(2)
  })

  // 🛑 THE CASE A FLAT LIST WITH BOTH SIZE FIELDS `optional` WOULD HAVE PASSED.
  // A cooler carrying neither a height nor a radiator size has a gap, not a
  // fact, and must never count as researched however well its other fields are
  // sourced.
  it('refuses to verify an air cooler that carries no height', () => {
    const sources = { a: { sockets: src(), type: src(), height: src() } }
    expect(coverageFor('cooler', [cooler('a', 'Air')], sources).verified).toBe(0)
  })

  it('refuses to verify a cooler whose type matches no variant', () => {
    const odd = { id: 'a', category: 'cooler', sockets: ['AM5'], tdp: 3, specs: { height: 165 } }
    expect(requiredFor(EXPECTED.cooler, odd)).toBeNull()
    const sources = { a: { sockets: src(), type: src(), height: src() } }
    expect(coverageFor('cooler', [odd], sources).verified).toBe(0)
  })

  // Without this the report would read `height 31/53`, which looks like a gap
  // and is not one: 22 of those rows are AIOs that owe no height at all.
  it('counts a size field only against the parts that owe it', () => {
    const parts = [cooler('a', 'Air', { height: 165 }), cooler('b', 'AIO', { radiatorMm: 360 })]
    const c = coverageFor('cooler', parts, {})
    expect(c.total).toBe(2)
    expect(c.fields.height.applies).toBe(1)
    expect(c.fields.radiatorMm.applies).toBe(1)
  })

  it('leaves a flat category reporting against its full row count', () => {
    const c = coverageFor('gpu', [gpu('a', { length: 300, tdp: 200 })], {})
    expect(c.fields.length.applies).toBe(c.total)
  })
})

describe('the cooler ratchet', () => {
  const air = { id: 'a', category: 'cooler', sockets: ['AM5'], tdp: 3, specs: { type: 'Air', height: 165 } }

  it('demands a source for a cooler sockets list', () => {
    expect(missingRatchetSources([air], {}, new Set(['cooler']))).toEqual(['a.sockets'])
  })

  // ⚠️ THE TRAP THIS ENCODES: a cooler's `tdp` of 2-5 W is the app's own
  // estimate of fan and pump draw, not a published figure. It must never be
  // asked for provenance.
  it('never demands a source for a cooler tdp', () => {
    expect(missingRatchetSources([air], { a: { sockets: src() } }, new Set(['cooler']))).toEqual([])
    expect(RATCHETED_KEYS.cooler).toEqual(['sockets'])
  })
})
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: FAIL. `requiredFor is not a function`, and `EXPECTED.cooler` / `RATCHETED_KEYS.cooler` are `undefined`.

- [ ] **Step 3: Add the expectations**

In `scripts/catalog-coverage-core.mjs`, add to `EXPECTED` after the `motherboard` entry (before the closing `}` on line 43):

```js
  // ⚠️ THE FIRST CATEGORY WHOSE REQUIRED LIST DEPENDS ON THE PART. An air
  // cooler owes its height; an AIO owes its radiator size. The split in the
  // data is already clean - all 31 air rows carry `height` and no radiator,
  // all 22 AIO rows the reverse - so a flat list with both marked `optional`
  // would pass a cooler carrying NEITHER. That is a gap, not a fact.
  //
  // `type` is required rather than assumed because it selects WHICH RULE RUNS:
  // compatibility.js skips the height check for anything typed AIO, and rule 4
  // in specRules.js skips anything not typed AIO. A mislabelled cooler is
  // checked by neither rule and blocks nothing.
  cooler: {
    variants: [
      { when: (p) => p.specs?.type === 'AIO', required: ['sockets', 'type', 'radiatorMm'] },
      { when: (p) => p.specs?.type === 'Air', required: ['sockets', 'type', 'height'] },
    ],
    optional: [],
  },
```

Add to `RATCHETED_KEYS` after the `motherboard` entry:

```js
  // `sockets` is the only top-level field on a cooler that any rule reads, and
  // it blocks in FOUR directions in compatibility.js. `tdp` is absent for the
  // same reason it is absent for a motherboard: the 2-5 W is the app's own
  // estimate of fan and pump draw, which no maker publishes.
  cooler: ['sockets'],
```

- [ ] **Step 4: Add `requiredFor` and make `coverageFor` use it**

In `scripts/catalog-coverage-core.mjs`, add above `coverageFor`:

```js
// The fields THIS part owes. A flat category answers the same list for every
// row; a variant category answers by the part's own type. `null` means no
// variant matched - an unclassifiable part, which can never be verified.
export function requiredFor(spec, part) {
  if (!spec.variants) return spec.required
  return spec.variants.find((v) => v.when(part))?.required ?? null
}
```

Then replace the whole body of `coverageFor` with:

```js
export function coverageFor(category, parts, sources) {
  const spec = EXPECTED[category]
  if (!spec) return null

  const rows = parts.filter((p) => p.category === category)
  const required = spec.variants
    ? [...new Set(spec.variants.flatMap((v) => v.required))]
    : spec.required

  const fields = {}
  for (const key of [...required, ...spec.optional]) {
    let present = 0
    let sourced = 0
    let applies = 0
    for (const part of rows) {
      const owed = requiredFor(spec, part)
      // A key this part does not owe is not counted against it, so a variant
      // category reports `height 31/31` rather than a misleading `31/53`.
      if (owed && !owed.includes(key) && !spec.optional.includes(key)) continue
      applies++
      if (hasField(part, key)) present++
      if (isResearched(part, sources, key)) sourced++
    }
    fields[key] = { present, sourced, applies, optional: spec.optional.includes(key) }
  }

  const verified = rows.filter((part) => {
    const owed = requiredFor(spec, part)
    return owed !== null && owed.every((key) => isResearched(part, sources, key))
  }).length

  return { category, total: rows.length, verified, fields }
}
```

- [ ] **Step 5: Print the per-field denominator in the CLI**

In `scripts/catalog-coverage.mjs`, replace line 20:

```js
    console.log(`  ${key.padEnd(20)} present ${String(f.present).padStart(3)}/${f.applies}   researched ${String(f.sourced).padStart(3)}/${f.applies}${tag}`)
```

For a flat category `applies === total`, so the four finished categories print exactly as before. The test in Step 1 pins that.

- [ ] **Step 6: Run the tests and verify they pass**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: PASS, all cases green.

- [ ] **Step 7: Confirm the new category reports zero and the old four are unchanged**

```bash
npm run catalog:coverage
```

Expected: `cooler: 0/53 parts fully researched (0%)` with `sockets 53/53 present, 0 researched`, `height 31/31 present, 0 researched`, `radiatorMm 0/22 present, 0 researched`. The gpu, case, psu and motherboard blocks must be **byte-identical** to before — all still `100%`.

- [ ] **Step 8: Run the full unit suite and the linter**

```bash
npm run test:run && npm run lint
```

Expected: PASS. The ratchet is inert — `cooler` is not yet in `VERIFIED_CATEGORIES`, so `partSources.test.js` does not yet demand the 53 socket sources.

- [ ] **Step 9: Commit**

```bash
git add scripts/catalog-coverage-core.mjs scripts/catalog-coverage.mjs src/tests/catalogCoverage.test.js
git commit -m "feat: expect three fields of a cooler, conditional on its type"
```

---

## Tasks 2–8: the data tranches

Seven tranches, by brand, so each sits on one maker's spec-page layout and one mounting system. **Every row follows research protocol C above.**

Each task has the same five steps. They are written out in full in Task 2; Tasks 3–8 give their own row table, their own maker traps and their own commit, and refer to Task 2 Step 2 for the writer.

### Task 2: DeepCool — 9 rows

**Files:**
- Create: `<scratchpad>/apply-tranche.mjs`
- Modify: `src/data/partsData.json`, `data/partSources.json`

| id | name | type | current | current sockets |
|---|---|---|---|---|
| `cooler-deepcool-ak620` | DeepCool AK620 | Air | 160mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-deepcool-ak400` | DeepCool AK400 | Air | 155mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-deepcool-ak500` | DeepCool AK500 | Air | 158mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-deepcool-ag400` | DeepCool AG400 | Air | 150mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-deepcool-ak400-digital` | DeepCool AK400 Digital | Air | 155mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-deepcool-ak620-digital` | DeepCool AK620 Digital | Air | 160mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-deepcool-ls520` | DeepCool LS520 SE AIO | AIO | 240mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-deepcool-le720` | DeepCool LE720 360 AIO | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-deepcool-mystique-360` | DeepCool Mystique 360 AIO | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |

**Maker entry point:** `deepcool.com` — navigate to the cooler line-up from there. ⚠️ These are entry points to navigate from, not citations; cite the exact product page you land on.

**Traps for this tranche:** DeepCool ships regional sites with different catalogues; confirm the SKU suffix (`SE`, `Digital`, `WH`) belongs to the page you opened. The AK400 and AK400 Digital are separate products with separate pages — do not let one stand in for the other.

- [ ] **Step 1: Research all nine rows under protocol C**

For each id above, open the maker's page, read `sockets`, `type`, and either `height` or `radiatorMm`, cross-check the size figure against one secondary source, and record the exact URL you opened. Collect the results as the literal for Step 2. Anything unpublished is `result: "unverifiable"` with a note and no URL — never a guess.

- [ ] **Step 2: Write the values with the house serializer**

Create `<scratchpad>/apply-tranche.mjs` — written once, reused by Tasks 3–8:

```js
// Applies one research tranche to both data files, in the repo's own JSON
// style. Refuses to write unless house-json round-trips BOTH files first.
import { readFileSync, writeFileSync } from 'node:fs'
import { FILES, toFile, roundTripOk } from '../../scripts/house-json.mjs'

// EDIT THIS PER TRANCHE. `specs` is merged into the part's existing specs;
// `sources` is merged into that part's source entry. A field set to null is
// DELETED from the part.
const TRANCHE = {
  'cooler-example': {
    part: { sockets: ['AM5', 'AM4', 'LGA1700'] },
    specs: { type: 'Air', height: 165 },
    sources: {
      sockets: { url: 'https://example.com/x', checkedOn: '2026-09-02' },
      type: { url: 'https://example.com/x', checkedOn: '2026-09-02' },
      height: { url: 'https://example.com/x', checkedOn: '2026-09-02' },
    },
  },
}

if (!roundTripOk(true)) {
  console.error('house-json does not round-trip the files as they stand; fix that before writing')
  process.exit(1)
}

const parts = JSON.parse(readFileSync('src/data/partsData.json', 'utf8'))
const sources = JSON.parse(readFileSync('data/partSources.json', 'utf8'))

for (const [id, entry] of Object.entries(TRANCHE)) {
  const part = parts.find((p) => p.id === id)
  if (!part) throw new Error(`no part with id ${id}`)
  Object.assign(part, entry.part ?? {})
  for (const [k, v] of Object.entries(entry.specs ?? {})) {
    if (v === null) delete part.specs[k]
    else part.specs[k] = v
  }
  sources[id] = { ...(sources[id] ?? {}), ...(entry.sources ?? {}) }
}

writeFileSync('src/data/partsData.json', toFile(parts, FILES['src/data/partsData.json']))
writeFileSync('data/partSources.json', toFile(sources, FILES['data/partSources.json']))
console.log(`applied ${Object.keys(TRANCHE).length} rows`)
```

Replace `TRANCHE` with this tranche's nine researched rows, then:

```bash
node "$CLAUDE_SCRATCHPAD/apply-tranche.mjs"
```

Expected: `MATCH  src/data/partsData.json`, `MATCH  data/partSources.json`, then `applied 9 rows`.

- [ ] **Step 3: Check the diff is small**

```bash
git diff --stat src/data/partsData.json data/partSources.json
```

Expected: tens of lines changed, not thousands. **A diff of 3236 lines means the serializer was bypassed — revert and fix before going on.**

- [ ] **Step 4: Verify coverage moved and the suite is green**

```bash
npm run catalog:coverage && npm run test:run && npm run lint
```

Expected: `cooler: 9/53 parts fully researched (17%)`, and PASS on both.

- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the nine DeepCool coolers"
```

⚠️ If a re-verified value disagreed with what was there, **name the old value in the commit message** — for example `AK620 height 160 -> 162`.

### Task 3: Thermalright — 9 rows

| id | name | type | current | current sockets |
|---|---|---|---|---|
| `cooler-thermalright-pa120` | Thermalright Peerless Assassin 120 SE | Air | 155mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-thermalright-pa120-digital` | Thermalright Peerless Assassin 120 Digital | Air | 155mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-thermalright-phantom-120` | Thermalright Phantom Spirit 120 SE | Air | 154mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-thermalright-ax120r` | Thermalright Assassin X 120 R SE | Air | 155mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-tr-peerless-140` | Thermalright Peerless Assassin 140 | Air | 158mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-tr-frost-commander` | Thermalright Frost Commander 140 | Air | 154mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-thermalright-frozen-notte-360` | Thermalright Frozen Notte 360 ARGB AIO | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-tr-aqua-elite-360` | Thermalright Aqua Elite 360 ARGB AIO | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-tr-notte-240` | Thermalright Notte 240 ARGB AIO | AIO | 240mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |

**Maker entry point:** `thermalright.com`.

**Traps for this tranche:** 🛑 **Three of these six air coolers currently read 154 or 155 mm and Thermalright's naming is dense with near-identical SKUs** — `SE`, `Plus`, `ARGB`, `Digital`, `EVO` are different products. This tranche carries the highest name-collision risk in the project. Confirm the exact SKU on the page you cite. Thermalright's spec tables sometimes give heatsink dimensions without the fan; protocol C wants the **assembled** height.

- [ ] **Step 1: Research all nine rows under protocol C**
- [ ] **Step 2: Write them with the Task 2 Step 2 writer** (edit `TRANCHE`, run `node "$CLAUDE_SCRATCHPAD/apply-tranche.mjs"`; expect two `MATCH` lines then `applied 9 rows`)
- [ ] **Step 3: Check the diff is small** — `git diff --stat src/data/partsData.json data/partSources.json`, tens of lines
- [ ] **Step 4: Verify** — `npm run catalog:coverage && npm run test:run && npm run lint`; expect `cooler: 18/53 (34%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the nine Thermalright coolers"
```

### Task 4: Arctic — 8 rows

| id | name | type | current | current sockets |
|---|---|---|---|---|
| `cooler-arctic-freezer-36` | Arctic Freezer 36 | Air | 159mm | AM5 AM4 LGA1700 LGA1851 |
| `cooler-arctic-freezer-36-argb` | Arctic Freezer 36 A-RGB | Air | 159mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-arctic-freezer-50` | Arctic Freezer 50 | Air | 165mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-arctic-lf2-240` | Arctic Liquid Freezer II 240 AIO | AIO | 240mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-arctic-lf3-240` | Arctic Liquid Freezer III 240 AIO | AIO | 240mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-arctic-lf3-280` | Arctic Liquid Freezer III 280 AIO | AIO | 280mm | AM5 AM4 LGA1700 LGA1851 |
| `cooler-arctic-lf3-360` | Arctic Liquid Freezer III 360 AIO | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-arctic-lf3-420` | Arctic Liquid Freezer III 420 AIO | AIO | 420mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |

**Maker entry point:** `arctic.de`.

**Traps for this tranche:** 🛑 **The two Freezer 36 rows disagree with each other on LGA1200 today** — one lists it, the other does not. At most one is right; this is exactly the kind of copied-list error protocol C's whole-list rule exists to catch. ⚠️ The Liquid Freezer III radiators are **38 mm thick**, and thickness is deliberately out of scope — record the nominal length (`240`/`280`/`360`/`420`) and put the measured dimensions in the `note`. ⚠️ Arctic sells `A-RGB` and non-RGB variants of the same cooler with different SKUs.

- [ ] **Step 1: Research all eight rows under protocol C**
- [ ] **Step 2: Write them with the Task 2 Step 2 writer** (expect two `MATCH` lines then `applied 8 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `cooler: 26/53 (49%)` and PASS on `test:run` and `lint`
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the eight Arctic coolers"
```

### Task 5: Noctua — 6 rows, all air

| id | name | type | current | current sockets |
|---|---|---|---|---|
| `cooler-noctua-d15` | Noctua NH-D15 | Air | 165mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-noctua-d15-chromax` | Noctua NH-D15 chromax.black | Air | 165mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-noctua-d15-g2` | Noctua NH-D15 G2 | Air | 168mm | AM5 AM4 LGA1700 LGA1851 |
| `cooler-noctua-u12s` | Noctua NH-U12S Redux | Air | 158mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-noctua-u9s` | Noctua NH-U9S | Air | 125mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-noctua-l9a` | Noctua NH-L9a-AM5 Low Profile | Air | 37mm | AM5 AM4 |

**Maker entry point:** `noctua.at`.

**Traps for this tranche:** 🛑 **This is the tranche the bracket rule was written for.** Noctua supports sockets across generations via SecuFirm2 mounting kits, some **in the box**, some **free on request**, some **bought separately**. Only the first two count for `sockets`; record which applies in the `note`. ⚠️ `cooler-noctua-l9a` is the 37 mm row — Noctua publishes height with and without the fan for low-profile models, and protocol C wants the **assembled** figure. ⚠️ The NH-L9a is an **AMD-only** part by design (there is a separate NH-L9i for Intel), so its two-socket list is plausible and must still be verified rather than assumed. ⚠️ The NH-D15 and NH-D15 chromax.black are separate product pages; the G2 is a different cooler again.

- [ ] **Step 1: Research all six rows under protocol C**
- [ ] **Step 2: Write them with the Task 2 Step 2 writer** (expect two `MATCH` lines then `applied 6 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `cooler: 32/53 (60%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the six Noctua coolers"
```

### Task 6: be quiet! — 6 rows

| id | name | type | current | current sockets |
|---|---|---|---|---|
| `cooler-bequiet-drp4` | be quiet! Dark Rock Pro 4 | Air | 162mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-bequiet-dark-rock-5` | be quiet! Dark Rock Pro 5 | Air | 168mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-bequiet-dark-rock-elite` | be quiet! Dark Rock Elite | Air | 168mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-bequiet-pure-rock-2` | be quiet! Pure Rock 2 | Air | 155mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-bequiet-shadow-rock-3` | be quiet! Shadow Rock 3 | Air | 163mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-bequiet-pure-loop-2-280` | be quiet! Pure Loop 2 FX 280 AIO | AIO | 280mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |

**Maker entry point:** `bequiet.com`.

**Traps for this tranche:** 🛑 **be quiet! removes a discontinued product's page completely, while search engines still index the dead URL** — a 404 here means "discontinued", not "spec unpublished", and the row may need re-pointing (keep the id). ⚠️ **Its full specs ARE in static HTML, addressed by numeric product id only.** ⚠️ **Its throttle returns an EMPTY 200** — an empty body is rate limiting, not a missing spec; back off and retry rather than recording `unverifiable`. ⚠️ `cooler-bequiet-dark-rock-5` is named "Dark Rock Pro 5" but its id says `dark-rock-5`; Dark Rock 5 and Dark Rock Pro 5 are **different coolers**. Establish which one this row is, correct the name if needed, and keep the id.

- [ ] **Step 1: Research all six rows under protocol C**
- [ ] **Step 2: Write them with the Task 2 Step 2 writer** (expect two `MATCH` lines then `applied 6 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `cooler: 38/53 (72%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the six be quiet! coolers"
```

### Task 7: Cooler Master and Corsair — 8 rows

| id | name | type | current | current sockets |
|---|---|---|---|---|
| `cooler-cm-hyper212` | Cooler Master Hyper 212 | Air | 158mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-cm-hyper-622-halo` | Cooler Master Hyper 622 Halo | Air | 154mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-cm-ml240l` | Cooler Master MasterLiquid ML240L V2 | AIO | 240mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-cm-360l-core` | Cooler Master MasterLiquid 360L Core ARGB | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-corsair-h100i` | Corsair iCUE H100i Elite Capellix | AIO | 240mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-corsair-h150i` | Corsair iCUE H150i Elite Capellix | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-corsair-nautilus-360` | Corsair Nautilus 360 RS AIO | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 |
| `cooler-corsair-link-h150i` | Corsair iCUE Link H150i RGB AIO | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |

**Maker entry points:** `coolermaster.com`, `corsair.com`.

**Traps for this tranche:** 🛑 **"Hyper 212" is a product family, not a SKU** — Hyper 212 Black Edition, EVO, EVO V2, Halo and Spectrum are different coolers with different heights and socket lists. Protocol C rule 4 is about exactly this; establish which SKU this row is and re-point the name if needed, keeping the id. ⚠️ **Corsair's "Elite Capellix" line has both an original and an XT revision**, with different socket support. ⚠️ Corsair lists AM5 support for older AIOs through a **free bracket request**; that counts under the bracket rule, and it belongs in the `note`.

- [ ] **Step 1: Research all eight rows under protocol C**
- [ ] **Step 2: Write them with the Task 2 Step 2 writer** (expect two `MATCH` lines then `applied 8 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `cooler: 46/53 (87%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the four Cooler Master and four Corsair coolers"
```

### Task 8: NZXT, Scythe, Lian Li and ID-Cooling — 7 rows

| id | name | type | current | current sockets |
|---|---|---|---|---|
| `cooler-nzxt-kraken-240` | NZXT Kraken 240 AIO | AIO | 240mm | AM5 AM4 LGA1700 LGA1851 |
| `cooler-nzxt-kraken-360` | NZXT Kraken 360 RGB AIO | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-nzxt-kraken-elite-360` | NZXT Kraken Elite 360 RGB AIO | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-lianli-galahad2-360` | Lian Li Galahad II Trinity 360 AIO | AIO | 360mm | AM5 AM4 LGA1700 LGA1851 |
| `cooler-scythe-fuma-3` | Scythe Fuma 3 | Air | 154mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-scythe-mugen-6` | Scythe Mugen 6 | Air | 154mm | AM5 AM4 LGA1700 LGA1851 LGA1200 |
| `cooler-idcooling-se214xt` | ID-Cooling SE-214-XT | Air | 150mm | AM5 AM4 LGA1700 LGA1200 |

**Maker entry points:** `nzxt.com`, `scythe-eu.com`, `lian-li.com`, `idcooling.com`.

**Traps for this tranche:** 🛑 **This tranche closes the AIOs**, so Task 9 cannot start until it lands. ⚠️ **The NZXT Kraken line has RGB, non-RGB and Elite variants at each radiator size**, and the 2023 relaunch reused old names — confirm the generation on the page. ⚠️ **Scythe publishes separate EU and JP sites** whose spec tables differ in completeness; cite the one you actually read. ⚠️ **Lian Li's Galahad II comes in Trinity, Trinity Performance and LCD editions.** ⚠️ `cooler-idcooling-se214xt` is the only row already missing LGA1851 — verify rather than assume that is right, and note that ID-Cooling ships several near-identical `SE-214` SKUs (`XT`, `XT ARGB`, `XT Black`).

- [ ] **Step 1: Research all seven rows under protocol C**
- [ ] **Step 2: Write them with the Task 2 Step 2 writer** (expect two `MATCH` lines then `applied 7 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `cooler: 53/53 parts fully researched (100%)` and PASS on `test:run` and `lint`
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the three NZXT, two Scythe, Lian Li and ID-Cooling coolers"
```

---

## Task 9: Retire the `specs.radiator` string

🛑 **Do not start this task until Task 8 has landed and `catalog:coverage` reports `cooler: 53/53`.** `coolerCapacityW` parses the string to pick a rung; deleting it while any AIO lacks a verified `radiatorMm` makes that AIO report 0 W capacity without throwing.

**Files:**
- Modify: `src/lib/partSynergy.js:10-13, 28-42`
- Modify: `src/lib/partStats.js:166`
- Modify: `src/lib/specSheetContent.js:42, 121-124`
- Modify: `src/lib/partPages.js:209-211`
- Modify: `src/tests/partStats.test.js:91`
- Modify: `src/data/partsData.json` (22 AIO rows)

- [ ] **Step 1: Write the failing test**

Add to `src/tests/partStats.test.js`, inside the existing top-level `describe`:

```js
  // The string this replaced was never verified against a maker's page, and it
  // drove the only cooling-capacity figure on the site. One stored fact now.
  it('reads every AIO capacity off the researched radiatorMm', () => {
    const aios = ofCat('cooler').filter((c) => c.specs.type === 'AIO')
    expect(aios.length).toBe(22)
    for (const c of aios) {
      expect(c.specs.radiator, `${c.id} still carries the unverified string`).toBeUndefined()
      expect(typeof c.specs.radiatorMm, `${c.id} radiatorMm`).toBe('number')
      expect(coolerCapacityW(c), `${c.id}`).toBeGreaterThan(0)
    }
  })
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/tests/partStats.test.js -t "researched radiatorMm"
```

Expected: FAIL — `cooler-arctic-lf2-240 still carries the unverified string`.

- [ ] **Step 3: Read the number in `partSynergy.js`**

Delete the local parser at lines 10–13:

```js
function radiatorMm(radiator) {
  const m = /(\d{2,3})/.exec(String(radiator ?? ''))
  return m ? Number(m[1]) : 0
}
```

and in `coolerCapacityW` replace:

```js
    const mm = radiatorMm(s.radiator)
```

with:

```js
    // ⚠️ The researched number, not the old "240mm" string that used to be
    // parsed here. 0 still means unknown and still costs nothing upstream.
    const mm = s.radiatorMm ?? 0
```

- [ ] **Step 4: Rewire the three copy sites**

`src/lib/partStats.js:166` — replace:

```js
      add('Radiator', s.radiator)
```

with:

```js
      add('Radiator', s.radiatorMm && `${s.radiatorMm}mm`)
```

`src/lib/specSheetContent.js:123` — replace the `AIO` branch:

```js
        ? `${s.radiatorMm}mm liquid cooler, so it needs a matching radiator mount in the case, but no height limit. Fits ${(part.sockets ?? []).join(', ')}.`
```

and delete the now-dead label on line 42:

```js
  radiator: 'Radiator',
```

`src/lib/partPages.js:210` — replace:

```js
        ? `A ${s.radiator ?? ''} radiator needs a case with matching mounts.`.replace('  ', ' ')
```

with:

```js
        ? `A ${s.radiatorMm}mm radiator needs a case with matching mounts.`
```

The `.replace('  ', ' ')` went with it: it existed only to tidy the double space a missing string left behind, and `radiatorMm` is now guaranteed present on every AIO by Task 8.

- [ ] **Step 5: Fix the capacity cross-check's failure label**

`src/tests/partStats.test.js:91` — replace:

```js
      expect(coolerCapacity(c), `${c.id} (${c.specs.type} ${c.specs.radiator ?? c.specs.height})`)
```

with:

```js
      expect(coolerCapacity(c), `${c.id} (${c.specs.type} ${c.specs.radiatorMm ?? c.specs.height})`)
```

- [ ] **Step 6: Delete the string from the 22 AIO rows**

Reuse the Task 2 Step 2 writer with a `null` value, which deletes the field:

```js
const TRANCHE = Object.fromEntries(
  JSON.parse(readFileSync('src/data/partsData.json', 'utf8'))
    .filter((p) => p.category === 'cooler' && p.specs?.type === 'AIO')
    .map((p) => [p.id, { specs: { radiator: null } }])
)
```

```bash
node "$CLAUDE_SCRATCHPAD/apply-tranche.mjs"
```

Expected: two `MATCH` lines then `applied 22 rows`.

- [ ] **Step 7: Prove the field is gone from the source tree**

```bash
grep -rn "specs\.radiator\b\|s\.radiator\b" src/ scripts/ || echo "CLEAN"
```

Expected: `CLEAN`. ⚠️ `radiatorSupport` and `radiatorMm` are different fields and must still be there — the `\b` in the pattern is what keeps them out of the result.

- [ ] **Step 8: Run the tests**

```bash
npm run test:run && npm run lint
```

Expected: PASS, including the new test from Step 1.

- [ ] **Step 9: Re-render the committed fragments**

`partPages.js` copy changed, and pre-rendered fragments go stale **silently**.

```bash
npm run prerender && git diff --stat prerendered/
```

Expected: `prerender: wrote 7 fragments to prerendered/`.

⚠️ **The seven fragments are whole pages** — `index`, `parts`, `glossary`, `help`, `feedback`, `privacy`, `terms` — **not one per part.** `parts.html` carries no radiator copy today, so if no cooler *name* changed in Tasks 2–8 this step can legitimately produce **no diff at all**. That is a pass, not a failure.

⚠️ **A failed prerender run leaves the folder untouched, so a clean `git diff` can also mean it never ran** — read the command's own output line, not just the diff.

- [ ] **Step 10: Commit**

```bash
git add src/lib src/tests src/data/partsData.json prerendered
git commit -m "refactor: read the radiator size off the researched number"
```

If `prerendered/` did change, commit it separately afterwards as `chore: re-render the parts page against the researched cooler data`, matching the previous four projects.

---

## Task 10: Switch the ratchet on

**Files:**
- Modify: `src/tests/partSources.test.js:12-24` (`RESEARCHED_KEYS`), `:145` (`VERIFIED_CATEGORIES`)
- Modify: `src/tests/__snapshots__/verdictSpread.test.js.snap`

- [ ] **Step 1: Add the two spec keys and the category**

In `src/tests/partSources.test.js`, add to `RESEARCHED_KEYS` after `'rating',`:

```js
  // ⚠️ Same rule as `rating` above: `height` and `type` could only join this
  // list once all 53 coolers had a source recorded. Adding either at the start
  // of the cooler project would have failed instantly against 53 unsourced
  // values.
  'height', 'type',
```

and on line 145:

```js
const VERIFIED_CATEGORIES = new Set(['gpu', 'case', 'psu', 'motherboard', 'cooler'])
```

- [ ] **Step 2: Run the suite**

```bash
npm run test:run
```

Expected: PASS. A failure here names the exact `<id>.<field>` still missing provenance — go back and finish that row rather than weakening the list.

- [ ] **Step 3: Prove the ratchet is non-vacuous**

Temporarily delete one cooler's `sockets` source entry from `data/partSources.json`, then:

```bash
npx vitest run src/tests/partSources.test.js
```

Expected: **FAIL**, naming that exact `<id>.sockets`. Restore the entry with `git checkout -- data/partSources.json` and re-run to confirm PASS.

⚠️ A ratchet that cannot fail is worth nothing. Do not skip this step.

- [ ] **Step 4: Update the verdict snapshot**

```bash
npx vitest run src/tests/verdictSpread.test.js -u
git diff src/tests/__snapshots__/verdictSpread.test.js.snap
```

Expected: **`cooler.unverified` goes from 22 to 0 in both builds**, with those 22 redistributed into `ok` and `blocked`. Every other category's `unverified` was already 0 and must stay 0. Read the diff before accepting it: this is the headline outcome of the project, and a snapshot update is the one place a regression can be rubber-stamped.

- [ ] **Step 5: Run everything**

```bash
npm run test:run && npm run lint && npm run build && npm run test:e2e
```

Expected: PASS throughout. ⚠️ **One 30 s e2e timeout fails the whole suite — re-run before blaming your change.**

- [ ] **Step 6: Commit**

```bash
git add src/tests
git commit -m "feat: switch the cooler ratchet on"
```

- [ ] **Step 7: Close out the plan and the spec**

Tick every checkbox in this file, add the outcome to the spec's success criteria, and record what the research actually found — wrong names, corrected heights, socket lists that were wrong in either direction. Commit as `docs: close out the cooler research plan - 53/53`.

- [ ] **Step 8: Report to the user, and stop**

🛑 **Do not push and do not run `npm run catalog:push`.** Report:

- the coverage figure and the verdict-snapshot movement,
- every product name re-pointed and every value corrected,
- that `main` is ahead of `origin` and the catalogue is now out of step with Supabase, so **`npm run catalog:push -- --apply` and the push are the user's to run**. ⚠️ `-- --apply` with both dashes; `-- apply` silently dry-runs.

---

## Success criteria

- `npm run catalog:coverage` reports **cooler 53/53 (100%)**, and the other four categories are unchanged at 100%.
- `partSources.test.js` passes with `cooler` in `VERIFIED_CATEGORIES`, and the ratchet is **proved non-vacuous**.
- **Zero `unverified` parts in either reference build** in `verdictSpread`.
- `specs.radiator` appears nowhere in `src/` or `scripts/`, and `coolerCapacityW` reads the researched number.
- Lint, unit, e2e, build and prerender all green.
