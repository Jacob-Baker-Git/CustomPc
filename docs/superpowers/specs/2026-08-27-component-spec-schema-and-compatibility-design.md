# Component spec schema and compatibility engine extension

Date: 2026-08-27

## Problem

The user set a research standard for hardware data: manufacturer's official spec
page first, cross-checked against at least one reliable secondary source, exact
SKU rather than product family, sources recorded, and **anything unverifiable
marked unknown rather than guessed**. Accuracy beats completeness.

The database cannot hold the result. `compatibility.js` reads exactly nine
fields — `socket`, `sockets`, `ramType`, `formFactor`, `supportedFormFactors`,
`maxGpuLength`, `maxCoolerHeight`, `length`, `wattage` — which covers 7 of the 16
compatibility relationships the user listed. The other nine have nowhere to be
stored, and `partsData.json` has no provenance field at all.

Worse, the current convention **silently passes on missing data**:

```js
if (Array.isArray(candidate.supportedFormFactors) && !candidate.supportedFormFactors.includes(...))
```

An absent field produces "compatible" indistinguishable from a real pass. That is
the exact failure the research standard exists to prevent, so it must not be
inherited by nine new rules.

### Evidence that this is not hypothetical

`gpu-rtx-4090` is named "NVIDIA GeForce RTX 4090" and carries `length: 336`.
NVIDIA's official page gives the Founders Edition as **304 mm**, 137 mm wide,
**3-slot (61 mm)**, 450 W TGP, **PCIe Gen 4**, needing 3× PCIe 8-pin or one
450 W+ Gen 5 cable. 336 mm is a partner card's length. The TDP is right; the
length is a product-family guess attached to a specific card's name.

## Decisions

Taken with the user, 2026-08-27:

| question | decision |
|---|---|
| Scope | Mechanism **plus 8 rules**. CPU↔chipset/BIOS **deferred** — it needs a per-board CPU support list with minimum BIOS versions, which is an ongoing data commitment, not a one-off. |
| Missing data | **Three-state verdict**: `ok` / `blocked` / `unverified`. The system never implies it checked something it could not. |
| Provenance | **Sibling file**, `data/partSources.json`, **not shipped to the browser**. Follows the `data/benchmarks/` precedent. |
| Existing 559 parts | **Out of scope here.** Verifying them to the new standard is a committed follow-on task, not an optional one. See "Follow-on". |

## Schema additions

Every field below is **optional**. Absent means "not researched yet"; explicit
`null` means "researched and not published / not determinable". Both produce
`unverified`, never `ok`. No existing field changes shape, so every current
reader keeps working.

### GPU (`specs`)

```json
"slotsThick": 3,
"pcieGen": 4,
"powerConnectors": { "12vhpwr": 1 },
"adapterFrom": { "pcie8": 3 }
```

`adapterFrom` records a bundled adapter, so a card whose socket is 12VHPWR but
which ships a 3×8-pin adapter is satisfiable by a PSU with neither a native
12VHPWR cable nor an excuse. The RTX 4090 FE is exactly this case and is why the
field exists.

### Motherboard (`specs`)

```json
"ramSlots": 4,
"maxRamGb": 192,
"maxRamSpeed": 8000,
"pcieGen": 5,
"epsConnectors": 2,
"sataPorts": 4,
"m2Slots": [ { "pcieGen": 5, "sata": false }, { "pcieGen": 4, "sata": true } ]
```

`m2Slots` is an array rather than a count because the slots differ from each
other: interface generation varies per slot, and only B+M-keyed slots accept a
SATA M.2 drive. A count cannot express "three slots, one of which takes SATA".

### Case (`specs`)

```json
"expansionSlots": 7,
"radiatorSupport": { "top": [240, 280, 360], "front": [240, 280, 360], "rear": [120] }
```

### Cooler (`specs`)

```json
"ratedTdpW": 250,
"radiatorMm": 360
```

⚠️ `ratedTdpW` is **only** for a figure the manufacturer actually publishes.
Many do not. It must not be confused with `partSynergy.coolerCapacityW`, which is
a *derived ladder* the app already computes; that stays as the fallback, and this
field takes precedence where it exists.

### PSU (`specs`)

```json
"connectors": { "pcie8": 6, "12vhpwr": 1, "eps8": 2 },
"formFactor": "ATX"
```

### Storage (`specs`)

```json
"m2FormFactor": "2280",
"pcieGen": 4,
"m2Sata": false
```

## The eight rules, and what each one does

⚠️ **Three of the eight must never block.** PCIe and M.2 generations are
backward compatible: a Gen 4 card in a Gen 3 slot runs, just slower. Blocking on
them would invent an incompatibility that does not exist, which is the same class
of error as guessing a spec.

