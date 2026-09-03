# RAM catalogue research: bringing 52 kits up to the research standard

Date: 2026-09-03

Seventh component tranche, after GPUs (79), cases (59), PSUs (53), motherboards
(70), coolers (53) and storage (52). **Research protocol R in
`docs/superpowers/plans/2026-08-30-case-catalogue-research.md` is binding** — the
SKU-anchored extraction, the maker's-KB-outranks-the-spec-table rule, recording
provenance in `data/partSources.json`, and writing both data files with
`scripts/house-json.mjs`, never `JSON.stringify`.

## Problem

**RAM is the last category whose rules return real verdicts from data nobody
checked, and the snapshot hides it the same way storage did.** All 52 kits are
`ok` — no kit is `unverified`, because every field the rules read is already
*present*. Not one of the 52 rows has an entry in `data/partSources.json`.

Two rules read a kit, and both run on unverified numbers:

### `compatibility.js` blocks on `ramType`

`compatibility.js:45-62` is the platform match, and it blocks in three
directions off `ramType`:

- a kit whose `ramType` ≠ the board's is refused (`:50`),
- a board whose `ramType` ≠ the kit's is refused (`:45`),
- a DDR4 kit on a DDR5-only socket — `AM5`, `LGA1851` — is refused (`:56`,`:61`).

**17 of 52 kits are DDR4.** Every one of those blocks rests on a `ramType`
string no one has read off a maker's page.

### Rule 5 (`ramFit`) blocks on `sticks` and `capacityGb`

`specRules.js:215` reads two RAM fields:

```js
if (sticks > slots)          → blocked  // ram.specs.sticks  vs board.ramSlots
if (ram.capacityGb > maxGb)  → blocked  // ram.capacityGb    vs board.maxRamGb
```

The board halves — `ramSlots` and `maxRamGb` — were verified by the motherboard
project (slots: 14 boards at 2, 56 at 4; maxRamGb: 64→4 boards, 96→2, 128→22,
192→7, 256→35). **The RAM halves were not.**

### ⚠️ The memory's "rule 5 refuses 17 kits" does not survive checking

Measured against the verified boards, rule 5 (`ramFit`) blocks **4 pairings, 1
distinct kit** today: the lone 96 GB kit against the four boards that cap at
64 GB. `sticks > slots` fires **zero** times — every kit is ≤ 2 sticks and the
smallest board has 2 slots.

The written-down "17" is the **DDR4 count**, which drives `compatibility.js`,
not `ramFit`. The number is corrected here; the framing it was attached to still
holds — 52 kits' worth of `ramType`, `capacityGb`, `sticks` and `speed` feed
real verdicts unverified.

### 🛑 The suspect field is `sticks`: 2 on 50 of 52

`specs.sticks` is `2` on 50 rows and `1` on the two 8 GB DDR4 kits. That
uniformity is the tell — the kit layout is **part of the SKU**, and it was
defaulted, not read:

- **13 kits are 16 GB.** Some are a single 1×16 module, some a 2×8 pair. Only the
  maker's part number says which, and all 13 currently claim 2.
- **64 GB DDR4** can be 2×32 or 4×16; **96 GB** and **48 GB** DDR5 are 2×48 /
  2×24. Each needs the layout read, not inferred.

A wrong `sticks` is a *silent under-block*: a 4-stick kit mislabelled 2 is waved
onto a 2-slot mini-ITX board it cannot physically populate. That is worse than a
false block, because nothing surfaces it. This is storage's "capacity is part of
the SKU" finding, one field over.

### 🛑 A live pluralisation bug on shipped part pages

`specSheetContent.js:98`:

```js
return `${part.capacityGb}GB across ${s.sticks ?? 2} sticks of ${part.ramType}-${part.speed}. `
```

`"sticks"` is hardcoded. The two single-DIMM 8 GB kits already render, on their
shipped `SpecSheet`/`PartPage`:

> "8GB across **1 sticks** of DDR4-3200."

`partPages.js:145` reads the same field through `count(n, 'stick')`
(`partPages.js:56`), which pluralises correctly. Two readers, one robust, one
not — exactly storage's `partPages.js` cable bug, and exactly what
[[copy-that-lives-in-data]] warns about. Correcting more kits to `sticks: 1`
spreads the defect, so the pluralisation is fixed **before** the research.

### No new field, no new rule

Unlike storage — which added `m2Sata` — every field the RAM rules read already
exists (`ramType`, `capacityGb`, `speed`, `specs.sticks`). No reader references a
RAM spec that is absent from the data, so there is no phantom read to add and no
new rule to write. This project is **re-verification, provenance, and the
ratchet** — plus the one copy fix above.

The brand strings are already consistent (Corsair 13, G.Skill 15, Kingston 8,
TeamGroup 7, Crucial 6, Patriot 3 = 52); there is no `"Western Digital"`/`"WD"`
split to repair.

