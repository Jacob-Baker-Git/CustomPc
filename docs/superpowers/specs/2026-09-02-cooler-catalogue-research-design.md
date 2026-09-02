# Cooler catalogue research: bringing 53 coolers up to the research standard

Date: 2026-09-02

Fifth component tranche, after GPUs (79), cases (59), PSUs (53) and
motherboards (70). **Research protocol R in
`docs/superpowers/plans/2026-08-30-case-catalogue-research.md` is binding here
too** — the SKU-anchored extraction, the rule that a maker's support KB
outranks its product spec table, and the requirement that
`src/data/partsData.json` and `data/partSources.json` are written with
`scripts/house-json.mjs` and never with `JSON.stringify`.

## Problem

Coolers are the last category the compatibility engine reads and the only one
still reporting `unverified`. All 53 rows carry three spec keys — `type`,
`height` or `radiator`, and a top-level `sockets` list — and **not one has an
entry in `data/partSources.json`.**

The category sits behind two different failures at once.

**Rule 4 is honestly dark.** `radiatorFit` in `src/lib/specRules.js:188` reads
`specs.radiatorMm`, a number that exists on no part. It deliberately refuses to
parse the `specs.radiator` string (`"240mm"`) that all 22 AIOs carry, because
those strings predate the standard. So every AIO reports `unverified`:

| build | cooler ok | blocked | unverified |
|---|---|---|---|
| cramped (mATX, Q300L) | 21 | 10 | **22** |
| roomy (ATX, Torrent) | 31 | 0 | **22** |

🛑 **These 22 are the only `unverified` parts left in either reference build.**
Every other category now answers for real. Rule 4 is the last dark rule, and
the case side of it — 59 researched `radiatorSupport` objects — is already
done and waiting.

**The air coolers are the opposite failure: they block, from data nobody
checked.** `compatibility.js:85` and `:91` refuse a build when `specs.height`
exceeds the case's `maxCoolerHeight`, and `:97`–`:114` refuse on the `sockets`
list in four directions. Ten coolers are blocked in the cramped build on
heights that have never been read off a maker's page. The height column has the
tell, too: **five coolers read exactly 154 and six read exactly 155**, a
cluster likelier to be one value copied along a row than eleven independently
correct measurements.

A wrong height silently refuses a cooler that fits. A wrong socket list
silently refuses a correct build in both directions. This is the failure the
research standard exists to prevent.

## Decisions

| | |
|---|---|
| Field set | `sockets` and `specs.type` on all 53; `specs.height` on the 31 air; **`specs.radiatorMm` (new)** on the 22 AIOs |
| Ratcheted | `sockets` — the only top-level field, and it blocks in four directions |
| `specs.radiator` | **Deleted.** Replaced by `radiatorMm`; display copy derived from the number |
| `tdp` | **Left exactly as it is.** No source, not in `EXPECTED`, not ratcheted |
| Cooler capacity | Stays a derived ladder in `partSynergy.coolerCapacityW`. No maker publishes a watt rating |
| Out of scope | Fan speed, noise, airflow, static pressure, bearing type, RGB, tube length, radiator thickness, pump speed |
| Execution | Inline, seven brand tranches, full suite green per tranche |
| Unpublished figures | `result: "unverifiable"` with a note, never a guess |

### `tdp` is a modelled figure and must not acquire a source

Every cooler carries `tdp: 2`–`5`. This is not the case and PSU `tdp: 0`
sentinel — it is a real number feeding the build's draw total — but it is the
app's own estimate of fan and pump draw, in the same family as the
motherboard's `tdp: 12`–`15`. Makers publish fan wattage inconsistently and
pump wattage almost never, and no rule blocks on it. A source entry would
assert provenance for a figure nobody published.

## The semantic decisions

### 1. `radiatorMm` is the nominal size, and it replaces the string outright

The field is the **nominal radiator length in millimetres as the maker names
the product** — 240, 280, 360, 420 — because that is the vocabulary the case
side already speaks. Rule 4 tests `support[mount].includes(size)` against the
59 researched `radiatorSupport` objects, whose arrays hold exactly
`92, 120, 140, 200, 240, 280, 360, 420`. An actual measured length (a "240" is
usually 277 mm over the end tanks) would match nothing and block every AIO in
the catalogue.