| # | rule | verdict on failure |
|---|---|---|
| 1 | PSU lacks the connectors the GPU requires (after allowing `adapterFrom`) | **blocked** |
| 2 | GPU `slotsThick` exceeds the case's `expansionSlots` | **blocked** |
| 3 | The board has no M.2 slot whose interface accepts this drive (a SATA M.2 into PCIe-only slots, or an M.2 drive on a board with `m2Slots: []`) | **blocked** |
| 4 | AIO `radiatorMm` not in the case's `radiatorSupport` for any mount | **blocked** |
| 5 | RAM `sticks` exceed board `ramSlots`, or `capacityGb` exceeds `maxRamGb` | **blocked** |
| 6 | Cooler `ratedTdpW` below CPU `tdp` | **warns** — thermal, not physical |
| 7 | GPU `pcieGen` above board `pcieGen` | **advisory** — runs at the lower gen |
| 8 | Storage `pcieGen` above its slot's gen, or RAM `speed` above `maxRamSpeed` | **advisory** — runs slower, or needs XMP/EXPO |

Rule 6 goes through the existing `getBuildWarnings` path rather than the
selection-blocking path, matching how thermal concerns are already surfaced.
Rules 7 and 8 are informational text only and never affect selectability.

⚠️ **A build holds exactly one part per category.** `selectedParts` is
`{ [category]: part }`, so there is never a second drive, a second GPU or a
second stick-set to account for. Rule 3 is therefore "does any slot on this board
accept this drive", **not** slot allocation across several drives, and rule 5
compares one RAM kit's `sticks` against `ramSlots`. Do not build inventory
tracking for a case that cannot arise.

Also covered by rule 1: a board's `epsConnectors` against the PSU's `eps8`, since
the user's list named CPU power connectors alongside GPU ones.

## The unverified contract

`checkCompatibility` returns:

```js
{ status: 'ok' | 'blocked' | 'unverified', reason: string | null, compatible: boolean }
```

- `compatible` is **derived**, `status !== 'blocked'`, and kept so that existing
  callers continue to work unchanged. This is what makes the change additive.
- **Precedence is `blocked` > `unverified` > `ok`.** A rule that blocks wins over
  one that could not run; a rule that could not run wins over silence. Without
  this, one satisfied rule would mask an unverified one.
- `getLockedReasons` locks on `blocked` **only**. An unverified rule must never
  make a part unselectable — that would make the catalogue unusable, since no
  part carries the new fields yet.
- Unverified surfaces on the **part being considered**, not as a build-wide
  banner. Eight standing "not verified" notices on every build would train people
  to ignore the one that matters.

## Provenance

`data/partSources.json`:

```json
{
  "gpu-rtx-4090": {
    "length":  { "url": "https://www.nvidia.com/en-gb/geforce/graphics-cards/40-series/rtx-4090/", "checkedOn": "2026-08-27" },
    "slotsThick": { "url": "https://www.nvidia.com/en-gb/geforce/graphics-cards/40-series/rtx-4090/", "checkedOn": "2026-08-27" }
  }
}
```

Keyed part id → spec key → `{ url, checkedOn }`. Build/authoring input only,
never imported by `src/`, so the shipped bundle is byte-identical. A test fails
if any part carries a new-schema spec with no matching source entry, so the two
files cannot drift apart.

## Testing

- One unit test per rule for the blocking/warning/advisory case.
- ⚠️ **One unit test per rule proving that absent data yields `unverified`** —
  not `ok`, and not `blocked`. This is the whole point of the design and is the
  assertion most likely to be quietly lost in a later refactor.
- A precedence test: a build with one satisfied rule and one unverified rule
  reports `unverified`.
- A test that `getLockedReasons` never locks on `unverified`.
- The provenance drift test described above.
- A regression test that every existing part still returns its current verdict,
  so the additive claim is proved rather than asserted.

## Out of scope

- **CPU ↔ chipset/BIOS compatibility.** Deferred by decision.
- **Verifying the existing 559 parts.** See below.
- Any change to how parts are priced, scored, or rendered.

## Follow-on, committed not optional

The user asked that **all** catalogue data eventually meet this standard. That is
a separate spec and plan, and it is much the larger job: 559 parts, each needing
a manufacturer page plus a cross-check. Sequencing should be by blast radius —
GPUs first, since they carry the most variant-specific error (the RTX 4090 length
is already wrong) and drive the most compatibility rules, then PSUs and cases,
then motherboards, then the rest.

It should also re-verify the **existing** `length`, `tdp` and `socket` values, not
only fill the new fields, because the 4090 shows the existing values carry the
same family-vs-SKU error the new standard is meant to prevent.

## Uncertain / to confirm during implementation

- Whether any catalogue AIO cooler publishes a `ratedTdpW` at all. If none does,
  rule 6 will be permanently `unverified` for AIOs and the derived ladder remains
  the only signal. This is acceptable and honest, but should be recorded rather
  than papered over.
- Case `radiatorSupport` mount naming (`top` / `front` / `rear` / `side`) varies
  by manufacturer. The first few cases researched will settle the vocabulary; it
  should be a fixed set, validated by a test, rather than free-form strings.
