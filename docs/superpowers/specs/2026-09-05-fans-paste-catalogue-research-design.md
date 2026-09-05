# Fans + paste catalogue research: the last category, and the first with no ratchet

Date: 2026-09-05

Ninth and final component tranche, after GPUs (79), cases (59), PSUs (53),
motherboards (70), coolers (53), storage (52), RAM (52) and CPUs (79).
**Research protocol R in
`docs/superpowers/plans/2026-08-30-case-catalogue-research.md` is binding** — the
SKU-anchored extraction, the maker's-KB-outranks-the-spec-table rule, recording
provenance in `data/partSources.json`, and writing both data files with
`scripts/house-json.mjs`, never `JSON.stringify`.

## The structural first: provenance with no ratchet

Every prior category was brought up to standard because a compatibility rule read
its data and returned a verdict from numbers nobody checked. **Fans and paste are
different: no rule reads either.** A grep of `src/lib` for the two categories
finds only display (`specSheetContent.js`, `partPages.js`, `partStats.js`,
`partQuality.js`), ordering (`autoBuilder.js`, `recommendedOrder.js`,
`categories.js`) and the app's own power estimate (`perfEngine/power.js`'s
`STEADY` list). Not one is a compatibility check that blocks a build.

So this project has a shape the other eight did not:

- **No `VERIFIED_CATEGORIES` entry, no `RATCHETED_KEYS` entry** for either
  category. There is no block-driving top-level field to protect from
  regression, because there is no block.
- Enforcement is **only** the `RESEARCHED_KEYS` unit test in
  `partSources.test.js` (every present spec owes a source) plus the
  `catalog:coverage` report (`EXPECTED`). That pairing is enough: it makes the
  research a bijection — every displayed spec has a source, every source
  describes a real field — without asserting a compatibility guarantee that does
  not exist.

This is **provenance and data quality**, not verdict correctness. The value is
honest sourcing for the specs users actually see, and catching a wrong or phantom
row the way the CPU tranche caught `cpu-ryzen-9-9900` — an SKU AMD never shipped.

## Problem

**61 rows — 46 fans, 15 paste — and not one has an entry in
`data/partSources.json`.** The two categories are unlike each other, and the
research means something different for each.

### Fans: three displayed specs, all present, none sourced

Every fan carries `specs.size` (a string, `"120mm"`/`"140mm"`), `specs.count`
(1 or 3 — a single fan or a multi-pack) and `specs.rgb` (a boolean). All 46 rows
carry all three. They are **displayed**, not internal:

- `specSheetContent.js:127` renders `"${count}-pack of ${size} fans${rgb ? ' with RGB' : ''}"`.
- `partPages.js:223` renders `"${count(count,'fan')} at ${size}"`.

A wrong `size`, `count` or `rgb` is therefore a user-visible error, exactly the
kind the research standard exists to catch — it just does not flip a verdict,
because no rule reads it. This is RAM's shape one field set over:
re-verification and provenance, no new rule.

`count` is the field most like RAM's `sticks` — it is part of the SKU (a
"3-pack" is a distinct product from the single), and it must be read off the
maker's or retailer's listing, not inferred.

### Paste: no spec to source at all — today

The 15 paste rows carry `id`, `name`, `brand`, `price` and `tdp: 0`, and **no
`specs` object**. `partPages.js:13` records that paste is *"deliberately
absent"* from part pages, and `specSheetContent.js:130` returns a fixed generic
sentence that reads no per-part field:

> "Sits between the CPU and the cooler plate. Any quality paste performs within a
> degree or two, and a pea-sized dot is enough."

Price is owned by the separate snapshot. So in the established
`partSources` format — which only ever keys a **spec** field — there is nothing
on a paste row to source. Making paste researchable at all requires giving it one
real, verifiable, displayable spec. That decision follows.

## Decisions

| | |
|---|---|
| Fans field set | `specs.size`, `specs.count`, `specs.rgb` on all 46 — re-verified and sourced. No new field. |
| Paste field | **Add `specs.amountG`** (grams, a number) to all 15 — sourced. |
| Paste sheet | Enrich `specSheetContent.js`'s paste line to lead with the tube size, with a fallback to the current text when `amountG` is absent. |
| `type` on paste | **Not added.** All 15 are non-conductive grease; a `type` would be uniform and imply a conductivity rule that does not exist. |
| Ratchet | **None, either category** — no rule blocks on a fan or a paste. Neither joins `VERIFIED_CATEGORIES` or `RATCHETED_KEYS`. |
| Coverage | `EXPECTED.fans` and `EXPECTED.paste`, both flat (no variants) — every row owes every field. |
| Enforcement | `RESEARCHED_KEYS += ['size','count','rgb','amountG']` — all four verified category-exclusive, so the GLOBAL list is safe. |
| `tdp` | **Left exactly as it is** on both. A fan's 2–6 W and a paste's 0 W are the app's own draw figures for `perfEngine/power.js`; no maker publishes them. Same call as the motherboard/PSU/cooler `tdp`. |
| Out of scope | Fan airflow (CFM), noise (dBA), PWM-vs-DC, bearing, connector; paste conductivity/viscosity/type; a paste **part page**. See below. |
| Execution | Inline, brand tranches (fans + paste of one maker together), full suite green per tranche. |
| Unpublished figures | `unverifiable` with a note, never a guess. |