⚠️ **Radiator thickness is deliberately not collected.** A case's support list
is published by nominal length only, so a thick radiator (the Arctic Liquid
Freezer III is 38 mm) cannot be checked against it without a second field on
all 59 cases. That is a separate project, and inventing half of it here would
produce a rule that cannot run.

🛑 **The string it replaces is load-bearing in four places, not one.** This is
why the replacement is a task of its own rather than a side effect:

| site | what it does today |
|---|---|
| `partSynergy.js:31` | a local helper *also called* `radiatorMm` parses `"240mm"` to pick the capacity rung |
| `partStats.js:166` | renders the `Radiator` row |
| `specSheetContent.js:123` | renders the spec-sheet summary sentence |
| `partPages.js:210` | renders pre-rendered part-page copy |

`coolerCapacityW` is **the only cooling-capacity figure on the site**, feeding
the Performance tab and the thermal-throttle advisory. After the swap it reads
the verified number directly, the local parser is retired along with the name
collision, and the three copy sites derive their text as `${mm}mm`.
`specSheetContent.js:22` already carries the label `Radiator size (mm)`.

### 2. Required fields are conditional on `specs.type`

Coolers are the **first category whose required field list depends on the part
itself.** The four done so far each had one flat list. The split in the data is
already clean: all 31 air coolers carry `height` and no radiator, all 22 AIOs
carry a radiator and no height.

`EXPECTED.cooler` therefore gains per-variant required lists keyed on
`specs.type`:

- `Air` → `sockets`, `type`, `height`
- `AIO` → `sockets`, `type`, `radiatorMm`

The alternative — one flat list with both size fields marked `optional` — was
rejected because a cooler carrying **neither** field would then count as fully
researched. That is the gap the case config's own comment warns about: an
omitted field is a gap, not a fact.

`type` is required rather than assumed because it **selects which rule runs**.
`compatibility.js:11` skips the height check entirely for anything typed
`AIO`, and rule 4 skips anything not typed `AIO`. A mislabelled cooler is
checked by neither rule and blocks nothing.

### 3. `sockets` is re-read as a whole list, against a closed vocabulary

The catalogue's socket vocabulary is exactly five tokens — `AM4`, `AM5`,
`LGA1200`, `LGA1700`, `LGA1851` — and it is already consistent across CPUs,
boards and coolers, with no orphan on either side. Research maps the maker's
list into that set and **drops anything outside it** (LGA1150, sTRX4, LGA2066),
the same convention the case project used for E-ATX in `supportedFormFactors`.
Adding a sixth token would change nothing but risk a mismatch.

⚠️ **A socket list is verified as a list, not spot-checked.** The block runs in
four directions, so an omitted socket refuses a valid pairing just as loudly as
an invented one refuses nothing. Mounting kits are the trap: several makers
support a socket **only via a bundled or free bracket** (AM5 on older Noctua
SecuFirm2, LGA1851 on kits shipped after launch). A socket the maker supports
with an included bracket counts; one needing a separately purchased kit does
not, and the distinction goes in the entry's `note`.

## Code changes

### Task 1: coverage learns a conditional category

`scripts/catalog-coverage-core.mjs` gains `EXPECTED.cooler` with the two
variants above and `RATCHETED_KEYS.cooler = ['sockets']`. Tests go in
`src/tests/catalogCoverage.test.js` first, including the case the flat-list
alternative would have passed: a cooler with neither `height` nor `radiatorMm`
must count as unresearched.

Both additions are **inert on landing** — coverage reports `cooler 0/53` and
the ratchet ignores the category until it joins `VERIFIED_CATEGORIES`.

### Task 9: the radiator string is retired

Delete `specs.radiator` from the 22 AIOs, rewire the four sites in the table
above, retire the local `radiatorMm()` parser, update `partStats.test.js:91`,
and re-run `npm run prerender` because `partPages.js` copy changes.

### Task 10: the ratchet goes on

`height` and `type` join `RESEARCHED_KEYS` in `src/tests/partSources.test.js`,
and `cooler` joins `VERIFIED_CATEGORIES`. The `verdictSpread` snapshot is
updated. The ratchet is proved non-vacuous by deleting one source and watching
the suite fail.

### The shape a finished cooler takes

