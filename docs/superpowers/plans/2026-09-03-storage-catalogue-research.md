# Storage catalogue research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 52 drives up to the research standard, make rule 3's SATA-M.2 branch reachable, and stop 37 part pages telling readers an NVMe drive connects by cable.

**Architecture:** Task 1 teaches the coverage core about storage, reusing the `variants` shape the cooler project added, and pins that coverage and rule 3 agree on what an M.2 drive is. Task 2 fixes the two live defects up front, because one is a user-visible falsehood and neither depends on the research. Tasks 3–8 research 52 drives against their makers' pages under protocol S. Task 9 switches the ratchet on.

**Tech Stack:** Node 22 ESM scripts, Vitest, ESLint, the in-app Browser (`mcp__Claude_Browser__*`) for research, `scripts/house-json.mjs` for every JSON write.

**Spec:** `docs/superpowers/specs/2026-09-03-storage-catalogue-research-design.md`

---

## Before you start: things that will bite you

1. 🛑 **Neither `WebFetch` nor the Browser is sufficient alone.** The cooler
   project proved it in both directions: `WebFetch` 403s on some vendor sites
   where the Browser reads them fine, and **ID-Cooling rendered a
   427-character shell in the Browser while only `WebFetch` returned the spec
   table**. If one returns nothing, try the other before concluding a spec is
   unpublished.

2. 🛑 **Never write these JSON files with `JSON.stringify(obj, null, 2)`.**
   Use `scripts/house-json.mjs`, which proves a byte-for-byte round trip before
   it writes. A plain stringify buries a ten-row change in a 3236-line diff.

3. 🛑 **`m2Sata` is already enforced.** It is in `RESEARCHED_KEYS`
   (`src/tests/partSources.test.js`). Writing it onto a part without a matching
   source entry fails the suite **today**.

4. ⚠️ **`storageType`, `capacityGb` and `readMbps` must NOT join their lists
   until Task 9.** All 52 rows carry all three unsourced, so adding any early
   fails instantly against 52 values. This is the `rating` / `height`
   precedent, now for the third time.

5. 🛑 **GREP EVERY CATEGORY BEFORE PUTTING A KEY IN THE GLOBAL
   `RESEARCHED_KEYS`.** The cooler project put `type` there and it failed
   against **59 cases**, because `specs.type` means "Mid Tower" on a case and
   "AIO" on a cooler. `RESEARCHED_KEYS_BY_CATEGORY` exists for exactly this.
   Check `readMbps` the same way before adding it.

6. 🛑 **Coverage and rule 3 must agree on what an M.2 drive is.** They cannot
   share a helper — `scripts/` may not import `src/lib` (`vite-node` is not
   installed) — so the regex is duplicated on purpose, and **Task 1 Step 5
   writes the test that pins the two copies together.** Two private copies of
   one definition drifting apart is precisely what shipped the
   `partPages.js:150` bug this project is fixing.

7. ⚠️ **A first-match regex over a spec page reads the wrong product's row.**
   Anchor extraction to the product's own SKU/capacity block. Drives are the
   worst category for this: **one page usually covers every capacity in the
   family**, and read speed differs per capacity.

8. ⚠️ **`node -e` in the Bash tool eats backticks and apostrophes.** Write a
   `.mjs` to the scratchpad and run it.

9. ⚠️ **Do not push.** `git push`, `npm run catalog:push` and any deploy are the
   user's to run. `main` is **already 15 commits ahead of origin** with the
   cooler tranche in it.

## File structure

| file | responsibility | tasks |
|---|---|---|
| `scripts/catalog-coverage-core.mjs` | `EXPECTED.storage` (variants), `RATCHETED_KEYS.storage` | 1 |
| `src/tests/catalogCoverage.test.js` | coverage tests + the definition-agreement test | 1 |
| `src/lib/partPages.js` | the dead `=== 'NVMe'` equality | 2 |
| `src/data/partsData.json` | the 52 drive rows; the brand string | 2, 3–8 |
| `data/partSources.json` | one provenance entry per researched field | 3–8 |
| `src/tests/specRules.test.js` | a test making the SATA-M.2 branch reachable | 2 |
| `prerendered/*.html` | seven committed fragments; go stale silently | 2 |
| `src/tests/partSources.test.js` | `RESEARCHED_KEYS`, `VERIFIED_CATEGORIES` | 9 |

---

## Research protocol S

**Every row in Tasks 3–8 follows this exact protocol.** It is protocol R (case
plan) as refined by protocol C (cooler plan), with the storage values named
here. Do not improvise a shortcut.

For each drive id:

1. **Open the maker's own product or spec page for that exact model AND
   CAPACITY.** 🛑 **Capacity is part of the SKU here.** One page covers the
   whole family and the read speed differs per capacity — a 500 GB drive is
   routinely slower than its 2 TB sibling. Anchor on the capacity row.

   Check the maker's line-up first: **fifteen catalogue rows across five
   categories have named a product nobody makes.** Re-point a wrong name and
   **keep the id**.