### Why `amountG` is a real spec, not filler

The tube weight is **the SKU differentiator**, not decoration:

- **Arctic MX-6** is in the catalogue twice — `(4g)` and `(8g)`.
- **Noctua NT-H2** is in the catalogue twice — `(3.5g)` and `(10g)`.

Same product, same performance, different SKU, distinguished only by the amount.
It is printed in 14 of the 15 names, stated on every maker's product page, and it
is a genuine purchase attribute (a 1 g tube is one application; a 10 g tube is
many). It earns a spec field the way a fan's `size` does.

**`type` does not.** Were there a liquid-metal compound in the set — Thermal
Grizzly Conductonaut and its kin, which are electrically conductive and must not
touch an aluminium fin or a surface-mount component — `type` would be a real
safety distinction and a candidate future warning. There is none: all 15 are
grease. A field uniform across every row records nothing and invites a
half-a-rule nobody asked for. Left out, per the RAM/storage "the app has nothing
to check it against" call.

### The one paste row with no amount in its name

`Cooler Master MasterGel Pro` carries no `(Ng)` in its name. Its `amountG` is
researched off Cooler Master's page like any other figure; if the retail SKU's
fill weight is genuinely unpublished, it is recorded `unverifiable` with a note —
not guessed. The other 14 amounts are cross-checked against the maker page, not
copied from the name string.

### Out of scope — the `m2FormFactor` call, one last time

- **Fan CFM / static pressure / dBA / PWM-vs-DC / bearing / connector.** Real fan
  specs, but the app stores and checks none of them, and there is no case- or
  cooler-side field they pair with. A number no rule reads and no sheet shows is
  half a rule; not collected.
- **Paste conductivity / viscosity / thermal W·m⁻¹K⁻¹.** No rule, no paired
  field, and (conductivity aside, which is moot with no liquid metal present)
  pure spec-sheet trivia here.
- **A paste part page.** Paste is deliberately excluded from `PART_CATEGORIES` in
  `partPages.js` today. Adding `amountG` does not change that: 15 new prerendered
  routes for a single one-number spec is not worth the payload, and the enriched
  spec sheet already surfaces the figure where a paste is selected. Sheet
  enrichment only; the part-page exclusion stands.

## Wiring the coverage (and pointedly not the ratchet)

The same two files every prior category touched — `catalog-coverage-core.mjs`
and `partSources.test.js` — but, unlike every prior category, **no ratchet edits
within them**:

1. **`EXPECTED.fans`** (`catalog-coverage-core.mjs`) — a flat required list:
   `required: ['size', 'count', 'rgb']`, `optional: []`.
2. **`EXPECTED.paste`** — flat: `required: ['amountG']`, `optional: []`.
3. **`RESEARCHED_KEYS`** (`partSources.test.js`) gains **`'size'`, `'count'`,
   `'rgb'`, `'amountG'`**. Verified safe in the GLOBAL list: a catalogue scan
   shows `specs.size`, `specs.count` and `specs.rgb` are carried by fans and
   **no other category** (46 parts, all `fans`), and `specs.amountG` exists
   nowhere until this project adds it to paste — the same category-exclusivity
   property that let `sticks`, `height`, `readMbps`, `cores` and `boostClock` go
   global.
4. **No `VERIFIED_CATEGORIES` change. No `RATCHETED_KEYS` change.** This is the
   whole point of the category: there is no block-driving field to ratchet.
   `missingRatchetSources` never sees fans or paste, and that is correct.

### Ordering constraints (the `rating`/`height`/`readMbps`/`sticks`/`cores` precedent, a sixth time)

1. **The four keys join `RESEARCHED_KEYS` only at close-out.** All 46 fans carry
   `size`/`count`/`rgb` and all 15 paste will carry `amountG` before the keys are
   listed; adding a key before every row has a source fails the suite instantly.
2. **`fans` and `paste` reach `EXPECTED` only at close-out** — the coverage
   number is a report, but a half-sourced category reads as a regression until
   every row is done.