## Decisions

| | |
|---|---|
| Field set | `ramType`, `capacityGb`, `speed` (top-level) and `specs.sticks` on all 52 |
| Ratcheted | `ramType` and `capacityGb` — both top-level and block-driving, via `RATCHETED_KEYS.ram`; `sticks` via the global `RESEARCHED_KEYS` |
| Required but **not** ratcheted | `speed` — sourced and demanded by coverage, but no ratchet (see below) |
| `tdp` | **Left exactly as it is.** The 3-8 W is the app's own draw estimate, no maker publishes it, and no rule blocks on it. Same call as the motherboard/PSU/cooler `tdp`. |
| Bug fixed first | `specSheetContent.js:98`'s hardcoded `"sticks"` |
| Out of scope | CAS/timings, voltage, rank, height, CUDIMM board-support — see below |
| Execution | Inline, five brand tranches, full suite green per tranche |
| Unpublished figures | `unverifiable` with a note, never a guess |

### `speed` is sourced but not ratcheted

`speed` is the kit's rated XMP/EXPO transfer rate — the number in every product
name. It feeds **advisories only**: `buildWarnings.js:51` (a kit faster than the
board's rated speed "runs slower unless the board's profile supports it"),
`perfEngine/memory.js:47`, and `partQuality.js:34`. No rule *blocks* on it; the
`ramFit` header says so outright.

So it takes storage's `readMbps` treatment: **required by `EXPECTED` (so a future
kit owes a source) and sourced for all 52, but out of the ratchet.**

⚠️ **One asymmetry, recorded so it is not mistaken for an omission:** `readMbps`
is a `specs.*` field, so it earns unit-test enforcement by sitting in
`RESEARCHED_KEYS`. `speed` is **top-level**, and that list reads `part.specs`
only — so a sourced `speed` is demanded by the coverage *report*
(`EXPECTED.ram.required`) but not by a unit test. This is exactly the status
GPU's `vram` and `memType` already carry: required by `EXPECTED.gpu` yet listed
in neither `RESEARCHED_KEYS` nor `RATCHETED_KEYS`. It is acceptable precisely
because no rule blocks on `speed`: the worst a missing source can do is drop the
`catalog:coverage` count below 52, which is visible.

### Out of scope — the `m2FormFactor` call, three times over

None of these is collected, because **the app has nothing to check them
against**, and half a rule is worse than none:

- **CAS latency / timings / voltage / rank.** No rule reads them; no board field
  pairs with them. Pure spec-sheet trivia here.
- **DIMM height vs cooler clearance.** A real physical constraint — tall RGB kits
  foul big air coolers — but there is no cooler-side RAM-clearance figure in the
  catalogue, so a kit height would be a number no rule could read.
- **CUDIMM board-support.** One kit (`G.Skill Trident Z5 CK CUDIMM DDR5-8000`)
  needs a CUDIMM-capable board or it runs in bypass at a lower speed. There is no
  board-side CUDIMM flag, so this is at most a future `buildWarnings` advisory
  paired with a motherboard-side project — not this one.

## Wiring the coverage and the ratchet

Four edits in two files, mirroring storage:

1. **`EXPECTED.ram`** (`catalog-coverage-core.mjs`) — a **flat** required list
   (RAM is not conditional like coolers/storage; every kit owes all four):
   `required: ['ramType', 'speed', 'capacityGb', 'sticks']`, `optional: []`.
2. **`RATCHETED_KEYS.ram`** = `['ramType', 'capacityGb']`. Per-category, so the
   `capacityGb` already ratcheted for storage does not collide — it is a
   different category key.
3. **`RESEARCHED_KEYS`** (`partSources.test.js`) gains **`'sticks'`**. Verified
   safe in the *global* list: `specs.sticks` is carried by RAM and **no other
   category** (52 parts, all `ram`), the same property that let `readMbps`,
   `height` and `rating` go global.
4. **`VERIFIED_CATEGORIES`** gains **`'ram'`**, switching the top-level ratchet
   on.

### Ordering constraints (the `rating`/`height`/`readMbps` precedent, a fourth time)

1. **`sticks` joins `RESEARCHED_KEYS` only at close-out.** All 52 rows carry
   `specs.sticks` today; adding the key before every row has a source fails the
   suite instantly.
2. **`ram` joins `VERIFIED_CATEGORIES` only at close-out.** `missingRatchetSources`
   would demand a `ramType` and `capacityGb` source for all 52 the moment the
   category is listed.
3. **`speed`, `ramType`, `capacityGb` reach `EXPECTED.ram.required` only at
   close-out** — the coverage number is a report, but a half-sourced category
   reads as a regression until every row is done.

## Tranches

Brand tranches, so each sits on one maker's spec-page layout. Five data tasks,
52 rows; three code tasks around them.

