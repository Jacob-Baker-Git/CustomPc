# CPU catalogue research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Bring all 80 CPUs up to the research standard — verify `socket`, `tdp`, `specs.cores` and `specs.boostClock` against each maker's spec page, record provenance, and switch the CPU ratchet on.

**Architecture:** Task 1 teaches the coverage core about CPUs with a **flat** required list (every CPU owes all four fields). Tasks 2–5 research 80 processors under protocol P, by brand and socket. Task 6 switches the ratchet on. There is **no new field, no new rule and no bug fix** — every field the rules read already exists and the readers are clean, so this is re-verification, provenance and the ratchet only. `perfScore` (a benchmark figure) and `legacy` are out of scope and are never touched.

**Tech Stack:** Node 22 ESM scripts, Vitest, ESLint, WebSearch + the maker spec pages (Intel `ark.intel.com`, AMD `amd.com`), `scripts/house-json.mjs` for every JSON write.

**Spec:** `docs/superpowers/specs/2026-09-03-cpu-catalogue-research-design.md`

---

## Before you start: things that will bite you

1. 🛑 **`socket` is THE field — it drives 4041 of 5600 CPU×board blocks.** Intel
   ark writes the socket as **`FCLGA1700` / `FCLGA1851` / `FCLGA1200`** — MAP
   these to the catalogue tokens **`LGA1700` / `LGA1851` / `LGA1200`** (drop the
   `FC`). AMD lists **`AM5` / `AM4`** directly. The token must match the
   board/cooler tokens exactly — `compatibility.js` uses `===`, not a fuzzy match.

2. 🛑 **Never write these JSON files with `JSON.stringify(obj, null, 2)`.** Use
   `scripts/house-json.mjs`, which proves a byte-for-byte round trip first.

3. ⚠️ **`tdp` is the BASE power, not turbo.** Intel ark: take **"Processor Base
   Power"** (older parts label it "TDP"), NEVER "Maximum Turbo Power". AMD: take
   **"Default TDP"**, NEVER PPT / socket power. The design decided base TDP.

4. ⚠️ **`cores` is TOTAL cores.** Intel 12th–14th gen and Core Ultra are hybrid
   (P-cores + E-cores); ark's **"Total Cores"** already sums them (a 14900K is
   `24` = 8P+16E). Do not record P-cores only.

5. ⚠️ **`boostClock` is the highest published boost, in GHz.** Intel: the top of
   Max Turbo Frequency / Turbo Boost Max 3.0 / Thermal Velocity Boost (a 14900K
   is `6.0`). AMD: **"Max. Boost Clock"**. One decimal, per SKU.

6. ⚠️ **`cores`/`boostClock` must NOT join `RESEARCHED_KEYS` until Task 6.** All
   80 rows carry both, so adding the keys early fails the suite instantly. The
   `rating`/`height`/`readMbps`/`sticks` precedent, a **fifth** time.

7. ⚠️ **`cpu` must NOT join `VERIFIED_CATEGORIES` until Task 6.**
   `missingRatchetSources` would demand a `socket` and `tdp` source for all 80.

8. 🛑 **`perfScore` and `legacy` are OUT.** `perfScore` is a benchmark figure
   (its own pipeline) and `legacy` is a discontinued-flag — never re-verify
   them, never give them a source entry, never delete them.

9. ⚠️ **A `socket` correction MOVES the verdict snapshot** (unlike RAM). A
   corrected socket flips CPU×board and CPU×cooler blocks. If
   `src/tests/verdictSpread.test.js` fails, update the snapshot and **read the
   diff** — only `cpu` may change, and each change must trace to one corrected
   socket.

10. 🛑 **GREP EVERY CATEGORY before putting a key in the global `RESEARCHED_KEYS`.**
    `specs.cores`/`specs.boostClock` are CPU-only today, but Task 6 Step 1
    re-confirms it before adding — the check is the discipline.

11. ⚠️ **`node -e` in the Bash tool eats backticks and apostrophes.** Write a
    `.mjs` to the scratchpad and run it.

12. ⚠️ **Do not push.** `git push`, `npm run catalog:push` and any deploy are the
    user's. `main` is **already ~41 commits ahead of origin** with the cooler,
    storage and RAM tranches in it, plus this project's spec on top.

## File structure

| file | responsibility | tasks |
|---|---|---|
| `scripts/catalog-coverage-core.mjs` | `EXPECTED.cpu` (flat), `RATCHETED_KEYS.cpu` | 1 |
| `src/tests/catalogCoverage.test.js` | coverage tests for CPU | 1 |
| `src/data/partsData.json` | the 80 CPU rows | 2–5 |
| `data/partSources.json` | one provenance entry per researched field | 2–5 |
| `src/tests/partSources.test.js` | `RESEARCHED_KEYS`, `VERIFIED_CATEGORIES` | 6 |