3. **`specs.amountG` is added to the 15 paste rows before or with its sources,
   never after the key is enforced.** The enriched sheet must tolerate a missing
   `amountG` (fallback text) so the intermediate state — some paste rows carrying
   the field, some not — renders correctly during the run.

## Tranches

Brand tranches, so each sits on one maker's page layout, and a maker who makes
both fans and paste is done in a single pass. Distribution measured:

- **Fans (46):** Arctic 12, Noctua 10, be quiet! 5, Lian Li 5, Corsair 5,
  Thermalright 2, Phanteks 2, DeepCool 2, Thermaltake 1, NZXT 1, Cooler Master 1.
- **Paste (15):** Thermal Grizzly 4, Arctic 3, Noctua 3, Cooler Master 2,
  Corsair 1, Thermalright 1, Gelid 1.

| # | tranche | rows |
|---|---|---|
| 1 | code: enrich the `specSheetContent.js` paste line (fallback-safe) | — |
| 2 | Arctic (12 fans + 3 paste) | 15 |
| 3 | Noctua (10 fans + 3 paste) | 13 |
| 4 | be quiet! (5 fans) + Lian Li (5 fans) | 10 |
| 5 | Corsair (5 fans + 1 paste) + Thermal Grizzly (4 paste) | 10 |
| 6 | tail: Thermalright (2 fans + 1 paste), Phanteks (2), DeepCool (2), Thermaltake (1), NZXT (1), Cooler Master (1 fan + 2 paste), Gelid (1 paste) | 13 |
| 7 | close-out: `EXPECTED.fans`/`.paste`, `RESEARCHED_KEYS` += 4 keys, re-prerender | — |

Each data tranche adds that maker's `amountG` **value and source together** with
its fans' `size`/`count`/`rgb` sources; the full suite is green per tranche.
Exact boundaries may shift in the plan, but the maker-grouping and the
code-first / close-out-last frame are fixed.

## Risks

| risk | mitigation |
|---|---|
| A key added to `RESEARCHED_KEYS` before all rows are sourced turns the suite red | The four keys join only at close-out — the sixth time this exact ordering rule applies |
| Adding `specs.amountG` and enriching the sheet changes prerendered paste pages | Expected — the sheet is generic today. Re-run `npm run prerender` and read the diff |
| The enriched sheet renders `undefined` for a paste row mid-run | The paste line falls back to the current generic text whenever `amountG` is absent |
| A fan `count` is wrong — a single sold as a 3-pack or vice-versa | Read off the SKU/listing, not inferred. Cross-check: a "3-pack" name must carry `count: 3` |
| A phantom fan or paste product, like `cpu-ryzen-9-9900` | Existence is part of verification. A row with no maker/retailer page is removed or re-pointed; **deleting a part reaches partsData.json, partSources.json and any preset/build that references its id** — grep the id before removing |
| Same name, different SKU (MX-6 4g/8g; NT-H2 3.5g/10g) | Source each row's `amountG` to its own SKU page, not the product family |
| `rgb: false` looks unsourceable | A present boolean is a real value; the source is the product page confirming the fan has no lighting. `isResearched` treats `false` as present |
| `size` stored as a string (`"120mm"`) invites a schema "tidy" | Keep the existing string format; the research verifies the value, it does not reshape the field |

## Success criteria

- `npm run catalog:coverage` reports **fans 46/46 (100%)** and **paste 15/15
  (100%)** — two new category lines, ten in total — with the other eight
  unchanged.
- `partSources.test.js` passes with `size`, `count`, `rgb`, `amountG` in
  `RESEARCHED_KEYS`, **proved non-vacuous** (removing one fan `size` or one paste
  `amountG` source turns the suite red).
- `specSheetContent.js` renders a paste's tube size, and `prerendered/` is
  re-rendered.
- Every fan `size`/`count`/`rgb` and every paste `amountG` carries a
  `partSources.json` entry, or is `unverifiable` with a note.
- Lint, unit, e2e, build and prerender all green.

## Explicitly not in this project

- **Fan CFM/dBA/PWM/bearing/connector; paste conductivity/viscosity/type; a paste
  part page.** See above.
- **A fan- or paste-driven compatibility block.** There is none, and none is
  being added — a fan clearance rule would need a case- or cooler-side field that
  does not exist.
- **Any category after this one.** Fans + paste is the last. With it done, every
  one of the ten catalogue categories that a rule *or a spec sheet* reads runs on
  sourced data.
- `npm run catalog:push` and any push to `origin`. Both the user's to run —
  `main` is already far ahead with the cooler, storage, RAM and CPU tranches plus
  the site-quality backlog in it, none of it pushed.
