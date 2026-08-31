# Motherboard catalogue research: bringing 70 boards up to the research standard

Date: 2026-08-31

Fourth component tranche, after GPUs (79), cases (59) and PSUs (53). The case
project established the method; this reuses it rather than restating it.
**Research protocol R in
`docs/superpowers/plans/2026-08-30-case-catalogue-research.md` is binding here
too** — including the SKU-anchored extraction, the rule that a maker's support
KB outranks its product spec table, and the requirement that
`src/data/partsData.json` and `data/partSources.json` are written with
`scripts/house-json.mjs` and never with `JSON.stringify`.

## Problem

The motherboard is the most rule-connected part in the catalogue and the least
researched. All 70 rows carry exactly one spec — `chipset` — and not one has an
entry in `data/partSources.json`.

Five of the seven rules in `src/lib/specRules.js` read a motherboard field that
does not exist:

| rule | reads | today | consequence |
|---|---|---|---|
| 1b `epsConnectors` | `specs.epsConnectors` | absent on all 70 | `unverified` |
| 3 `m2Interface` | `specs.m2Slots`, `specs.sataPorts` | absent on all 70 | `unverified` |
| 5 `ramFit` | `specs.ramSlots`, `specs.maxRamGb` | absent on all 70 | `unverified` |

Two advisories in `src/lib/buildWarnings.js` read one too — `specs.pcieGen` and
`specs.maxRamSpeed` — and are silent for the same reason.

🛑 **This is what has been holding the previous three projects' data down.**
`aggregate()` takes the worst status, so a board with no `epsConnectors` keeps
**every GPU verdict `unverified` whenever a board is selected**, however good
the 79 GPUs' `powerConnectors` and the 53 PSUs' `connectors` now are. The PSU
project watched `verdictSpread` refuse to move across six data tranches for
exactly this reason. Motherboards are the field that turns three finished
projects on.

The four values the boards *do* carry are unsourced, and three of them block:

| field | location | read by |
|---|---|---|
| `socket` | top level | `compatibility.js` — CPU↔board, both directions |
| `formFactor` | top level | `compatibility.js` — board↔case, both directions |
| `ramType` | top level | `compatibility.js` — RAM↔board, both directions |
| `chipset` | `specs` | spec sheet copy only; no rule reads it |

A wrong `socket` silently refuses a correct build and offers no way to tell.
Cases found 43 wrong values on re-verification and PSUs found five wrong product
names, so these four are re-read, not assumed.

## Decisions

| | |
|---|---|
| Field set | The **seven** schema fields — `ramSlots`, `maxRamGb`, `maxRamSpeed`, `pcieGen`, `epsConnectors`, `sataPorts`, `m2Slots` — plus re-verification of `socket`, `formFactor`, `ramType`, `chipset` |
| Ratcheted | `socket`, `formFactor`, `ramType`. **Not `chipset`** — no rule reads it |
| `tdp` | **Left exactly as it is.** No source, not in `EXPECTED`, not ratcheted |
| Out of scope | VRM phases, rear I/O, networking, audio codec, USB counts, BIOS flashback, board dimensions — no rule reads them |
| Execution | Inline, seven brand tranches, full suite green per tranche |
| Unpublished figures | `result: "unverifiable"` with a note, never a guess |

### `tdp` is a modelled figure and must not acquire a source

Every board carries `tdp: 12`–`15`. This is **not** the case and PSU `tdp: 0`
sentinel — it is a real number feeding the build's draw total in
`compatibility.js:8`, `buildWarnings.js:10`, `autoBuilder.js:27` and
`partSynergy.js:51`. But **no maker publishes a motherboard TDP.** It is the
app's own estimate, in the same family as `partSynergy.coolerCapacityW`'s
derived ladder.

Chipset TDPs *are* published (AMD and Intel both give them), but a chipset TDP
is not a board TDP — it would be a different quantity wearing the same field
name, which is the failure mode
`docs/superpowers/specs/2026-08-27-component-spec-schema-and-compatibility-design.md`
records for `radiatorMm` versus `specs.radiator`.

So `tdp` stays, unsourced and unratcheted, with a comment in
`catalog-coverage-core.mjs` saying why. Giving it a source entry would assert
provenance for a number nobody published.

## The semantic decisions

Three conventions are new to this category. Each is a place where the obvious
reading produces a wrong number.

### 1. `epsConnectors` counts 8-pin sockets only

An "8+4 pin" board is `epsConnectors: 1`. An "8+8 pin" board is `2`.

This mirrors the PSU side exactly, and it has to: rule 1b compares
`board.specs.epsConnectors` against `psu.specs.connectors.eps8`, and the PSU
project's convention is that **a bare 4-pin CPU head is not `eps8`** (be quiet!
lists `P4+4` and `P4` as separate rows; only `P8` and `P4+4` were counted). A
board counting its 4-pin socket as an EPS header would be comparing two
different things.

⚠️ The field records **sockets the board has**, which is a published fact off
the spec page. It does not record how many the board *requires* — see the rule
change below, which is where that judgement now lives.

### 2. `maxRamSpeed` takes the maker's highest published figure, EXPO/XMP included