⚠️ No `prerendered/` re-render is needed unless a CPU **name** changes (a
re-point) — the parts listing prints name/brand/price only, and CPU spec sheets
are client-rendered, not among the seven prerendered route fragments.

---

## Research protocol P

**Every row in Tasks 2–5 follows this exact protocol.** It is protocol R (case
plan) as refined by the RAM plan, with the CPU values named here.

For each CPU id:

1. **Open the maker's spec page for that exact model.** Intel →
   `ark.intel.com` (search the model number, e.g. "i9-14900K"); AMD →
   `amd.com` product page. WebSearch surfaces the page; the maker page is the
   citation. Check the line-up first — re-point a wrong name and **keep the id**.

2. **Read four values:**

   - **`socket`** (top level) — 🛑 the branch the whole build anchors on. Intel
     ark "Sockets Supported" = `FCLGA1700`/`FCLGA1851`/`FCLGA1200` → record
     `LGA1700`/`LGA1851`/`LGA1200`. AMD "Socket" = `AM5`/`AM4` verbatim.

   - **`tdp`** (top level) — the **base** power in W. Intel "Processor Base
     Power" (or "TDP"), AMD "Default TDP". ⚠️ **Never** Max Turbo Power / PPT.

   - **`specs.cores`** — **Total Cores** (P+E summed for Intel hybrids).

   - **`specs.boostClock`** — the highest published boost/turbo in GHz.

3. **Cross-check `socket` against the known generation:** Ryzen 7000/8000/9000 →
   `AM5`; Ryzen 5000/3000 → `AM4`; Core i 12th/13th/14th → `LGA1700`; Core Ultra
   2xx → `LGA1851`; Core i 10th/11th → `LGA1200`. A socket that disagrees with
   the generation is the highest-value catch in the project.

4. **Write the values** with the Task 2 Step 2 writer.

5. **If a (usually legacy) part's page is gone**, record it unverifiable and
   **remove the field**:

   ```json
   { "checkedOn": "2026-09-03", "result": "unverifiable", "note": "discontinued; neither ark nor amd.com still publishes a spec page for this SKU" }
   ```

   ⚠️ An unverifiable entry has `checkedOn` and a non-empty `note`, and **no**
   `url`. ark and AMD keep old pages, so this should be rare even for legacy.

6. **Where a re-verified value disagrees, change it, and name the old value in
   the commit message.**

### The shape a finished CPU takes

⚠️ **SHAPE ONLY — every value is illustrative. Never copy these in.**

```json
{
  "id": "cpu-example",
  "category": "cpu",
  "name": "AMD Ryzen 5 Example",
  "brand": "AMD",
  "price": 199.99,
  "socket": "AM5",
  "tdp": 65,
  "perfScore": 70,
  "specs": { "cores": 6, "boostClock": 5.1 }
}
```

```json
"cpu-example": {
  "socket": { "url": "https://www.amd.com/en/products/...", "checkedOn": "2026-09-03" },
  "tdp": { "url": "https://www.amd.com/en/products/...", "checkedOn": "2026-09-03", "note": "Default TDP (base)" },
  "cores": { "url": "https://www.amd.com/en/products/...", "checkedOn": "2026-09-03" },
  "boostClock": { "url": "https://www.amd.com/en/products/...", "checkedOn": "2026-09-03", "note": "Max Boost Clock, GHz" }
}
```

⚠️ `perfScore` and `legacy` stay exactly as they are and **must never get a
source entry.**

---

## Task 1: Coverage learns CPU

**Files:**
- Modify: `scripts/catalog-coverage-core.mjs` (`EXPECTED`, `RATCHETED_KEYS`)
- Test: `src/tests/catalogCoverage.test.js`

- [x] **Step 1: Write the failing tests**

Append to `src/tests/catalogCoverage.test.js`:

```js
describe('cpu expectations', () => {
  const chip = (id, over = {}) =>
    ({ id, category: 'cpu', socket: 'AM5', tdp: 65, perfScore: 70, specs: { cores: 6, boostClock: 5.1 }, ...over })

  it('expects the four fields, flat for every processor', () => {
    expect(requiredFor(EXPECTED.cpu, chip('a')))
      .toEqual(['socket', 'tdp', 'cores', 'boostClock'])
    // A legacy Intel chip owes exactly the same four.
    expect(requiredFor(EXPECTED.cpu, chip('b', { socket: 'LGA1200', tdp: 125, legacy: true, specs: { cores: 8, boostClock: 5.3 } })))
      .toEqual(['socket', 'tdp', 'cores', 'boostClock'])
  })

  it('counts a fully sourced processor as verified', () => {
    const parts = [chip('a')]
    const sources = { a: { socket: src(), tdp: src(), cores: src(), boostClock: src() } }
    expect(coverageFor('cpu', parts, sources).verified).toBe(1)
  })

  it('does not verify a processor whose boostClock was never sourced', () => {
    const parts = [chip('a')]
    const sources = { a: { socket: src(), tdp: src(), cores: src() } }
    expect(coverageFor('cpu', parts, sources).verified).toBe(0)
  })

  it('ratchets the two top-level block-driving fields and no others', () => {
    expect(RATCHETED_KEYS.cpu).toEqual(['socket', 'tdp'])
  })
})
```