2. **Read four values:**

   - **`storageType`** (top level) — one of the catalogue's three tokens:
     `"NVMe SSD"`, `"SATA SSD"`, `"HDD"`. 🛑 **This is rule 3's branch
     selector.** A drive typed wrongly is checked against the wrong bus. The
     token must satisfy the same regex rule 3 uses: an M.2 NVMe drive matches
     `/nvme|m\.2/i`, a 2.5" SATA SSD and a 3.5" HDD must not.

   - **`capacityGb`** (top level) — the maker's stated capacity as printed. A
     "2TB" drive is `2000`. ⚠️ **Do not convert to binary GiB.** Every maker
     prints decimal, and the catalogue compares against decimal everywhere.

   - **`specs.readMbps`** — the maker's stated **sequential read**, in MB/s,
     **for this capacity**. For an HDD this is the sustained transfer rate,
     which makers publish as "up to X MB/s"; take that figure.

   - **`specs.m2Sata`** — NVMe/M.2 drives only. `true` only if the drive is an
     M.2 card speaking **SATA** rather than NVMe. Every mainstream NVMe drive
     is `false`. ⚠️ **Record `false` explicitly; never omit it.** An absent
     field and a researched `false` are different claims, and `isResearched`
     counts an absent one as a gap.

3. **Cross-check `readMbps` against one reliable secondary source.** It is the
   value most likely to be wrong and the least likely to be noticed.

   ⚠️ **The current data has visible copying tells.** Every Seagate Barracuda
   reads 190–210; the Kingston NV3 500 GB carries the same 6000 as its 1 TB and
   2 TB siblings, which is exactly the per-capacity difference step 1 warns
   about. Treat both as prompts to check, not as predictions.

4. **Write the values** with the Task 3 Step 2 writer.

5. **If the maker does not publish a figure**, record it unverifiable and
   **remove the field**:

   ```json
   { "checkedOn": "2026-09-03", "result": "unverifiable", "note": "Seagate publishes no sustained transfer rate for this Barracuda capacity; not on the spec page or in the product manual" }
   ```

   ⚠️ An unverifiable entry must have `checkedOn` and a non-empty `note`, and
   must **not** carry a `url`. ⚠️ Removing `readMbps` has downstream reach:
   `partQuality` ranks storage on `readMbps + capacityGb`, and
   `specSheetContent`'s storage insight tiers off it. Check the rendered copy
   for a drive with no read speed before committing.

6. **Where a re-verified number disagrees, change it, and name the old value in
   the commit message.**

### The shape a finished drive takes

⚠️ **SHAPE ONLY — every value is illustrative. Never copy these in.**

```json
{
  "id": "storage-example-nvme",
  "category": "storage",
  "name": "Example P1 2TB NVMe",
  "brand": "Example",
  "price": 129.99,
  "storageType": "NVMe SSD",
  "capacityGb": 2000,
  "tdp": 7,
  "specs": { "readMbps": 7000, "m2Sata": false }
}
```

```json
"storage-example-nvme": {
  "storageType": { "url": "https://example.com/p1/spec", "checkedOn": "2026-09-03" },
  "capacityGb": { "url": "https://example.com/p1/spec", "checkedOn": "2026-09-03" },
  "readMbps": { "url": "https://example.com/p1/spec", "checkedOn": "2026-09-03", "note": "sequential read, 2TB capacity; the 1TB is rated lower" },
  "m2Sata": { "url": "https://example.com/p1/spec", "checkedOn": "2026-09-03", "note": "PCIe Gen4 x4 NVMe, not a SATA M.2 card" }
}
```

⚠️ `tdp` stays exactly as it is and **must never get a source entry.**

---

## Task 1: Coverage learns storage, and the two M.2 definitions are pinned together

**Files:**
- Modify: `scripts/catalog-coverage-core.mjs` (`EXPECTED`, `RATCHETED_KEYS`)
- Test: `src/tests/catalogCoverage.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/catalogCoverage.test.js`:

```js
describe('storage expectations', () => {
  const drive = (id, storageType, specs = {}) =>
    ({ id, category: 'storage', storageType, capacityGb: 1000, tdp: 7, specs })

  it('asks an M.2 drive for m2Sata and a cabled drive for nothing extra', () => {
    expect(requiredFor(EXPECTED.storage, drive('a', 'NVMe SSD', { readMbps: 7000, m2Sata: false })))
      .toEqual(['storageType', 'capacityGb', 'readMbps', 'm2Sata'])
    expect(requiredFor(EXPECTED.storage, drive('b', 'HDD', { readMbps: 190 })))
      .toEqual(['storageType', 'capacityGb', 'readMbps'])
    expect(requiredFor(EXPECTED.storage, drive('c', 'SATA SSD', { readMbps: 560 })))
      .toEqual(['storageType', 'capacityGb', 'readMbps'])
  })

  it('counts a fully sourced drive of each kind as verified', () => {
    const parts = [
      drive('a', 'NVMe SSD', { readMbps: 7000, m2Sata: false }),
      drive('b', 'HDD', { readMbps: 190 }),
    ]
    const sources = {
      a: { storageType: src(), capacityGb: src(), readMbps: src(), m2Sata: src() },
      b: { storageType: src(), capacityGb: src(), readMbps: src() },
    }
    expect(coverageFor('storage', parts, sources).verified).toBe(2)
  })

  // 🛑 An absent m2Sata and a researched `false` are DIFFERENT claims.
  it('refuses to verify an M.2 drive whose m2Sata was never recorded', () => {
    const sources = { a: { storageType: src(), capacityGb: src(), readMbps: src(), m2Sata: src() } }
    expect(coverageFor('storage', [drive('a', 'NVMe SSD', { readMbps: 7000 })], sources).verified).toBe(0)
  })

  it('does not count m2Sata against a drive that has no M.2 interface', () => {
    const parts = [
      drive('a', 'NVMe SSD', { readMbps: 7000, m2Sata: false }),
      drive('b', 'HDD', { readMbps: 190 }),
    ]
    const c = coverageFor('storage', parts, {})
    expect(c.total).toBe(2)
    expect(c.fields.m2Sata.applies).toBe(1)
    expect(c.fields.readMbps.applies).toBe(2)
  })

  it('ratchets the two top-level fields and no others', () => {
    expect(RATCHETED_KEYS.storage).toEqual(['storageType', 'capacityGb'])
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: FAIL — `EXPECTED.storage` and `RATCHETED_KEYS.storage` are `undefined`.

- [ ] **Step 3: Add the expectations**

In `scripts/catalog-coverage-core.mjs`, add to `EXPECTED` after `cooler`:

```js
  // The SECOND conditional category, after coolers. Only an M.2 drive can owe
  // `m2Sata`: a 2.5" SATA SSD and a 3.5" HDD have no M.2 interface to describe.
  //
  // 🛑 THE PREDICATE IS THE SAME REGEX RULE 3 USES, deliberately, and
  // catalogCoverage.test.js pins the two copies together. It cannot be a shared
  // import: scripts/ may not require src/lib, because vite-node is not a local
  // dependency. Two private copies of one definition drifting apart is exactly
  // what shipped the partPages.js `=== 'NVMe'` bug.
  storage: {
    variants: [
      { when: (p) => /nvme|m\.2/i.test(p.storageType ?? ''), required: ['storageType', 'capacityGb', 'readMbps', 'm2Sata'] },
      { when: () => true, required: ['storageType', 'capacityGb', 'readMbps'] },
    ],
    optional: [],
  },
```

Add to `RATCHETED_KEYS` after `cooler`:

```js
  // `storageType` is rule 3's branch selector - a drive typed wrongly is checked
  // against the wrong bus entirely - and `capacityGb` is the number users
  // compare drives on, feeding pricePerGb, partQuality and partSynergy.
  // `readMbps` is deliberately absent: it is required by EXPECTED, so a future
  // drive owes a source, but no rule blocks on it.
  storage: ['storageType', 'capacityGb'],
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: PASS.

- [ ] **Step 5: Pin coverage and rule 3 to the same definition**

This is the test gotcha 6 exists for. Add to `src/tests/catalogCoverage.test.js`:

```js
import partsData from '../data/partsData.json'
import { evaluateSpecRules } from '../lib/specRules'

// 🛑 Coverage and rule 3 each hold their OWN copy of "is this an M.2 drive",
// because scripts/ cannot import src/lib. This test is the only thing keeping
// them honest. If it fails, the two definitions have drifted and coverage will
// certify a drive against a rule that classifies it differently.
describe('the M.2 definition', () => {
  // A board with one NVMe-only M.2 slot and no SATA ports: it can satisfy an
  // M.2 drive and must block a cabled one. Which branch rule 3 takes is
  // therefore observable from the outside.
  const board = {
    id: 'b', category: 'motherboard', name: 'Test board',
    specs: { m2Slots: [{ pcieGen: 4, sata: false }], sataPorts: 0 },
  }

  it('agrees with rule 3 for every drive in the catalogue', () => {
    for (const drive of partsData.filter((p) => p.category === 'storage')) {
      const coverageSaysM2 = requiredFor(EXPECTED.storage, drive).includes('m2Sata')
      const ruleBlocked = evaluateSpecRules({ motherboard: board }, drive).status === 'blocked'
      // The board has zero SATA ports, so rule 3 blocks exactly the drives it
      // sends down the cabled branch.
      expect(coverageSaysM2, `${drive.id} (${drive.storageType})`).toBe(!ruleBlocked)
    }
  })
})
```

- [ ] **Step 6: Run it**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: PASS, 37 drives classified as M.2 and 15 as cabled by both definitions.

- [ ] **Step 7: Confirm the category reports zero and the others are unchanged**

```bash
npm run catalog:coverage
```

Expected: `storage: 0/52 parts fully researched (0%)`, with `storageType 52/52`
and `capacityGb 52/52` present, `readMbps 52/52` present, `m2Sata 0/37`. The
five finished categories must print **byte-identically** at 100%.

