# RAM catalogue research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 52 RAM kits up to the research standard — verify `ramType`, `capacityGb`, `speed` and `specs.sticks` against each maker's page, record provenance, and stop `specSheetContent` rendering "1 sticks".

**Architecture:** Task 1 teaches the coverage core about RAM with a **flat** required list — RAM, unlike coolers and storage, is not conditional; every kit owes all four fields. Task 2 fixes the live pluralisation defect up front, because it is user-visible and independent of the research. Tasks 3–7 research 52 kits under protocol M. Task 8 switches the ratchet on. There is **no new field and no new rule** — every field the RAM rules read already exists, so this is re-verification, provenance and the ratchet, plus the one copy fix.

**Tech Stack:** Node 22 ESM scripts, Vitest, ESLint, the in-app Browser (`mcp__Claude_Browser__*`) for research, `scripts/house-json.mjs` for every JSON write.

**Spec:** `docs/superpowers/specs/2026-09-03-ram-catalogue-research-design.md`

---

## Before you start: things that will bite you

1. 🛑 **`sticks` is the suspect field, and it is a *silent under-block* when
   wrong.** It reads `2` on 50 of 52 rows — a default, not a read. The kit
   layout (N×M) is **part of the SKU**: a "16GB" kit is a single 1×16 module or
   a 2×8 pair, and only the maker's part number says which. A 4-stick kit
   mislabelled 2 is waved onto a 2-slot mini-ITX board it cannot populate, and
   nothing surfaces it. Read the layout, never infer it from the capacity.

2. 🛑 **Never write these JSON files with `JSON.stringify(obj, null, 2)`.** Use
   `scripts/house-json.mjs`, which proves a byte-for-byte round trip before it
   writes. A plain stringify buries a ten-row change in a multi-thousand-line
   diff.

3. ⚠️ **`sticks` must NOT join `RESEARCHED_KEYS` until Task 8.** All 52 rows
   carry `specs.sticks` today, so adding the key before every row has a source
   fails the suite instantly against 52 values. This is the
   `rating`/`height`/`readMbps` precedent, a **fourth** time.

4. ⚠️ **`ram` must NOT join `VERIFIED_CATEGORIES` until Task 8.**
   `missingRatchetSources` would demand a `ramType` and `capacityGb` source for
   all 52 the moment the category is listed.

5. 🛑 **GREP EVERY CATEGORY BEFORE PUTTING A KEY IN THE GLOBAL
   `RESEARCHED_KEYS`.** The cooler project put `type` there and it failed
   against 59 cases. `specs.sticks` has been checked and is **RAM-only today**,
   but Task 8 Step 1 re-confirms it before adding — the check is the discipline,
   not the answer.

6. 🛑 **`speed` goes in NEITHER enforcement list.** It is TOP-LEVEL, so
   `RESEARCHED_KEYS` (which reads `part.specs` only) cannot hold it, and it is
   **deliberately not ratcheted** — no rule blocks on it. It is sourced for all
   52 and demanded by the coverage *report* via `EXPECTED.ram.required`, exactly
   as GPU's `vram`/`memType` are. Do not "fix" its absence from the lists.

7. ⚠️ **A first-match extraction over a family page reads the wrong kit's row.**
   RAM makers list every capacity, speed and kit-size of a family on one page.
   Anchor on the exact SKU — capacity, speed AND stick count together.

8. ⚠️ **`node -e` in the Bash tool eats backticks and apostrophes.** Write a
   `.mjs` to the scratchpad and run it.

9. ⚠️ **Do not push.** `git push`, `npm run catalog:push` and any deploy are the
   user's to run. `main` is **already far ahead of origin** with the cooler and
   storage tranches in it, and the spec for this project on top.

## File structure

| file | responsibility | tasks |
|---|---|---|
| `scripts/catalog-coverage-core.mjs` | `EXPECTED.ram` (flat), `RATCHETED_KEYS.ram` | 1 |
| `src/tests/catalogCoverage.test.js` | coverage tests for RAM | 1 |
| `src/lib/specSheetContent.js` | the hardcoded `"sticks"` at `:98` | 2 |
| `src/tests/specSheetCopy.test.js` | a test that no kit renders "1 sticks" | 2 |
| `src/data/partsData.json` | the 52 kit rows | 3–7 |
| `data/partSources.json` | one provenance entry per researched field | 3–7 |
| `prerendered/*.html` | committed fragments; go stale silently | 2, 8 |
| `src/tests/partSources.test.js` | `RESEARCHED_KEYS`, `VERIFIED_CATEGORIES` | 8 |

---

## Research protocol M

**Every row in Tasks 3–7 follows this exact protocol.** It is protocol R (case
plan) as refined by the storage plan (protocol S), with the RAM values named
here. Do not improvise a shortcut.

For each kit id:

