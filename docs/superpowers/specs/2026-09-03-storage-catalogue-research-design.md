# Storage catalogue research: bringing 52 drives up to the research standard

Date: 2026-09-03

Sixth component tranche, after GPUs (79), cases (59), PSUs (53), motherboards
(70) and coolers (53). **Research protocol R in
`docs/superpowers/plans/2026-08-30-case-catalogue-research.md` is binding**, as
is protocol C's refinement in the cooler plan — the SKU-anchored extraction, the
maker's-KB-outranks-the-spec-table rule, and writing both data files with
`scripts/house-json.mjs`, never `JSON.stringify`.

## Problem

**Storage is a worse problem than the five categories before it, and the
snapshot hides that.** Every one of those was honestly `unverified` — the app
said "I cannot check this". Storage says nothing at all: **52 ok, 0 blocked,
0 unverified.** Rule 3 finds every field it reads already *present* and returns
a real verdict from data nobody checked.

Not one of the 52 rows has an entry in `data/partSources.json`.

### Rule 3 is running on an unverified branch selector

`m2Interface` in `src/lib/specRules.js:150` chooses its whole branch off
`storage.storageType`:

```js
if (!/nvme|m\.2/i.test(storage.storageType ?? '')) { …SATA port check… }
…M.2 slot check…
```

A drive typed wrongly is checked against **the wrong bus entirely** — and
because both branches currently pass for every catalogue board, the error is
invisible. The three values in use are `"NVMe SSD"` (37), `"HDD"` (9) and
`"SATA SSD"` (6), and none has ever been read off a maker's page.

### 🛑 The SATA-M.2 branch never fires for a real build

⚠️ **CORRECTED after checking the tests.** This section first said the branch
was "unreachable dead code". That is too strong: `src/tests/specRules.test.js`
already covers it with **synthetic** fixtures, and those tests pass.

The accurate statement is narrower and still worth fixing. Rule 3's blocked
case for an M.2 drive reads:

```js
const needsSata = storage.specs?.m2Sata === true
```

**No part in the catalogue carries `m2Sata`** — 0 of 52. So for any real build
`needsSata` is always false, every M.2 slot counts as usable, and the branch
cannot fire. The motherboard project researched the board half of this —
**25 of 70 boards have a SATA-capable M.2, and exactly one of those is AM5** —
and against real data that work is currently checked against a constant.

**Consequence for the plan:** no new rule-3 tests are needed. What the research
supplies is the *real* data that makes the existing, already-tested branch
exercisable — 37 drives carrying a researched boolean instead of nothing.

### 🛑 A live copy bug on 37 pre-rendered part pages

`src/lib/partPages.js:150`:

```js
add('Motherboard', part.storageType === 'NVMe' ? …M.2… : `A ${part.storageType} drive, connected by cable rather than an M.2 slot.`)
```

**No drive has `storageType === 'NVMe'`** — all 37 are `"NVMe SSD"`. The
equality is dead, so every NVMe drive's part page currently tells the reader:

> "A NVMe SSD drive, connected by cable rather than an M.2 slot."

That is false, it is shipped in `prerendered/`, and it is the kind of thing
[[copy-that-lives-in-data]] warns about: a defect that a grep of `src/` finds
only because the *comparison* is in code — the value it fails against is in
JSON.

⚠️ `partSynergy.js:110` reads the same field with `/HDD/i` and `/SATA/i`
regexes and is **not** affected. One reader is robust, one is exact-match. Only
the exact-match one broke, which is why nothing caught it.

### One inconsistent brand string

`storage-wd-sn580-2tb` has `brand: "Western Digital"`; the other ten WD drives
have `brand: "WD"`. It is the same maker, and the brand string is user-facing
filter text.

## Decisions

| | |
|---|---|
| Field set | `storageType` and `capacityGb` on all 52; `specs.readMbps` on all 52; **`specs.m2Sata` (new)** on the 37 NVMe |
| Ratcheted | `storageType` and `capacityGb` — both top-level, and rule 3 branches on the first |
| **Not collected** | **`m2FormFactor`** — see below |
| `tdp` | **Left exactly as it is.** No source, not in `EXPECTED`, not ratcheted |
| Bugs fixed | `partPages.js:150`'s dead equality; the `"Western Digital"` brand string |
| Out of scope | Write speed, endurance (TBW), DRAM cache, controller, NAND type, warranty, IOPS |
| Execution | Inline, six brand tranches, full suite green per tranche |
| Unpublished figures | `result: "unverifiable"` with a note, never a guess |