- [ ] **Step 8: Full suite, lint, commit**

```bash
npm run test:run && npm run lint
git add scripts/catalog-coverage-core.mjs src/tests/catalogCoverage.test.js
git commit -m "feat: expect four fields of a drive, conditional on its interface"
```

---

## Task 2: Fix the two live defects

🛑 **This comes BEFORE the research, unlike the cooler project's equivalent,
because one of these is a falsehood already shipped to users and neither
depends on a single researched value.**

**Files:**
- Modify: `src/lib/partPages.js:150`
- Modify: `src/data/partsData.json` (one brand string)
- Test: `src/tests/specRules.test.js`, `src/tests/partPages.test.js` (if present)

- [ ] **Step 1: Write the failing test for the copy bug**

Add to `src/tests/partPages.test.js`. The bug lives in `compatibilityNotes`
(`src/lib/partPages.js:101`), which returns `{ label, detail }` objects:

```js
// 🛑 partPages.js tested `storageType === 'NVMe'`, and NO drive has ever had
// that exact value - every one is "NVMe SSD". The equality was dead, so all 37
// NVMe drives' pages said the opposite of the truth, in pre-rendered HTML.
// partSynergy reads the same field with a regex and was unaffected: only the
// exact-match reader broke, which is why nothing caught it.
it('does not tell an NVMe drive owner that the drive connects by cable', () => {
  const nvme = partsData.filter((p) => p.category === 'storage' && /nvme|m\.2/i.test(p.storageType ?? ''))
  expect(nvme.length).toBe(37)
  for (const drive of nvme) {
    const mb = compatibilityNotes(drive, partsData).find((n) => n.label === 'Motherboard')
    expect(mb, drive.id).toBeTruthy()
    expect(mb.detail, drive.id).not.toMatch(/connected by cable/)
    expect(mb.detail, drive.id).toMatch(/M\.2/)
  }
})

it('still tells a cabled drive owner that it is cabled', () => {
  const cabled = partsData.filter((p) => p.category === 'storage' && !/nvme|m\.2/i.test(p.storageType ?? ''))
  expect(cabled.length).toBe(15)
  for (const drive of cabled) {
    const mb = compatibilityNotes(drive, partsData).find((n) => n.label === 'Motherboard')
    expect(mb.detail, drive.id).toMatch(/connected by cable/)
  }
})
```

⚠️ Add `compatibilityNotes` and `partsData` to that file's imports if they are
not already there — `src/tests/partPages.test.js` imports a set of named
exports from `../lib/partPages` on line 4.

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL on the first NVMe drive, with "connected by cable".

- [ ] **Step 3: Fix the equality**

`src/lib/partPages.js:150` — replace:

```js
      add('Motherboard', part.storageType === 'NVMe'
```

with:

```js
      // ⚠️ A REGEX, matching rule 3's definition in specRules.js. This was
      // `=== 'NVMe'` and no drive has ever had that exact value - every one is
      // "NVMe SSD" - so all 37 NVMe drives' pages said the opposite of the
      // truth, in pre-rendered HTML, until 2026-09-03.
      add('Motherboard', /nvme|m\.2/i.test(part.storageType ?? '')
```

- [ ] **Step 4: Make rule 3's SATA-M.2 branch reachable**

Add to `src/tests/specRules.test.js`:

```js
// Rule 3's SATA-M.2 block was unreachable until storage carried `m2Sata`: the
// flag existed on no part, so `needsSata` was always false and this branch
// could never fire. The motherboard project researched 25 boards as having a
// SATA-capable M.2 against a constant.
it('blocks a SATA M.2 drive on a board whose M.2 slots are NVMe-only', () => {
  const board = { id: 'b', category: 'motherboard', name: 'B', specs: { m2Slots: [{ pcieGen: 4, sata: false }], sataPorts: 4 } }
  const sataM2 = { id: 'd', category: 'storage', storageType: 'NVMe SSD', specs: { m2Sata: true } }
  const nvme = { id: 'e', category: 'storage', storageType: 'NVMe SSD', specs: { m2Sata: false } }
  expect(evaluateSpecRules({ motherboard: board }, sataM2).status).toBe('blocked')
  expect(evaluateSpecRules({ motherboard: board }, nvme).status).toBe('ok')
})

it('accepts a SATA M.2 drive on a board that has a SATA-capable M.2 slot', () => {
  const board = { id: 'b', category: 'motherboard', name: 'B', specs: { m2Slots: [{ pcieGen: 4, sata: false }, { pcieGen: 3, sata: true }], sataPorts: 4 } }
  const sataM2 = { id: 'd', category: 'storage', storageType: 'NVMe SSD', specs: { m2Sata: true } }
  expect(evaluateSpecRules({ motherboard: board }, sataM2).status).toBe('ok')
})
```

- [ ] **Step 5: Fix the brand string**