1. **Open the maker's own product or spec page for that exact kit — model,
   capacity AND stick count.** 🛑 **The kit layout is part of the SKU.** One
   family page covers every capacity, speed and kit-size; the part number (e.g.
   Corsair `CMK32GX5...`, G.Skill `F5-...`) distinguishes a 2×16 kit from a
   single 1×16 module. Anchor on the exact SKU.

   Check the maker's line-up first: across the six earlier categories, **wrong
   product names recurred in every one.** Re-point a wrong name and **keep the
   id**.

2. **Read four values:**

   - **`ramType`** (top level) — `"DDR4"` or `"DDR5"`, the catalogue's two
     tokens. 🛑 **`compatibility.js` hard-blocks on this** in three directions
     (kit vs board, board vs kit, DDR4 on a DDR5-only socket). A wrong token
     refuses a correct build in silence.

   - **`capacityGb`** (top level) — the kit's **total** capacity as printed. A
     "32GB" kit is `32`. ⚠️ **RAM is binary** — a 32GB kit is 32 GiB and every
     maker prints the same number — so unlike storage there is no decimal/binary
     trap. Store it as stated.

   - **`speed`** (top level) — the kit's **rated XMP/EXPO** transfer rate in
     MT/s (e.g. `6000`), the number in the product name. ⚠️ **Not the JEDEC base
     speed** a DDR5 kit falls back to without its profile. Record the rated
     figure the maker headlines.

   - **`specs.sticks`** — the number of DIMMs in the kit. 🛑 **The suspect
     field.** `2` today on all but the two 8GB kits; several are wrong. Read the
     kit description: "2 x 16GB" → `2`, a single "16GB module" → `1`.

3. **Cross-check `sticks`** — it is the value most likely wrong and least likely
   to be noticed. Two independent checks:

   - **The division invariant:** `capacityGb ÷ sticks` must be a real DIMM size —
     one of **8, 16, 24, 32, 48** GB. `16 ÷ 2 = 8` ✓, `16 ÷ 1 = 16` ✓,
     `64 ÷ 2 = 32` ✓ or `64 ÷ 4 = 16` ✓, `96 ÷ 2 = 48` ✓, `48 ÷ 2 = 24` ✓.
   - **The SKU wording:** the maker's own listing says "Kit (2 x …)" or sells it
     as a single module. Take that, not the capacity.

   ⚠️ **The current data has a visible tell:** every kit reads `2` except the two
   8GB parts. Treat each 16GB row as a prompt to check the single-vs-pair
   question, and each 64GB DDR4 row as a prompt to check 2×32 vs 4×16.

4. **Write the values** with the Task 3 Step 2 writer.

5. **If the maker no longer publishes a figure** (a discontinued kit whose page
   is gone), record it unverifiable and **remove the field**:

   ```json
   { "checkedOn": "2026-09-03", "result": "unverifiable", "note": "kit discontinued; no maker page states the stick count for this SKU, and the retailer listings disagree" }
   ```

   ⚠️ An unverifiable entry must have `checkedOn` and a non-empty `note`, and
   must **not** carry a `url`. ⚠️ RAM fields are almost always published (they are
   in the name and SKU), so this should be rare. The storage project's
   secondary-source exception is available if a maker page is unreadable but the
   kit is still sold — surface it and ask before leaning on it.

6. **Where a re-verified value disagrees, change it, and name the old value in
   the commit message.**

### The shape a finished kit takes

⚠️ **SHAPE ONLY — every value is illustrative. Never copy these in.**

```json
{
  "id": "ram-example",
  "category": "ram",
  "name": "Example Vengeance DDR5-6000 32GB",
  "brand": "Example",
  "price": 89.99,
  "ramType": "DDR5",
  "speed": 6000,
  "capacityGb": 32,
  "tdp": 6,
  "specs": { "sticks": 2 }
}
```

```json
"ram-example": {
  "ramType": { "url": "https://example.com/kit/spec", "checkedOn": "2026-09-03" },
  "capacityGb": { "url": "https://example.com/kit/spec", "checkedOn": "2026-09-03" },
  "speed": { "url": "https://example.com/kit/spec", "checkedOn": "2026-09-03", "note": "rated XMP/EXPO speed" },
  "sticks": { "url": "https://example.com/kit/spec", "checkedOn": "2026-09-03", "note": "kit of 2 x 16GB (part no. CMK32GX5M2...)" }
}
```

⚠️ `tdp` stays exactly as it is and **must never get a source entry** — it is the
app's own draw estimate, like the motherboard/PSU/cooler `tdp`.

---

## Task 1: Coverage learns RAM

**Files:**
- Modify: `scripts/catalog-coverage-core.mjs` (`EXPECTED`, `RATCHETED_KEYS`)
- Test: `src/tests/catalogCoverage.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/catalogCoverage.test.js`:

