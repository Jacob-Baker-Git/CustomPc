# CPU catalogue research: bringing 80 processors up to the research standard

Date: 2026-09-03

Eighth component tranche, after GPUs (79), cases (59), PSUs (53), motherboards
(70), coolers (53), storage (52) and RAM (52). **Research protocol R in
`docs/superpowers/plans/2026-08-30-case-catalogue-research.md` is binding** — the
SKU-anchored extraction, recording provenance in `data/partSources.json`, and
writing both data files with `scripts/house-json.mjs`, never `JSON.stringify`.

## Problem

**CPUs are the largest source of real verdicts running on unverified data in the
whole catalogue.** All 80 CPUs are `ok`/verdicted, and not one has an entry in
`data/partSources.json`. Two rules read a processor, and both block:

### 🛑 `socket` — the single biggest verdict-driver in the catalogue

`compatibility.js` hard-blocks on `cpu.socket` in three directions:

- **CPU ↔ motherboard** (`:35`, `:40`) — measured, **4041 of 5600 CPU×board
  pairings are blocked today** on socket mismatch. 72% of the grid.
- **CPU ↔ cooler** (`:103`, `:108`, `:113`) — 138 of 4240 CPU×cooler pairings
  blocked, where a cooler's `sockets` list omits the CPU's socket.
- **CPU → DDR type** (`:56`) — `DDR5_ONLY_SOCKETS = ['AM5', 'LGA1851']` reads
  `cpu.socket` to refuse a DDR4 kit on a DDR5-only platform.

The **board** side (`socket`) was verified by the motherboard project and the
**cooler** side (`sockets`) by the cooler project. **The CPU side was never
verified.** A wrong `cpu.socket` string refuses a correct build, or admits an
impossible one, in silence — and it is the axis the whole build is anchored on.

The five tokens in use — `AM5` (26), `LGA1700` (29), `LGA1851` (6), `AM4` (13),
`LGA1200` (6) — must match the board/cooler tokens exactly; the rule is a string
`===`, not a fuzzy match.

### `tdp` — a real number that block-drives, unlike every other category's

`cpu.tdp` feeds two things: `compatibility.js`'s `psuTooSmall` (`:126`) sums it
into the build's draw and blocks against the PSU, and `buildWarnings.js:32`
warns when a cooler's rated wattage is below it.

🛑 **A CPU's `tdp` is the one `tdp` in the catalogue that is a real measurement.**
A case, PSU or motherboard carries `tdp: 0`/`12` — a sentinel nobody published,
which is exactly why those categories do **not** ratchet it. A CPU carries
`58–170`, the maker's stated power, and it changes build verdicts. So CPU `tdp`
is verified **and** ratcheted, the same call the GPU project made.

### No new field, no new rule, no latent bug

Every field the rules read already exists (`socket`, `tdp`). No reader
references a CPU spec absent from the data, so there is no phantom read to add.
The readers use clean enum tokens — `compatibility.js`'s socket `===`,
`partPages.js`/`specSheetContent.js` printing `socket`/`tdp`/`cores` directly —
with **no storage-style exact-match trap** (there is no `=== 'NVMe'` that never
matches) and **no RAM-style pluralisation bug**. This project is
re-verification, provenance and the ratchet — no code fix comes free with it.

### `perfScore` is out of scope

`cpu.perfScore` feeds `fpsEstimate`/`gameFps`/`bottleneck`, but it is a
**benchmarked figure** produced by the perf pipeline (`data/benchmarks/`,
`data/specs/cpuSpecs.json`), not a number any maker publishes. It has its own
verification track ([[spec-data-verification]]) and is the same call the GPU
project made about GPU `perfScore`: not a manufacturer catalogue spec, so not
this project.

### Legacy processors are in scope

19 CPUs carry `legacy: true` — all AM4 (13) and LGA1200 (6), the discontinued
platforms. `legacy` excludes them from being *offered* (`autoBuilder`,
`partRatings`), but they are shown in the upgrade flow and **their `socket`/`tdp`
still feed `compatibility.js` when one is selected as "what you have now."** So
all 80 are researched. ⚠️ A discontinued CPU's maker page is likelier to be
gone — Intel's ark and AMD's product pages are unusually durable, but the
`unverifiable` path applies here more than in current-platform tranches.

## Decisions

| | |
|---|---|
| Field set | `socket`, `tdp` (top-level), `specs.cores`, `specs.boostClock` on all 80 |
| Ratcheted | `socket` and `tdp` — both top-level and block-driving, via `RATCHETED_KEYS.cpu`; `cores` and `boostClock` via the global `RESEARCHED_KEYS` |
| `perfScore` | **left exactly as it is.** Benchmark track, not a maker spec. Never gets a source entry |
| Bugs fixed | none — no latent CPU reader bug exists |
| Out of scope | integrated-graphics presence, stock-cooler-included, threads/cache/PCIe-lanes/base-clock — see below |
| Execution | inline, four–five brand/socket tranches, full suite green per tranche |
| Unpublished figures | `unverifiable` with a note, never a guess (likelier on legacy parts) |

### `tdp` is the maker's base TDP, not turbo