- [x] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: FAIL — `EXPECTED.cpu` and `RATCHETED_KEYS.cpu` are `undefined`.

- [x] **Step 3: Add the expectations**

In `scripts/catalog-coverage-core.mjs`, add to `EXPECTED` after `ram`:

```js
  // The eighth category, flat like RAM: every processor owes all four. Two rules
  // read a CPU and both block - `socket` (compatibility.js's CPU<->board,
  // CPU<->cooler and CPU->DDR-type checks) and `tdp` (psuTooSmall + the cooler
  // warning). `cores` and `boostClock` are the headline specs the spec sheet
  // prints. `perfScore` is absent: it is a benchmark figure, not a maker spec.
  cpu: {
    required: ['socket', 'tdp', 'cores', 'boostClock'],
    optional: [],
  },
```

Add to `RATCHETED_KEYS` after `ram`:

```js
  // `socket` is the biggest verdict-driver in the catalogue and `tdp` block-
  // drives psuTooSmall; both are top-level. ⚠️ `tdp` is ratcheted HERE and
  // nowhere else that carries a tdp: a CPU's 58-170 is a real maker number,
  // whereas the case/PSU/board tdp is a 0/12 sentinel. Per-category keys are
  // exactly what lets that distinction stand. `cores`/`boostClock` are specs
  // fields, enforced by RESEARCHED_KEYS instead.
  cpu: ['socket', 'tdp'],
```

- [x] **Step 4: Run the tests**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: PASS.

- [x] **Step 5: Confirm the category reports zero and the others are unchanged**

```bash
npm run catalog:coverage
```

Expected: `cpu: 0/80 parts fully researched (0%)`, with `socket 80/80`,
`tdp 80/80`, `cores 80/80`, `boostClock 80/80` all **present**, 0 sourced. The
seven finished categories must print **byte-identically** at 100%.

- [x] **Step 6: Full suite, lint, commit**

```bash
npm run test:run && npm run lint
git add scripts/catalog-coverage-core.mjs src/tests/catalogCoverage.test.js
git commit -m "feat: expect four fields of a cpu"
```

---

## Tasks 2–5: the data tranches

Four tranches, by brand and socket. **Every row follows research protocol P.**
Task 2 writes out the full five steps and the writer; later tranches give their
own rows, traps and commit, and refer to Task 2 Step 2 for the writer.

### Task 2: AMD AM5 — 26 rows

**Files:** Create `<scratchpad>/apply-tranche.mjs`; modify `src/data/partsData.json`, `data/partSources.json`

| id | name | socket | tdp | cores | boost |
|---|---|---|---|---|---|
| `cpu-ryzen-9-7950x` | AMD Ryzen 9 7950X | AM5 | 170 | 16 | 5.7 |
| `cpu-ryzen-7-7700x` | AMD Ryzen 7 7700X | AM5 | 105 | 8 | 5.4 |
| `cpu-ryzen-5-7600x` | AMD Ryzen 5 7600X | AM5 | 105 | 6 | 5.3 |
| `cpu-ryzen-9-7900x` | AMD Ryzen 9 7900X | AM5 | 170 | 12 | 5.6 |
| `cpu-ryzen-7-7800x3d` | AMD Ryzen 7 7800X3D | AM5 | 120 | 8 | 5.0 |
| `cpu-ryzen-5-7600` | AMD Ryzen 5 7600 | AM5 | 65 | 6 | 5.1 |
| `cpu-ryzen-5-8500g` | AMD Ryzen 5 8500G | AM5 | 65 | 6 | 5.0 |
| `cpu-ryzen-9-7900` | AMD Ryzen 9 7900 | AM5 | 65 | 12 | 5.4 |
| `cpu-ryzen-7-7700` | AMD Ryzen 7 7700 | AM5 | 65 | 8 | 5.3 |
| `cpu-ryzen-9-7950x3d` | AMD Ryzen 9 7950X3D | AM5 | 120 | 16 | 5.7 |
| `cpu-ryzen-7-8700g` | AMD Ryzen 7 8700G | AM5 | 65 | 8 | 5.1 |
| `cpu-ryzen-9-9950x3d` | AMD Ryzen 9 9950X3D | AM5 | 170 | 16 | 5.7 |
| `cpu-ryzen-9-9950x` | AMD Ryzen 9 9950X | AM5 | 170 | 16 | 5.7 |
| `cpu-ryzen-7-9800x3d` | AMD Ryzen 7 9800X3D | AM5 | 120 | 8 | 5.2 |
| `cpu-ryzen-9-9900x` | AMD Ryzen 9 9900X | AM5 | 120 | 12 | 5.6 |
| `cpu-ryzen-7-9700x` | AMD Ryzen 7 9700X | AM5 | 65 | 8 | 5.5 |
| `cpu-ryzen-5-9600x` | AMD Ryzen 5 9600X | AM5 | 65 | 6 | 5.4 |
| `cpu-ryzen-5-7500f` | AMD Ryzen 5 7500F | AM5 | 65 | 6 | 5.0 |
| `cpu-ryzen-9-7900x3d` | AMD Ryzen 9 7900X3D | AM5 | 120 | 12 | 5.6 |
| `cpu-ryzen-5-9600` | AMD Ryzen 5 9600 | AM5 | 65 | 6 | 5.2 |
| `cpu-ryzen-5-8400f` | AMD Ryzen 5 8400F | AM5 | 65 | 6 | 4.7 |
| `cpu-ryzen-5-8600g` | AMD Ryzen 5 8600G | AM5 | 65 | 6 | 5.0 |
| `cpu-ryzen-7-8700f` | AMD Ryzen 7 8700F | AM5 | 65 | 8 | 5.0 |
| `cpu-ryzen-5-9500f` | AMD Ryzen 5 9500F | AM5 | 65 | 6 | 5.0 |
| `cpu-ryzen-7-9700f` | AMD Ryzen 7 9700F | AM5 | 65 | 8 | 5.4 |
| `cpu-ryzen-9-9900` | AMD Ryzen 9 9900 | AM5 | 65 | 12 | 5.4 |