### 🛑 `m2FormFactor` is deliberately NOT collected

It is already in `RESEARCHED_KEYS`, and no part carries it. It should stay that
way, because **the board side has no counterpart to check it against.** Every
researched `m2Slots` entry is exactly `{ pcieGen, sata }` — 70 boards, and not
one slot carries a length. Collecting 2280/2242/22110 would produce a field no
rule can read.

This is the same call the cooler project made about radiator thickness, for the
same reason: **half a rule is worse than none.** Adding it needs a
motherboard-side project to research per-slot lengths first, and that is where
the decision belongs.

### `capacityGb` is ratcheted; `readMbps` is not

`capacityGb` is the number users compare drives on, it drives `pricePerGb`, the
`partQuality` ranking and `partSynergy`'s capacity advisory, and it is
trivially verifiable from any maker's page. It owes provenance.

`readMbps` is researched and sourced but **not ratcheted**: no rule blocks on
it, and it is a sequential-read headline that varies with capacity and test
conditions. It is required by `EXPECTED` — so a future drive owes a source —
but it does not join the top-level ratchet.

### Storage is the second conditional category

Like coolers, the required list depends on the part: **only an M.2 drive can
owe `m2Sata`.** A 3.5" HDD has no M.2 interface to describe.

`EXPECTED.storage` therefore uses the `variants` shape the cooler project added
to `catalog-coverage-core.mjs`, keyed on `storageType`:

- matches `/nvme|m\.2/i` → `storageType`, `capacityGb`, `readMbps`, `m2Sata`
- anything else → `storageType`, `capacityGb`, `readMbps`

⚠️ **The variant predicate must use the same regex rule 3 uses**, not an
equality. If the two ever disagree about what an M.2 drive is, coverage would
certify a drive against one definition while the rule checks another. That is
exactly the failure `partPages.js:150` already shipped.

### `m2Sata` is a boolean about the DRIVE's interface

`true` means the drive is an M.2 card speaking SATA, not NVMe — the kind that
fits only an M.2 slot wired for SATA. Every mainstream NVMe drive is `false`.

⚠️ **Record `false` explicitly; do not omit it.** An absent field and a
researched `false` are different claims, and `isResearched` treats a missing
value as a gap unless it carries an `unverifiable` marker.

## Tranches

Brand tranches, so each sits on one maker's spec-page layout. Six data tasks,
52 rows.

| # | tranche | rows |
|---|---|---|
| 2 | Samsung | 12 |
| 3 | Crucial | 11 |
| 4 | WD (incl. the mislabelled `Western Digital` row) | 11 |
| 5 | Seagate | 7 |
| 6 | Kingston | 5 |
| 7 | Toshiba, Lexar, Solidigm, TeamGroup | 6 |

Tasks 1, 8 and 9 are the code changes: coverage, the two bug fixes, and the
ratchet.

## Ordering constraints

1. **`m2Sata` is already in `RESEARCHED_KEYS`** — writing it without a source
   fails the suite today, before any change in this plan.
2. **`storageType`, `capacityGb` and `readMbps` can only join their lists at
   close-out.** All 52 rows carry the first two and `readMbps` unsourced, so
   adding any of them early fails instantly. This is the `rating`/`height`
   precedent, twice over.
3. ⚠️ **`readMbps` needs a per-category entry, not the global list** — `rpm` and
   `size` collisions are not an issue, but check before adding: the cooler
   project found `type` collided with 59 cases and needed
   `RESEARCHED_KEYS_BY_CATEGORY`. **Grep every category for the key before
   putting it in the global list.**

## Risks