⚠️ **SHAPE ONLY — every value below is illustrative. Never copy these into the
catalogue; they must come from the maker's page.**

```json
{
  "id": "cooler-example-air",
  "category": "cooler",
  "name": "Example Air 140",
  "brand": "Example",
  "price": 99.99,
  "sockets": ["AM5", "AM4", "LGA1700", "LGA1851"],
  "tdp": 3,
  "specs": { "type": "Air", "height": 165 }
}
```

```json
{
  "id": "cooler-example-aio",
  "category": "cooler",
  "name": "Example Liquid 360",
  "brand": "Example",
  "price": 149.99,
  "sockets": ["AM5", "LGA1700", "LGA1851"],
  "tdp": 5,
  "specs": { "type": "AIO", "radiatorMm": 360 }
}
```

```json
"cooler-example-aio": {
  "sockets": { "url": "https://example.com/liquid-360/spec", "checkedOn": "2026-09-02", "note": "LGA1851 via the bracket in the box" },
  "type": { "url": "https://example.com/liquid-360/spec", "checkedOn": "2026-09-02" },
  "radiatorMm": { "url": "https://example.com/liquid-360/spec", "checkedOn": "2026-09-02", "note": "radiator 394 x 120 x 27 mm; nominal 360" }
}
```

⚠️ `tdp` stays exactly as it is and **must never get a source entry.**

## Ordering constraints — the part that will bite

The enforcement mechanism is already half-built, and that fixes the order:

1. **`radiatorMm` is already in `RESEARCHED_KEYS`** (`partSources.test.js:16`,
   added by the schema project). Writing it without a source fails **today**.
   No list change is needed, and none may be made early.
2. **`height` and `type` can only join `RESEARCHED_KEYS` at close-out.** All 53
   rows carry them unsourced right now, so adding either early fails instantly
   against 53 values. This is exactly the `rating` precedent the test file
   already documents from the PSU project.
3. 🛑 **The string may only be deleted after all 22 AIOs carry a number.**
   `coolerCapacityW` parses it to pick a rung, so deleting it first makes every
   AIO report **0 W capacity** — which does not error, it silently blanks the
   capacity row and the throttle advisory. The 22 AIOs are spread across six of
   the seven tranches, so the last of them lands in Task 8 and Task 9 can only
   follow it.

## Tranches

Brand tranches, so each sits on one maker's spec-page layout and one mounting
system. Seven data tasks, 53 rows.

| # | tranche | air | AIO | rows |
|---|---|---|---|---|
| 2 | DeepCool | 6 | 3 | 9 |
| 3 | Thermalright | 6 | 3 | 9 |
| 4 | Arctic | 3 | 5 | 8 |
| 5 | Noctua | 6 | 0 | 6 |
| 6 | be quiet! | 5 | 1 | 6 |
| 7 | Cooler Master + Corsair | 2 | 6 | 8 |
| 8 | NZXT, Scythe, Lian Li, ID-Cooling | 3 | 4 | 7 |

Tasks 1, 9 and 10 are the code changes above, giving ten tasks in all.

## Risks

| risk | mitigation |
|---|---|
| The 154/155 height cluster is real and re-verification changes nothing | Fine — a re-read that confirms a value still converts an assumption into a fact with a URL. The clusters are a prompt to check, not a prediction |
| A socket dropped from a list silently refuses a valid build | The list is re-read whole, and the bracket convention is recorded in the note. Cross-row invariant: every one of the five tokens is claimed by at least one cooler, and no cooler names a token outside the closed set |
| A wrong product name, as in all four previous categories | Thirteen found so far. Check the maker's line-up before trusting a row's name; where a row is re-pointed, **keep its id** so saved builds and `/part/` URLs survive, and name the old value in the commit |
| Deleting `specs.radiator` breaks a site nobody listed | The GPU project's field deletion reached eight places. All four production reads plus one test are enumerated above; grep for the field before and after, and re-run the pre-render |
| A discontinued cooler's page is gone | be quiet! removes a discontinued product's page completely while search engines still index the dead URL, and its throttle returns an empty 200. Record `unverifiable` with what was checked; a dead page is not a missing spec |
| A low-profile cooler's height is quoted without its fan | One row already reads 37 mm. Height is the assembled height **with the stock fan at its shipped position**; where a maker publishes both, the assembled figure is the fact and the bare-heatsink figure goes in the note |

