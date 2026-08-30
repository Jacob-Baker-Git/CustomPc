# PSU catalogue research: bringing 53 supplies up to the research standard

Date: 2026-08-30

Spec and plan in one document. The case project
(`2026-08-30-case-catalogue-research-design.md` and its plan) established the
method; this reuses it rather than restating it. **Research protocol R in
`docs/superpowers/plans/2026-08-30-case-catalogue-research.md` is binding here
too** — including the two traps it records, the SKU-anchored extraction and the
rule that a maker's support KB outranks its product spec table.

## Problem

`src/lib/specRules.js` rule 1 asks whether the PSU can power the graphics card.
It reads `psu.specs.connectors`. **No PSU carries it**, so rule 1 returns
`unverified` for every build in the catalogue — even now that all 79 GPUs have a
researched `powerConnectors`. That GPU work is still only half a comparison.

The two fields PSUs *do* carry are unsourced:

| field | location | today | read by |
|---|---|---|---|
| `connectors` | `specs` | **absent on all 53** | rule 1, rule 1b |
| `wattage` | top level | present, 0 sourced | `psuTooSmall`, `autoBuilder.choosePsu`, `partPages`, `partQuality` |
| `rating` | `specs` | present, 0 sourced | `psuEfficiency()` → quality score, spec sheet |

`wattage` is load-bearing in a way case clearances were not: it is the only
thing standing between a user and a build whose draw exceeds its supply, and
`autoBuilder` picks a unit by it on every auto-build.

## Decisions

| | |
|---|---|
| Field set | **Rule-complete**: `connectors`, `wattage`, `rating`. Nothing else |
| Out of scope | PSU length, form factor (ATX/SFX), cable count, fan size, modularity — **no rule reads them** |
| Execution | Inline, in brand tranches, full suite green per tranche |
| Unpublished figures | `result: "unverifiable"` with a note, never a guess |

### The connector convention — the semantic decision of this project

`connectors` counts **the plugs the unit can present at once**, not the number
of cables.

A supply advertising "PCIe 6+2 × 6" ships perhaps three cables with two heads
each. Six is the number that matters, because rule 1 asks whether the card's
sockets can be filled. Counting cables would wrongly block a 3×8-pin card on a
supply that runs it fine.

- `pcie8` — 8-pin PCIe heads, **including 6+2 heads**, since a 6+2 fills an
  8-pin socket.
- `pcie6` — heads that are 6-pin only. Rare on modern units.
- `eps8` — 8-pin EPS/CPU heads, including 4+4.
- `12vhpwr` — native 12VHPWR / 12V-2x6 (ATX 3.x). A card needing one can also be
  fed through its bundled adapter, which rule 1 already handles via the GPU's
  `adapterFrom`.

⚠️ Where a maker states a total that mixes cable and head counts, the **head**
count wins and the note records the wording.

## Code changes

Two, mirroring Task 1 of the case project:

1. `EXPECTED.psu = { required: ['wattage', 'rating', 'connectors'], optional: [] }`
   in `scripts/catalog-coverage-core.mjs`.
2. `RATCHETED_KEYS.psu = ['wattage']`.

🛑 **`wattage` ONLY.** Every PSU also carries `tdp: 0` — the same sentinel the
case work found. Ratcheting `tdp` would demand provenance for 53 zeros nobody
measured.

`connectors` is already in `RESEARCHED_KEYS`, so it is source-enforced from the
first row. **`rating` is not**, and adding it now would fail instantly against
53 unsourced values — so it joins `RESEARCHED_KEYS` in the final task, once
every row has a source. That is the same ratchet shape, applied to a `specs`
key rather than a top-level one.

## Tranches

| # | tranche | rows |
|---|---|---|
| 1 | `EXPECTED.psu` + `RATCHETED_KEYS.psu` (no data) | — |
| 2 | Corsair | 15 |
| 3 | be quiet! | 9 |
| 4 | Seasonic + Lian Li | 8 |
| 5 | MSI + Cooler Master | 8 |
| 6 | EVGA + NZXT | 7 |
| 7 | ASUS + Thermaltake | 6 |
| 8 | Switch the PSU ratchet on, and add `rating` to `RESEARCHED_KEYS` | — |

⚠️ be quiet! renders its spec tables client-side and could not be read during
the case project. Expect to fall back to PCPartPicker there, and say so in the
notes.

## Verification

Per tranche: `npm run test:run`, and `npm run catalog:coverage` showing `psu`
climbing to 53/53. `npm run lint` and `npm run build` before the final commit.

⚠️ **Unlike the case work, this changes what the app BLOCKS.** Rule 1 goes from
`unverified` everywhere to real verdicts, so the `verdictSpread` snapshot will
move. Read that diff rather than accepting it — it is the whole point of the
snapshot, and it is how a wrong connector count would be caught.

⚠️ A `wattage` correction is more dangerous than a clearance one: raising it
lets `autoBuilder` pick a unit that cannot run the build. Cross-check every
changed wattage.

## Out of scope, and what stays dark

- **Rule 1b (`epsConnectors`) stays unverified.** It needs the *motherboard's*
  EPS header count, and boards are not researched. The PSU half lands here; the
  board half is a later project.
- Rule 4 (radiators) is unaffected and still waits on the 22 AIOs.
