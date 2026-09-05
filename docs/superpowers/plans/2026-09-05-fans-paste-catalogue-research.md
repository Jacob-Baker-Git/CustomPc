# Fans + paste catalogue research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 46 fans and 15 paste rows up to the research standard — source the two maker fan specs (`size`, `rgb`; `count` is an app bundle, not researched), give paste one real spec (`amountG`, the tube weight) and enrich its spec sheet to show it, record provenance for every value, and report both categories in `catalog:coverage`.

**Architecture:** Task 1 teaches the coverage core about fans and paste with **flat** required lists (neither is conditional). Task 2 enriches the paste spec-sheet line so a reader for `amountG` exists before the data arrives. Tasks 3–7 research 61 rows under protocol F, brand-grouped so a maker who makes both fans and paste is done in one pass. Task 8 adds the four keys to the `RESEARCHED_KEYS` unit test. **This is the first category with no ratchet:** no compatibility rule reads a fan or a paste, so nothing joins `RATCHETED_KEYS` or `VERIFIED_CATEGORIES` — enforcement is the coverage report plus the `RESEARCHED_KEYS` test, and that is enough.

**Tech Stack:** Node 22 ESM scripts, Vitest, ESLint, the in-app Browser (`mcp__Claude_Browser__*`) for research, `scripts/house-json.mjs` for every JSON write.

**Spec:** `docs/superpowers/specs/2026-09-05-fans-paste-catalogue-research-design.md`

---

## Before you start: things that will bite you

