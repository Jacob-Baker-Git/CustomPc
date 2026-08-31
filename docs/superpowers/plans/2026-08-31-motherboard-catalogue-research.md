# Motherboard Catalogue Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 70 catalogue motherboards up to the component research standard — seven new spec fields researched and `socket` / `formFactor` / `ramType` / `chipset` re-verified, each with a recorded source — then switch the motherboard ratchet on.

**Architecture:** Two preparatory code tasks come first: one fixes a false block that the honest data would otherwise ship, the other teaches the coverage report and the provenance ratchet about motherboards. Seven data tranches then research the catalogue by maker and platform, each a single commit with the full suite green. A final task switches the ratchet on so no future board can regress.

**Tech Stack:** Node 22 ESM scripts, Vitest, Playwright, JSON data files (`src/data/partsData.json`, `data/partSources.json`), the in-app Browser MCP (`mcp__Claude_Browser__*`) for reading manufacturer pages.

---

## Required reading before Task 1

- `docs/superpowers/specs/2026-08-31-motherboard-catalogue-research-design.md` — the spec this implements. Its Decisions and "semantic decisions" sections are binding.
- `docs/superpowers/plans/2026-08-30-case-catalogue-research.md` — **protocol R**, which is binding here. Do not re-derive it.
- `src/lib/specRules.js` — rules 1b, 3 and 5 are the consumers.
- `src/lib/buildWarnings.js:40-57` — the two advisories that read a board.

## File structure

| file | responsibility | change |
|---|---|---|
| `src/lib/specRules.js:83-97` | rule 1b, EPS headers | **Modify** — block on absence, not shortfall |
| `src/lib/buildWarnings.js` | advisory messages, has a `note` level | **Modify** — add the EPS shortfall note |
| `src/tests/specRules.test.js:100-118` | rule unit tests | **Modify** — one test inverts, two are added |
| `src/tests/buildWarnings.test.js` | advisory unit tests | **Modify** — three tests for the new note |
| `scripts/catalog-coverage-core.mjs:18-45` | pure coverage + ratchet rules, I/O-free | **Modify** — add `EXPECTED.motherboard`, `RATCHETED_KEYS.motherboard` |
| `src/tests/catalogCoverage.test.js` | unit tests for the pure core | **Modify** — a `motherboard expectations` block |
| `src/tests/partSources.test.js:145` | provenance guards over the real data | **Modify** — `motherboard` joins `VERIFIED_CATEGORIES`, in the LAST task only |
| `src/data/partsData.json` | the catalogue | **Modify** — 70 board rows gain seven spec fields; some existing values corrected |
| `data/partSources.json` | provenance, authoring-only, never bundled | **Modify** — 11 entries per board |
| `src/tests/__snapshots__/verdictSpread.test.js.snap` | the selectability snapshot | **Modify** — re-recorded per tranche, diff read before accepting |

⚠️ `data/partSources.json` must never be imported from `src/` outside `src/tests/`. A test greps for this. Do not "helpfully" wire it into the app.

---

## Research protocol M

**Protocol R (in the case plan) is the procedure.** Every step of it applies unchanged: open the maker's own page for the exact SKU, anchor the extraction to that product's own spec block, cross-check against one reliable secondary, prefer the maker's support KB over its spec table where they disagree, record a URL you actually opened, and record `unverifiable` rather than guessing.

Protocol M is protocol R plus the eleven values a board owes and the three conventions that decide them.

### M1. The eleven values

Read off the maker's spec page for that exact model:

| field | location | what to read |
|---|---|---|
| `socket` | top level | `AM5`, `AM4`, `LGA1700`, `LGA1851`, `LGA1200` — the catalogue's existing vocabulary |
| `formFactor` | top level | `ATX`, `mATX`, `ITX` — the catalogue's existing vocabulary. Micro-ATX maps to `mATX`, Mini-ITX to `ITX` |
| `ramType` | top level | `DDR4` or `DDR5`. ⚠️ Many models ship in both; the row's name usually says which |
| `chipset` | `specs` | `B650`, `Z790`, `X870E` … as the maker writes it |
| `ramSlots` | `specs` | integer, the number of DIMM slots |
| `maxRamGb` | `specs` | integer GB, the maker's stated maximum |
| `maxRamSpeed` | `specs` | integer MT/s, **the highest published figure** — see M3 |
| `pcieGen` | `specs` | integer, the generation of the **primary x16 slot** |
| `epsConnectors` | `specs` | integer, **8-pin EPS sockets only** — see M2 |
| `sataPorts` | `specs` | integer, the board's own SATA connectors at their maximum |
| `m2Slots` | `specs` | array of `{ "pcieGen": <int>, "sata": <bool> }`, one per slot — see M4 |

### M2. `epsConnectors` counts 8-pin sockets only

An "8+4 pin" board is `1`. An "8+8 pin" board is `2`. A board with a single 8-pin is `1`.