## Success criteria

- `npm run catalog:coverage` reports **cooler 53/53 verified**.
- `src/tests/partSources.test.js` passes with `cooler` in the ratchet, and the
  ratchet is proved **non-vacuous** — remove one source, watch it fail.
- **Zero `unverified` parts in either reference build.** Rule 4 answers for
  every AIO against every case, and `verdictSpread` records it.
- `specs.radiator` appears nowhere in `src/`, and the capacity ladder reads the
  verified number.
- The full suite green: lint, unit, e2e, build, sitemap and prerender drift.

## Explicitly not in this project

- **Radiator thickness, and the case-side field it would need.** See above.
- **Storage and RAM**, the next two projects. ⚠️ **Correcting an assumption
  recorded in the motherboard spec:** it states that rules 3 and 5 report
  `unverified` against an unresearched drive or kit. They do not. Both rules
  now find every field they read *present* — the board halves are researched,
  and `storageType`, `specs.sticks` and `capacityGb` have always existed — so
  they return real verdicts built on unverified data. The snapshot shows it:
  **storage 52 ok / 0 unverified, and RAM 35 ok / 17 blocked / 0 unverified.**
  Seventeen kits are refused today on numbers nobody checked. Rule 4's design —
  demanding a *new* field rather than trusting the old string — is the reason
  coolers are honest about their gap and these two are not, and it is the model
  the storage and RAM projects should follow.
- **CPU socket re-verification** (80 rows) and **fans and paste** (61 rows, no
  rule reads them). Later projects, in that order.
- `npm run catalog:push` and any push to `origin`. Both are the user's to run,
  and until the push happens none of this reaches a user.

---

## ✅ Outcome — DONE, 53/53, ratchet on

Executed on `feat/cooler-catalogue-research`, ten commits. Full detail in
`docs/superpowers/plans/2026-09-02-cooler-catalogue-research.md`.

**Every success criterion met**, and the headline one is the catalogue's:
**zero `unverified` parts in either reference build, across all ten
categories** — 20 of 20 snapshot rows. There is no longer a part in the
catalogue the compatibility engine cannot judge.

**29 of 53 rows carried a wrong value** — 2 names, 11 heights, 16 socket lists
— plus the 22 radiator sizes that did not exist at all.

### What the spec got right

- **`radiatorMm` as the nominal size** was correct and load-bearing. Makers
  publish 277 mm for a "240" and 398 mm for a "360"; a measured length would
  have matched nothing and blocked every AIO.
- **Conditional variants** were the right shape. The flat-list alternative
  would have passed a cooler carrying neither size field, and the test written
  for that case is the one that pins it.
- **Requiring `type`** paid off in an unexpected way — see below.
- **The bracket rule** turned out to be the single most load-bearing decision:
  it decided **eleven of the sixteen** socket corrections, and it resolved
  differently per maker. Arctic's LGA1200 kit is a EUR 9.99 purchase (excluded);
  Noctua's are free on request (included).

### What the spec got wrong

1. **The verdict snapshot moves at every AIO tranche**, not once at the end.
2. **Five production sites read `specs.radiator`, not four.** `partQuality.js`
   held a second private copy of the parser, and deleting the string without it
   would have flattened the AIO quality ranking to a tie **with no test
   failing**.
3. **`type` could not join the global `RESEARCHED_KEYS`.** Cases carry
   `specs.type` too — "Mid Tower", an unmeasured label — so the global list
   failed against 59 cases. It needed a per-category companion, the same split
   `RATCHETED_KEYS` already required.

### Correcting this spec's own correction

This spec noted that the motherboard spec was wrong to say rules 3 and 5 report
`unverified` for an unresearched drive or kit. That stands: **17 RAM kits are
still refused today on numbers nobody checked**, and storage still passes all
52 on an unverified `storageType`. Those two projects are next, and rule 4's
design — demanding a *new* field rather than trusting an old one — is the model
they should follow. It is the reason coolers were honest about their gap.

🛑 **Not shipped.** The branch is unmerged and unpushed, and the catalogue is
now out of step with Supabase. `npm run catalog:push -- --apply`, the merge and
the push are all the user's to run.