1. 🛑 **There is NO ratchet, and that is deliberate — do not add one.** No rule
   reads a fan or a paste (a grep of `src/lib` finds only display, ordering and
   the app's own power estimate). So neither category goes in `RATCHETED_KEYS`
   or `VERIFIED_CATEGORIES`. Enforcement is the `RESEARCHED_KEYS` test in
   `partSources.test.js` (every present spec owes a source) plus the coverage
   report. Adding a `RATCHETED_KEYS.fans` is the reflex to resist — there is no
   top-level block-driving field to protect.

2. 🛑 **The writer must CREATE `part.specs` for a paste row.** Paste rows carry
   no `specs` object at all today. A writer that does `part.specs[k] = v`
   (like the RAM one) throws `Cannot set property of undefined` on the first
   paste. The Task 3 writer does `part.specs ??= {}` first — keep that line.

3. 🛑 **`EXPECTED.paste` breaks an existing test the moment it is added.**
   `src/tests/catalogCoverage.test.js:64-66` asserts `coverageFor('paste', [], {})`
   returns `null`, using `'paste'` as its example of a category with no
   expectations. Task 1 Step 3 re-points that test to a genuinely non-existent
   category. Do not skip it — the suite goes red otherwise.

4. 🛑 **Never write these JSON files with `JSON.stringify(obj, null, 2)`.** Use
   the Task 3 writer, which calls `scripts/house-json.mjs` and proves a
   byte-for-byte round trip of BOTH files before it writes. A plain stringify
   buries a small change in a multi-thousand-line diff.

5. ⚠️ **The four keys must NOT join `RESEARCHED_KEYS` until Task 8.** All 46 fans
   carry `size`/`count`/`rgb` and all 15 paste will carry `amountG` before the
   keys are listed, so adding a key earlier fails the suite instantly against
   unsourced values. This is the `rating`/`height`/`readMbps`/`sticks`/`cores`
   precedent, a **sixth** time.

6. 🛑 **GREP EVERY CATEGORY BEFORE PUTTING A KEY IN THE GLOBAL
   `RESEARCHED_KEYS`.** `size`, `count`, `rgb` have been checked and are
   **fans-only**; `amountG` exists nowhere until this project adds it. Task 8
   Step 1 re-confirms all four — the check is the discipline, not the answer.
   (`type` is the cautionary tale: it means "Air"/"AIO" on a cooler and "Mid
   Tower" on a case, so it lives in `RESEARCHED_KEYS_BY_CATEGORY`, not the global
   list.)

7. ⚠️ **`amountG` is verified against the maker's page, not copied from the
   name.** The name is a hint. `Cooler Master MasterGel Pro` has no amount in its
   name at all and must be read off the page — or recorded `unverifiable` if the
   fill weight is genuinely unpublished. Same product, different tube: MX-6 ships
   4 g and 8 g, NT-H2 3.5 g and 10 g — anchor each row on its own SKU page.

8. ⚠️ **The verdict snapshot CANNOT move.** No rule reads a fan or a paste, so a
   corrected `size`/`count`/`rgb`/`amountG` cannot flip a compatibility verdict.
   If `src/tests/verdictSpread.test.js` fails, something ELSE changed — stop and
   investigate; do not blindly update the snapshot.

9. ⚠️ **`node -e` in the Bash tool eats backticks and apostrophes.** Write a
   `.mjs` to the scratchpad and run it. The one `node -e` in Task 8 Step 1 is
   backtick-free on purpose.

10. ⚠️ **Do not push.** `git push`, `npm run catalog:push` and any deploy are the
    user's to run. `main` is **already far ahead of origin** with the cooler,
    storage, RAM and CPU tranches and the site-quality backlog in it, and this
    branch is unmerged on top.

## File structure

| file | responsibility | tasks |
|---|---|---|
| `scripts/catalog-coverage-core.mjs` | `EXPECTED.fans`, `EXPECTED.paste` (flat). **No `RATCHETED_KEYS` change.** | 1 |
| `src/tests/catalogCoverage.test.js` | coverage tests for fans + paste; re-point the `paste`-null test | 1 |
| `src/lib/specSheetContent.js` | enrich the paste line at `:129` to show the tube size | 2 |
| `src/tests/specSheetCopy.test.js` | tests that a paste with `amountG` shows it, and one without falls back | 2 |
| `src/data/partsData.json` | 46 fan rows (source-only, corrections rare) + 15 paste rows (add `amountG`) | 3–7 |
| `data/partSources.json` | one provenance entry per researched field | 3–7 |
| `prerendered/*.html` | committed fragments; go stale silently | 2, 8 |
| `src/tests/partSources.test.js` | `RESEARCHED_KEYS` += 4 keys. **No `VERIFIED_CATEGORIES` change.** | 8 |

---

## Research protocol F

**Every row in Tasks 3–7 follows this exact protocol.** It is protocol R (case
plan) with the fans/paste values named here. Do not improvise a shortcut.

For each part id:

1. **Open the maker's own product or spec page for that exact SKU** — the model
   AND the pack size (fans) or tube size (paste). Check the maker's line-up
   first: across the eight earlier categories, **wrong product names recurred in
   every one, and one catalogue row (`cpu-ryzen-9-9900`) was a phantom SKU that
   was never made.** A row with no maker/retailer page is removed or re-pointed;
   re-point a wrong name and **keep the id**.

2. **Read the fields for the category:**

   **A fan** — two researched fields, both under `specs`:

   - **`size`** — a string, `"120mm"` or `"140mm"` (the two tokens in the data).
     Keep the string format; a slim or thick fan (Arctic P12 Slim, Phanteks T30)
     is still `"120mm"` — thickness is not stored.
   - **`rgb`** — a boolean: does this SKU have RGB/ARGB lighting? ⚠️ **Confirm on
     the page, do not infer from the name alone** — a line often sells both a
     lit and an unlit model (Corsair RS120 is non-RGB; the LL/QL/AF/RX are lit).

   🛑 **`count` is NOT researched** (decided during execution — see the count
   gotcha). The catalogue mixes real maker packs with app-chosen bundles the
   maker never sells (Arctic ships Single/5-Pack only, yet the catalogue offers
   3/4/10-packs), so `count` is an app bundling number like `tdp`, not a maker
   spec. Leave it exactly as it is; do not source it, correct it, or delete it.

   **A paste** — one field, under `specs`:

   - **`amountG`** — the tube fill weight in grams, a number (`4`, `3.5`, `10`).
     🛑 **The tube size is the SKU** (MX-6 4 g vs 8 g, NT-H2 3.5 g vs 10 g); read
     the exact SKU's weight off the page, never the name string.

3. **Cross-check:**

   - **A fan `rgb`** — the product page's lighting spec, not the name's marketing.
   - **A paste `amountG`** — the tube weight stated on the SKU page. If a product
     is sold in several tube sizes, land on the one this row names.

4. **Write the values** with the Task 3 Step 2 writer. For a fan whose three
   specs are already right, the writer adds only the three sources. For a paste,
   it adds `specs.amountG` (creating the `specs` object) and its source.

5. **If the maker no longer publishes a figure** (a discontinued fan, or a paste
   whose tube weight is unstated), record it unverifiable and **remove/omit the
   field**:

   ```json
   { "checkedOn": "2026-09-05", "result": "unverifiable", "note": "MasterGel Pro is sold in several tube sizes; Cooler Master's page states no single fill weight for this SKU" }
   ```

   ⚠️ An unverifiable entry has `checkedOn` and a non-empty `note`, and **no**
   `url`. For a paste, "field removed" means the `specs.amountG` key is simply
   never added (the row keeps its bare shape). ⚠️ Fan specs are almost always
   published; this should be rare and is most likely only `paste-cm-mastergel`.

6. **Where a re-verified value disagrees, change it, and name the old value in
   the commit message.**

### The shape a finished fan and a finished paste take

⚠️ **SHAPE ONLY — every value is illustrative. Never copy these in.**

A fan (its three specs sourced; usually no value changes):

```json
{
  "id": "fans-example-3pack",
  "category": "fans",
  "name": "Example X120 RGB (3-pack)",
  "brand": "Example",
  "price": 59.99,
  "tdp": 6,
  "specs": { "size": "120mm", "count": 3, "rgb": true }
}
```

```json
"fans-example-3pack": {
  "size": { "url": "https://example.com/x120", "checkedOn": "2026-09-05" },
  "rgb":  { "url": "https://example.com/x120", "checkedOn": "2026-09-05", "note": "addressable RGB" }
}
```

A paste (gains `specs.amountG` where it had no `specs` at all):

```json
{
  "id": "paste-example",
  "category": "paste",
  "name": "Example Grease (4g)",
  "brand": "Example",
  "price": 8.99,
  "tdp": 0,
  "specs": { "amountG": 4 }
}
```

```json
"paste-example": {
  "amountG": { "url": "https://example.com/grease", "checkedOn": "2026-09-05", "note": "4 g tube" }
}
```

⚠️ `tdp` stays exactly as it is on both and **must never get a source entry** — a
fan's 2–6 W and a paste's 0 W are the app's own draw figures for
`perfEngine/power.js`, like the motherboard/PSU/cooler `tdp`.

---

## Task 1: Coverage learns fans and paste

**Files:**
- Modify: `scripts/catalog-coverage-core.mjs` (`EXPECTED` only — no `RATCHETED_KEYS`)
- Test: `src/tests/catalogCoverage.test.js`

> **On timing:** `EXPECTED` is added HERE, not at close-out, refining the spec's
> ordering-constraint #2. A brand-new category enters the report at `0/N` and
> climbs per tranche — it cannot regress the eight finished categories (they stay
> 100%), so the spec's "reads as a regression" caution does not apply to a new
> line. This is exactly what all eight prior plans did. Only the `RESEARCHED_KEYS`
> **enforcement** waits for close-out (Task 8), because that one WOULD fail
> instantly against unsourced values.

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/catalogCoverage.test.js`:

```js
describe('fans expectations', () => {
  const fan = (id, over = {}) =>
    ({ id, category: 'fans', tdp: 2, specs: { size: '120mm', count: 1, rgb: false }, ...over })

  it('expects the three displayed specs, flat for every fan', () => {
    expect(requiredFor(EXPECTED.fans, fan('a'))).toEqual(['size', 'count', 'rgb'])
  })

  it('counts a fully sourced fan as verified', () => {
    const sources = { a: { size: src(), count: src(), rgb: src() } }
    expect(coverageFor('fans', [fan('a')], sources).verified).toBe(1)
  })

  it('does not verify a fan whose rgb was never sourced', () => {
    const sources = { a: { size: src(), count: src() } }
    expect(coverageFor('fans', [fan('a')], sources).verified).toBe(0)
  })

  // 🛑 No rule reads a fan, so there is deliberately NO ratchet entry.
  it('has no ratchet keys - nothing blocks on a fan', () => {
    expect(RATCHETED_KEYS.fans).toBeUndefined()
  })
})

describe('paste expectations', () => {
  const paste = (id, over = {}) =>
    ({ id, category: 'paste', tdp: 0, specs: { amountG: 4 }, ...over })

  it('expects the one researched spec, amountG', () => {
    expect(requiredFor(EXPECTED.paste, paste('a'))).toEqual(['amountG'])
  })

  it('counts a fully sourced paste as verified', () => {
    expect(coverageFor('paste', [paste('a')], { a: { amountG: src() } }).verified).toBe(1)
  })

  // The one paste with no published fill weight is DONE when recorded absent.
  it('counts an amountG recorded unverifiable (field absent) as researched', () => {
    const parts = [{ id: 'a', category: 'paste', tdp: 0, specs: {} }]
    const sources = { a: { amountG: { checkedOn: '2026-09-05', result: 'unverifiable', note: 'no published fill weight' } } }
    expect(coverageFor('paste', parts, sources).verified).toBe(1)
  })

  it('has no ratchet keys - nothing blocks on a paste', () => {
    expect(RATCHETED_KEYS.paste).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: FAIL — `EXPECTED.fans` and `EXPECTED.paste` are `undefined` (and the
old `coverageFor('paste', [], {})` test still passes for now).

- [ ] **Step 3: Add the expectations and re-point the stale `paste`-null test**

In `scripts/catalog-coverage-core.mjs`, add to `EXPECTED` after `cpu`:

```js
  // The ninth and last category pair, and the FIRST with no ratchet: no rule
  // reads a fan or a paste, so nothing here feeds a verdict. Enforcement is the
  // coverage report plus the RESEARCHED_KEYS unit test - never RATCHETED_KEYS or
  // VERIFIED_CATEGORIES. Fans carry three displayed specs (specSheetContent.js
  // and partPages.js render size/count/rgb); flat, every fan owes all three.
  fans: {
    required: ['size', 'count', 'rgb'],
    optional: [],
  },
  // Paste had NO specs object until this project. `amountG` (the tube weight) is
  // added as the one real, SKU-differentiating, displayable field - MX-6 ships
  // 4g and 8g, NT-H2 3.5g and 10g, distinct rows. `type` is deliberately absent:
  // all 15 are grease, so it would be uniform and imply a conductivity rule that
  // does not exist.
  paste: {
    required: ['amountG'],
    optional: [],
  },
```

**Do not touch `RATCHETED_KEYS`.** Then re-point the now-broken test at
`src/tests/catalogCoverage.test.js:64-66` — `'paste'` is no longer a category
without expectations. Replace:

```js
  it('returns null for a category with no expectations yet', () => {
    expect(coverageFor('paste', [], {})).toBeNull()
  })
```

with:

```js
  // ⚠️ Was 'paste' until 2026-09-05, when paste gained expectations. Every real
  // category is now in EXPECTED, so this uses a name that never will be.
  it('returns null for a category with no expectations', () => {
    expect(coverageFor('nonexistent', [], {})).toBeNull()
  })
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: PASS.

- [ ] **Step 5: Confirm both categories report zero and the others are unchanged**

```bash
npm run catalog:coverage
```

Expected: two new lines — `fans: 0/46 parts fully researched (0%)` with
`size 46/46`, `count 46/46`, `rgb 46/46` all **present** but 0 sourced, and
`paste: 0/15 ...` with `amountG 0/15` present (the field does not exist yet, so
it reads 0 present — that is correct, it is added in the tranches). The eight
finished categories must print **byte-identically** at 100%.

- [ ] **Step 6: Full suite, lint, commit**

```bash
npm run test:run && npm run lint
git add scripts/catalog-coverage-core.mjs src/tests/catalogCoverage.test.js
git commit -m "feat: expect the specs of a fan and a paste"
```

---

## Task 2: Enrich the paste spec sheet to show the tube size

🛑 **This comes BEFORE the research so a reader for `amountG` exists when the
data lands, and it is fallback-safe: a paste row with no `amountG` renders the
current sentence byte-for-byte.** It does not depend on any researched value.

**Files:**
- Modify: `src/lib/specSheetContent.js:129-130`
- Test: `src/tests/specSheetCopy.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `src/tests/specSheetCopy.test.js` (it already imports `insight` and
`partsData` and defines `ofCat`):

```js
// amountG is added to paste in this project (the tube weight, the SKU
// differentiator). The sheet leads with it when present and falls back to the
// generic sentence when it is not, so a mid-research row still reads correctly.
describe('a paste spec sheet shows its tube size', () => {
  it('leads with the gram weight when amountG is present', () => {
    expect(insight({ id: 'p', category: 'paste', specs: { amountG: 4 } }))
      .toMatch(/^4g tube\. /)
  })

  it('falls back to the generic sentence when amountG is absent', () => {
    const generic = insight({ id: 'p', category: 'paste', specs: {} })
    expect(generic).toMatch(/^Sits between the CPU/)
    // a paste row with no specs object at all must not throw
    expect(insight({ id: 'q', category: 'paste' })).toBe(generic)
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/tests/specSheetCopy.test.js
```

Expected: FAIL — the current paste line ignores `amountG`, so the `4g tube`
assertion fails.

- [ ] **Step 3: Enrich the paste line**

`src/lib/specSheetContent.js:129-130` — replace:

```js
    case 'paste':
      return 'Sits between the CPU and the cooler plate. Any quality paste performs within a degree or two, and a pea-sized dot is enough.'
```

with:

```js
    case 'paste':
      // ⚠️ amountG (the tube weight) is the paste SKU differentiator - MX-6
      // ships 4g and 8g, NT-H2 3.5g and 10g. Lead with it when present; fall
      // back to the generic sentence for a row not yet researched. `s` is
      // `part.specs ?? {}`, so a paste with no specs is safe.
      return `${s.amountG ? `${s.amountG}g tube. ` : ''}Sits between the CPU and the cooler plate. Any quality paste performs within a degree or two, and a pea-sized dot is enough.`
```

- [ ] **Step 4: Run the test and the sibling copy suite**

```bash
npx vitest run src/tests/specSheetCopy.test.js
```

Expected: PASS, other blocks in the file still green.

- [ ] **Step 5: Re-render and check the diff**

```bash
npm run prerender && git diff --stat prerendered/
```

Expected: **no change** — paste has no part page (`partPages.js:13`), and no
paste carries `amountG` yet, so every paste sheet still renders the generic
sentence. ⚠️ If pages DO change, read the diff before committing; a shared
fragment may render `insight` for paste somewhere. ⚠️ A failed prerender leaves
the folder untouched, so a clean `git diff` can also mean it never ran — read the
command's own output line.

- [ ] **Step 6: Full suite, lint, commit**

```bash
npm run test:run && npm run lint
git add src/lib/specSheetContent.js src/tests/specSheetCopy.test.js prerendered
git commit -m "feat: show a paste tube size in its spec sheet"
```

---

## Tasks 3–7: the data tranches

Five tranches, brand-grouped so a maker who makes both fans and paste is done in
one pass. **Every row follows research protocol F.** Each task has the same five
steps, written out in full in Task 3; later tranches give their own rows, traps
and commit, and refer to Task 3 Step 2 for the writer.

⚠️ **A fan row needs only its two sources — `size` and `rgb`** (`count` is not
researched). Both are usually already right (the names are descriptive), but
verify anyway; the CPU tranche taught that 78 of 80 rows were correct, and the
value was proving it.

### Task 3: Arctic — 12 fans + 3 paste = 15 rows

**Files:** Create `<scratchpad>/apply-tranche.mjs`; modify `src/data/partsData.json`, `data/partSources.json`

**Fans:**

| id | name | size | count | rgb |
|---|---|---|---|---|
| `fans-arctic-p12-single` | Arctic P12 PWM 120mm | 120mm | 1 | false |
| `fans-arctic-p12-3pack` | Arctic P12 PWM (3-pack) | 120mm | 3 | false |
| `fans-arctic-f14-single` | Arctic F14 140mm | 140mm | 1 | false |
| `fans-arctic-p14-single` | Arctic P14 PWM 140mm | 140mm | 1 | false |
| `fans-arctic-p14-3pack` | Arctic P14 PWM (3-pack) | 140mm | 3 | false |
| `fans-arctic-p12-max-single` | Arctic P12 Max 120mm | 120mm | 1 | false |
| `fans-arctic-p12-pro-4pack` | Arctic P12 Pro (4-pack) | 120mm | 4 | false |
| `fans-arctic-p14-max` | Arctic P14 Max 140mm | 140mm | 1 | false |
| `fans-arctic-p12-5pack` | Arctic P12 PWM PST (5-pack) | 120mm | 5 | false |
| `fans-arctic-p12-10pack` | Arctic P12 PWM PST (10-pack) | 120mm | 10 | false |
| `fans-arctic-p14-5pack` | Arctic P14 PWM PST (5-pack) | 140mm | 5 | false |
| `fans-arctic-p12-slim` | Arctic P12 Slim PWM 120mm | 120mm | 1 | false |

**Paste:**

| id | name | amountG now |
|---|---|---|
| `paste-arctic-mx4` | Arctic MX-4 (4g) | add 4 |
| `paste-arctic-mx6` | Arctic MX-6 (4g) | add 4 |
| `paste-arctic-mx6-8g` | Arctic MX-6 (8g) | add 8 |

**Entry point:** `arctic.de/en`. ⚠️ Entry points are to navigate from, not to cite.

**Traps:** 🛑 **`rgb` is the field to check** (count is not researched).
⚠️ **All Arctic P/F fans here are non-RGB** — Arctic does make a "P12 A-RGB", so
confirm none of these twelve is secretly the RGB variant. ⚠️ **P12 Slim, P12 Max
and P14 Max are distinct SKUs from the plain P12/P14** — read the specific
model's page (P14 Max is 140mm), not the family. ⚠️ **MX-6 is in twice (4g and
8g)** — anchor each on its own tube SKU; MX-4 is also sold in 2g/8g/20g, so
confirm the 4g. (Noted for the record: Arctic ships non-RGB P12/P14 as Single or
5-Pack only, so the 3/4/10-packs are app bundles — left as-is per the decision.)

- [ ] **Step 1: Research all fifteen rows under protocol F**

For each id, open Arctic's page for that exact SKU, read the fan's
`size`/`count`/`rgb` or the paste's `amountG`, run the cross-checks, and record
the URL you opened.

- [ ] **Step 2: Write the values with the house serializer**

Create `<scratchpad>/apply-tranche.mjs` — written once, reused by Tasks 4–7:

```js
// Applies one fans/paste research tranche to both data files, in the repo's own
// JSON style. Refuses to write unless house-json round-trips BOTH files first.
// Run from the REPO ROOT (house-json reads relative paths).
import { readFileSync, writeFileSync } from 'node:fs'
// ⚠️ An ABSOLUTE file: URL - the scratchpad is not inside the repo.
import { FILES, toFile, roundTripOk } from 'file:///C:/Users/jacob/IdeaProjects/CustomPc/scripts/house-json.mjs'

// EDIT PER TRANCHE. `part` merges top-level fields (rarely needed here);
// `specs` merges into the part's specs (size/count/rgb for a fan, amountG for a
// paste; null DELETES a key); `sources` merges into that part's provenance.
const TRANCHE = {
  'fans-example': {
    // `specs` only when a size or rgb VALUE is actually wrong; usually a fan
    // needs just its two sources. `count` is never touched (app bundle).
    sources: {
      size: { url: 'https://arctic.de/x', checkedOn: '2026-09-05' },
      rgb:  { url: 'https://arctic.de/x', checkedOn: '2026-09-05' },
    },
  },
  'paste-example': {
    specs: { amountG: 4 },
    sources: {
      amountG: { url: 'https://arctic.de/x', checkedOn: '2026-09-05', note: '4 g tube' },
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
  Object.assign(part, entry.part ?? {})
  if (entry.specs) {
    part.specs ??= {}   // 🛑 paste rows have no specs object yet
    for (const [k, v] of Object.entries(entry.specs)) {
      const before = part.specs[k]
      if (v === null) delete part.specs[k]
      else part.specs[k] = v
      if (before !== v) console.log(`spec   ${id}.${k}: ${JSON.stringify(before)} -> ${JSON.stringify(v)}`)
    }
  }
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

Expected: two `MATCH` lines from `house-json`, any `spec …` correction lines
(likely a run of `spec paste-arctic-*.amountG: undefined -> N` as the field is
added), then `applied 15 rows`. ⚠️ If `$CLAUDE_SCRATCHPAD` is unset in your
shell, use the absolute scratchpad path from the environment preamble.

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

Expected: `fans: 12/46 (26%)` and `paste: 3/15 (20%)`, and PASS. ⚠️ **The verdict
snapshot cannot move** (gotcha 8) — if `verdictSpread.test.js` fails, a
non-fan/paste value changed; investigate.

- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the twelve Arctic fans and three Arctic pastes"
```

⚠️ Name any corrected value in the commit message.

### Task 4: Noctua — 10 fans + 3 paste = 13 rows

**Fans:**

| id | name | size | count | rgb |
|---|---|---|---|---|
| `fans-noctua-nf-a12` | Noctua NF-A12x25 120mm | 120mm | 1 | false |
| `fans-noctua-nf-a14` | Noctua NF-A14 PWM 140mm | 140mm | 1 | false |
| `fans-noctua-nf-a12-chromax` | Noctua NF-A12x25 chromax.black | 120mm | 1 | false |
| `fans-noctua-a14x25-g2` | Noctua NF-A14x25 G2 140mm | 140mm | 1 | false |
| `fans-noctua-nf-p12-redux` | Noctua NF-P12 redux 120mm | 120mm | 1 | false |
| `fans-noctua-a14g2-single` | Noctua NF-A14x25 G2 (single) | 140mm | 1 | false |
| `fans-noctua-p12-redux-3` | Noctua NF-P12 redux (3-pack) | 120mm | 3 | false |
| `fans-noctua-a14-3pack` | Noctua NF-A14 PWM (3-pack) | 140mm | 3 | false |
| `fans-noctua-nf-f12` | Noctua NF-F12 PWM 120mm | 120mm | 1 | false |
| `fans-noctua-nf-s12a` | Noctua NF-S12A PWM 120mm | 120mm | 1 | false |

**Paste:**

| id | name | amountG now |
|---|---|---|
| `paste-noctua-nth1` | Noctua NT-H1 (3.5g) | add 3.5 |
| `paste-noctua-nth2` | Noctua NT-H2 (3.5g) | add 3.5 |
| `paste-noctua-nth2-10g` | Noctua NT-H2 (10g) | add 10 |

**Entry point:** `noctua.at`.

**Traps:** 🛑 **`fans-noctua-a14x25-g2` and `fans-noctua-a14g2-single` are both
the NF-A14x25 G2, both `count: 1`** — confirm they are two genuinely distinct
retail SKUs (e.g. a standard vs an Sx variant / a differently packaged single),
and if one is a true duplicate of the other, **flag it for the user rather than
inventing a difference.** ⚠️ **Every Noctua fan here is non-RGB** — Noctua has no
RGB line; `rgb: false` should hold for all ten, but confirm. ⚠️ Noctua sells
mostly singles; verify the two 3-packs (`p12-redux-3`, `a14-3pack`) exist as
Noctua-branded multipacks and are not really singles. ⚠️ **NT-H1 is sold in 3.5g
and 10g and NT-H2 in 3.5g and 10g** — anchor each paste on its own tube SKU.

- [ ] **Step 1: Research all thirteen rows under protocol F**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect two `MATCH` lines, then `applied 13 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `fans: 22/46 (48%)`, `paste: 6/15 (40%)`, and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the ten Noctua fans and three Noctua pastes"
```

### Task 5: be quiet! and Lian Li — 10 fans = 10 rows

**Fans (be quiet!, 5):**

| id | name | size | count | rgb |
|---|---|---|---|---|
| `fans-be-quiet-silent-wings-4` | be quiet! Silent Wings 4 120mm | 120mm | 1 | false |
| `fans-bequiet-sw4-140` | be quiet! Silent Wings 4 140mm | 140mm | 1 | false |
| `fans-bequiet-pw3-140-2` | be quiet! Pure Wings 3 140mm (2-pack) | 140mm | 2 | false |
| `fans-bequiet-pure-wings-3-120` | be quiet! Pure Wings 3 120mm | 120mm | 1 | false |
| `fans-bequiet-light-wings-3pack` | be quiet! Light Wings 120mm ARGB (3-pack) | 120mm | 3 | true |

**Fans (Lian Li, 5):**

| id | name | size | count | rgb |
|---|---|---|---|---|
| `fans-lian-li-sl120-3pack` | Lian Li Uni Fan SL120 (3-pack) | 120mm | 3 | true |
| `fans-lian-li-sl120-single` | Lian Li Uni Fan SL120 (single) | 120mm | 1 | true |
| `fans-lian-li-sl140-2pack` | Lian Li Uni Fan SL140 (2-pack) | 140mm | 2 | true |
| `fans-lianli-tl-lcd-3` | Lian Li Uni Fan TL LCD 120 (3-pack) | 120mm | 3 | true |
| `fans-lianli-sl-inf-3pack` | Lian Li Uni Fan SL-Infinity 120 (3-pack) | 120mm | 3 | true |

**Entry points:** `bequiet.com`, `lian-li.com`.

**Traps:** ⚠️ **be quiet! product pages** — full specs are in static HTML by
**numeric id**; a **discontinued** product vanishes completely and the throttle
can return an empty 200 (see the memory note). 🛑 **`rgb` splits within be
quiet!**: Silent Wings 4 and Pure Wings 3 are non-RGB; **Light Wings is ARGB
(`rgb: true`)** — do not blanket the brand. ⚠️ **Every Lian Li here is a Uni Fan,
all RGB (`rgb: true`)** — the TL LCD adds a screen but is still counted `rgb:
true`. ⚠️ Confirm the Uni Fan pack counts: SL120 sells as single and 3-pack,
SL140 as a 2-pack — the pack SKU is the discriminator.

- [ ] **Step 1: Research all ten rows under protocol F**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect `applied 10 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `fans: 32/46 (70%)`, `paste: 6/15 (40%)`, and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the five be quiet! and five Lian Li fans"
```

### Task 6: Corsair and Thermal Grizzly — 5 fans + 5 paste = 10 rows

**Fans (Corsair, 5):**

| id | name | size | count | rgb |
|---|---|---|---|---|
| `fans-corsair-ll120-3pack` | Corsair LL120 RGB (3-pack) | 120mm | 3 | true |
| `fans-corsair-ql120-3pack` | Corsair QL120 RGB (3-pack) | 120mm | 3 | true |
| `fans-corsair-af120-3pack` | Corsair AF120 RGB Elite (3-pack) | 120mm | 3 | true |
| `fans-corsair-rx120-3pack` | Corsair iCUE Link RX120 RGB (3-pack) | 120mm | 3 | true |
| `fans-corsair-rs120-3pack` | Corsair RS120 (3-pack) | 120mm | 3 | false |

**Paste (Corsair 1 + Thermal Grizzly 4):**

| id | name | amountG now |
|---|---|---|
| `paste-corsair-xtm70` | Corsair XTM70 (3g) | add 3 |
| `paste-tg-kryonaut` | Thermal Grizzly Kryonaut (1g) | add 1 |
| `paste-tg-kryonaut-extreme` | Thermal Grizzly Kryonaut Extreme (2g) | add 2 |
| `paste-tg-hydronaut` | Thermal Grizzly Hydronaut (3.9g) | add 3.9 |
| `paste-tg-duronaut` | Thermal Grizzly Duronaut (3.9g) | add 3.9 |

**Entry points:** `corsair.com`, `thermal-grizzly.com`.

**Traps:** 🛑 **`fans-corsair-rs120-3pack` is the non-RGB Corsair** (`rgb:
false`) among four RGB packs — do not blanket the brand `true`. ⚠️ Confirm the
iCUE Link RX120 SKU is the RGB model (Corsair sells RX and RX RGB). ⚠️ **Thermal
Grizzly tube weights are stated in grams AND ml on the page** — take the gram
figure. Kryonaut ships 1g/2g/... and Hydronaut 3.9g/7.8g — anchor each on its own
tube. Kryonaut Extreme is a distinct product from Kryonaut, at 2g here.

- [ ] **Step 1: Research all ten rows under protocol F**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect `applied 10 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `fans: 37/46 (80%)`, `paste: 11/15 (73%)`, and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the five Corsair fans and five Corsair/Thermal Grizzly pastes"
```

### Task 7: the tail — 9 fans + 4 paste = 13 rows

🛑 **This tranche closes both categories.**

**Fans:**

| id | name | size | count | rgb |
|---|---|---|---|---|
| `fans-cm-sickleflow-3pack` | Cooler Master SickleFlow 120 RGB (3-pack) | 120mm | 3 | true |
| `fans-deepcool-fc120-3pack` | DeepCool FC120 ARGB (3-pack) | 120mm | 3 | true |
| `fans-deepcool-fk120-3pack` | DeepCool FK120 (3-pack) | 120mm | 3 | false |
| `fans-nzxt-f120-rgb` | NZXT F120 RGB (single) | 120mm | 1 | true |
| `fans-thermaltake-toughfan-12` | Thermaltake ToughFan 12 (2-pack) | 120mm | 2 | false |
| `fans-phanteks-t30-3pack` | Phanteks T30-120 (3-pack) | 120mm | 3 | false |
| `fans-phanteks-m25-3pack` | Phanteks M25 120mm (3-pack) | 120mm | 3 | false |
| `fans-thermalright-tlc12-3` | Thermalright TL-C12C X3 (3-pack) | 120mm | 3 | false |
| `fans-tr-c12cw-3pack` | Thermalright TL-C12CW-S X3 (3-pack) | 120mm | 3 | true |

**Paste (Thermalright 1 + Cooler Master 2 + Gelid 1):**

| id | name | amountG now |
|---|---|---|
| `paste-thermalright-tf7` | Thermalright TF7 (2g) | add 2 |
| `paste-cm-mastergel` | Cooler Master MasterGel Pro | **research — no name amount** |
| `paste-cm-cryofuze` | Cooler Master CryoFuze (2g) | add 2 |
| `paste-gelid-gc-extreme` | Gelid GC-Extreme (3.5g) | add 3.5 |

**Entry points:** `coolermaster.com`, `deepcool.com`, `nzxt.com`,
`thermaltake.com`, `phanteks.com`, `thermalright.com`, `gelid.com`.

**Traps:** 🛑 **`paste-cm-mastergel` is the one paste with no amount in its
name** — read the fill weight off Cooler Master's MasterGel Pro page; if it is
sold in several tube sizes with no single canonical retail weight, record
`amountG` **unverifiable** with a note and leave the field off (protocol F step
5). 🛑 **`rgb` splits three times in this tail**: DeepCool FC120 is ARGB
(`true`) but FK120 is not (`false`); Thermalright TL-C12C is non-RGB (`false`)
but the **TL-C12CW-S is ARGB (`true`)** — the `W` is the white-frame ARGB model;
Thermaltake ToughFan 12 is non-RGB (`false`) despite being a premium fan. ⚠️
**Phanteks T30 is a 30mm-thick 120mm fan** — still `size: "120mm"`, thickness is
not stored. ⚠️ Confirm the ToughFan 12 is genuinely a 2-pack SKU and the NZXT
F120 RGB a single. ⚠️ Gelid GC-Extreme ships 1g/3.5g/10g — confirm the 3.5g.

- [ ] **Step 1: Research all thirteen rows under protocol F**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect `applied 13 rows`; a `mastergel` unverifiable entry is added by hand in `data/partSources.json` if its weight is unpublished — the writer only records URL sources)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `fans: 46/46 (100%)` and `paste: 15/15 (100%)`, and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the nine tail fans and four tail pastes - both categories 100%"
```

⚠️ If `paste-cm-mastergel` is `unverifiable`, name that in the commit message.

---

## Task 8: Lock the enforcement (no ratchet)

**Files:** `src/tests/partSources.test.js`, then `prerendered/*`

- [ ] **Step 1: Check every key for a collision BEFORE adding it**

🛑 Gotcha 6. Run this first (backtick-free, so it is safe in `node -e`):

```bash
node -e "const d=require('./src/data/partsData.json');for(const k of ['size','rgb','amountG']){const by={};for(const p of d){if(p.specs&&p.specs[k]!==undefined)by[p.category]=(by[p.category]||0)+1}console.log(k,JSON.stringify(by))}"
```

Expected: `size`, `rgb` appear **only** under `fans` (46 each), and `amountG`
only under `paste` (15). If any key shows another category, it goes in
`RESEARCHED_KEYS_BY_CATEGORY`, not the global list. (`count` is intentionally
excluded — it is an app bundle, not a maker spec.)

- [ ] **Step 2: Add the four keys — and NOTHING else**

In `src/tests/partSources.test.js`, add to `RESEARCHED_KEYS` (after `cores`, `boostClock`):

```js
  // ⚠️ Sixth time for this ordering rule: these three could only join once all
  // 46 fans (size, rgb) and 15 paste (amountG) had a source. Safe in the GLOBAL
  // list because fans are the only category carrying specs.size/rgb, and paste
  // the only one carrying specs.amountG (Step 1 proves it).
  //
  // 🛑 `count` is NOT here: it is a fan's pack size, an app bundling choice the
  // maker often does not sell (Arctic ships Single/5-Pack, the catalogue offers
  // 3/4/10), so it owes no provenance - like tdp.
  //
  // 🛑 There is NO VERIFIED_CATEGORIES entry and NO RATCHETED_KEYS entry for
  // fans or paste - no rule blocks on either, so this RESEARCHED_KEYS test IS
  // the whole enforcement. Do not "finish the pattern" by adding them below.
  'size', 'rgb', 'amountG',
```

🛑 **Do NOT add `fans` or `paste` to `VERIFIED_CATEGORIES`.** It stays the
eight-category set (`gpu, case, psu, motherboard, cooler, storage, ram, cpu`).

- [ ] **Step 3: Run the suite**

```bash
npm run test:run
```

Expected: PASS. A failure names the exact `<id>.<field>` still missing
provenance — finish that row rather than weakening the list.

- [ ] **Step 4: Prove the enforcement is non-vacuous on a fan AND a paste key**

Both go through the `RESEARCHED_KEYS` loop, but prove one of each: delete one
fan's `size` source and one paste's `amountG` source from `data/partSources.json`,
run, expect FAIL naming both; restore.

```bash
npx vitest run src/tests/partSources.test.js
git checkout -- data/partSources.json
```

⚠️ An enforcement test that cannot fail is worth nothing. Do not skip.

- [ ] **Step 5: Re-render and read the diff**

```bash
npm run prerender && git diff --stat prerendered/
```

Expected: only fan part pages whose `size`/`count`/`rgb` actually changed (likely
none or a handful). ⚠️ Paste has no part page, so paste changes do not appear
here. ⚠️ Read the command's own output line — a failed prerender leaves the folder
untouched and `git diff` then lies "clean".

- [ ] **Step 6: Run everything**

```bash
npm run test:run && npm run lint && npm run build && npm run test:e2e
```

⚠️ **One 30 s e2e timeout fails the whole suite — re-run before blaming your
change.**

- [ ] **Step 7: Commit**

```bash
git add src/tests/partSources.test.js prerendered
git commit -m "feat: enforce fan and paste provenance (no ratchet - nothing blocks on them)"
```

- [ ] **Step 8: Close out the plan and the spec**

Tick every checkbox, record what the research actually found — any corrected
`size`/`count`/`rgb`, whether `paste-cm-mastergel` was verifiable, whether the
Noctua G2 double-entry was a real pair or a duplicate, and that the verdict
snapshot did not move (it cannot) — and commit as
`docs: close out the fans + paste research plan - 46/46 + 15/15`.

- [ ] **Step 9: Report, and stop**

🛑 **Do not push and do not run `npm run catalog:push`.** Report the two coverage
figures, every corrected value, and that **`main` is far ahead of origin** with
the cooler, storage, RAM and CPU tranches and the site-quality backlog already in
it — the merge of this branch, the push and `npm run catalog:push -- --apply` are
all the user's. **With this branch merged, every one of the ten catalogue
categories a rule or a spec sheet reads runs on sourced data.**

---

## Success criteria

- `npm run catalog:coverage` reports **fans 46/46 (100%)** and **paste 15/15
  (100%)** — two new lines, ten categories in total; the eight finished
  categories unchanged.
- `partSources.test.js` passes with `size`, `rgb`, `amountG` in
  `RESEARCHED_KEYS` (`count` deliberately absent), proved **non-vacuous on a fan
  key and a paste key**, with **no** `fans`/`paste` entry in
  `VERIFIED_CATEGORIES` or `RATCHETED_KEYS`.
- `specSheetContent.js` renders a paste's tube size when `amountG` is present and
  the generic sentence when it is not; `prerendered/` re-rendered.
- Every fan `size`/`rgb` and every paste `amountG` carries a `partSources.json`
  entry, or is `unverifiable` with a note. (`count` is not sourced.)
- Lint, unit, e2e, build and prerender all green.

---

## Outcome — DONE, fans 46/46 + paste 15/15, no ratchet

Executed on `feat/fans-paste-catalogue-research`. `catalog:coverage` reports
**fans 46/46 (100%)** and **paste 15/15 (100%)** — ten categories now on sourced
data; the eight earlier categories unchanged. Unit (1650), lint, build, prerender
and e2e (100 passed, 1 unrelated flaky on retry) all green.

**The last category, and the first with no ratchet.** No rule reads a fan or a
paste, so neither joined `VERIFIED_CATEGORIES`/`RATCHETED_KEYS`; the
`RESEARCHED_KEYS` unit test (size, rgb, amountG) plus the coverage report are the
whole enforcement, proved non-vacuous on both a fan key and a paste key. The
verdict snapshot did **not** move — it cannot, since no rule reads either.

### What the research changed

- **One data correction:** `paste-tg-duronaut` renamed `(3.9g) → (2g)` with
  `amountG` set to `2`. Thermal Grizzly sells Duronaut only in 2/6/30g; the 3.9g
  was a phantom size, almost certainly copied from Hydronaut (whose 1.5ml tube
  genuinely is 3.9g at density 2.6 g/cm³).
- **One unverifiable:** `paste-cm-mastergel` (`amountG` absent, recorded
  unverifiable). Cooler Master's MasterGel Pro pages 404 across every path
  (superseded by New MasterGel Pro / V2); no maker page states this SKU's fill
  weight. Its spec sheet falls back to the generic sentence.
- **Everything else was already right.** All 46 fan sizes (120/140mm) and all 46
  `rgb` booleans matched the catalogue, including every RGB split that could have
  been wrong — be quiet! Light Wings ARGB vs Silent/Pure Wings, Corsair RS120
  non-RGB among four RGB packs, DeepCool FK120 vs FC120, Thermalright TL-C12C vs
  TL-C12CW-S, Phanteks M25-120 Black. 13 of 15 paste amounts matched their names.

### The decision that reshaped the project: `count` is not a maker spec

The Arctic tranche disproved the spec's assumption that a fan's `count` is a maker
SKU. Arctic ships its non-RGB P12/P14 only as **Single or 5-Pack**, yet the
catalogue offers 3-, 4- and 10-packs at their own price points — the author mixed
real maker packs with **app-chosen bundles**. Per the user's decision, `count`
was dropped from research (treated like `tdp`): only `size` and `rgb` are
sourced, and every `count` was left exactly as it is. `EXPECTED.fans` is
`['size', 'rgb']`; `RESEARCHED_KEYS` gained `size`, `rgb`, `amountG` (not
`count`). See the spec's amendment and `fix: drop fan count from research`.

### ⚠️ Flagged for the user

- **Noctua NF-A14x25 G2 appears twice** — `fans-noctua-a14x25-g2` and
  `fans-noctua-a14g2-single` are the same product (both 140mm, both count 1), a
  likely catalogue duplicate. Left as two rows (not a size/rgb error); your call
  whether to merge or differentiate them.
- **`count` is now unsourced app data.** The invented Arctic pack sizes (3/4/10)
  remain in the catalogue as bundling choices. If you ever want the displayed
  pack sizes to match real maker SKUs, that is a separate editorial pass.

### Two pre-existing issues fixed in passing

- **Stale prerendered fragments** — three backlog commits (`<main>` landmark,
  `/parts` content-visibility, July→September price) had never been re-rendered,
  so the deployed static HTML lagged the source. Regenerated (`a3ca337`).
- The **paste spec sheet** now shows the tube size (`"4g tube. …"`).

### ⏭️ Next — nothing; this is the last category

🛑 **Not shipped.** `main` is far ahead of `origin` with the cooler, storage,
RAM and CPU tranches and the whole site-quality backlog, and this branch is
unmerged on top. The merge, `git push` and `npm run catalog:push -- --apply` are
all the user's to run. With this branch merged and pushed, every one of the ten
catalogue categories a rule **or a spec sheet** reads runs on sourced data.
