# Case catalogue research: bringing 59 cases up to the research standard

Date: 2026-08-30

## Problem

The GPU sweep finished at 79/79 and the payoff is capped, because a
compatibility rule needs two operands and cases supply none of theirs.

`src/lib/specRules.js` ships two rules that read a case:

| rule | case field it reads | cases carrying it |
|---|---|---|
| `gpuThickness` (rule 2) | `specs.expansionSlots` | **0 of 59** |
| `radiatorFit` (rule 4) | `specs.radiatorSupport` | **0 of 59** |

Both therefore return `unverified` for every build in the catalogue. The 79
researched `slotsThick` values — a full tranche of work — feed a comparison
whose other side does not exist.

The three case fields that *do* exist are unsourced. All 59 rows carry
`maxGpuLength`, `maxCoolerHeight` and `supportedFormFactors`; **none has an
entry in `data/partSources.json`.** They predate the research standard, so
nobody has checked them against a manufacturer page — and they are read by
`compatibility.js`, `dimensionsCheck.js`, `autoBuilder.js`, `partQuality.js`
and `partPages.js`. `partPages.js` prints them as fact: "Up to 400 mm, so N of
79 cards fit."

### What the data looks like, and what that is worth as evidence

Unlike the GPU catalogue, the case numbers are **not obviously placeholders**:
35 distinct `maxGpuLength` values across 59 rows, 23 distinct
`maxCoolerHeight`. That is a real spread, not per-generation buckets.

Two soft signals are worth checking rather than trusting:

- **Ten cases sit at exactly 400 mm**, spanning micro towers (Corsair 2500X)
  and mid towers (NZXT H7 Flow). A round number shared across form factors is
  the shape a default takes.
- **20 of 59 cooler heights are 165 or 170 mm.** Both are genuinely common
  values, so this may well be real. It is a prompt to verify, not a defect.

This is a weaker evidence base than the GPU sweep had, and the spec says so
rather than dressing it up. The case for the work is requirement 6 of the
standard — an unsourced number cannot be re-checked by anyone — plus the two
dead rules, not a proven catalogue of errors.

### A hypothesis that was checked and is FALSE

`supportedFormFactors` has only three distinct shapes and **no case lists
E-ATX**, which looks like a gap that would make large boards unbuildable. It is
not one: the catalogue's 70 motherboards are 40 ATX, 27 mATX and 3 ITX, and
**no board is E-ATX**. Nothing is blocked. Do not re-open this.

## Decisions

Taken with the user during brainstorming. Do **not** re-litigate these.

| | |
|---|---|
| Field set | **Rule-complete**: the five fields the engine reads, no more |
| Existing three fields | **Re-verified**, not trusted — sources recorded for all 59 |
| `maxGpuLength` semantics | **Maker's unobstructed maximum**; a "with front radiator" figure goes in the source `note` |
| Execution | **Inline, in brand tranches**, full suite green per tranche. No subagents |
| Unpublished figures | `result: "unverifiable"` with a note, never a guess |
| Scope | **Cases only.** PSUs follow as their own spec |

## The field set

Five fields per case, 295 values in total.

| field | location | today | after |
|---|---|---|---|
| `expansionSlots` | `specs` | absent on all 59 | integer, sourced |
| `radiatorSupport` | `specs` | absent on all 59 | `{ top: [240,280], front: [360], … }`, sourced |
| `maxGpuLength` | top level | present, 0 sourced | re-verified, sourced |
| `maxCoolerHeight` | top level | present, 0 sourced | re-verified, sourced |
| `supportedFormFactors` | top level | present, 0 sourced | re-verified, sourced |

`expansionSlots` and `radiatorSupport` are **already listed in
`RESEARCHED_KEYS`** in `src/tests/partSources.test.js`. Adding either without a
source fails the suite by name today — no new guard is needed for them.

`radiatorSupport` is an object keyed by mount position, each value an array of
radiator sizes in mm. Rule 4 asks only whether *any* mount takes the size, so
the keys are documentation; use the maker's own words (`top`, `front`, `rear`,
`side`, `bottom`).

### Where a value is corrected, not just sourced