⚠️ **This mirrors the PSU side and has to.** Rule 1b compares this against
`psu.specs.connectors.eps8`, and the PSU project's convention is that a bare
4-pin CPU head is **not** `eps8`. Counting a board's 4-pin socket here would be
comparing two different things.

The field records **sockets the board has**, which is a published fact. It does
not record how many must be populated — Task 1 moves that judgement into the
rule, once, instead of into 70 data decisions.

### M3. `maxRamSpeed` takes the highest published figure, EXPO/XMP included

Record `8000` for "DDR5-8000+(OC)". Record `7200` for "up to DDR5-7200 (EXPO)".
Drop the `+`.

🛑 **Do not record the JEDEC base.** DDR5-5600 on AM5 or DDR5-4800 on LGA1700 is
the speed with no profile enabled; recording it would fire `buildWarnings`'
advisory against every DDR5-6000 EXPO kit in the catalogue on every AM5 board,
which is noise *and* false — a 6000 EXPO kit on a B650 runs at 6000.

⚠️ Where the maximum is qualified by population ("8000+ (1DPC)", "6400 (2DPC)"),
take the highest figure and put the qualification in that entry's `note`.

### M4. `m2Slots` records slots present, not contention

One entry per M.2 slot the board physically has.

- `pcieGen` is **per slot, not per board**. A B650 typically has one Gen5 x4 slot
  and one or two Gen4 x4. 🛑 Reading the board's headline "PCIe 5.0" onto every
  slot is the product-family-for-exact-SKU error one level down.
- `sata: true` **only** where the maker states that slot accepts a SATA M.2
  (the B+M-keyed slots). It is increasingly rare on current boards. When in
  doubt the answer is `false`, because a wrong `true` makes rule 3 pass a drive
  the board cannot take.
- **Sharing and disabling is NOT modelled.** Many boards drop SATA ports or the
  x16 slot to x8 when a given M.2 is populated. Rule 3 is documented as "does
  ANY slot accept this drive, NOT slot allocation", and a build holds exactly
  one drive. Put the sharing in the `note` if it is notable; do not encode it.

⚠️ `sataPorts` is likewise the board's maximum. If two ports are disabled by
M.2_3, record the maximum and note it.

### M5. Where a value disagrees with what is there

Change it, and **name the old value in the commit message**. Cases found 43
wrong values this way; PSUs found five wrong product names.

🛑 **If a row names a product nobody makes** — six such rows across three
projects so far — re-point it to the real product and **KEEP THE ID**, so saved
builds and `/part/` URLs survive. That is the user's standing choice.

### M6. Writing the files

🛑 **Do NOT write these files with `JSON.stringify(obj, null, 2)`.** It reformats
all 8310 lines and buries a ten-row change in a 3236-line diff. Write a script
in the scratchpad that does this:

```js
import { readFileSync, writeFileSync } from 'node:fs'
import { toFile, roundTripOk } from '../../CustomPc/scripts/house-json.mjs'

// ⚠️ The guard runs FIRST. If the serializer cannot reproduce the files
// byte-for-byte as they are, it must not be used to write them.
if (!roundTripOk(true)) { console.error('house-json round-trip FAILED; refusing to write'); process.exit(1) }

const parts = JSON.parse(readFileSync('src/data/partsData.json', 'utf8'))
const sources = JSON.parse(readFileSync('data/partSources.json', 'utf8'))

// ... mutate parts and sources here ...

writeFileSync('src/data/partsData.json', toFile(parts, 3))
writeFileSync('data/partSources.json', toFile(sources, 2))
```

⚠️ Use an absolute import path for `house-json.mjs` that resolves from wherever
the script lives, and run the script from the repo root so the relative data
paths are right. Confirm with `git diff --stat` that the diff is the size of the
change, not the size of the file.

### M7. Cross-row invariants to run after each tranche

Internal consistency proves nothing; these catch transcription errors that a
green test suite will not. Run them and read the output:

```js
// scratchpad/mb-invariants.mjs — run from the repo root after each tranche
const parts = JSON.parse(readFileSync('src/data/partsData.json', 'utf8'))
const boards = parts.filter((p) => p.category === 'motherboard' && p.specs.ramSlots !== undefined)
const bad = []
for (const b of boards) {
  const s = b.specs
  if (b.socket === 'AM5' && b.ramType !== 'DDR5') bad.push(`${b.id}: AM5 must be DDR5`)
  if (b.formFactor === 'ITX' && s.ramSlots !== 2) bad.push(`${b.id}: ITX with ${s.ramSlots} RAM slots`)
  if (b.formFactor === 'ATX' && s.ramSlots !== 4) bad.push(`${b.id}: ATX with ${s.ramSlots} RAM slots`)
  if (!Array.isArray(s.m2Slots) || s.m2Slots.length < 1) bad.push(`${b.id}: no M.2 slot`)
  if (s.epsConnectors < 1 || s.epsConnectors > 2) bad.push(`${b.id}: epsConnectors ${s.epsConnectors}`)
  if (s.pcieGen < 3 || s.pcieGen > 5) bad.push(`${b.id}: pcieGen ${s.pcieGen}`)
  if (s.maxRamGb < 32 || s.maxRamGb > 256) bad.push(`${b.id}: maxRamGb ${s.maxRamGb}`)
  if (!s.chipset || !b.name.toUpperCase().includes(s.chipset.toUpperCase())) bad.push(`${b.id}: chipset ${s.chipset} not in name`)
}
console.log(bad.length ? bad.join('\n') : `OK — ${boards.length} researched boards pass`)
```