| # | tranche | rows |
|---|---|---|
| 1 | code: `EXPECTED.ram` + the `specSheetContent.js` bug fix | — |
| 2 | G.Skill | 15 |
| 3 | Corsair | 13 |
| 4 | Kingston | 8 |
| 5 | TeamGroup | 7 |
| 6 | Crucial (6) + Patriot (3) | 9 |
| 7 | close-out: `RESEARCHED_KEYS` += `sticks`, `VERIFIED_CATEGORIES` += `ram`, ratchet on, re-prerender | — |

## Risks

| risk | mitigation |
|---|---|
| A wrong `sticks` waves a 4-stick kit onto a 2-slot board | Every layout is read off the maker's part number, not the capacity. Cross-check: a kit's `capacityGb` must be divisible by its `sticks` into a real DIMM size (8/16/24/32/48) |
| A single-DIMM 16 GB kit is really a 2×8 pair, or vice versa | The maker's SKU distinguishes "kit of 2" from a single module; record what the page states, `unverifiable` if it does not |
| Fixing `specSheetContent.js:98` and correcting `sticks` changes prerendered pages | Expected — they are wrong today. Re-run `npm run prerender` and read the diff |
| `speed` looks ratchet-worthy and gets ratcheted by reflex | It is deliberately not — no rule blocks on it. Adding it to `RATCHETED_KEYS` was offered and declined |
| A discontinued kit's page is gone | Six categories in, this recurs. Record `unverifiable` with what was checked; storage's secondary-source exception is available if a maker page is unreadable |
| `capacityGb` is marketing GB | RAM is binary — a "32GB" kit is 32 GiB — and every maker prints the same number. Store it as stated |

## Success criteria

- `npm run catalog:coverage` reports **ram 52/52 (100%)**, other categories unchanged.
- `partSources.test.js` passes with `ram` in `VERIFIED_CATEGORIES` and `sticks`
  in `RESEARCHED_KEYS`, **proved non-vacuous** (removing one `ramType` or
  `sticks` source turns the suite red).
- `specSheetContent.js` never renders "1 sticks", and `prerendered/` is re-rendered.
- Every corrected `sticks`/`capacityGb`/`ramType`/`speed` value carries a
  `partSources.json` entry; every unpublished one is `unverifiable` with a note.
- Lint, unit, e2e, build and prerender all green.

## Explicitly not in this project

- **CAS/timings/voltage/rank, DIMM height, CUDIMM board-support.** See above.
- **A speed-vs-board *block*.** A kit faster than the board still runs; that is
  `buildWarnings`, not a compatibility refusal, and it already exists.
- **CPUs** (80), then **fans + paste** (61, no rule reads them) — the categories
  after this one.
- `npm run catalog:push` and any push to `origin`. Both the user's to run —
  and `main` is already far ahead with the cooler and storage tranches in it.

---

## ✅ Outcome — DONE, 52/52, ratchet on

Executed on `feat/ram-catalogue-research`, eight commits. Full detail in
`docs/superpowers/plans/2026-09-03-ram-catalogue-research.md`.

**Four data corrections across 52 kits** — three single-DIMM `sticks` fixes
(Corsair, TeamGroup, Crucial 16GB DDR5, all `2 → 1`) and one re-point (G.Skill
Ripjaws S5 16GB → 32GB, a product G.Skill does not make), plus the pluralisation
bug fixed first.

### What the spec got right

- **The pluralisation bug was real and shipped** — two 8GB kits rendered "1 sticks".
- **The single-DIMM hypothesis landed**, narrowly: 3 of ~13 16GB kits, all DDR5
  16GB budget/entry parts whose maker offering *at that speed* is a single 1×16.

### What the spec got wrong

1. **`sticks:2` was far less suspect than feared.** 48 of 52 were correct. The
   "64GB DDR4 = 4×16" worry did not materialise (Corsair's is 2×32), and no 32GB+
   kit was a single. Kit-branded lines (Kingston Fury, Ballistix, Viper Steel,
   Ripjaws V/Aegis) sell real 2×8 kits at 16GB and correctly kept `sticks:2`.
2. **The memory's "17 kits refused" was wrong** — corrected in this spec before
   work began. Rule 5 blocks 4 pairings / 1 kit; 17 is the DDR4 count.

### The decision worth carrying forward

**A wrong stick count is a provenance problem, not a live-verdict problem here.**
`verdictSpread` did not move: a `2 → 1` correction cannot flip rule 5, so the
value of the research is the sourcing and the displayed copy, not a changed
compatibility answer. Contrast storage, where a `storageType` correction *could*
have flipped rule 3's branch — RAM's block-driving field (`sticks`) is bounded
below the board's slot count in every real build.

### ⏭️ Next

**CPUs (80)**, then **fans + paste (61)**. 🛑 **Not shipped** — the merge, push
and `npm run catalog:push -- --apply` are all the user's to run.