`storage-wd-sn580-2tb` has `brand: "Western Digital"`; the other ten WD drives
have `"WD"`. Use the Task 3 Step 2 writer with a `part` patch, or a one-off
scratchpad script using `house-json.mjs`. **Do not hand-edit the JSON.**

- [ ] **Step 6: Run everything, re-render, commit**

```bash
npm run test:run && npm run lint
npm run prerender && git diff --stat prerendered/
```

Expected: the tests pass, and `prerendered/parts.html` plus any storage copy
changes. ⚠️ **A failed prerender leaves the folder untouched, so a clean
`git diff` can also mean it never ran** — read the command's own output line.

```bash
git add src/lib src/tests src/data/partsData.json prerendered
git commit -m "fix: stop telling NVMe drive owners the drive connects by cable"
```

---

## Tasks 3–8: the data tranches

Six tranches, by brand. **Every row follows research protocol S.** Each task
has the same five steps, written out in full in Task 3; later tranches give
their own rows, traps and commit, and refer to Task 3 Step 2 for the writer.

### Task 3: Samsung — 12 rows

**Files:** Create `<scratchpad>/apply-tranche.mjs`; modify `src/data/partsData.json`, `data/partSources.json`

| id | name | type | GB | readMbps now |
|---|---|---|---|---|
| `storage-samsung-990-1tb` | Samsung 990 Pro 1TB NVMe | NVMe SSD | 1000 | 7450 |
| `storage-samsung-990-2tb` | Samsung 990 Pro 2TB NVMe | NVMe SSD | 2000 | 7450 |
| `storage-samsung-990-4tb` | Samsung 990 Pro 4TB NVMe | NVMe SSD | 4000 | 7450 |
| `storage-samsung-980-1tb` | Samsung 980 1TB NVMe | NVMe SSD | 1000 | 3500 |
| `storage-samsung-9100-2tb` | Samsung 9100 Pro 2TB PCIe 5.0 NVMe | NVMe SSD | 2000 | 14700 |
| `storage-samsung-990-evo-1tb` | Samsung 990 EVO 1TB NVMe | NVMe SSD | 1000 | 5000 |
| `storage-samsung-990evo-plus-1tb` | Samsung 990 EVO Plus 1TB NVMe | NVMe SSD | 1000 | 7250 |
| `storage-samsung-990-evo-2tb` | Samsung 990 EVO Plus 2TB NVMe | NVMe SSD | 2000 | 7250 |
| `storage-samsung-870-evo-500gb` | Samsung 870 EVO 500GB SATA SSD | SATA SSD | 500 | 560 |
| `storage-samsung-870-1tb` | Samsung 870 EVO 1TB SATA SSD | SATA SSD | 1000 | 560 |
| `storage-samsung-870-2tb` | Samsung 870 EVO 2TB SATA SSD | SATA SSD | 2000 | 560 |
| `storage-samsung-870-qvo-4tb` | Samsung 870 QVO 4TB SATA SSD | SATA SSD | 4000 | 560 |

**Entry point:** `samsung.com/semiconductor/minisite/ssd/` — navigate to the
exact model. ⚠️ Entry points are to navigate from, not to cite.

**Traps:** 🛑 **Two rows name the same product family with different ids** —
`storage-samsung-990-evo-1tb` is the **990 EVO** and
`storage-samsung-990evo-plus-1tb` is the **990 EVO Plus**, which are different
drives with different ratings. Read the id and the name together. ⚠️ The 990
Pro's 7450 MB/s is the same at 1/2/4 TB, which is genuinely how Samsung rates
it — do not "correct" it to a per-capacity ladder. ⚠️ The 870 QVO is QLC and
rated the same 560 MB/s sequential as the EVO; the difference is sustained
write, which is out of scope.

- [ ] **Step 1: Research all twelve rows under protocol S**

For each id, open the maker's page for that exact model **and capacity**, read
`storageType`, `capacityGb`, `readMbps` and (M.2 only) `m2Sata`, cross-check
the read speed, and record the URL you opened.

- [ ] **Step 2: Write the values with the house serializer**

Create `<scratchpad>/apply-tranche.mjs` — written once, reused by Tasks 4–8:

```js
// Applies one research tranche to both data files, in the repo's own JSON
// style. Refuses to write unless house-json round-trips BOTH files first.
// Run from the REPO ROOT (house-json reads relative paths).
import { readFileSync, writeFileSync } from 'node:fs'
// ⚠️ An ABSOLUTE file: URL - the scratchpad is not inside the repo.
import { FILES, toFile, roundTripOk } from 'file:///C:/Users/jacob/IdeaProjects/CustomPc/scripts/house-json.mjs'

// EDIT PER TRANCHE. `part` merges into the part, `specs` into its specs (null
// DELETES a key), `sources` into that part's provenance entry.
const TRANCHE = {
  'storage-example': {
    part: { storageType: 'NVMe SSD', capacityGb: 2000 },
    specs: { readMbps: 7000, m2Sata: false },
    sources: {
      storageType: { url: 'https://example.com/x', checkedOn: '2026-09-03' },
      capacityGb: { url: 'https://example.com/x', checkedOn: '2026-09-03' },
      readMbps: { url: 'https://example.com/x', checkedOn: '2026-09-03' },
      m2Sata: { url: 'https://example.com/x', checkedOn: '2026-09-03' },
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
  const before = { t: part.storageType, c: part.capacityGb, r: part.specs?.readMbps }
  Object.assign(part, entry.part ?? {})
  for (const [k, v] of Object.entries(entry.specs ?? {})) {
    if (v === null) delete part.specs[k]
    else part.specs[k] = v
  }
  if (before.t !== part.storageType) console.log(`type    ${id}: ${before.t} -> ${part.storageType}`)
  if (before.c !== part.capacityGb) console.log(`gb      ${id}: ${before.c} -> ${part.capacityGb}`)
  if (before.r !== part.specs?.readMbps) console.log(`read    ${id}: ${before.r} -> ${part.specs?.readMbps}`)
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

Replace `TRANCHE` with this tranche's twelve rows, then:

```bash
node "$CLAUDE_SCRATCHPAD/apply-tranche.mjs"
```

Expected: two `MATCH` lines, then `applied 12 rows`.

- [ ] **Step 3: Check the diff is small**

```bash
git diff --stat src/data/partsData.json data/partSources.json
```

Expected: tens of lines. **A 3236-line diff means the serializer was bypassed —
revert and fix.**

- [ ] **Step 4: Verify**

```bash
npm run catalog:coverage && npm run test:run && npm run lint
```

Expected: `storage: 12/52 (23%)` and PASS.

⚠️ **The verdict snapshot may move.** Unlike coolers, a `storageType`
correction can flip a drive between rule 3's branches. If `verdictSpread`
fails, update it and **read the diff**: only `storage` may change, and the
change must be explicable by a specific corrected value.

- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the twelve Samsung drives"
```

⚠️ Name any corrected value in the commit message.

### Task 4: Crucial — 11 rows

| id | name | type | GB | readMbps now |
|---|---|---|---|---|
| `storage-crucial-p3-500gb` | Crucial P3 500GB NVMe | NVMe SSD | 500 | 3500 |
| `storage-crucial-p3-1tb` | Crucial P3 1TB NVMe | NVMe SSD | 1000 | 3500 |
| `storage-crucial-p3plus-1tb` | Crucial P3 Plus 1TB NVMe | NVMe SSD | 1000 | 5000 |
| `storage-crucial-p3plus-2tb` | Crucial P3 Plus 2TB NVMe | NVMe SSD | 2000 | 5000 |
| `storage-crucial-p310-1tb` | Crucial P310 1TB NVMe | NVMe SSD | 1000 | 7100 |
| `storage-crucial-p310-2tb` | Crucial P310 2TB NVMe | NVMe SSD | 2000 | 7100 |
| `storage-crucial-t500-2tb` | Crucial T500 2TB NVMe | NVMe SSD | 2000 | 7400 |
| `storage-crucial-t700-2tb` | Crucial T700 2TB PCIe 5.0 NVMe | NVMe SSD | 2000 | 12400 |
| `storage-crucial-t705-2tb` | Crucial T705 2TB PCIe 5.0 NVMe | NVMe SSD | 2000 | 14500 |
| `storage-crucial-mx500-500gb` | Crucial MX500 500GB SATA SSD | SATA SSD | 500 | 560 |
| `storage-crucial-bx500-1tb` | Crucial BX500 1TB SATA SSD | SATA SSD | 1000 | 540 |

**Entry point:** `crucial.com`.

**Traps:** ⚠️ **Crucial is now a Micron consumer brand and some pages redirect**
to Micron; cite the page you land on. ⚠️ **P3 and P3 Plus are different
drives** (Gen3 vs Gen4) and so are **T700 and T705**. ⚠️ The P310 is a **2230-
and 2280-form-factor** drive — form factor is out of scope, but do not let the
2230 variant's spec block be the one you read.