⚠️ **These are tripwires, not laws.** A flagged row is a row to go and re-read,
not a row to bend. An mATX board legitimately has 2 or 4 slots, which is why
mATX is not asserted. If a board genuinely breaks one — an ATX board with two
slots exists — record why in the tranche's commit message and relax that line.

---

## Task 1: Stop rule 1b false-blocking an underpopulated second EPS header

**Why first:** the honest data from Task 3 onward would otherwise ship roughly
300 new blocked pairings for builds that boot and run. Ten of the 53 researched
supplies carry exactly one 8-pin EPS head — Corsair CX650, CX750, CV550,
RM550x; EVGA SuperNOVA 650 G6 and 500 W1; MSI MAG A650BN; be quiet! Pure Power
12 M 650; Seasonic Core GM-650; Thermaltake Smart 500 — and most ATX boards in
this catalogue are 8+8. A board with two EPS sockets populated by one runs at
stock.

**Files:**
- Modify: `src/lib/specRules.js:83-97`
- Modify: `src/lib/buildWarnings.js`
- Test: `src/tests/specRules.test.js:100-118`
- Test: `src/tests/buildWarnings.test.js`

- [x] **Step 1: Write the failing tests**

In `src/tests/specRules.test.js`, **replace** the test currently reading
`it('blocks a PSU with one EPS cable on a board needing two', ...)` and the two
after it with this block:

```js
  // 🛑 The rule blocks on ABSENCE, not on shortfall. A board with two 8-pin EPS
  // sockets populated by one boots and runs at stock, so refusing the pairing
  // would be a false block — the same shape as 53fba98 and 0a192ce. The
  // shortfall is a note in buildWarnings.js instead.
  it('blocks a board needing EPS against a PSU with no EPS head at all', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { epsConnectors: 2 } }
    const r = evaluateSpecRules({ motherboard: b }, psu({ eps8: 0 }))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/EPS/i)
  })

  it('blocks a single-socket board too when the PSU has no EPS head', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { epsConnectors: 1 } }
    expect(evaluateSpecRules({ motherboard: b }, psu({ eps8: 0 })).status).toBe('blocked')
  })

  it('does NOT block a two-socket board on a one-head supply', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { epsConnectors: 2 } }
    expect(evaluateSpecRules({ motherboard: b }, psu({ eps8: 1 })).status).toBe('ok')
  })

  it('passes a PSU with enough EPS cables', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { epsConnectors: 2 } }
    expect(evaluateSpecRules({ motherboard: b }, psu({ eps8: 2 })).status).toBe('ok')
  })

  it('is unverified when the board does not state its EPS headers', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: {} }
    expect(evaluateSpecRules({ motherboard: b }, psu({ eps8: 2 })).status).toBe('unverified')
  })

  it('is unverified when the PSU does not state its connectors', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { epsConnectors: 2 } }
    expect(evaluateSpecRules({ motherboard: b }, psu(null)).status).toBe('unverified')
  })
```

In `src/tests/buildWarnings.test.js`, append inside the top-level
`describe('getBuildWarnings', ...)`:

```js
  // ⚠️ The counterpart to rule 1b's weakening. The shortfall has to surface
  // SOMEWHERE, or softening the rule just deletes the check.
  const boardEps = (n) => ({ id: 'm', category: 'motherboard', name: 'Test Board', specs: { epsConnectors: n } })
  const psuEps = (n) => ({ id: 'p', category: 'psu', name: 'Test PSU', wattage: 1000, specs: { connectors: { eps8: n } } })

  it('notes a board EPS socket the PSU cannot fill', () => {
    const w = getBuildWarnings({ motherboard: boardEps(2), psu: psuEps(1) })
    const note = w.find((x) => /EPS/i.test(x.message))
    expect(note?.level).toBe('note')
    expect(note?.message).toMatch(/overclock/i)
  })

  it('says nothing when the PSU fills every EPS socket', () => {
    const w = getBuildWarnings({ motherboard: boardEps(2), psu: psuEps(2) })
    expect(w.some((x) => /EPS/i.test(x.message))).toBe(false)
  })

  // A PSU with no EPS head at all is rule 1b's job — it BLOCKS. Saying it twice,
  // once as a block and once as a note, would read as two different problems.
  it('says nothing when the PSU has no EPS head at all', () => {
    const w = getBuildWarnings({ motherboard: boardEps(2), psu: psuEps(0) })
    expect(w.some((x) => /EPS/i.test(x.message))).toBe(false)
  })

  it('says nothing when either side is unresearched', () => {
    expect(getBuildWarnings({ motherboard: boardEps(2), psu: { id: 'p', wattage: 1000, specs: {} } })
      .some((x) => /EPS/i.test(x.message))).toBe(false)
    expect(getBuildWarnings({ motherboard: { id: 'm', specs: {} }, psu: psuEps(1) })
      .some((x) => /EPS/i.test(x.message))).toBe(false)
  })
```