A re-verified figure that disagrees with the maker gets **changed**, in the same
commit as its source, with the old value named in the commit message. This is
the RTX 4090 case: the correction is the point of the exercise, not a side
effect.

## The ratchet needs a change before it can cover cases

`VERIFIED_CATEGORIES` is `new Set(['gpu'])` and `RATCHETED_KEYS` is the global
`['length', 'tdp']`.

🛑 **Adding `'case'` to that set as it stands would demand a source for
`tdp: 0` on all 59 cases.** Per the standard, a case's `tdp: 0` means "draws
nothing" — it is a sentinel, not a researched figure, and sourcing it would be
recording provenance for a fact nobody measured.

So `RATCHETED_KEYS` becomes a per-category map:

```js
const RATCHETED_KEYS = {
  gpu: ['length', 'tdp'],
  case: ['maxGpuLength', 'maxCoolerHeight', 'supportedFormFactors'],
}
```

The `gpu` entry must keep passing unchanged — that is the regression guard on
the refactor. `'case'` joins `VERIFIED_CATEGORIES` only in the final task, once
all 59 rows are done, so the suite stays green throughout.

`EXPECTED.case` is added to `scripts/catalog-coverage-core.mjs` with the five
fields required and none optional, so `npm run catalog:coverage` reports cases
from the first tranche. `coverageFor` already handles top-level fields via
`hasField`, so no other change is needed there.

## Sources

The hierarchy is the standard's, unchanged: **manufacturer spec page first**,
one reliable secondary for cross-checking, PCPartPicker as secondary only.

Cases are easier than GPUs in one respect and harder in another. Easier: a case
is a single SKU, so the "exact model, not family" trap barely applies. Harder:
clearance figures are often published as prose in a support table rather than a
spec row, and several makers qualify them ("360 mm with front fan removed").
The qualification goes in the `note`; the field takes the unobstructed number.

⚠️ `WebFetch` cannot reach several vendor sites. Drive the in-app Browser
(`preview_start {url}`, then `javascript_tool` to read the DOM). Fractal, Lian
Li, NZXT, Corsair, Cooler Master and Phanteks all publish full clearance tables.

## Tranches

Nine commits, the full suite green after each.

| # | tranche | rows |
|---|---|---|
| 1 | Ratchet refactor + `EXPECTED.case` (no data) | — |
| 2 | Fractal Design | 10 |
| 3 | Lian Li | 10 |
| 4 | NZXT + HYTE | 8 |
| 5 | Corsair | 7 |
| 6 | Cooler Master | 6 |
| 7 | Phanteks | 6 |
| 8 | Tail: Montech 4, be quiet! 3, Thermaltake 2, Kolink, Aerocool, Antec | 12 |
| 9 | Switch the case ratchet on | — |

Tranche 2 doubles as the pilot: it stops for user review before the rest run.

## Verification

- `npm run test:run` after every tranche — the provenance bijection, the
  unverifiable rules and the ratchet all live there.
- `npm run catalog:coverage` shows `case` climbing to 59/59.
- `npm run lint` and `npm run build` before the final commit.
- ⚠️ `npm run prerender` after the data lands: part-page copy quotes these
  numbers, and fragments go stale silently.
- ⚠️ None of this reaches users until `npm run catalog:push -- --apply` and a
  push of `main`. Both are the user's to run.

## Out of scope

- **PSUs** (53 rows) — the next spec, and the other half of rule 1.
- **AIO `radiatorMm`** (22 coolers) — see below.
- PSU clearance, drive bays, fan mounts, case dimensions: no rule reads them.

## Known limitation: rule 4 stays dark after this lands

`radiatorFit` needs `cooler.specs.radiatorMm`, a number **no cooler carries**.
All 22 AIOs hold the string `radiator: "240mm"`, which predates the standard and
which the rule deliberately refuses to parse. So `radiatorSupport` will be
correct and inert until those 22 coolers are researched.

Rule 2 (`gpuThickness`) does go fully live, because the GPU side is already
79/79.

The 22-cooler follow-on is smaller than PSUs and completes a rule outright; it
is the natural third project, after PSUs or before them at the user's call.