**Entry point:** `amd.com` → Processors → Ryzen Desktop; or WebSearch
"AMD Ryzen 9 7950X specifications amd.com".

**Traps:** ⚠️ **X3D parts have a LOWER boost than their non-X3D siblings** (the
7800X3D is 5.0, the 7700X is 5.4) — do not "correct" a genuine X3D figure up.
⚠️ **`F` parts (no iGPU) and `G` parts (APU) share a socket and TDP with the
mainstream chip but differ in boost** — read each SKU. ⚠️ AMD's 65W parts have a
much higher PPT than 65W; take **Default TDP**, not PPT.

- [x] **Step 1: Research all 26 rows under protocol P**

- [x] **Step 2: Write the values with the house serializer**

Create `<scratchpad>/apply-tranche.mjs` — written once, reused by Tasks 3–5:

```js
// Applies one research tranche to both data files, in the repo's own JSON style.
// Refuses to write unless house-json round-trips BOTH files first.
// Run from the REPO ROOT (house-json reads relative paths).
import { readFileSync, writeFileSync } from 'node:fs'
import { FILES, toFile, roundTripOk } from 'file:///C:/Users/jacob/IdeaProjects/CustomPc/scripts/house-json.mjs'

const on = '2026-09-03'
const s = (url) => ({ url, checkedOn: on })
const sn = (url, note) => ({ url, checkedOn: on, note })
// Four field sources sharing one maker URL.
const four = (url) => ({
  socket: s(url), tdp: sn(url, 'base TDP / Processor Base Power'),
  cores: s(url), boostClock: sn(url, 'max boost/turbo GHz'),
})

// EDIT PER TRANCHE. `part` merges top-level (socket/tdp), `specs` merges
// cores/boostClock (null DELETES), `sources` merges provenance. Give `part`/
// `specs` ONLY the fields that CHANGE; a correct row needs `sources` alone.
const TRANCHE = {
  'cpu-example': { sources: four('https://www.amd.com/en/products/apu/x') },
  // a corrected row, e.g.:
  // 'cpu-other': { part: { tdp: 105 }, sources: four('https://ark.intel.com/...') },
}
const RENAME = {}

if (!roundTripOk(true)) {
  console.error('house-json does not round-trip the files as they stand; fix that first')
  process.exit(1)
}

const parts = JSON.parse(readFileSync('src/data/partsData.json', 'utf8'))
const sources = JSON.parse(readFileSync('data/partSources.json', 'utf8'))

for (const [id, entry] of Object.entries(TRANCHE)) {
  const part = parts.find((p) => p.id === id)
  if (!part) throw new Error(`no part with id ${id}`)
  const before = { so: part.socket, t: part.tdp, c: part.specs?.cores, b: part.specs?.boostClock }
  Object.assign(part, entry.part ?? {})
  for (const [k, v] of Object.entries(entry.specs ?? {})) {
    if (v === null) delete part.specs[k]
    else part.specs[k] = v
  }
  if (before.so !== part.socket) console.log(`socket ${id}: ${before.so} -> ${part.socket}`)
  if (before.t !== part.tdp) console.log(`tdp    ${id}: ${before.t} -> ${part.tdp}`)
  if (before.c !== part.specs?.cores) console.log(`cores  ${id}: ${before.c} -> ${part.specs?.cores}`)
  if (before.b !== part.specs?.boostClock) console.log(`boost  ${id}: ${before.b} -> ${part.specs?.boostClock}`)
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

Replace `TRANCHE` with this tranche's 26 rows, then:

```bash
node "$CLAUDE_SCRATCHPAD/apply-tranche.mjs"
```

Expected: two `MATCH` lines, any correction lines, then `applied 26 rows`.

- [x] **Step 3: Check the diff is small**

```bash
git diff --stat src/data/partsData.json data/partSources.json
```

Expected: tens of lines in `partsData` at most (only corrections), a large
block of new `partSources` entries. **A multi-thousand-line `partsData` diff
means the serializer was bypassed — revert and fix.**

- [x] **Step 4: Verify**

```bash
npm run catalog:coverage && npm run test:run && npm run lint
```

Expected: `cpu: 26/80 (33%)` and PASS. ⚠️ **If `verdictSpread` fails, a `socket`
was corrected** — update the snapshot with `npx vitest run -u
src/tests/verdictSpread.test.js`, then read the diff: only `cpu` may move, and
each change must trace to a specific corrected socket.

- [x] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the twenty-six AMD AM5 processors"
```