- [x] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/tests/specRules.test.js src/tests/buildWarnings.test.js
```

Expected: FAIL. `does NOT block a two-socket board on a one-head supply` gets
`blocked` where it wants `ok`, and all four buildWarnings tests fail because no
message matches `/EPS/i`.

- [x] **Step 3: Change rule 1b**

Replace the whole of `epsConnectors` in `src/lib/specRules.js` (currently lines
83–97, comment included) with:

```js
// Rule 1b. The board's EPS headers. A supply that cannot feed the CPU at all is
// just as dead a build as one that cannot feed the card.
//
// 🛑 BLOCKS ON ABSENCE, NOT ON SHORTFALL, and that is deliberate. A board with
// two 8-pin EPS sockets populated by one boots and runs at stock; the second
// header matters for sustained overclocking. Ten of the 53 researched supplies
// carry exactly one EPS head and most ATX boards in this catalogue are 8+8, so
// blocking on the count would refuse hundreds of pairings that work — the same
// shape of false block as 53fba98 (PCIe 8-pin and 6-pin as separate pools) and
// 0a192ce (choosePsu sizing on watts alone).
//
// The shortfall is not dropped: buildWarnings.js raises it as a `note`. It
// lives there because specRules has no warning level, and giving it one would
// change aggregate()'s precedence for every rule in this file.
function epsConnectors(selectedParts, candidate) {
  const psu = candidate.category === 'psu' ? candidate : selectedParts.psu
  const board = candidate.category === 'motherboard' ? candidate : selectedParts.motherboard
  if (!psu || !board) return null

  const need = board.specs?.epsConnectors
  const supply = psu.specs?.connectors
  if (typeof need !== 'number') return { status: 'unverified', reason: `EPS headers on ${board.name ?? 'this motherboard'} are not verified` }
  if (!supply) return { status: 'unverified', reason: `Connectors on ${psu.name ?? 'this PSU'} are not verified` }

  // A board that asks for nothing is satisfied by a supply that offers nothing.
  if (need < 1) return null
  if ((supply.eps8 ?? 0) >= 1) return null
  return { status: 'blocked', reason: `Board needs an 8-pin EPS connector; this PSU has none` }
}
```

- [x] **Step 4: Add the advisory**

In `src/lib/buildWarnings.js`, insert immediately **after** the `maxRamSpeed`
block and **before** `return warnings.sort(...)`:

```js
  // ⚠️ NOT a block — see rule 1b in specRules.js, which deliberately blocks only
  // on a supply with NO EPS head. A board with two 8-pin sockets runs at stock
  // on one, so an unfilled second socket is worth knowing and is not a fault.
  // Fires only when both sides are researched, and never when the count is zero
  // — that case is already blocked, and saying it twice reads as two problems.
  const epsNeed = motherboard?.specs?.epsConnectors
  const epsHave = psu?.specs?.connectors?.eps8
  if (typeof epsNeed === 'number' && typeof epsHave === 'number' && epsHave >= 1 && epsHave < epsNeed) {
    warnings.push({
      level: 'note',
      message: `This board has ${epsNeed} 8-pin EPS sockets and the ${psu.name ?? 'PSU'} can fill ${epsHave}. It runs at stock; the spare socket matters only for sustained overclocking.`,
    })
  }
```

- [x] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/tests/specRules.test.js src/tests/buildWarnings.test.js
```

Expected: PASS, all files.

- [x] **Step 6: Run the full unit suite and the linter**

```bash
npm run lint && npm run test:run
```

Expected: lint clean; every test passing. ⚠️ No board carries `epsConnectors`
yet, so `verdictSpread` **must not move** in this task. If its snapshot changes
here, something else changed — stop and find out what.

- [x] **Step 7: Commit**

```bash
git add src/lib/specRules.js src/lib/buildWarnings.js src/tests/specRules.test.js src/tests/buildWarnings.test.js
git commit -m "fix: block on a missing EPS header, not on an unfilled second one"
```

---

## Task 2: Teach coverage and the ratchet about motherboards

**Files:**
- Modify: `scripts/catalog-coverage-core.mjs:18-45`
- Test: `src/tests/catalogCoverage.test.js`

- [x] **Step 1: Write the failing tests**