Boards publish a ladder: a JEDEC base (DDR5-5600 on AM5, DDR5-4800 on LGA1700)
and an overclocked maximum ("DDR5-8000+(OC)", "up to 7200 EXPO"). The field
takes **the highest number the maker publishes for that board**, with any "+"
dropped — `8000+` is recorded as `8000`.

The alternative — recording the JEDEC base — would fire
`buildWarnings`' advisory against every DDR5-6000 EXPO kit in the catalogue on
every AM5 board, which is both noise and false: a 6000 EXPO kit on a B650 runs
at 6000. The advisory's own wording ("unless the board's own profile supports
it") is written for a kit that exceeds what the board claims, which is what the
published maximum expresses.

⚠️ Where the maximum is qualified by population ("8000+ (1DPC)", "6400 (2DPC)"),
take the highest figure and put the qualification in that entry's `note`.

### 3. `m2Slots` records slots physically present, not contention

Many boards disable SATA ports, or drop the primary PCIe slot to x8, when a
given M.2 slot is populated. **None of that is modelled**, deliberately: rule 3
is documented as "does ANY slot on this board accept this drive, NOT slot
allocation", and a build holds exactly one part per category, so there is never
a second drive competing.

Each entry is `{ "pcieGen": <number>, "sata": <boolean> }`. `sata: true` only
where the maker states that slot accepts a SATA M.2 — it is the B+M-keyed
slots, and it is increasingly rare on current boards. `sataPorts` counts the
board's own SATA connectors at their maximum, with any sharing noted.

⚠️ **A slot's `pcieGen` is per slot, not per board.** That is the entire reason
this field is an array of objects rather than a count: a B650 typically has one
Gen5 x4 slot and one or two Gen4 x4. Reading the board's headline "PCIe 5.0"
onto every slot would be the product-family-for-exact-SKU error, one level down.

## Code changes

### Task 1a: coverage and ratchet, mirroring the previous three projects

```js
motherboard: {
  required: ['socket', 'formFactor', 'ramType', 'chipset', 'ramSlots', 'maxRamGb',
             'maxRamSpeed', 'pcieGen', 'epsConnectors', 'sataPorts', 'm2Slots'],
  optional: [],
},
```

```js
RATCHETED_KEYS.motherboard = ['socket', 'formFactor', 'ramType']
```

All seven `specs` keys are **already in `RESEARCHED_KEYS`** in
`src/tests/partSources.test.js`, so provenance is enforced from the first row
written — unlike the PSU project's `rating`, which had to wait for the final
task. `chipset` is not in that list and is not added: it is required for
coverage (it is re-verified) but nothing blocks on it.

⚠️ `formFactor` is already in `RESEARCHED_KEYS` as a `specs` key. On a board it
is **top level**, so it is the ratchet that enforces it, not that list. The two
mechanisms read different places and both need to be right.

### Task 1b: rule 1b stops false-blocking an underpopulated second EPS header

**The problem this fixes.** 10 of the 53 researched PSUs have exactly one 8-pin
EPS head — CX650, CX750, CV550, RM550x, EVGA G6 650, EVGA 500 W1, MSI A650BN,
be quiet! Pure Power 12 M 650, Seasonic Core GM-650, Thermaltake Smart 500 —
and most ATX boards in this catalogue have an 8+8 layout. Recording the honest
socket count and leaving rule 1b alone would ship roughly 300 new blocked
pairings on the day the first tranche lands, for builds that **boot and run**: a
board with two EPS sockets populated by one is fine at stock.

That is structurally the same defect as `53fba98` (PCIe 8-pin and 6-pin treated
as separate pools, 12 real cards falsely blocked) and `0a192ce` (`choosePsu`
sizing on watts alone). Both were found only once real data made them visible.
This one is visible *before* the data lands, so it is fixed first.

**The change.** Rule 1b blocks only on a genuine absence, and the shortfall
becomes an advisory:

- `psu.connectors.eps8 < 1` and the board needs any → **blocked**, as now. A
  supply with no EPS head cannot power a CPU at all.
- `1 ≤ psu.connectors.eps8 < board.specs.epsConnectors` → **not blocked**. A new
  `note` in `buildWarnings.js` says the board has a header this supply cannot
  fill, that it runs at stock, and that both matter for sustained overclocking.
- Either side unverified → `unverified`, as now.

⚠️ The advisory lives in `buildWarnings.js` because `specRules.js` has no
warning level — its statuses are `blocked` / `unverified` / null, and adding a
third would change `aggregate()`'s precedence for every rule. `buildWarnings`
already carries exactly this shape of message for the cooler's `ratedTdpW`.

⚠️ This makes rule 1b weaker, so it needs a test that the *strong* case still
blocks: a 0-EPS supply against a board needing one. Without it the rule could
be reduced to nothing and stay green.

### The shape a finished board takes

⚠️ **SHAPE ONLY — every value below is illustrative. Never copy these into the
catalogue; they must come from the maker's page.**

In `src/data/partsData.json`:

```json
{
  "id": "mb-example",
  "category": "motherboard",
  "name": "Example B650 Board",
  "brand": "Example",
  "price": 199.99,
  "socket": "AM5",
  "formFactor": "ATX",
  "ramType": "DDR5",
  "tdp": 14,
  "specs": {
    "chipset": "B650",
    "ramSlots": 4,
    "maxRamGb": 256,
    "maxRamSpeed": 8000,
    "pcieGen": 5,
    "epsConnectors": 2,
    "sataPorts": 4,
    "m2Slots": [
      { "pcieGen": 5, "sata": false },
      { "pcieGen": 4, "sata": false }
    ]
  }
}
```

In `data/partSources.json` — ten entries, one per researched field:

```json
"mb-example": {
  "socket": { "url": "https://example.com/b650/spec", "checkedOn": "2026-08-31" },
  "formFactor": { "url": "https://example.com/b650/spec", "checkedOn": "2026-08-31" },
  "ramType": { "url": "https://example.com/b650/spec", "checkedOn": "2026-08-31" },
  "chipset": { "url": "https://example.com/b650/spec", "checkedOn": "2026-08-31" },
  "ramSlots": { "url": "https://example.com/b650/spec", "checkedOn": "2026-08-31" },
  "maxRamGb": { "url": "https://example.com/b650/spec", "checkedOn": "2026-08-31" },
  "maxRamSpeed": { "url": "https://example.com/b650/spec", "checkedOn": "2026-08-31", "note": "8000+ (OC), 1DPC; 6400 at 2DPC" },
  "pcieGen": { "url": "https://example.com/b650/spec", "checkedOn": "2026-08-31" },
  "epsConnectors": { "url": "https://example.com/b650/spec", "checkedOn": "2026-08-31", "note": "8-pin + 4-pin; the 4-pin is not counted" },
  "sataPorts": { "url": "https://example.com/b650/spec", "checkedOn": "2026-08-31" },
  "m2Slots": { "url": "https://example.com/b650/spec", "checkedOn": "2026-08-31" }
}
```

⚠️ `tdp: 14` stays exactly as it is and **must never get a source entry**.

## Tranches

| # | tranche | rows |
|---|---|---|
| 1 | Code: `EXPECTED.motherboard`, `RATCHETED_KEYS.motherboard`, the rule 1b change | — |
| 2 | MSI, AM5 current (B650/B850/X670E/X870E) | 11 |
| 3 | MSI, Intel + AM4/legacy | 11 |
| 4 | ASUS, AM5 | 9 |
| 5 | ASUS, Intel + AM4/legacy | 10 |
| 6 | Gigabyte, AM5 | 8 |
| 7 | Gigabyte, Intel + legacy | 8 |
| 8 | ASRock, all 13 | 13 |
| 9 | Switch the motherboard ratchet on | — |

Splitting MSI, ASUS and Gigabyte by platform rather than arbitrarily keeps each
tranche on one maker's spec-page layout **and** one socket's vocabulary, so a
convention decided in a tranche applies to all of it.

## Risks

| risk | mitigation |
|---|---|
| A wrong `socket` or `ramType` correction breaks saved builds | The re-verification changes values, never ids. Any name re-point keeps the id, per the standing choice recorded in the PSU project |
| 70 boards × 11 fields is 770 values; transcription error is the real threat | Per-slot `m2Slots` and the SKU-anchored extraction of protocol R. Cross-row invariants: an AM5 board is never DDR4, an ITX board never has 4 RAM slots, `m2Slots.length ≥ 1` on every board since 2020 |
| Rule 1b weakened too far and nothing notices | An explicit test that a 0-EPS supply still blocks, written before the change |
| A discontinued board's page is gone | The PSU project's finding: three makers deleted pages search engines still index. Record `unverifiable` with what was checked; do not treat a dead page as a missing spec |
| `maxRamGb` and `maxRamSpeed` move with BIOS releases | Both are recorded with `checkedOn`, which is what that field is for. Neither blocks: `maxRamGb` blocks only above the stated maximum, and no catalogue kit approaches 192 GB |

## Success criteria

- `npm run catalog:coverage` reports **motherboard 70/70 verified**.
- `src/tests/partSources.test.js` passes with `motherboard` in the ratchet, and
  the ratchet is proved **non-vacuous** — remove one source, watch it fail.
- Rules 1b, 3 and 5 return a real verdict for a fully-specified build, and
  `verdictSpread` moves for the first time since the GPU project.
- The full suite green: lint, unit, e2e, build, sitemap and prerender drift.

## Explicitly not in this project

- The 22 AIOs' `radiatorMm` (rule 4). Next project.
- Storage `m2FormFactor` / `m2Sata`, and RAM `sticks`. Rules 3 and 5 need
  **both** sides; until those land, a fully-verified board still reports
  `unverified` against an unresearched drive or kit. **That is expected**, and
  is the same lag the PSU project saw. Rule 1b is the exception: the PSU side is
  already done, so 1b goes fully live with this project.
- CPU ↔ chipset/BIOS support lists. Deferred by decision — a per-board CPU list
  with minimum BIOS versions goes stale with every BIOS release.
- `npm run catalog:push` and any push to `origin`. Both are the user's to run.
