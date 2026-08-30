# GPU catalogue research: bringing 79 cards up to the research standard

Date: 2026-08-28

## Problem

The compatibility engine gained six spec-driven rules at `2171ed0`, and they
check almost nothing. No part carries the researched fields, so every rule
reports `unverified` for the whole catalogue. The engine is built; the data is
not there.

Worse, the data that *is* there is not trustworthy. The GPU catalogue holds
**79 cards with only 28 distinct lengths**, and the clustering is not credible
as measured data:

| length | cards | why it cannot be real |
|---|---|---|
| 267 mm | **19 AMD cards** | spans RX 6500 XT to RX 9070 XT — tiny to flagship |
| 200 mm | 7 | includes an Arc A380 *and* an RTX 5060 |
| 229 mm | 7 | every Turing card, one number |
| 336 mm | 3 | 4070 Ti, 4080, 4080 Super |

These are per-generation placeholder buckets. One of them has already been
proved wrong: `gpu-rtx-4090` carried 336 mm, and NVIDIA's own page gives the
Founders Edition as **304 mm** — an error of 32 mm, in the field that decides
whether the app tells somebody a card fits their case.

### Evidence that this is not hypothetical

The 4090 correction landed at `750ce88` after being read off NVIDIA's spec page
and cross-checked against The FPS Review. Correcting it changed real behaviour:
the card now fits **8 cases** it had been wrongly blocked from (320–335 mm
clearance). Every one of those was a build the app refused to let somebody make,
on the strength of a number nobody had checked.

## Decisions

Taken with the user during brainstorming. Do **not** re-litigate these.

| | |
|---|---|
| What a part represents | **Reference/Founders card where one exists; otherwise one named, purchasable partner card**, with `name` changed to match |
| `id` | **FROZEN, always.** Only `name` changes |
| Unverifiable values | **Delete the field.** The rule then reports `unverified` rather than blocking on a guess |
| Enforcement | A **per-category provenance ratchet**, plus a coverage report |
| Cadence | **Pilot of six, then user review**, then vendor/generation tranches |

## Identity: what each catalogue GPU is

The names are generic — "NVIDIA GeForce RTX 4070 Ti" — but real cards differ by
board partner in exactly the dimensions that matter. Rule 4 of the research
standard says exact SKU, never product family. So each part is pinned to one
real product:

- **A reference design exists** (RTX 4090 FE, RX 7900 XTX reference, …) →
  research that card. `name` is already correct and does not change.
- **No reference design exists** → NVIDIA never made a Founders Edition of the
  4070 Ti, 4060 Ti, 4060 or 5070 Ti; many AMD and Intel SKUs are AIB-only.
  Pick **one real, currently purchasable partner card** and set `name` to it,
  e.g. `NVIDIA GeForce RTX 4070 Ti` becomes `ASUS Dual RTX 4070 Ti OC`.

The `name` plus the `partSources` URL together state exactly which product every
figure came from. No separate "which card is this" field is needed.

### ⚠️ `id` must never change

Three things key off it, and all three break silently:

1. **Shared and saved builds.** `src/lib/buildCodec.js` encodes `part.id` into
   the share payload. A changed id makes every existing link drop that part.
2. **The benchmark corpus.** `data/benchmarks/entries.json` references **41
   distinct `gpuId` values**. A changed id orphans that card's benchmark rows and
   silently degrades the perf model to its spec-derived prior.
3. **SEO.** `public/sitemap.xml` publishes `/parts/<id>` for every part, and
   those URLs are pre-rendered and indexed.

So `gpu-rtx-4070ti` will keep its id while displaying a partner card's name.
That mismatch is intentional and harmless.

## Fields researched per card

Eight, all obtainable from one manufacturer product page.

| field | type | notes |
|---|---|---|
| `length` | number (mm) | **re-verified**; today's values are placeholders |
| `tdp` | number (W) | **re-verified**; the board power / TGP figure |
| `specs.slotsThick` | number | drives the case expansion-slot rule |
| `specs.pcieGen` | number | advisory only — PCIe is backward compatible |
| `specs.powerConnectors` | map | e.g. `{ "12vhpwr": 1 }` or `{ "pcie8": 3 }` |
| `specs.adapterFrom` | map | **only when an adapter actually ships in the box** |
| `specs.vram` | number (GB) | verified in passing |
| `specs.memType` | string | verified in passing |

⚠️ `adapterFrom` is not a fallback or a guess. It records that the manufacturer
bundles an adapter, which is a second legitimate way to satisfy the card. Absent
adapter, absent field.

## The unverified contract

When a figure cannot be confirmed against a manufacturer page — a discontinued
card whose page is gone, a spec the page does not state — **the field is
deleted**, not kept and not guessed.

Consequences, accepted deliberately:

- The relevant rule reports `unverified`, which is `compatible: true`, so the
  part is **not** locked. The app blocks *less* than it does today.