Append to `src/tests/catalogCoverage.test.js`:

```js
describe('motherboard expectations', () => {
  const board = (id, fields = {}, specs = {}) =>
    ({ id, category: 'motherboard', tdp: 14, ...fields, specs })

  it('expects the eleven fields a researched board carries', () => {
    expect(EXPECTED.motherboard.required).toEqual([
      'socket', 'formFactor', 'ramType', 'chipset',
      'ramSlots', 'maxRamGb', 'maxRamSpeed', 'pcieGen',
      'epsConnectors', 'sataPorts', 'm2Slots',
    ])
    expect(EXPECTED.motherboard.optional).toEqual([])
  })

  it('counts a fully sourced board as verified', () => {
    const part = board('m',
      { socket: 'AM5', formFactor: 'ATX', ramType: 'DDR5' },
      { chipset: 'B650', ramSlots: 4, maxRamGb: 256, maxRamSpeed: 8000, pcieGen: 5,
        epsConnectors: 2, sataPorts: 4, m2Slots: [{ pcieGen: 5, sata: false }] })
    const sources = { m: Object.fromEntries(EXPECTED.motherboard.required.map((k) => [k, src()])) }
    expect(coverageFor('motherboard', [part], sources).verified).toBe(1)
  })

  // ⚠️ A DIFFERENT trap from the case and PSU zeros. A board's tdp is 12-15, a
  // real number feeding the build's draw total — but no maker publishes a
  // motherboard TDP, so it is the app's own estimate and must not be given
  // provenance it does not have.
  it('never demands a source for a board tdp', () => {
    const part = board('m', { socket: 'AM5', formFactor: 'ATX', ramType: 'DDR5' })
    const sources = { m: { socket: src(), formFactor: src(), ramType: src() } }
    expect(missingRatchetSources([part], sources, new Set(['motherboard']))).toEqual([])
  })

  // `chipset` is re-verified (EXPECTED lists it) but nothing blocks on it, so no
  // future board owes it provenance.
  it('ratchets the three fields compatibility.js blocks on, and no others', () => {
    expect(RATCHETED_KEYS.motherboard).toEqual(['socket', 'formFactor', 'ramType'])
  })

  it('reports a board field that carries no source', () => {
    const part = board('m', { socket: 'AM5', formFactor: 'ATX', ramType: 'DDR5' })
    expect(missingRatchetSources([part], {}, new Set(['motherboard']))).toEqual([
      'm.socket', 'm.formFactor', 'm.ramType',
    ])
  })
})
```

- [x] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: FAIL with `Cannot read properties of undefined (reading 'required')` —
`EXPECTED.motherboard` does not exist.

- [x] **Step 3: Add the expectations**

In `scripts/catalog-coverage-core.mjs`, add inside `EXPECTED`, after the `psu`
entry:

```js
  // The eleven fields a researched board carries. Four already had values —
  // socket, formFactor and ramType at top level, chipset in specs — and are
  // RE-VERIFIED rather than added, because compatibility.js blocks on the first
  // three and a wrong one refuses a correct build in silence.
  motherboard: {
    required: [
      'socket', 'formFactor', 'ramType', 'chipset',
      'ramSlots', 'maxRamGb', 'maxRamSpeed', 'pcieGen',
      'epsConnectors', 'sataPorts', 'm2Slots',
    ],
    optional: [],
  },
```

And inside `RATCHETED_KEYS`, after the `psu` entry:

```js
  // ⚠️ `tdp` is absent for a DIFFERENT reason from the case and PSU zeros. A
  // board carries tdp: 12-15, a real number feeding the build's draw total in
  // compatibility.js, buildWarnings.js, autoBuilder.js and partSynergy.js — but
  // NO MAKER PUBLISHES A MOTHERBOARD TDP. It is the app's own estimate, in the
  // family of partSynergy.coolerCapacityW's derived ladder, and a source entry
  // would assert provenance for a figure nobody published.
  //
  // `chipset` is absent too: EXPECTED requires it, so it is re-verified, but no
  // rule blocks on it and no future board should owe it provenance.
  motherboard: ['socket', 'formFactor', 'ramType'],
```