| risk | mitigation |
|---|---|
| A wrong `storageType` sends a drive down the wrong branch of rule 3 | It is re-read for all 52 and ratcheted. Cross-row invariant: every row whose name says NVMe must match the M.2 regex, and no HDD may |
| Fixing `partPages.js:150` changes 37 pre-rendered pages | That is the point — they are wrong today. Re-run `npm run prerender` and read the diff |
| `m2Sata: false` on 37 drives looks like filler | It is a researched claim, not a default, and each carries a source. The one thing that would make it filler is inferring it from the product name instead of the maker's interface spec |
| Capacity is marketing GB vs binary GiB | The catalogue stores the maker's stated capacity (a "2TB" drive is `2000`), which is what every maker prints. Do not convert |
| A discontinued drive's page is gone | Five categories in, three makers have deleted pages and one delisted while keeping the URL live. Record `unverifiable` with what was checked |

## Success criteria

- `npm run catalog:coverage` reports **storage 52/52 (100%)**, other categories unchanged.
- `partSources.test.js` passes with `storage` in `VERIFIED_CATEGORIES`, proved **non-vacuous**.
- **Rule 3's SATA-M.2 branch is reachable** — a test pins that an `m2Sata: true`
  drive is blocked by a board whose every M.2 slot is `sata: false`.
- `partPages.js` no longer tells an NVMe drive's reader it connects by cable,
  and `prerendered/` is re-rendered.
- Lint, unit, e2e, build and prerender all green.

## Explicitly not in this project

- **`m2FormFactor` and per-slot board lengths.** See above.
- **Drive PCIe generation against the slot's.** A Gen5 drive in a Gen4 slot
  works, just slower — an advisory at most, and `buildWarnings` is where that
  would live, not a blocking rule.
- **RAM** (52 rows, 17 kits refused today on unverified data), then **CPUs**
  (80), then **fans + paste** (61, no rule reads them).
- `npm run catalog:push` and any push to `origin`. Both the user's to run —
  and `main` is already 15 commits ahead with the cooler tranche in it.

---

## ✅ Outcome — DONE, 52/52, ratchet on

Executed on `feat/storage-catalogue-research`, nine commits. Full detail in
`docs/superpowers/plans/2026-09-03-storage-catalogue-research.md`.

**Nine changed values across 52 rows** — six corrected read speeds, two
deletions, one brand string — plus 37 `m2Sata` booleans that did not exist, and
the two live defects fixed before the research began.

### What the spec got right

- **The two defects were real and worth fixing first.** 37 pre-rendered part
  pages told readers an NVMe drive connects by cable.
- **Refusing `m2FormFactor` was correct.** Nothing in the project produced a
  reason to want it, and the board side still has no slot lengths to check it
  against.
- **"Capacity is part of the SKU"** was the most valuable rule in the plan:
  three of six corrections are a row carrying a sibling capacity's figure.
- **Pinning coverage and rule 3 to one definition** with a test — the drift it
  guards against is the exact bug this project fixed.

### What the spec got wrong

1. **"Unreachable dead code" overstated rule 3's SATA-M.2 branch.**
   `specRules.test.js` already covered it with synthetic fixtures. The accurate
   claim — no *real* part carried `m2Sata`, so it could not fire for a real
   build — is narrower, and it meant the plan needed no new rule-3 tests.
   Corrected in place above.
2. **The spec assumed the maker's page would be there.** Eight of 52 drives
   could not be read off one, against roughly three per category before, and
   the user approved a documented secondary-source exception mid-project.

### The decision worth carrying forward

`unverifiable` deletes the field, and **that is safe for some categories and
not others**. `specSheetContent` tiers on `readMbps >= 400`, so an absent value
says *"spinning disk, cheap bulk storage"* — true of a Toshiba HDD, false of a
Crucial SSD. The same protocol step was therefore **refused for two rows and
applied to two others**. Check what a deletion renders before taking it.

### ⏭️ Next

**RAM (52 kits).** It is the last rule running on unverified data: rule 5
refuses **17 kits today** on `specs.sticks` and `capacityGb` nobody checked.
⚠️ `capacityGb` is shared between RAM and storage — this project put it in the
per-category ratchet for that reason, and the RAM project will meet the same
field from the other side. Then CPUs (80), then fans + paste (61).

🛑 **Not shipped.** `main` is far ahead of `origin` with two research tranches
in it and the Supabase catalogue out of step. The merge, the push and
`npm run catalog:push -- --apply` are all the user's to run.