⚠️ Name any corrected value in the commit message.

### Task 3: AMD AM4 (legacy) — 13 rows

| id | name | socket | tdp | cores | boost |
|---|---|---|---|---|---|
| `cpu-ryzen-5-5500` | AMD Ryzen 5 5500 | AM4 | 65 | 6 | 4.2 |
| `cpu-ryzen-5-5600` | AMD Ryzen 5 5600 | AM4 | 65 | 6 | 4.4 |
| `cpu-ryzen-5-5600x` | AMD Ryzen 5 5600X | AM4 | 65 | 6 | 4.6 |
| `cpu-ryzen-7-5700x` | AMD Ryzen 7 5700X | AM4 | 65 | 8 | 4.6 |
| `cpu-ryzen-7-5800x` | AMD Ryzen 7 5800X | AM4 | 105 | 8 | 4.7 |
| `cpu-ryzen-7-5800x3d` | AMD Ryzen 7 5800X3D | AM4 | 105 | 8 | 4.5 |
| `cpu-ryzen-9-5900x` | AMD Ryzen 9 5900X | AM4 | 105 | 12 | 4.8 |
| `cpu-ryzen-9-5950x` | AMD Ryzen 9 5950X | AM4 | 105 | 16 | 4.9 |
| `cpu-ryzen-5-3600` | AMD Ryzen 5 3600 | AM4 | 65 | 6 | 4.2 |
| `cpu-ryzen-7-3700x` | AMD Ryzen 7 3700X | AM4 | 65 | 8 | 4.4 |
| `cpu-ryzen-9-3900x` | AMD Ryzen 9 3900X | AM4 | 105 | 12 | 4.6 |
| `cpu-ryzen-5-5600g` | AMD Ryzen 5 5600G | AM4 | 65 | 6 | 4.4 |
| `cpu-ryzen-7-5700g` | AMD Ryzen 7 5700G | AM4 | 65 | 8 | 4.6 |

**Entry point:** `amd.com` (older Ryzen 3000/5000 pages are still live).

**Traps:** 🛑 **All 13 are `legacy: true` — leave that field untouched.** ⚠️ The
5800X3D boost is 4.5, LOWER than the 5800X's 4.7 — genuine. ⚠️ The 5600G/5700G
are Zen 3 APUs at 65W; confirm each against its own page. ⚠️ If a Ryzen 3000
page has been retired, record `unverifiable` rather than guessing.