```js
describe('ram expectations', () => {
  const kit = (id, over = {}) =>
    ({ id, category: 'ram', ramType: 'DDR5', speed: 6000, capacityGb: 32, specs: { sticks: 2 }, ...over })

  it('expects the four fields the rules read, flat for every kit', () => {
    expect(requiredFor(EXPECTED.ram, kit('a')))
      .toEqual(['ramType', 'speed', 'capacityGb', 'sticks'])
    // A DDR4 single-DIMM kit owes exactly the same four - RAM is not conditional.
    expect(requiredFor(EXPECTED.ram, kit('b', { ramType: 'DDR4', capacityGb: 8, specs: { sticks: 1 } })))
      .toEqual(['ramType', 'speed', 'capacityGb', 'sticks'])
  })

  it('counts a fully sourced kit as verified', () => {
    const parts = [kit('a')]
    const sources = { a: { ramType: src(), speed: src(), capacityGb: src(), sticks: src() } }
    expect(coverageFor('ram', parts, sources).verified).toBe(1)
  })

  it('does not verify a kit whose sticks was never sourced', () => {
    const parts = [kit('a')]
    const sources = { a: { ramType: src(), speed: src(), capacityGb: src() } }
    expect(coverageFor('ram', parts, sources).verified).toBe(0)
  })

  it('ratchets the two top-level block-driving fields and no others', () => {
    expect(RATCHETED_KEYS.ram).toEqual(['ramType', 'capacityGb'])
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: FAIL — `EXPECTED.ram` and `RATCHETED_KEYS.ram` are `undefined`.

- [ ] **Step 3: Add the expectations**

In `scripts/catalog-coverage-core.mjs`, add to `EXPECTED` after `storage`:

```js
  // The seventh category, and the first FLAT conditional-free one since PSUs:
  // every kit owes all four fields, so there are no `variants`. Two rules read
  // a kit and both are covered here - `ramType` (compatibility.js's DDR match
  // and the DDR5-only-socket block) and `sticks`/`capacityGb` (specRules rule
  // 5). `speed` is required so a future kit owes a source, but it is not
  // ratcheted: no rule blocks on it, only buildWarnings advises on it.
  ram: {
    required: ['ramType', 'speed', 'capacityGb', 'sticks'],
    optional: [],
  },
```

Add to `RATCHETED_KEYS` after `storage`:

```js
  // `ramType` hard-blocks in compatibility.js and `capacityGb` block-drives
  // rule 5; both are top-level, so they belong here rather than in the
  // specs-only RESEARCHED_KEYS. `capacityGb` is shared with storage, which is
  // exactly why RATCHETED_KEYS is per-category - the two never collide.
  //
  // `speed` is absent deliberately: required by EXPECTED so a future kit owes a
  // source, but no rule blocks on it. `sticks` is absent because it is a
  // `specs.*` field - it is enforced by RESEARCHED_KEYS in partSources.test.js.
  ram: ['ramType', 'capacityGb'],
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: PASS.

- [ ] **Step 5: Confirm the category reports zero and the others are unchanged**

```bash
npm run catalog:coverage
```

Expected: `ram: 0/52 parts fully researched (0%)`, with `ramType 52/52`,
`speed 52/52`, `capacityGb 52/52` and `sticks 52/52` all **present** but
0 sourced. The six finished categories must print **byte-identically** at 100%.

- [ ] **Step 6: Full suite, lint, commit**

```bash
npm run test:run && npm run lint
git add scripts/catalog-coverage-core.mjs src/tests/catalogCoverage.test.js
git commit -m "feat: expect four fields of a ram kit"
```

---

## Task 2: Fix the live pluralisation defect

🛑 **This comes BEFORE the research, because it is a grammatical falsehood
already shipped to users on the two single-DIMM kits, and it does not depend on
any researched value. Correcting `sticks` to `1` on more kits in Tasks 3–7 would
spread it.**

**Files:**
- Modify: `src/lib/specSheetContent.js:98`
- Test: `src/tests/specSheetCopy.test.js`

- [ ] **Step 1: Write the failing test**

Add to `src/tests/specSheetCopy.test.js` (it already imports `insight`, `partsData`
and defines `ofCat`):

```js
// 🛑 specSheetContent.js:98 hardcoded the word "sticks", so a single-DIMM kit
// rendered "8GB across 1 sticks". partPages.js:145 prints the same field through
// count(n, 'stick') and pluralises correctly - two readers, one robust, one not,
// exactly the storage partPages cable bug. The two 8GB kits ship this today.
describe('a single-DIMM kit is not described as "1 sticks"', () => {
  const singles = ofCat(partsData, 'ram').filter((p) => p.specs?.sticks === 1)

  it('has a single-DIMM kit to describe', () => {
    expect(singles.length).toBeGreaterThan(0)
  })

  it('never renders "1 sticks"', () => {
    for (const kit of singles) {
      expect(insight(kit), kit.id).not.toMatch(/\b1 sticks\b/)
      expect(insight(kit), kit.id).toMatch(/\b1 stick\b/)
    }
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/tests/specSheetCopy.test.js
```

Expected: FAIL — the two 8GB kits render "1 sticks".

- [ ] **Step 3: Fix the pluralisation**

`src/lib/specSheetContent.js:98` — replace:

```js
      return `${part.capacityGb}GB across ${s.sticks ?? 2} sticks of ${part.ramType}-${part.speed}. ` +
```

with:

```js
      // ⚠️ Pluralise: a single-DIMM kit read "1 sticks" until 2026-09-03. The
      // sibling reader partPages.js:145 already does this through count().
      return `${part.capacityGb}GB across ${s.sticks ?? 2} stick${(s.sticks ?? 2) === 1 ? '' : 's'} of ${part.ramType}-${part.speed}. ` +
```

- [ ] **Step 4: Run the test and the sibling copy suite**

```bash
npx vitest run src/tests/specSheetCopy.test.js
```

Expected: PASS, and the existing "described in transfer rates, not clocks" block
still green.

- [ ] **Step 5: Re-render and check the diff**

```bash
npm run prerender && git diff --stat prerendered/
```

Expected: the two 8GB kits' pages change from "1 sticks" to "1 stick". ⚠️ **A
failed prerender leaves the folder untouched, so a clean `git diff` can also mean
it never ran** — read the command's own output line.

- [ ] **Step 6: Full suite, lint, commit**

```bash
npm run test:run && npm run lint
git add src/lib/specSheetContent.js src/tests/specSheetCopy.test.js prerendered
git commit -m "fix: stop describing a single-DIMM kit as \"1 sticks\""
```

---

## Tasks 3–7: the data tranches

Five tranches, by brand. **Every row follows research protocol M.** Each task
has the same five steps, written out in full in Task 3; later tranches give
their own rows, traps and commit, and refer to Task 3 Step 2 for the writer.

### Task 3: G.Skill — 15 rows

**Files:** Create `<scratchpad>/apply-tranche.mjs`; modify `src/data/partsData.json`, `data/partSources.json`

| id | name | type | speed | GB | sticks now |
|---|---|---|---|---|---|
| `ram-gskill-ddr5-32` | G.Skill Trident Z5 DDR5-6000 32GB | DDR5 | 6000 | 32 | 2 |
| `ram-gskill-ddr5-64` | G.Skill Trident Z5 RGB DDR5-6400 64GB | DDR5 | 6400 | 64 | 2 |
| `ram-gskill-ddr4-16` | G.Skill Ripjaws V DDR4-3600 16GB | DDR4 | 3600 | 16 | 2 |
| `ram-gskill-ddr5-48` | G.Skill Trident Z5 DDR5-6400 48GB | DDR5 | 6400 | 48 | 2 |
| `ram-gskill-ddr5-32-6000` | G.Skill Flare X5 DDR5-6000 32GB | DDR5 | 6000 | 32 | 2 |
| `ram-gskill-ddr4-32-3600` | G.Skill Trident Z RGB DDR4-3600 32GB | DDR4 | 3600 | 32 | 2 |
| `ram-gskill-ddr5-8000-32` | G.Skill Trident Z5 CK CUDIMM DDR5-8000 32GB | DDR5 | 8000 | 32 | 2 |
| `ram-gskill-neo-ddr5-6000-64` | G.Skill Trident Z5 Neo DDR5-6000 64GB | DDR5 | 6000 | 64 | 2 |
| `ram-gskill-ripjaws-s5-16` | G.Skill Ripjaws S5 DDR5-5600 16GB | DDR5 | 5600 | 16 | 2 |
| `ram-gskill-ddr4-3200-32` | G.Skill Ripjaws V DDR4-3200 32GB | DDR4 | 3200 | 32 | 2 |
| `ram-gskill-z5-7200-32` | G.Skill Trident Z5 RGB DDR5-7200 32GB | DDR5 | 7200 | 32 | 2 |
| `ram-gskill-s5-ddr5-6000-32` | G.Skill Ripjaws S5 DDR5-6000 32GB | DDR5 | 6000 | 32 | 2 |
| `ram-gskill-neo-rgb-ddr5-6000-32` | G.Skill Trident Z5 Neo RGB DDR5-6000 32GB | DDR5 | 6000 | 32 | 2 |
| `ram-gskill-z5-rgb-ddr5-6000-48` | G.Skill Trident Z5 RGB DDR5-6000 48GB | DDR5 | 6000 | 48 | 2 |
| `ram-gskill-aegis-ddr4-3200-16` | G.Skill Aegis DDR4-3200 16GB | DDR4 | 3200 | 16 | 2 |

**Entry point:** `gskill.com/products` — navigate to the exact model. ⚠️ Entry
points are to navigate from, not to cite.

**Traps:** 🛑 **The three 16GB kits are the correction candidates** —
`ram-gskill-ddr4-16` (Ripjaws V), `ram-gskill-ripjaws-s5-16` (Ripjaws S5) and
`ram-gskill-aegis-ddr4-3200-16` (Aegis) all claim 2; G.Skill sells 16GB as both
1×16 and 2×8. Read the F5-/F4- part number. ⚠️ **`ram-gskill-ddr5-8000-32` is a
CUDIMM kit** — its `ramType` is still `DDR5` and `speed` is `8000`; CUDIMM
board-support is **out of scope** (no board-side flag), so record only the four
standard fields. ⚠️ The 48GB kits are 2×24 and the 64GB kits 2×32 — confirm, do
not assume. ⚠️ G.Skill's specs are on a per-kit tabbed page; the "Specification"
tab lists the DIMM count as "2" or the module organisation.

