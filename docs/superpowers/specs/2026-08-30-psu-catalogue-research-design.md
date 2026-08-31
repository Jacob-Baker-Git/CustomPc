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

## Tranches — ✅ ALL COMPLETE, 53/53 (100%)

| # | tranche | rows | done | outcome |
|---|---|---|---|---|
| 1 | `EXPECTED.psu` + `RATCHETED_KEYS.psu` (no data) | — | `8cce7dc` | — |
| 2 | Corsair | 15 | `1b1acf2` | no value changed |
| 3 | be quiet! | 9 | `839e672` | 1 name, 1 wattage, 1 rating |
| 4 | Seasonic + Lian Li | 8 | `31df827` | no value changed |
| 5 | MSI + Cooler Master | 8 | `48ede2c` | 2 names |
| 6 | EVGA + NZXT | 7 | `23aacdb` | no value changed |
| 7 | ASUS + Thermaltake | 6 | `505f5ef` | 1 name, 1 rating |
| 8 | Switch the PSU ratchet on, and add `rating` to `RESEARCHED_KEYS` | — | `77f6b43` | proved non-vacuous |

⚠️ be quiet! renders its spec tables client-side and could not be read during
the case project. Expect to fall back to PCPartPicker there, and say so in the
notes.

## What the work actually found

The interesting result was not the connector counts. It was how often a
maker's own page is wrong, or silent, about its own product.

**Five catalogue rows named products nobody makes.** be quiet! "Pure Power 12 M
600W" (the line is 550/650/750/850/1000/1200), MSI "MAG A750BN" (only the
PCIE5 exists), MSI "MPG A1250G PCIE5" (it is the A1250**GS**), and Thermaltake
"Smart BX1 500W" (BX1 is 450/550/650/750; the 500 W is the plain Smart, and
80 PLUS Standard rather than Bronze). Each was re-pointed to the real product
**keeping its id**, so saved builds and `/part/` URLs still resolve.

**A maker's page contradicted the same maker's KB, twice.** The 1000 W tab of
both `seasonic.com/focus-gx/` and `seasonic.com/prime-tx/` lists a native
"12VHPWR (12+4 Pins to 12+4 Pins)" cable; Seasonic's own
`/cable-compatibility/` table says neither series can accept one, and
PCPartPicker agrees with the KB. Recording the page as read would have told a
user an RTX 40/50-series card could be fed natively by a supply that has no
16-pin port. This is the case project's rule — *the support KB outranks the
product spec table* — paying out a second time.

**A parenthesis decided a 1200 W unit's verdict.** ASUS writes "(both PSU &
component side)" for the TUF units and "(component side)" for the ROG Thor
1200P2. Only the first is a native port.

**Two makers publish no figure at all where it looks like they do.** Cooler
Master's MWE Gold 650 V2 page carries a shared series row reading
"750W / 850W: x4 ... 1000W: x3" and never mentions 650 W; Thermaltake omits
the CPU/EPS row entirely on every model.

**Three makers have deleted their product pages.** evga.com redirects every
`/products/` URL to its homepage, NZXT 404s its pre-ATX-3.1 C-series, and be
quiet! serves the generic homepage for Straight Power 11 and System Power 10.
Search engines still index all of them, so a dead page looks like a live lead.

### The two latent bugs it surfaced

Both were invisible until rule 1 had real data to read.

1. **`specRules.js` treated `pcie8` and `pcie6` as independent pools** —
   fixed at `53fba98`. Every modern PCIe head is a 6+2, so the first fifteen
   connector sets blocked 12 real cards on a 1000 W supply with four spare
   heads.
2. **`autoBuilder.choosePsu` sized a supply on watts alone** — fixed at
   `0a192ce`. It paired an RTX 5080 with a 650 W two-head Bronze unit, and the
   build it returned was `blocked` by the app's own rule.

### What is still dark

Rule 1b (`epsConnectors`) needs the **motherboard's** EPS header count, so it
still returns `unverified` for every build. Because `aggregate()` takes the
worst status, GPU verdicts stay `unverified` whenever a board is also
selected — which is why the `verdictSpread` snapshot did not move across all
six data tranches. Motherboards are the next project.

⚠️ Seven EVGA/NZXT rows, plus be quiet!'s Straight Power 11 and System Power
10, are **discontinued products the catalogue still offers**. That is a
curation question, not a research one, and was deliberately left alone.

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