- [x] **Step 1: Research all 13 rows under protocol P**
- [x] **Step 2: Write them with the Task 2 Step 2 writer** (expect `applied 13 rows`)
- [x] **Step 3: Check the diff is small**
- [x] **Step 4: Verify** — expect `cpu: 39/80 (49%)` and PASS
- [x] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the thirteen AMD AM4 processors"
```

### Task 4: Intel LGA1700 — 29 rows

| id | name | socket | tdp | cores | boost |
|---|---|---|---|---|---|
| `cpu-i9-13900k` | Intel Core i9-13900K | LGA1700 | 125 | 24 | 5.8 |
| `cpu-i7-13700k` | Intel Core i7-13700K | LGA1700 | 125 | 16 | 5.4 |
| `cpu-i5-13600k` | Intel Core i5-13600K | LGA1700 | 125 | 14 | 5.1 |
| `cpu-i9-13900kf` | Intel Core i9-13900KF | LGA1700 | 125 | 24 | 5.8 |
| `cpu-i7-13700f` | Intel Core i7-13700F | LGA1700 | 65 | 16 | 5.2 |
| `cpu-i5-13400f` | Intel Core i5-13400F | LGA1700 | 65 | 10 | 4.6 |
| `cpu-i3-13100f` | Intel Core i3-13100F | LGA1700 | 58 | 4 | 4.5 |
| `cpu-i5-12400f` | Intel Core i5-12400F | LGA1700 | 65 | 6 | 4.4 |
| `cpu-i9-14900k` | Intel Core i9-14900K | LGA1700 | 125 | 24 | 6.0 |
| `cpu-i7-14700k` | Intel Core i7-14700K | LGA1700 | 125 | 20 | 5.6 |
| `cpu-i5-14600k` | Intel Core i5-14600K | LGA1700 | 125 | 14 | 5.3 |
| `cpu-i5-14400f` | Intel Core i5-14400F | LGA1700 | 65 | 10 | 4.7 |
| `cpu-i5-13500` | Intel Core i5-13500 | LGA1700 | 65 | 14 | 4.8 |
| `cpu-i7-14700` | Intel Core i7-14700 | LGA1700 | 65 | 20 | 5.4 |
| `cpu-i9-14900ks` | Intel Core i9-14900KS | LGA1700 | 150 | 24 | 6.2 |
| `cpu-i3-14100f` | Intel Core i3-14100F | LGA1700 | 58 | 4 | 4.7 |
| `cpu-i3-12100f` | Intel Core i3-12100F | LGA1700 | 58 | 4 | 4.3 |
| `cpu-i5-14600kf` | Intel Core i5-14600KF | LGA1700 | 125 | 14 | 5.3 |
| `cpu-i3-13100` | Intel Core i3-13100 | LGA1700 | 60 | 4 | 4.5 |
| `cpu-i3-14100` | Intel Core i3-14100 | LGA1700 | 60 | 4 | 4.7 |
| `cpu-i5-12500` | Intel Core i5-12500 | LGA1700 | 65 | 6 | 4.6 |
| `cpu-i5-12600k` | Intel Core i5-12600K | LGA1700 | 125 | 10 | 4.9 |
| `cpu-i5-13400` | Intel Core i5-13400 | LGA1700 | 65 | 10 | 4.6 |
| `cpu-i5-14500` | Intel Core i5-14500 | LGA1700 | 65 | 14 | 5.0 |
| `cpu-i7-12700k` | Intel Core i7-12700K | LGA1700 | 125 | 12 | 5.0 |
| `cpu-i7-14700kf` | Intel Core i7-14700KF | LGA1700 | 125 | 20 | 5.6 |
| `cpu-i9-12900k` | Intel Core i9-12900K | LGA1700 | 125 | 16 | 5.2 |
| `cpu-i9-14900f` | Intel Core i9-14900F | LGA1700 | 65 | 24 | 5.8 |
| `cpu-i9-12900ks` | Intel Core i9-12900KS | LGA1700 | 150 | 16 | 5.5 |

**Entry point:** `ark.intel.com` — search the model number; the page's
"Sockets Supported" is `FCLGA1700` → record `LGA1700`.

**Traps:** 🛑 **This is the tranche most likely to expose a wrong `tdp`.** Intel
lists **Processor Base Power** AND **Maximum Turbo Power** on the same page —
take the BASE one (a 14900K is `125`, not `253`). 🛑 **`cores` is Total Cores
(P+E)** — a 14700K is `20` (8P+12E), not 8. ⚠️ **12th/13th/14th gen share a
socket but differ per SKU** in tdp/cores/boost — read each. ⚠️ `KS` parts have a
150W base and the highest boost (14900KS 6.2, 12900KS 5.5). ⚠️ `i3` parts are
58/60W — genuine, do not round to 65.

- [x] **Step 1: Research all 29 rows under protocol P**
- [x] **Step 2: Write them with the Task 2 Step 2 writer** (expect `applied 29 rows`)
- [x] **Step 3: Check the diff is small**
- [x] **Step 4: Verify** — expect `cpu: 68/80 (85%)` and PASS
- [x] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the twenty-nine Intel LGA1700 processors"
```

### Task 5: Intel LGA1851 and LGA1200 (legacy) — 12 rows