**Decided:** `tdp` records the manufacturer's stated **base** power — Intel
**Processor Base Power** (PBP, the number labelled "TDP"), AMD **TDP** — not the
turbo ceiling (Intel Maximum Turbo Power, AMD PPT). This matches the field's
conventional meaning and the existing data (the 65W and 125W clusters are base
figures). ⚠️ **Accurately:** the `psuTooSmall` block compares the *raw* sum of
base TDPs to the PSU wattage with **no** multiplier (`draw >= wattage`,
`compatibility.js:24`); the 1.6× headroom lives only in the `psuFor`
*recommendation* (`partPages.js:96`). So base TDP keeps the block on the lenient
side, which is the current, accepted behaviour. Recording MTP/PPT would shift
many values sharply up (a 125W base i9 becomes ~253W) and move
`psuTooSmall`/cooler-warning verdicts — a semantic change this project is not
making, and one the user chose against.

### Out of scope — no counterpart to check against

- **Integrated graphics / "this CPU needs a discrete GPU to display".** A real
  build-completeness gap, but it needs a *new rule* (and an `iGpu` field), which
  is a design decision that belongs in its own project, not a spec-research pass.
- **Stock cooler included.** Some CPUs ship a cooler, so a build without a
  separate cooler could still be valid — again a new rule, not this project.
- **Threads, L3 cache, PCIe lanes, base clock.** No rule reads them, and
  `cores`/`boostClock` are the headline specs the spec sheet already prints.
  Adding more would be a field no rule can use — the `m2FormFactor` call.

## Wiring the coverage and the ratchet

Four edits in two files, mirroring RAM:

1. **`EXPECTED.cpu`** (`catalog-coverage-core.mjs`) — a **flat** required list
   (every CPU owes all four): `required: ['socket', 'tdp', 'cores', 'boostClock']`,
   `optional: []`.
2. **`RATCHETED_KEYS.cpu`** = `['socket', 'tdp']`. Per-category, so `tdp` here —
   a real measurement — does not conflict with the `tdp` sentinels other
   categories deliberately omit.
3. **`RESEARCHED_KEYS`** (`partSources.test.js`) gains **`'cores'` and
   `'boostClock'`**. Verified safe in the *global* list: `specs.cores` and
   `specs.boostClock` are carried by CPUs and **no other category** (80 parts,
   all `cpu`), the same property that let `sticks`, `readMbps` and `height` go
   global.
4. **`VERIFIED_CATEGORIES`** gains **`'cpu'`**, switching the top-level ratchet on.

### Ordering constraints (the `rating`/`height`/`readMbps`/`sticks` precedent)

1. **`cores`/`boostClock` join `RESEARCHED_KEYS` only at close-out.** All 80 rows
   carry both today; adding the keys before every row has a source fails the
   suite instantly against 80 values.
2. **`cpu` joins `VERIFIED_CATEGORIES` only at close-out.** `missingRatchetSources`
   would demand a `socket` and `tdp` source for all 80 the moment it is listed.

## Tranches

Brand tranches, sub-split by socket for size and because the source differs by
maker — **Intel → ark.intel.com** (a permanent per-SKU spec page), **AMD →
amd.com**. Four–five data tasks, 80 rows:

| tranche | rows |
|---|---|
| AMD AM5 | 26 |
| AMD AM4 (legacy) | 13 |
| Intel LGA1700 | 29 |
| Intel LGA1851 (6) + LGA1200 (6, legacy) | 12 |

The 29-row and 26-row tranches may split further in the plan; the two code tasks
(coverage wiring, ratchet) bracket them.

## Risks

| risk | mitigation |
|---|---|
| A wrong `socket` anchors the whole build wrong | It is re-read for all 80 and ratcheted. Cross-check: the socket must be one of the five board/cooler tokens, and match the CPU's known generation (a Ryzen 7000 is AM5, a 5000 is AM4) |
| Intel `tdp` recorded as turbo not base | Take the field labelled **Processor Base Power / TDP** on ark, never Maximum Turbo Power |
| AMD `tdp` recorded as PPT not TDP | Take the **TDP** field on amd.com, not the socket power (PPT) |
| A legacy CPU's page is gone | Ark and AMD keep old pages, but if one is unreadable record `unverifiable` with what was checked |
| A `socket` correction moves the verdict snapshot | Possible here, unlike RAM — a corrected socket flips CPU×board and CPU×cooler blocks. If `verdictSpread` fails, read the diff: only `cpu` may change, and each change must trace to a specific corrected socket |
| `boostClock` off by a decimal | Take the maker's stated **Max Boost / Max Turbo Frequency** in GHz, per SKU |

## Success criteria

- `npm run catalog:coverage` reports **cpu 80/80 (100%)**, other categories unchanged.
- `partSources.test.js` passes with `cpu` in `VERIFIED_CATEGORIES` and
  `cores`/`boostClock` in `RESEARCHED_KEYS`, **proved non-vacuous** (removing one
  `socket`, `tdp`, `cores` or `boostClock` source turns the suite red).
- Every corrected `socket`/`tdp`/`cores`/`boostClock` value carries a
  `partSources.json` entry; every unpublished one is `unverifiable` with a note.
- Lint, unit, e2e, build and prerender all green.

## Explicitly not in this project

- **`perfScore`** — benchmark track.
- **Integrated-graphics / stock-cooler build-completeness rules**, threads,
  cache, PCIe lanes, base clock. See above.
- **Fans + paste** (61 rows, no rule reads them) — the last category after this.
- `npm run catalog:push` and any push to `origin`. Both the user's to run — and
  `main` is already far ahead with the cooler, storage and RAM tranches in it.