- [ ] **Step 1: Research all fifteen rows under protocol M**

For each id, open G.Skill's page for that exact kit, read `ramType`,
`capacityGb`, `speed` and `specs.sticks`, run the division and SKU cross-checks,
and record the URL you opened.

- [ ] **Step 2: Write the values with the house serializer**

Create `<scratchpad>/apply-tranche.mjs` — written once, reused by Tasks 4–7:

```js
// Applies one research tranche to both data files, in the repo's own JSON
// style. Refuses to write unless house-json round-trips BOTH files first.
// Run from the REPO ROOT (house-json reads relative paths).
import { readFileSync, writeFileSync } from 'node:fs'
// ⚠️ An ABSOLUTE file: URL - the scratchpad is not inside the repo.
import { FILES, toFile, roundTripOk } from 'file:///C:/Users/jacob/IdeaProjects/CustomPc/scripts/house-json.mjs'

// EDIT PER TRANCHE. `part` merges into the part (top-level ramType/capacityGb/
// speed), `specs` into its specs (sticks; null DELETES a key), `sources` into
// that part's provenance entry.
const TRANCHE = {
  'ram-example': {
    part: { ramType: 'DDR5', capacityGb: 32, speed: 6000 },
    specs: { sticks: 2 },
    sources: {
      ramType: { url: 'https://gskill.com/x', checkedOn: '2026-09-03' },
      capacityGb: { url: 'https://gskill.com/x', checkedOn: '2026-09-03' },
      speed: { url: 'https://gskill.com/x', checkedOn: '2026-09-03', note: 'rated XMP speed' },
      sticks: { url: 'https://gskill.com/x', checkedOn: '2026-09-03', note: 'kit of 2 x 16GB' },
    },
  },
}
const RENAME = {}

if (!roundTripOk(true)) {
  console.error('house-json does not round-trip the files as they stand; fix that before writing')
  process.exit(1)
}

const parts = JSON.parse(readFileSync('src/data/partsData.json', 'utf8'))
const sources = JSON.parse(readFileSync('data/partSources.json', 'utf8'))

for (const [id, entry] of Object.entries(TRANCHE)) {
  const part = parts.find((p) => p.id === id)
  if (!part) throw new Error(`no part with id ${id}`)
  const before = { t: part.ramType, c: part.capacityGb, sp: part.speed, st: part.specs?.sticks }
  Object.assign(part, entry.part ?? {})
  for (const [k, v] of Object.entries(entry.specs ?? {})) {
    if (v === null) delete part.specs[k]
    else part.specs[k] = v
  }
  if (before.t !== part.ramType) console.log(`type   ${id}: ${before.t} -> ${part.ramType}`)
  if (before.c !== part.capacityGb) console.log(`gb     ${id}: ${before.c} -> ${part.capacityGb}`)
  if (before.sp !== part.speed) console.log(`speed  ${id}: ${before.sp} -> ${part.speed}`)
  if (before.st !== part.specs?.sticks) console.log(`sticks ${id}: ${before.st} -> ${part.specs?.sticks}`)
  sources[id] = { ...(sources[id] ?? {}), ...(entry.sources ?? {}) }
}

for (const [id, name] of Object.entries(RENAME)) {
  const part = parts.find((p) => p.id === id)
  if (!part) throw new Error(`no part with id ${id}`)
  console.log(`rename ${id}: ${JSON.stringify(part.name)} -> ${JSON.stringify(name)}`)
  part.name = name
}

writeFileSync('src/data/partsData.json', toFile(parts, FILES['src/data/partsData.json']))
writeFileSync('data/partSources.json', toFile(sources, FILES['data/partSources.json']))
console.log(`applied ${Object.keys(TRANCHE).length} rows`)
```

Replace `TRANCHE` with this tranche's fifteen rows, then:

```bash
node "$CLAUDE_SCRATCHPAD/apply-tranche.mjs"
```

Expected: two `MATCH` lines from `house-json`, any `sticks …` correction lines,
then `applied 15 rows`.

- [ ] **Step 3: Check the diff is small**

```bash
git diff --stat src/data/partsData.json data/partSources.json
```

Expected: tens of lines. **A multi-thousand-line diff means the serializer was
bypassed — revert and fix.**

- [ ] **Step 4: Verify**

```bash
npm run catalog:coverage && npm run test:run && npm run lint
```

Expected: `ram: 15/52 (29%)` and PASS.

⚠️ **The verdict snapshot can move.** A `sticks` correction **upward** (a kit that
is really 4×16 marked 2) flips rule 5 on a 2-slot board, and a `ramType` or
`capacityGb` correction changes `compatibility.js` or rule 5 directly. If
`src/tests/verdictSpread.test.js` fails, update its snapshot and **read the
diff**: every change must be explicable by a specific corrected value.

- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the fifteen G.Skill kits"
```

⚠️ Name any corrected value in the commit message.

### Task 4: Corsair — 13 rows

| id | name | type | speed | GB | sticks now |
|---|---|---|---|---|---|
| `ram-corsair-ddr5-32` | Corsair Vengeance DDR5-5600 32GB | DDR5 | 5600 | 32 | 2 |
| `ram-corsair-ddr4-32` | Corsair Vengeance DDR4-3200 32GB | DDR4 | 3200 | 32 | 2 |
| `ram-corsair-ddr5-64` | Corsair Dominator Platinum DDR5-6000 64GB | DDR5 | 6000 | 64 | 2 |
| `ram-corsair-ddr4-16` | Corsair Vengeance LPX DDR4-3200 16GB | DDR4 | 3200 | 16 | 2 |
| `ram-corsair-ddr5-32-6400` | Corsair Vengeance RGB DDR5-6400 32GB | DDR5 | 6400 | 32 | 2 |
| `ram-corsair-ddr4-64` | Corsair Vengeance LPX DDR4-3200 64GB | DDR4 | 3200 | 64 | 2 |
| `ram-corsair-ddr5-6000-32` | Corsair Vengeance DDR5-6000 32GB CL30 | DDR5 | 6000 | 32 | 2 |
| `ram-corsair-ddr4-3600-32` | Corsair Vengeance LPX DDR4-3600 32GB | DDR4 | 3600 | 32 | 2 |
| `ram-corsair-ddr5-5600-16` | Corsair Vengeance DDR5-5600 16GB | DDR5 | 5600 | 16 | 2 |
| `ram-corsair-ddr5-6000-64` | Corsair Vengeance DDR5-6000 64GB CL30 | DDR5 | 6000 | 64 | 2 |
| `ram-corsair-ddr5-5200-32` | Corsair Vengeance DDR5-5200 32GB | DDR5 | 5200 | 32 | 2 |
| `ram-corsair-ddr5-6400-96` | Corsair Vengeance DDR5-6400 96GB | DDR5 | 6400 | 96 | 2 |
| `ram-corsair-lpx-ddr4-3200-8` | Corsair Vengeance LPX DDR4-3200 8GB | DDR4 | 3200 | 8 | 1 |

**Entry point:** `corsair.com`.

**Traps:** 🛑 **`ram-corsair-ddr4-64` (Vengeance LPX 64GB) is the 2×32-vs-4×16
case** — Corsair sells DDR4-3200 64GB as both, under different SKUs. Read the
`CMK64GX4M2...` (2 sticks) vs `...M4...` (4 sticks) part number; a wrong 2 here
is the exact silent under-block gotcha 1 warns about. ⚠️ **The two 16GB kits**
(`ram-corsair-ddr4-16`, `ram-corsair-ddr5-5600-16`) are the 1×16-vs-2×8
candidates. ⚠️ **"CL30" in two names is CAS latency — out of scope.** Timings are
not collected; do not add a field for them. ⚠️ The 96GB kit is 2×48 and the two
64GB DDR5 kits are 2×32 — confirm. ⚠️ Corsair's spec tab lists "SDRAM Capacity"
per module and "Memory Kit Capacity" total; the stick count is the kit ÷ module.

- [ ] **Step 1: Research all thirteen rows under protocol M**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect two `MATCH` lines, then `applied 13 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `ram: 28/52 (54%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the thirteen Corsair kits"
```

### Task 5: Kingston — 8 rows

| id | name | type | speed | GB | sticks now |
|---|---|---|---|---|---|
| `ram-kingston-ddr5-16` | Kingston Fury Beast DDR5-5200 16GB | DDR5 | 5200 | 16 | 2 |
| `ram-kingston-ddr4-32` | Kingston Fury Beast DDR4-3200 32GB | DDR4 | 3200 | 32 | 2 |
| `ram-kingston-ddr5-32` | Kingston Fury Beast DDR5-6000 32GB | DDR5 | 6000 | 32 | 2 |
| `ram-kingston-ddr4-16` | Kingston Fury Beast DDR4-3200 16GB | DDR4 | 3200 | 16 | 2 |
| `ram-kingston-fury-ddr5-6400-32` | Kingston Fury Renegade DDR5-6400 32GB | DDR5 | 6400 | 32 | 2 |
| `ram-kingston-renegade-64` | Kingston Fury Renegade DDR5-6400 64GB | DDR5 | 6400 | 64 | 2 |
| `ram-kingston-beast-ddr5-5600-32` | Kingston Fury Beast DDR5-5600 32GB | DDR5 | 5600 | 32 | 2 |
| `ram-kingston-beast-ddr4-3600-32` | Kingston Fury Beast DDR4-3600 32GB | DDR4 | 3600 | 32 | 2 |

**Entry point:** `kingston.com`.

**Traps:** 🛑 **The two 16GB Fury Beast kits** (`ram-kingston-ddr5-16`,
`ram-kingston-ddr4-16`) are the correction candidates — Kingston's KF-part
suffix `1` = single module, `2` = kit of two. ⚠️ Kingston sells Fury Beast and
Renegade as both single sticks and matched kits at the same capacity; the SKU is
the only reliable discriminator. ⚠️ The 64GB Renegade is 2×32 — confirm.