| id | name | socket | tdp | cores | boost |
|---|---|---|---|---|---|
| `cpu-intel-ultra-9-285k` | Intel Core Ultra 9 285K | LGA1851 | 125 | 24 | 5.7 |
| `cpu-intel-ultra-7-265k` | Intel Core Ultra 7 265K | LGA1851 | 125 | 20 | 5.5 |
| `cpu-intel-ultra-5-245k` | Intel Core Ultra 5 245K | LGA1851 | 125 | 14 | 5.2 |
| `cpu-ultra-5-225` | Intel Core Ultra 5 225 | LGA1851 | 65 | 10 | 4.9 |
| `cpu-ultra-7-265kf` | Intel Core Ultra 7 265KF | LGA1851 | 125 | 20 | 5.5 |
| `cpu-ultra-9-285` | Intel Core Ultra 9 285 | LGA1851 | 65 | 24 | 5.6 |
| `cpu-i5-10400f` | Intel Core i5-10400F | LGA1200 | 65 | 6 | 4.3 |
| `cpu-i7-10700k` | Intel Core i7-10700K | LGA1200 | 125 | 8 | 5.1 |
| `cpu-i9-10900k` | Intel Core i9-10900K | LGA1200 | 125 | 10 | 5.3 |
| `cpu-i5-11400f` | Intel Core i5-11400F | LGA1200 | 65 | 6 | 4.4 |
| `cpu-i7-11700k` | Intel Core i7-11700K | LGA1200 | 125 | 8 | 5.0 |
| `cpu-i9-11900k` | Intel Core i9-11900K | LGA1200 | 125 | 8 | 5.3 |

**Entry point:** `ark.intel.com`. LGA1851 → `FCLGA1851`; LGA1200 → `FCLGA1200`.

**Traps:** 🛑 **This tranche closes the category.** 🛑 **The six LGA1200 rows are
`legacy: true` — leave that field.** ⚠️ **Core Ultra (Arrow Lake) has NO
hyperthreading and a P+E core count** — a 285K is `24` (8P+16E). Its "Processor
Base Power" is 125. ⚠️ Core Ultra boost: take the **Max Turbo Frequency**
(285K 5.7). ⚠️ The 11900K is 8 cores (Rocket Lake capped at 8), not 10 — a
believable place for a wrong `cores`.

- [x] **Step 1: Research all 12 rows under protocol P**
- [x] **Step 2: Write them with the Task 2 Step 2 writer** (expect `applied 12 rows`)
- [x] **Step 3: Check the diff is small**
- [x] **Step 4: Verify** — expect `cpu: 80/80 (100%)` and PASS
- [x] **Step 5: Commit**

```bash
git add src/data/partsData.json data/partSources.json
git commit -m "data: research the six Core Ultra and six LGA1200 processors"
```

---

## Task 6: Switch the ratchet on

**Files:** `src/tests/partSources.test.js`

- [x] **Step 1: Check every key for a collision BEFORE adding it**

🛑 Gotcha 10. Run this first:

```bash
node -e "const d=require('./src/data/partsData.json');for(const k of ['cores','boostClock','socket','tdp']){const by={};for(const p of d){const v=p.specs?.[k]!==undefined||p[k]!==undefined;if(v)by[p.category]=(by[p.category]||0)+1}console.log(k,JSON.stringify(by))}"
```

Expected: `cores` and `boostClock` appear **only** under `cpu`. (`socket` also
shows `motherboard`; `tdp` shows every category — both are top-level, handled by
`RATCHETED_KEYS` per category, not this specs-only list.) If `cores`/`boostClock`
show another category, they go in `RESEARCHED_KEYS_BY_CATEGORY`.

- [x] **Step 2: Add the keys and the category**

In `src/tests/partSources.test.js`, add to `RESEARCHED_KEYS`:

```js
  // ⚠️ Fifth time for this rule: `cores`/`boostClock` could only join once all
  // 80 CPUs had a source. Safe in the GLOBAL list because CPUs are the only
  // category carrying `specs.cores`/`specs.boostClock` (Step 1 proves it).
  //
  // 🛑 `socket` and `tdp` are deliberately NOT here - both TOP-LEVEL, enforced
  // by RATCHETED_KEYS.cpu. `perfScore` is a benchmark figure and owes no source.
  'cores', 'boostClock',
```

and add `cpu` to `VERIFIED_CATEGORIES`:

```js
const VERIFIED_CATEGORIES = new Set(['gpu', 'case', 'psu', 'motherboard', 'cooler', 'storage', 'ram', 'cpu'])
```

- [x] **Step 3: Run the suite**

```bash
npm run test:run
```

Expected: PASS. A failure names the exact `<id>.<field>` still missing
provenance — finish that row rather than weakening the list.

- [x] **Step 4: Prove the ratchet is non-vacuous on all four demanded keys**