- [x] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/tests/catalogCoverage.test.js
```

Expected: PASS.

- [x] **Step 5: Confirm the coverage report shows the new category at zero**

```bash
npm run catalog:coverage
```

Expected: a `motherboard: 0/70 parts fully researched (0%)` section listing all
eleven fields. `socket`, `formFactor`, `ramType` and `chipset` show
`present 70/70   researched 0/70`; the other seven show `present 0/70`.

- [x] **Step 6: Run the full suite**

```bash
npm run lint && npm run test:run
```

Expected: all green. ⚠️ `partSources.test.js` must still pass —
`VERIFIED_CATEGORIES` does **not** include `motherboard` yet, and it must not
until Task 10.

- [x] **Step 7: Commit**

```bash
git add scripts/catalog-coverage-core.mjs src/tests/catalogCoverage.test.js
git commit -m "feat: expect eleven fields of a motherboard, and ratchet the three that block"
```

---

## Tasks 3–9: the data tranches

**Every one of these seven tasks runs the identical five steps, S1–S5.** They
are written out in full once, here; each tranche then has its own five
checkboxes so progress is tracked per tranche. The only thing that changes
between tranches is the row list and the traps noted with it.

#### S1: Run protocol M for every row in the tranche

Open each board's page on the maker's own site with the in-app Browser
(`preview_start {url}`, then `javascript_tool` or `get_page_text`). Read the
eleven values of M1. Cross-check `socket`, `ramSlots`, `m2Slots` and
`epsConnectors` against one secondary source — PCPartPicker is a useful
secondary and is **never** the source of truth.

⚠️ **`WebFetch` is not enough.** It cannot reach asrock.com (403/empty). Drive
the Browser. A `WebFetch` that returns nothing is not evidence a spec is
unpublished.

#### S2: Write the data and the provenance

Per M6: a scratchpad script that asserts `roundTripOk()` before writing, then
`toFile(parts, 3)` and `toFile(sources, 2)`. Eleven source entries per board.
Confirm the diff size with `git diff --stat`.

#### S3: Run the invariants and the full suite

```bash
node scratchpad/mb-invariants.mjs && npm run lint && npm run test:run
```

Expected: invariants report OK for every researched board so far; lint clean;
`partSources.test.js` green (a spec with no source fails it **by name**).

#### S4: Re-record the verdict snapshot and READ THE DIFF

```bash
npx vitest run src/tests/verdictSpread.test.js -u
git diff src/tests/__snapshots__/verdictSpread.test.js.snap
```

🛑 **Read it before accepting it.** This is the only place a tranche's effect on
what the app will and will not let a user pick is visible. From tranche 3
onward the `psu` and `storage` rows should start moving off `unverified` for
the reference builds, because rules 1b and 3 finally have a board side.
An unexpected jump in `blocked` is a wrong number, not a success.

#### S5: Commit

One commit per tranche, naming every corrected value per M5:

```bash
git add src/data/partsData.json data/partSources.json src/tests/__snapshots__/verdictSpread.test.js.snap
git commit -m "data: research the <n> <maker> <platform> boards"
```

### Task 3: MSI, AM5 (11 rows)

- [x] **S1** — protocol M for all 11 rows below
- [x] **S2** — write the data and the eleven source entries per board
- [x] **S3** — invariants, lint, full unit suite
- [x] **S4** — re-record the verdict snapshot and read the diff
- [x] **S5** — commit, naming every corrected value


`mb-msi-x670e` · `mb-msi-x670e-carbon` · `mb-msi-x870e-carbon` ·
`mb-msi-b850-tomahawk` · `mb-msi-b850m-mortar` · `mb-msi-b650-edge` ·
`mb-msi-b650i-edge` · `mb-msi-b650-gaming-plus` · `mb-msi-b650-p` ·
`mb-msi-b650m-mortar` · `mb-msi-a620m-e`

⚠️ **MSI's per-SKU spec table is the best of the four makers** and separates the
rows this project needs. It is **client-rendered**: `fetch()` does not contain
it, so navigate and read `body.innerText`.

🛑 **A retired MSI product returns HTTP 200 with no `<title>` and a ~117 kB
body**; a live one is ~125 kB and titled. That is the cheapest existence test
found in the PSU project — and MSI is the maker whose catalogue rows have
already been wrong twice (`MAG A750BN` → `PCIE5`, `MPG A1250G` → `A1250GS`).
**Check the line-up before trusting a row's name.**

⚠️ `mb-msi-b650i-edge` is the tranche's only ITX board: 2 RAM slots, and the
invariant in M7 asserts it.

### Task 4: MSI, Intel and AM4 (11 rows)

- [x] **S1** — protocol M for all 11 rows below
- [x] **S2** — write the data and the eleven source entries per board
- [x] **S3** — invariants, lint, full unit suite
- [x] **S4** — re-record the verdict snapshot and read the diff
- [x] **S5** — commit, naming every corrected value

`mb-msi-z890-tomahawk` · `mb-msi-z790-edge` · `mb-msi-z790-tomahawk` ·
`mb-msi-b760-pro` · `mb-msi-b760m-mortar` · `mb-msi-b760m-e` ·
`mb-msi-h610m-g-ddr4` · `mb-msi-mag-z590-tomahawk` · `mb-msi-b460m-pro-vdh` ·
`mb-msi-mag-b550-tomahawk` · `mb-msi-b450-tomahawk-max`

⚠️ **Four DDR4 boards here** (`b760m-e`, `h610m-g-ddr4`, plus the LGA1200 and
AM4 rows). MSI ships DDR4 and DDR5 variants under near-identical names —
`PRO B760M-E DDR4` is a different SKU from `PRO B760M-E DDR5`. Confirm the
variant against the row's `ramType` and correct the *name* if it is ambiguous.

⚠️ `mb-msi-b450-tomahawk-max` is named `B450 TOMAHAWK MAX II`. Verify that SKU
exists; MSI shipped `B450 TOMAHAWK MAX` and `B450 TOMAHAWK MAX II` and they
differ.

### Task 5: ASUS, AM5 (9 rows)

- [x] **S1** — protocol M for all 9 rows below
- [x] **S2** — write the data and the eleven source entries per board
- [x] **S3** — invariants, lint, full unit suite
- [x] **S4** — re-record the verdict snapshot and read the diff
- [x] **S5** — commit, naming every corrected value

`mb-asus-x670e` · `mb-asus-proart-x870e` · `mb-asus-x870-tuf` ·
`mb-asus-b850a` · `mb-asus-b650e-f` · `mb-asus-b650e-itx` ·
`mb-asus-b650-plus` · `mb-asus-b650m-a` · `mb-asus-a620m-k`

⚠️ **asus.com fetches cleanly** — one of only two vendor sites that do. But the
PSU project found ASUS **silently redirects a US URL to a series listing** for a
SKU it does not sell in that region; assert `location.pathname` after
navigating.

⚠️ ASUS states RAM support as "DDR5 8000+(OC)". Per M3 record `8000` and put the
population qualifier in the note.

⚠️ `mb-asus-b650e-itx` is ITX: 2 RAM slots, and expect **1** EPS socket.

### Task 6: ASUS, Intel and AM4 (10 rows)

- [ ] **S1** — protocol M for all 10 rows below
- [ ] **S2** — write the data and the eleven source entries per board
- [ ] **S3** — invariants, lint, full unit suite
- [ ] **S4** — re-record the verdict snapshot and read the diff
- [ ] **S5** — commit, naming every corrected value

`mb-asus-z890-e` · `mb-asus-z790-maximus` · `mb-asus-z790` ·
`mb-asus-tuf-b760plus` · `mb-asus-b760-plus` · `mb-asus-b760m-a-wifi` ·
`mb-asus-b860m-a-wifi` · `mb-asus-prime-b560m-a` · `mb-asus-strix-x570e` ·
`mb-asus-tuf-b550-plus`

⚠️ `mb-asus-b760-plus` is `Prime B760-Plus D4` — the **DDR4** variant, and the
catalogue agrees (`ramType: DDR4`). `mb-asus-tuf-b760plus` is the DDR5 TUF
board. Two different products with confusable names; do not read one's page for
the other.

⚠️ `mb-asus-z790-maximus` (ROG Maximus Z790 Hero) is the tranche's most likely
**8+8** board. Its `epsConnectors: 2` against a one-head supply is exactly the
pairing Task 1 stopped blocking — check the note fires rather than a block.

### Task 7: Gigabyte, AM5 (8 rows)

- [ ] **S1** — protocol M for all 8 rows below
- [ ] **S2** — write the data and the eleven source entries per board
- [ ] **S3** — invariants, lint, full unit suite
- [ ] **S4** — re-record the verdict snapshot and read the diff
- [ ] **S5** — commit, naming every corrected value

`mb-gigabyte-x870e-elite` · `mb-gigabyte-x670-gaming` ·
`mb-gigabyte-b850-elite` · `mb-gigabyte-b850-eagle` ·
`mb-gigabyte-b850m-aorus` · `mb-gigabyte-b650-aorus` ·
`mb-gigabyte-b650m-k` · `mb-gigabyte-a620m-s2h`

⚠️ Gigabyte publishes a **"Support" tab separate from "Specification"**, and the
memory-support list lives on the support tab. Protocol R's KB rule applies: if
the two disagree on `maxRamGb` or `maxRamSpeed`, the support page wins and the
disagreement goes in the note.

⚠️ Gigabyte names revisions (`rev. 1.0`, `rev. 1.1`) with different M.2 counts on
some models. Record the current revision and name it in the note.

### Task 8: Gigabyte, Intel and legacy (8 rows)

- [ ] **S1** — protocol M for all 8 rows below
- [ ] **S2** — write the data and the eleven source entries per board
- [ ] **S3** — invariants, lint, full unit suite
- [ ] **S4** — re-record the verdict snapshot and read the diff
- [ ] **S5** — commit, naming every corrected value

`mb-gigabyte-z890-aorus-elite` · `mb-gigabyte-z790-ultra` ·
`mb-gigabyte-b860m` · `mb-gigabyte-b760-itx` · `mb-gigabyte-b760m` ·
`mb-gigabyte-b760m-ddr4` · `mb-gigabyte-b550m-ds3h` ·
`mb-gigabyte-z490-aorus-elite`

⚠️ `mb-gigabyte-b760m` is `B760M DS3H` with `ramType: DDR4`, and
`mb-gigabyte-b760m-ddr4` is `B760M Gaming X DDR4`. **Gigabyte ships a `B760M
DS3H` in both DDR4 and DDR5**; verify which the row means and correct the name
if the page names it explicitly (`B760M DS3H DDR4`).

⚠️ `mb-gigabyte-b760-itx` is ITX: 2 RAM slots.

### Task 9: ASRock, all 13 rows

- [ ] **S1** — protocol M for all 13 rows below
- [ ] **S2** — write the data and the eleven source entries per board
- [ ] **S3** — invariants, lint, full unit suite
- [ ] **S4** — re-record the verdict snapshot and read the diff
- [ ] **S5** — commit, naming every corrected value

`mb-asrock-z890-taichi` · `mb-asrock-z890-pro-rs` · `mb-asrock-z790-pro` ·
`mb-asrock-b860m-x` · `mb-asrock-b760m-pro-rs-d4` · `mb-asrock-h610m` ·
`mb-asrock-h610m-hvs` · `mb-asrock-b650e-steel` · `mb-asrock-b650-pg` ·
`mb-asrock-b850m-pro` · `mb-asrock-b650m-hdv` · `mb-asrock-a620m` ·
`mb-asrock-b450m-pro4`

🛑 **`WebFetch` cannot reach asrock.com at all** — 403 or an empty body. This is
recorded in the GPU project and cost hours before it was believed. **Drive the
in-app Browser for every row in this tranche.**

⚠️ ASRock's budget models carry the M.2 count in the product name
(`A620M-HDV/M.2`, `H610M-HDV/M.2`, `H610M-HVS/M.2`, `B650M-HDV/M.2`). That is a
lead, not a citation — read the spec table.

⚠️ This tranche holds the catalogue's cheapest boards, so expect the project's
first `unverifiable` records here. That is a result, not a failure: record
`{ "checkedOn": "...", "result": "unverifiable", "note": "..." }` with a
non-empty note and **no `url`**, and remove the field.

---

## Task 10: Switch the motherboard ratchet on

**Files:**
- Modify: `src/tests/partSources.test.js:145`

- [ ] **Step 1: Confirm every board is researched first**

```bash
npm run catalog:coverage
```

Expected: `motherboard: 70/70 parts fully researched (100%)`. **Do not proceed
if it is not 70/70** — the ratchet would fail against the gap, and the honest
fix is to research the gap, not to relax the ratchet.

- [ ] **Step 2: Add the category**

In `src/tests/partSources.test.js`, change:

```js
const VERIFIED_CATEGORIES = new Set(['gpu', 'case', 'psu'])
```

to:

```js
const VERIFIED_CATEGORIES = new Set(['gpu', 'case', 'psu', 'motherboard'])
```

- [ ] **Step 3: Run it**

```bash
npx vitest run src/tests/partSources.test.js
```

Expected: PASS.

- [ ] **Step 4: Prove the ratchet is NOT vacuous**

A green ratchet that would be green with the data removed protects nothing.
Delete one board's `socket` source by hand:

```bash
node -e "const f='data/partSources.json';const s=JSON.parse(require('fs').readFileSync(f,'utf8'));delete s['mb-asus-x670e'].socket;require('fs').writeFileSync(f,JSON.stringify(s));" 
npx vitest run src/tests/partSources.test.js
```

Expected: **FAIL**, naming `mb-asus-x670e.socket`. Then restore it:

```bash
git checkout -- data/partSources.json
```

⚠️ `git checkout --` on a file with uncommitted work destroys it. Only run this
because the previous tranche was committed — confirm with `git status` first.

- [ ] **Step 5: Run the whole suite, including e2e and the build**

```bash
npm run lint && npm run test:run && npm run build && npm run sitemap && npm run prerender
```

Then check for drift with `git diff --exit-code`, **not** `git status`.

```bash
npm run test:e2e
```

⚠️ e2e: one 30 s timeout fails the whole suite. Re-run before blaming the
change.

⚠️ **`npm run prerender` must be re-run after any shared-UI change and its
output committed** — fragments go stale silently, and a failed run leaves the
folder untouched so `git diff` reports clean.

- [ ] **Step 6: Commit**

```bash
git add src/tests/partSources.test.js prerendered/
git commit -m "feat: switch the motherboard ratchet on"
```

---

## What "done" looks like

- `npm run catalog:coverage` reports **motherboard 70/70 (100%)**.
- The ratchet is on and proved non-vacuous.
- Rules 1b, 3 and 5 return real verdicts, and `verdictSpread` has moved for the
  first time since the GPU project.
- Full suite green: lint, unit, e2e, build, sitemap and prerender drift.

🛑 **Nothing here reaches a user.** `src/data/partsData.json` is overridden by
Supabase on mount, so the research ships to nobody until `npm run catalog:push
-- --apply`, and the repo is far ahead of `origin`. **Both the push and the
catalogue push are the user's to run** — do not run either.