- No `partSources` entry is written for a deleted field, so the bijection guard
  (`every source describes a spec that exists`) stays satisfied.
- A card can end up with no `length` at all. That is the honest state: we do not
  know how long it is, so we do not claim to check whether it fits.

This is the same call the project already made for `coolerCapacity`, where 0
meaning "unknown" printed a literal zero and was replaced by hiding the row.

## Provenance ratchet

`src/tests/partSources.test.js` today requires a source for any of the 18
researched `specs.*` keys. It does **not** cover top-level fields, which is
exactly how a wrong `length` sat unnoticed. Turning that on globally would fail
for all 559 parts at once.

Instead, a `VERIFIED_CATEGORIES` allowlist:

```js
// A category joins this list only when every part in it has been researched to
// the standard. From then on its top-level length/tdp need sources too, so the
// category cannot silently regress.
const VERIFIED_CATEGORIES = new Set([])   // 'gpu' added by the final tranche
const RATCHETED_KEYS = ['length', 'tdp']
```

`gpu` is added by the last tranche, not the first. Until then GPUs are held to
the existing `specs.*` rule only.

### Coverage report

`npm run catalog:coverage` — per category, how many parts carry each expected
field and how many of those have provenance. Computed from `partSources.json`
and `partsData.json`, so it cannot drift from reality. It answers "how far along
is this" without anybody maintaining a checklist, and every later category
inherits it.

## Tranches

Each tranche ends with: guards green, coverage report, commit.

The catalogue breaks down as: NVIDIA 29 current + 17 legacy, AMD 23 current +
4 legacy, Intel 6 current + 0 legacy. 79 total, 58 current, 21 legacy.

| # | scope | count | running total |
|---|---|---|---|
| 0 | **Pilot** — RTX 4090 (already done, `750ce88`, the worked example), one no-FE NVIDIA card, one legacy card, one AMD reference card, one AMD AIB-only card, one Intel Arc | 6 | 6 |
| — | 🛑 **STOP for user review** — convention, naming and record shape confirmed before scaling | | |
| 1 | NVIDIA, current, less the 2 in the pilot | 27 | 33 |
| 2 | AMD, current, less the 2 in the pilot | 21 | 54 |
| 3 | Intel Arc, less the 1 in the pilot | 5 | 59 |
| 4 | Legacy, less the 1 in the pilot | 20 | 79 |
| 5 | Add `gpu` to `VERIFIED_CATEGORIES`; full verification | — | 79 |

The pilot deliberately mixes the hard cases: a card with a reference design and
one without, a legacy card whose page may be gone, both AMD situations, and
Intel. A wrong convention shows up after six cards instead of seventy-nine.

## Testing

Existing guards that must stay green throughout:

- `partSources.test.js` — both directions: every researched spec has a source,
  and every source describes a spec that exists.
- `specSheetNonScalar.test.js` — no `[object Object]` anywhere in the catalogue.
  ⚠️ **Every field added here appears on the public info sheet**, because
  `specSheetContent.specRows` prints every entry in `part.specs`.
- `specRules.test.js`, `compatibility.test.js` — rule behaviour.
- `catalogDiff.test.js` — drift detection between repo and live.

New:

- **Ratchet test** — for a category in `VERIFIED_CATEGORIES`, a top-level
  `length` or `tdp` without a source fails, by name. Must be proved non-vacuous
  the way the original provenance guard was: add an unsourced value, watch it
  fail, revert.
- **Coverage report** has a pure, unit-tested core, like `catalog-diff-core`.

⚠️ Expect `getLockedReasons` behaviour to change as data lands. That is the
point, but each tranche should report how many parts moved between `ok`,
`blocked` and `unverified`, so a surprise is visible rather than buried.

## Out of scope

- **`perfScore`** — a curated ranking, not a manufacturer spec.
- **`price`** — stale by nature, and not what this standard is about.
- **All non-GPU categories.** PSUs and cases are the natural next spec, since
  they are the other half of the connector and clearance rules.
- **The Supabase push.** `npm run catalog:push -- --apply` needs a service role
  key and writes to production; the user runs it. Each tranche should end by
  noting that rows are waiting.
- **CPU ↔ chipset/BIOS**, still deferred by earlier decision.

## Uncertain / to confirm during implementation

- **How many legacy cards still have a live manufacturer page.** If most do not,
  tranche 4 mostly deletes fields, and it is worth checking with the user whether
  that is the outcome they want before doing all 21.
- **Whether a partner card chosen today stays purchasable.** Nothing re-checks
  it. The `checkedOn` date is the only signal, and no test enforces freshness.
- **Whether shoppers should see `pcieGen` and `slotsThick`** on the info sheet at
  all, now that they render there. They are useful; they are also clutter on a
  card that already lists eight rows.