Delete one CPU's `socket` source, run, expect FAIL naming it; restore. Repeat
for `tdp` (the other `RATCHETED_KEYS.cpu` key) and for `cores`/`boostClock` (the
`RESEARCHED_KEYS` keys). A scratchpad `.mjs` that deletes each in turn, runs
`npx vitest run src/tests/partSources.test.js`, and restores from the in-memory
original is the clean way (see the RAM plan's `nonvacuity.mjs`).

⚠️ A ratchet that cannot fail is worth nothing. `socket`/`tdp` fail through
`missingRatchetSources`; `cores`/`boostClock` through the `RESEARCHED_KEYS` loop
— different code paths, so test all four.

- [x] **Step 5: Run everything**

```bash
npm run test:run && npm run lint && npm run build && npm run test:e2e
```

⚠️ **One 30 s e2e timeout fails the whole suite — re-run before blaming your
change.** No prerender step unless a CPU name changed (Task 2–5 note).

- [x] **Step 6: Commit**

```bash
git add src/tests
git commit -m "feat: switch the cpu ratchet on"
```

- [x] **Step 7: Close out the plan and the spec**

Tick every checkbox, record what the research found — the real `socket`/`tdp`/
`cores`/`boostClock` corrections, whether the verdict snapshot moved and why —
and commit as `docs: close out the cpu research plan - 80/80`.

- [x] **Step 8: Report, and stop**

🛑 **Do not push and do not run `npm run catalog:push`.** Report the coverage
figure, the snapshot movement, every corrected value, and that **`main` is far
ahead of origin** with the cooler, storage and RAM tranches in it — the merge of
this branch, the push and `npm run catalog:push -- --apply` are the user's.

---

## Success criteria

- `npm run catalog:coverage` reports **cpu 80/80 (100%)**; the seven finished categories unchanged.
- `partSources.test.js` passes with `cpu` in `VERIFIED_CATEGORIES` and
  `cores`/`boostClock` in `RESEARCHED_KEYS`, proved **non-vacuous on all four
  demanded keys** (`socket`, `tdp`, `cores`, `boostClock`).
- Every corrected value carries a `partSources.json` entry; every unpublished one
  is `unverifiable` with a note.
- `perfScore` and `legacy` are untouched on all 80 rows.
- Lint, unit, e2e, build and prerender all green.

---

## Outcome — DONE, 79/79, ratchet on

Executed on `feat/cpu-catalogue-research`, seven commits. `catalog:coverage`
reports **cpu 79/79 (100%)** (was 80 — one phantom removed); the seven earlier
categories unchanged. Lint, unit, build, 101 e2e and prerender all green.

### The cleanest tranche yet: one correction, one removal

Of 80 rows, **78 were exactly right** — socket, base TDP, total cores and max
boost all correct. The AMD half (39) and Intel half (41) both verified against
the maker's own page (amd.com, ark.intel.com) with essentially no drift.

| kit | change | why |
|---|---|---|
| AMD Ryzen 7 9700F | boost 5.4 → **5.5** | amd.com lists Max Boost 5.5 GHz |
| AMD Ryzen 9 9900 | **removed** (80 → 79 CPUs) | a phantom SKU AMD never shipped |

🛑 **The phantom `cpu-ryzen-9-9900`.** Three authoritative checks — amd.com
(404), general search (only ever the 9900X), and TechPowerUp (only the 9900X) —
confirmed AMD never shipped a non-X Ryzen 9 9900. The perf source table had
already flagged it "not listed". Its two natural re-point targets (the 9900X,
and the real 65W 12-core 7900) **both already existed**, so it was a redundant
phantom, not a rename candidate. **User approved removal.** This is the RAM
Ripjaws S5 situation with a deletion twist: removing a part reached FOUR files —
`partsData`, the `cpuSpecs.json` note, `public/sitemap.xml` (a URL per part) and
`prerendered/parts.html` — plus the `verdictSpread` snapshot (ok 26 → 25 per
build). Every one was regenerated and the diffs traced back to the one removal.

### What the spec got right

- **Base TDP was the right call.** Intel lists Base Power (125) and Max Turbo
  Power (253) on one page; taking the base kept every value consistent with the
  existing data. AMD Default TDP likewise.
- **`socket` is THE field, and it was already correct.** 4041 of 5600 CPU×board
  pairings block on it; not one socket was wrong, so the verdict grid only moved
  for the *removed* part, never a corrected one.
- **No new field, no new rule, no latent bug** — confirmed.

### What the spec did not anticipate

- **A phantom part.** The spec planned for wrong values and dead pages, not for a
  catalogue entry describing a product that was never made. The RAM re-point
  policy covered the decision, but the *deletion* fan-out (sitemap, snapshot,
  prerender, perf-note) was new for a research tranche.
- **The perf source table's `unverified` notes are a gift, not a warning.** Three
  it flagged as "source vs catalogue, unresolved" — 12900KS 5.5, Ultra 9 285
  5.6, 10700K 5.1 — all confirmed the **catalogue right and the perf source
  wrong**. The catalogue's boost figures are more trustworthy than that table.

### ⏭️ Next

**Fans + paste (61 rows)** — the last category, and the easiest: no rule reads
either, so it is pure provenance with no ratchet-blocking risk.

🛑 **Not shipped.** `main` is far ahead of `origin` with the cooler, storage and
RAM tranches in it; this branch is unmerged on top. The merge, `git push` and
`npm run catalog:push -- --apply` are all the user's to run.