- [ ] **Step 1: Research all eight rows under protocol M**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect `applied 8 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `ram: 36/52 (69%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the eight Kingston kits"
```

### Task 6: TeamGroup — 7 rows

| id | name | type | speed | GB | sticks now |
|---|---|---|---|---|---|
| `ram-teamgroup-ddr5-32` | TeamGroup T-Force Delta DDR5-6000 32GB | DDR5 | 6000 | 32 | 2 |
| `ram-teamgroup-ddr4-32` | TeamGroup T-Force Vulcan DDR4-3600 32GB | DDR4 | 3600 | 32 | 2 |
| `ram-teamgroup-tcreate-ddr5-6400-48` | TeamGroup T-Create Expert DDR5-6400 48GB | DDR5 | 6400 | 48 | 2 |
| `ram-team-ddr5-6000-16` | TeamGroup T-Force Delta DDR5-6000 16GB | DDR5 | 6000 | 16 | 2 |
| `ram-teamgroup-ddr5-16` | TeamGroup Elite DDR5-5600 16GB | DDR5 | 5600 | 16 | 2 |
| `ram-teamgroup-delta-rgb-ddr5-6400-32` | TeamGroup T-Force Delta RGB DDR5-6400 32GB | DDR5 | 6400 | 32 | 2 |
| `ram-teamgroup-elite-ddr4-3200-16` | TeamGroup Elite DDR4-3200 16GB | DDR4 | 3200 | 16 | 2 |

**Entry point:** `teamgroupinc.com`.

**Traps:** 🛑 **Three 16GB kits** (`ram-team-ddr5-6000-16`,
`ram-teamgroup-ddr5-16`, `ram-teamgroup-elite-ddr4-3200-16`) — the Elite line in
particular ships many 1×16 single modules, so these are the strongest single-DIMM
candidates in the project. ⚠️ **TeamGroup publishes several regional spec tables
that disagree** (the storage project hit this with the MP44L); take the global
`teamgroupinc.com` figures. ⚠️ The 48GB T-Create is 2×24 — confirm.

- [ ] **Step 1: Research all seven rows under protocol M**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect `applied 7 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `ram: 43/52 (83%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the seven TeamGroup kits"
```

### Task 7: Crucial and Patriot — 9 rows

| id | name | type | speed | GB | sticks now |
|---|---|---|---|---|---|
| `ram-crucial-ddr5-16` | Crucial DDR5-4800 16GB | DDR5 | 4800 | 16 | 2 |
| `ram-crucial-ddr4-16` | Crucial Ballistix DDR4-3200 16GB | DDR4 | 3200 | 16 | 2 |
| `ram-crucial-pro-ddr5-5600-32` | Crucial Pro DDR5-5600 32GB | DDR5 | 5600 | 32 | 2 |
| `ram-crucial-ddr5-5600-64` | Crucial Pro DDR5-5600 64GB | DDR5 | 5600 | 64 | 2 |
| `ram-crucial-pro-ddr5-6000-32` | Crucial Pro DDR5-6000 32GB | DDR5 | 6000 | 32 | 2 |
| `ram-crucial-ddr4-3200-8` | Crucial DDR4-3200 8GB | DDR4 | 3200 | 8 | 1 |
| `ram-patriot-ddr5-6000-32` | Patriot Viper Venom DDR5-6000 32GB | DDR5 | 6000 | 32 | 2 |
| `ram-patriot-ddr4-16` | Patriot Viper Steel DDR4-3200 16GB | DDR4 | 3200 | 16 | 2 |
| `ram-patriot-venom-ddr5-6400-32` | Patriot Viper Venom DDR5-6400 32GB | DDR5 | 6400 | 32 | 2 |

**Entry points:** `crucial.com`, `viper.patriotmemory.com` / `patriotmemory.com`.

**Traps:** 🛑 **This tranche closes the category.** 🛑 **`ram-crucial-ddr5-16`
(plain "Crucial DDR5-4800 16GB", no Ballistix/Pro) is the single most likely
single-DIMM in the project** — Crucial's own-brand basic memory sells 16GB
overwhelmingly as one 1×16 module (part `CT16G48C40U5`), not a pair. If its
`sticks` really is 1, that is the headline correction. ⚠️ **Crucial is a Micron
consumer brand and some pages redirect** to Micron/`crucial.com/…`; cite where
you land. ⚠️ `ram-crucial-ddr4-16` (Ballistix) and `ram-patriot-ddr4-16` (Viper
Steel) are the other 16GB single-vs-pair candidates. ⚠️ The 64GB Crucial Pro is
2×32 — confirm.

- [ ] **Step 1: Research all nine rows under protocol M**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect `applied 9 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `ram: 52/52 parts fully researched (100%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the six Crucial and three Patriot kits"
```

---

## Task 8: Switch the ratchet on

**Files:** `src/tests/partSources.test.js`, then `prerendered/*`

- [ ] **Step 1: Check every key for a collision BEFORE adding it**

🛑 Gotcha 5. Run this first:

```bash
node -e "const d=require('./src/data/partsData.json');for(const k of ['sticks','ramType','capacityGb','speed']){const by={};for(const p of d){const v=p.specs?.[k]!==undefined||p[k]!==undefined;if(v)by[p.category]=(by[p.category]||0)+1}console.log(k,JSON.stringify(by))}"
```

Expected: `sticks` appears **only** under `ram`. (`capacityGb` also shows
`storage` — that is why it is a `RATCHETED_KEYS` per-category key, not a global
`RESEARCHED_KEYS` one. `ramType` and `speed` are top-level, handled below /
already handled.) If `sticks` shows another category, it goes in
`RESEARCHED_KEYS_BY_CATEGORY`, not the global list.

- [ ] **Step 2: Add the key and the category**

In `src/tests/partSources.test.js`, add to `RESEARCHED_KEYS`:

```js
  // ⚠️ Fourth time for this rule: `sticks` could only join once all 52 kits had
  // a source. Safe in the GLOBAL list because RAM is the only category carrying
  // a `specs.sticks` at all (Step 1 proves it).
  //
  // 🛑 `ramType`, `capacityGb` and `speed` are deliberately NOT here. All three
  // are TOP-LEVEL, so this list - which reads `part.specs` only - would never
  // see them. `ramType` and `capacityGb` are enforced by RATCHETED_KEYS.ram;
  // `speed` is intentionally unenforced by a unit test, demanded only by the
  // coverage report, because no rule blocks on it.
  'sticks',
```

and add `ram` to `VERIFIED_CATEGORIES`:

```js
const VERIFIED_CATEGORIES = new Set(['gpu', 'case', 'psu', 'motherboard', 'cooler', 'storage', 'ram'])
```

- [ ] **Step 3: Run the suite**

```bash
npm run test:run
```

Expected: PASS. A failure names the exact `<id>.<field>` still missing
provenance — finish that row rather than weakening the list.

- [ ] **Step 4: Prove the ratchet is non-vacuous on all three demanded keys**

Delete one kit's `ramType` source, run, expect FAIL naming it; restore. Repeat
for `capacityGb` (the other `RATCHETED_KEYS.ram` key) and for `sticks` (the
`RESEARCHED_KEYS` key).

```bash
npx vitest run src/tests/partSources.test.js
git checkout -- data/partSources.json
```

⚠️ A ratchet that cannot fail is worth nothing. Do not skip, and do not test only
one key — `ramType` and `capacityGb` fail through `missingRatchetSources`,
`sticks` through the `RESEARCHED_KEYS` loop; they are different code paths and
checking one proves nothing about the others.

- [ ] **Step 5: Re-render — the data tranches left the part pages stale**

🛑 **`partPages.js:145` prints "across N stick(s)" on every RAM part page**, so
each `sticks` correction in Tasks 3–7 changed a page that was not re-rendered.
This is the mandatory catch-up:

```bash
npm run prerender && git diff --stat prerendered/
```

Expected: the part pages for every kit whose `sticks` changed. ⚠️ Read the
command's own output line — a failed prerender leaves the folder untouched and
`git diff` then lies "clean".

- [ ] **Step 6: Run everything**

```bash
npm run test:run && npm run lint && npm run build && npm run test:e2e
```

⚠️ **One 30 s e2e timeout fails the whole suite — re-run before blaming your
change.**

- [ ] **Step 7: Commit**

```bash
git add src/tests prerendered
git commit -m "feat: switch the ram ratchet on"
```

- [ ] **Step 8: Close out the plan and the spec**

Tick every checkbox, record what the research actually found — the real `sticks`
corrections, any `capacityGb`/`ramType`/`speed` changes, whether the verdict
snapshot moved and why — and commit as
`docs: close out the ram research plan - 52/52`.

- [ ] **Step 9: Report, and stop**

🛑 **Do not push and do not run `npm run catalog:push`.** Report the coverage
figure, the snapshot movement, every corrected value, and that **`main` is far
ahead of origin with the cooler and storage tranches already in it** — the merge
of this branch, the push and `npm run catalog:push -- --apply` are the user's.

---

## Success criteria

- `npm run catalog:coverage` reports **ram 52/52 (100%)**; the six finished categories unchanged.
- `partSources.test.js` passes with `ram` in `VERIFIED_CATEGORIES` and `sticks`
  in `RESEARCHED_KEYS`, proved **non-vacuous on all three demanded keys**
  (`ramType`, `capacityGb`, `sticks`).
- `specSheetContent.js` never renders "1 sticks", pinned by a test; `prerendered/`
  re-rendered after the bug fix and again after the data tranches.
- Every corrected `sticks`/`capacityGb`/`ramType`/`speed` value carries a
  `partSources.json` entry; every unpublished one is `unverifiable` with a note.
- Lint, unit, e2e, build and prerender all green.

---

## Outcome

_Filled in at close-out (Task 8 Step 8)._