- [ ] **Step 1: Research all eleven rows under protocol S**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect two `MATCH` lines, then `applied 11 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `storage: 23/52 (44%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the eleven Crucial drives"
```

### Task 5: WD — 11 rows

| id | name | type | GB | readMbps now |
|---|---|---|---|---|
| `storage-wd-sn770-1tb` | WD Black SN770 1TB NVMe | NVMe SSD | 1000 | 5150 |
| `storage-wd-sn770-2tb` | WD Black SN770 2TB NVMe | NVMe SSD | 2000 | 5150 |
| `storage-wd-sn850x-1tb` | WD Black SN850X 1TB NVMe | NVMe SSD | 1000 | 7300 |
| `storage-wd-sn850x-2tb` | WD Black SN850X 2TB NVMe | NVMe SSD | 2000 | 7300 |
| `storage-wd-sn850x-4tb` | WD Black SN850X 4TB NVMe | NVMe SSD | 4000 | 7300 |
| `storage-wd-sn7100-1tb` | WD Black SN7100 1TB NVMe | NVMe SSD | 1000 | 7250 |
| `storage-wd-sn7100-2tb` | WD Black SN7100 2TB NVMe | NVMe SSD | 2000 | 7250 |
| `storage-wd-sn580-1tb` | WD Blue SN580 1TB NVMe | NVMe SSD | 1000 | 4150 |
| `storage-wd-sn580-2tb` | WD Blue SN580 2TB NVMe | NVMe SSD | 2000 | 4150 |
| `storage-wd-blue-1tb-hdd` | WD Blue 1TB HDD | HDD | 1000 | 150 |
| `storage-wd-blue-4tb-hdd` | WD Blue 4TB HDD | HDD | 4000 | 180 |

**Entry point:** `westerndigital.com` (WD_BLACK products may sit under `wdc.com`
or the SanDisk umbrella — cite where you land).

**Traps:** 🛑 **The SN850X 1TB is rated LOWER than the 2TB and 4TB** in WD's own
table — this is the clearest per-capacity case in the project, and the row
currently carries one figure for all three. ⚠️ **`storage-wd-sn580-2tb` still
carries `brand: "Western Digital"` if Task 2 Step 5 was skipped** — check it is
`"WD"` before starting. ⚠️ WD publishes HDD speed as a **"host to/from drive"
sustained rate**; if a Blue capacity has none, record `unverifiable` rather
than borrowing the other capacity's figure.

- [ ] **Step 1: Research all eleven rows under protocol S**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect `applied 11 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `storage: 34/52 (65%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the eleven WD drives"
```

### Task 6: Seagate — 7 rows

| id | name | type | GB | readMbps now |
|---|---|---|---|---|
| `storage-seagate-1tb-hdd` | Seagate Barracuda 1TB HDD | HDD | 1000 | 210 |
| `storage-seagate-2tb-hdd` | Seagate Barracuda 2TB HDD | HDD | 2000 | 190 |
| `storage-seagate-4tb-hdd` | Seagate Barracuda 4TB HDD | HDD | 4000 | 190 |
| `storage-seagate-6tb-hdd` | Seagate Barracuda 6TB HDD | HDD | 6000 | 190 |
| `storage-seagate-8tb-hdd` | Seagate Barracuda 8TB HDD | HDD | 8000 | 210 |
| `storage-firecuda-530-2tb` | Seagate FireCuda 530 2TB NVMe | NVMe SSD | 2000 | 7300 |
| `storage-firecuda-530r-4tb` | Seagate FireCuda 530R 4TB NVMe | NVMe SSD | 4000 | 7300 |

**Entry point:** `seagate.com`.

**Traps:** 🛑 **This is the tranche the copying tell points at** — five
Barracudas carrying 190/210 in a near-alternating pattern. Seagate's Barracuda
family spans **2.5" and 3.5", SMR and CMR**, at different rates per capacity;
the 1 TB is commonly a 2.5" part. Read each capacity's own datasheet.
⚠️ Seagate often publishes only "Max Sustained Transfer Rate (OD)" in a PDF
datasheet rather than on the product page. ⚠️ **FireCuda 530 and 530R are
different drives.**

- [ ] **Step 1: Research all seven rows under protocol S**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect `applied 7 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `storage: 41/52 (79%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the seven Seagate drives"
```

### Task 7: Kingston — 5 rows

| id | name | type | GB | readMbps now |
|---|---|---|---|---|
| `storage-kingston-nv2-1tb` | Kingston NV2 1TB NVMe | NVMe SSD | 1000 | 3500 |
| `storage-kingston-nv3-500` | Kingston NV3 500GB NVMe | NVMe SSD | 500 | 6000 |
| `storage-kingston-nv3-1tb` | Kingston NV3 1TB NVMe | NVMe SSD | 1000 | 6000 |
| `storage-kingston-nv3-2tb` | Kingston NV3 2TB NVMe | NVMe SSD | 2000 | 6000 |
| `storage-kingston-kc3000-1tb` | Kingston KC3000 1TB NVMe | NVMe SSD | 1000 | 7000 |

**Entry point:** `kingston.com`.

**Traps:** 🛑 **The NV3 500 GB carrying the same 6000 MB/s as its 1 TB and 2 TB
siblings is the single most likely wrong value in this project** — small
capacities have fewer NAND dies and are routinely rated lower. Read the
capacity table. ⚠️ Kingston explicitly reserves the right to ship the NV2/NV3
with **different controllers and NAND**, publishing a rate range rather than
one figure; if so, take the rated sequential read from the spec table and note
the variability.

- [ ] **Step 1: Research all five rows under protocol S**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect `applied 5 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `storage: 46/52 (88%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the five Kingston drives"
```

### Task 8: Toshiba, Lexar, Solidigm and TeamGroup — 6 rows

| id | name | type | GB | readMbps now |
|---|---|---|---|---|
| `storage-toshiba-p300-2tb` | Toshiba P300 2TB HDD | HDD | 2000 | 190 |
| `storage-toshiba-x300-8tb` | Toshiba X300 8TB HDD | HDD | 8000 | 210 |
| `storage-lexar-nm790-2tb` | Lexar NM790 2TB NVMe | NVMe SSD | 2000 | 7400 |
| `storage-lexar-nm790-4tb` | Lexar NM790 4TB NVMe | NVMe SSD | 4000 | 7400 |
| `storage-solidigm-p44-1tb` | Solidigm P44 Pro 1TB NVMe | NVMe SSD | 1000 | 7000 |
| `storage-teamgroup-mp44l-1tb` | TeamGroup MP44L 1TB NVMe | NVMe SSD | 1000 | 5000 |

**Entry points:** `toshiba-storage.com`, `lexar.com`, `solidigm.com`,
`teamgroupinc.com`.

**Traps:** 🛑 **This tranche closes the category.** ⚠️ Toshiba's consumer drive
business is now **Kioxia** for SSDs but P300/X300 HDDs remain Toshiba — expect
redirects and cite where you land. ⚠️ **Solidigm is the former Intel SSD
business**; the P44 Pro is an SK hynix Platinum P41 twin, and review sources
often conflate them — use Solidigm's own page. ⚠️ **TeamGroup's MP44L is a
DRAM-less drive published in several regional spec tables that disagree**; take
the global site's.

- [ ] **Step 1: Research all six rows under protocol S**
- [ ] **Step 2: Write them with the Task 3 Step 2 writer** (expect `applied 6 rows`)
- [ ] **Step 3: Check the diff is small**
- [ ] **Step 4: Verify** — expect `storage: 52/52 parts fully researched (100%)` and PASS
- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the two Toshiba, two Lexar, Solidigm and TeamGroup drives"
```

---

## Task 9: Switch the ratchet on

**Files:** `src/tests/partSources.test.js`

- [ ] **Step 1: Check every key for a collision BEFORE adding it**

🛑 Gotcha 5. Run this first:

```bash
node -e "const d=require('./src/data/partsData.json');for(const k of ['readMbps','storageType','capacityGb']){const by={};for(const p of d){const v=p.specs?.[k]!==undefined||p[k]!==undefined;if(v)by[p.category]=(by[p.category]||0)+1}console.log(k,JSON.stringify(by))}"
```

Expected: all three appear **only** under `storage`. If any shows another
category, it goes in `RESEARCHED_KEYS_BY_CATEGORY`, not the global list.

- [ ] **Step 2: Add the keys and the category**

In `src/tests/partSources.test.js`, add to `RESEARCHED_KEYS` (only those the
step above proved unambiguous):

```js
  // ⚠️ Third time for this rule: `readMbps` could only join once all 52 drives
  // had a source. `storageType` and `capacityGb` are TOP-LEVEL, so they are
  // enforced by RATCHETED_KEYS below rather than here.
  'readMbps',
```

and:

```js
const VERIFIED_CATEGORIES = new Set(['gpu', 'case', 'psu', 'motherboard', 'cooler', 'storage'])
```

- [ ] **Step 3: Run the suite**

```bash
npm run test:run
```

Expected: PASS. A failure names the exact `<id>.<field>` still missing
provenance — finish that row rather than weakening the list.

- [ ] **Step 4: Prove the ratchet is non-vacuous on BOTH ratcheted keys**

Delete one drive's `storageType` source, run, expect FAIL naming it; restore.
Repeat for `capacityGb` and for `readMbps`.

```bash
npx vitest run src/tests/partSources.test.js
git checkout -- data/partSources.json
```

⚠️ A ratchet that cannot fail is worth nothing. Do not skip, and do not test
only one key — the cooler project found all three of its demands bit, and
checking one would not have proved the other two.

- [ ] **Step 5: Run everything**

```bash
npm run test:run && npm run lint && npm run build && npm run test:e2e
```

⚠️ **One 30 s e2e timeout fails the whole suite — re-run before blaming your
change.**

- [ ] **Step 6: Commit**

```bash
git add src/tests
git commit -m "feat: switch the storage ratchet on"
```

- [ ] **Step 7: Close out the plan and the spec**

Tick every checkbox, record what the research actually found, and commit as
`docs: close out the storage research plan - 52/52`.

- [ ] **Step 8: Report, and stop**

🛑 **Do not push and do not run `npm run catalog:push`.** Report the coverage
figure, the snapshot movement, every corrected value, and that **`main` is far
ahead of origin with two research tranches in it** — the push and
`npm run catalog:push -- --apply` are the user's.

---

## Success criteria

- `npm run catalog:coverage` reports **storage 52/52 (100%)**; the five finished categories unchanged.
- `partSources.test.js` passes with `storage` in `VERIFIED_CATEGORIES`, proved **non-vacuous on both ratcheted keys**.
- **Rule 3's SATA-M.2 branch is reachable**, pinned by a test.
- **Coverage and rule 3 agree on every drive**, pinned by a test.
- No NVMe drive's part page says it connects by cable; `prerendered/` re-rendered.
- Lint, unit, e2e, build and prerender all green.
