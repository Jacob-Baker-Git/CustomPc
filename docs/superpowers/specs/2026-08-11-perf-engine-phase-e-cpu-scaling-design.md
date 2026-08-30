# Performance engine phase E — reviving the modelled tier

**Date:** 2026-08-11
**Status:** approved
**Depends on:** `docs/superpowers/specs/2026-08-07-performance-engine-design.md`,
`docs/superpowers/specs/2026-08-11-perf-corpus-expansion-design.md`

## The problem

The `modelled` tier is effectively dead. A modelled frame rate requires

```js
cell?.B > 0 && gpuIdx.value > 0 && cpuIdx.value > 0      // index.js
```

and `cellFor` returns nothing unless the cell also has an `A`. So a usable answer
needs a GPU-scaling review and a CPU-scaling review to have measured **the same
game at the same preset**. Today the corpus holds:

- **one** cpu-scaling source — ComputerBase's 9800X3D review;
- **12 live entries** from it, covering **one game** (`ghost-of-tsushima`);
- **12 of 80 catalogue CPUs** indexed, all of them current-generation
  (14th-gen Intel, Core Ultra, Ryzen 9000).

The consequence, measured through the real engine: any mainstream processor —
i5-13600K, Ryzen 5 5600 — answers **0 of 48 games at every resolution**,
whatever graphics card sits beside it. No amount of GPU data changes this.

## What the investigation established

Four findings, each measured rather than assumed. They are recorded here because
three of them closed off approaches that looked obvious.

### 1. Preset names are not preset equivalence — merging them was rejected

`ghost-of-tsushima` sits in the corpus twice: `sehr-hoch` (ComputerBase, 52 rows)
and `very-high` (Notebookcheck, 18 rows). The labels are the same words in two
languages, and merging them would have roughly doubled the usable overlap.

Both outlets measured an **RTX 4070 at native**, so the claim is directly
testable:

| | 1440p | 4K |
|---|---|---|
| ComputerBase `sehr-hoch` | 55.5 | 36.1 |
| Notebookcheck `very-high` | 76.6 | 47.2 |
| ratio | **0.725** | **0.765** |

A 27–31% gap on identical hardware. Whatever differs — scene, extras, patch —
these are not the same measurement, and a name-based merge would have injected
that error into every cell it touched.

**Rule adopted (the user's own): merge only what is demonstrably the same thing;
where the data differs, keep it separate.** A shared label is not evidence. A
shared part with agreeing frame rates is. Preset normalisation is therefore
**not** part of this phase, and any future proposal to merge two labels must
present a same-hardware comparison first.

### 2. There is no latent CPU signal to mine

Notebookcheck supplies 87.7% of the corpus and its rows each name a test-system
CPU across seven declared benches, which raised the possibility that CPU
variation was already present and merely classified away as `gpu-scaling`. It is
not:

- of **1535** `game|preset|resolution|GPU` groups, **2** span more than one CPU;
- loosening to `game|GPU`, **9 of 322** groups span more than one CPU, and all
  but two of those differ in preset or resolution as well.

Each Notebookcheck bench is one fixed CPU used to test many GPUs, and the benches
do not re-test the same GPU+game+preset on a different CPU. That is what a
GPU-testing outlet does, and it means the CPU side cannot be recovered from data
already held. Phase E requires genuinely new cpu-scaling measurements.

### 3. Both ComputerBase reviews were sampled at about a sixth

This is the actual unlock, and it needs no new outlet.

| review | games published | games imported |
|---|---|---|
| RX 9070 (gpu-scaling) | 23 | **4** |
| 9800X3D (cpu-scaling) | 15 | **1** |

The GPU review's own TSV header records why: *"A SAMPLE of four of the review's
23 games… taking all of them would be a substantial part of ComputerBase's
compilation, which is what the corpus's per-source concentration cap exists to
prevent."*

**That cap no longer exists.** It was removed on 2026-08-10 (`9d16328`) and
replaced by measure-and-report in `concentration.js`, under the standing decision
to accept any valid data while the corpus is being built and dilute afterwards.
The sampling constraint outlived the rule that motivated it.

ComputerBase is also the only outlet in the corpus publishing **both**
machine-readable GPU reviews and machine-readable CPU reviews on a shared
parcours — which is exactly the pairing an `A`+`B` cell needs.

### 4. The two parcours overlap on nine games, seven of them cleanly

| game | GPU-side upscaling | status |
|---|---|---|
| Ghost of Tsushima | DLSS/FSR Native | already has A+B |
| Warhammer 40k: Space Marine 2 | TAA Native | A only |
| Dragon's Dogma 2 | TAA Native | neither |
| F1 24 | native | neither |
| Frostpunk 2 | DLSS/FSR Native | neither |
| Horizon Forbidden West | DLSS/FSR Native | neither |
| Outcast: A New Beginning | TAA Native | neither |
| Senua's Saga: Hellblade 2 | DLSS/FSR **Quality** | render-scale mismatch |
| Star Wars Outlaws | DLSS/FSR **Quality** | render-scale mismatch |

The CPU review's remaining six games (Anno 1800, Baldur's Gate 3, Cities
Skylines II, Cyberpunk Phantom Liberty, Homeworld 3, Starfield) have no
ComputerBase `A`. Three of them have a Notebookcheck `A`, but at Notebookcheck's
own preset and scene — finding 1 forbids treating those as the same cell.

## The upscaling hole

The cell key is `gameId|presetId`. **Upscaling is not in it.** So an `A` fitted
from DLSS-Quality rows can be paired with a `B` fitted from native rows, and the
blended frame time silently describes neither. Hellblade 2 and Star Wars Outlaws
are precisely this case, and importing the rest of the GPU review — which runs
eight of its games at DLSS/FSR Quality — is what would arm it.

This is the eighth instance of the engine's founding failure mode: *a number
nobody measured, presented exactly like one that was measured.*

**The corpus is currently clean.** Measured before designing the fix: of **249**
`game|preset|resolution` cells, **0** mix upscaling modes (1712 native rows, 40
quality rows, each in its own cell). The hole is latent, not live.

That matters for the migration. Because every existing cell is already
internally consistent on upscaling, adding upscaling to the key **re-partitions
nothing** — each cell keeps exactly the rows it has, under a longer name.

**Therefore the refit is required to reproduce every existing `A`, `B` and
`lowBase` to the last decimal.** Any movement is a bug in the migration, not a
consequence of it. This is the same check that caught both ComputerBase
extraction traps, and it is the gate on step 1.

## Design

### Step 1 — put upscaling in the cell key

Done first, so that everything imported afterwards lands in a correctly-shaped
cell and no import has to be redone.

- `scripts/fit-perf-model.mjs`: both fits key cells on
  `` `${gameId}|${presetId}|${upscaling}` ``.
- `src/data/perfModel.json`: the leaf of `gameConst[gameId][resolution]` becomes
  `` `${presetId}|${upscaling}` `` rather than `presetId`. The nesting depth is
  unchanged, so the artefact stays diffable and the file does not grow a level.
- `src/lib/perfEngine/indices.js`: `cellFor(model, game, resolution, presetId,
  upscaling)`. The composite key is built in this one place; no caller
  concatenates it by hand.
- `src/data/perfGames.json` (generated): each preset entry gains an `upscaling`
  field, derived from the corpus like every other field. `build-perf-games.mjs`
  and `perfGames.test.js` both extend to it, keeping the "listed because
  measured" contract.
- The engine already returns a row per game **and** preset; it becomes a row per
  game, preset **and** upscaling. `rowId` extends accordingly.

**Migration gate:** refit before and after, and diff `perfModel.json`. Every `A`,
`B`, `lowBase`, `sources` and `cv` must be identical; only the key spelling and
the new `upscaling` fields may differ. Verified by a checked-in comparison, not
by inspection.

### Step 2 — import both ComputerBase reviews in full

**GPU review (RX 9070), remaining ~19 games at 1440p and 4K.** Existing
exclusions are unchanged and re-stated so nobody re-litigates them:

- **3440×1440 ultrawide** — 34% more pixels than 16:9 at the same height, and
  `RESOLUTIONS` has no slot for it. Filing it as 1440p asserts a pixel count
  nobody measured.
- **Lego: Horizon Adventures** — run at "70 % TSR", not a named upscaling mode.
- **Arc B570** — no catalogue part.
- Any cell with an average but no P1 lands with **no low**, never an invented one.

**CPU review (9800X3D), remaining 14 games at 720p.** Same declared source, same
already-verified test system (DDR5-5600CL32, Windows 11 24H2, GeForce 565.90,
RTX 4090), so no new bench verification is owed. Exclusions unchanged:

- **7800X3D** (DDR5-5200CL30), **5800X3D** (AM4/DDR4-3200CL14) — different
  memory from the review's standard, so they are not the recorded test system.
- **Turbo-Mode and DDR5-OC rows** — non-stock configurations that collide on
  entry id with their stock counterparts, where the importer's dedupe silently
  keeps whichever lands first.

Each row's memory configuration is readable from `chart__item-title-addtl`
(`"253/253 W, DDR5-5600CL32"`), which is how the excluded rows are identified
mechanically rather than by position.

**Per-game presets and upscaling are read from the article, per game, never
defaulted.** The review states them individually — "Preset Hoch", "Preset
Ultrahoch", "Preset Max", "Preset sehr hoch", "Preset Ultra High" — and a game
whose preset or upscaling cannot be read off the source is **not imported**.
This is the same rule the Notebookcheck bench specs are held to.

Expected result: **7 games carrying both `A` and `B`**, up from 1. Hellblade 2
and Star Wars Outlaws join only if their CPU-side upscaling matches the GPU
side's Quality; after step 1 a mismatch simply produces two separate cells and
answers nothing, rather than a wrong number.

**Concentration:** roughly +760 GPU and +170 CPU rows takes ComputerBase from
172 to ~1100 entries and Notebookcheck from **87.7% to ~57%**. This phase
performs the dilution `perfModel.report.json` has been asking for, rather than
deferring it again. The figure is reported, not gated.

### Step 3 — index the processors people actually buy

Mainstream current (i5-13600K, i5-14600K, Ryzen 5 7600, Ryzen 7 7800X3D) and the
budget/older AM4 + LGA1200 tail (Ryzen 5 5600, 5700X, i5-12400F, 10th/11th-gen
Intel), per the chosen targets.

**The binding constraint is connectivity, not games.** `fitTwoWay` determines
index ratios only within the anchor's connected component, and `fit-perf-model`
drops everything outside it. A new CPU review must therefore **share at least one
processor** with the existing set, or every CPU in it is discarded as
disconnected.

It does **not** need to share games. Once a processor is indexed it answers on
every cell that already has an `A` and a `B` — so a review that adds only older
chips still puts them on the board across all seven games from step 2. This is
the cheapest possible lever and it is the one that closes "mainstream CPU shows
nothing".

Candidate reviews are ComputerBase processor articles, which have the same
machine-readable chart markup already proven here (47 charts, 838 rows on the
9800X3D page). **Every declared source carries its own verified test system**;
a review whose memory specification cannot be read off the article is not
declared — the rule that already caught the 13900K bench running DDR5-6400 where
its neighbours run 6000.

## Data flow

```
ComputerBase RX 9070 (gpu-scaling)      ComputerBase CPU reviews (cpu-scaling)
   23 games, 1440p/4K                      15 games + older parcours, 720p
            │                                          │
            └──────────────┬───────────────────────────┘
                           ▼
                  import-bench-tsv.mjs
                           │
                           ▼
            data/benchmarks/{sources,entries}.json
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
    fit-perf-model.mjs            build-perf-games.mjs
    (cells keyed by                (presets carry
     game|preset|upscaling)         upscaling)
            │                             │
            ▼                             ▼
    src/data/perfModel.json      src/data/perfGames.json
            └──────────────┬──────────────┘
                           ▼
                   PerformanceScreen
```

No Supabase write. Corpus, fitted model and game list are all repo files, so
none of this reaches the live site without a deploy. `gamesData.json` and the
Supabase `games` table are untouched — they drive the legacy CustomPC score,
which `legacyEngineUntouched.test.js` requires to stay byte-identical.

## Verification

Per step, before moving on:

1. **Step 1 gate:** refit and diff `perfModel.json` against the pre-change
   artefact. Every fitted constant identical; only key spelling and new
   `upscaling` fields differ. Full suite green.
2. **Re-derive rows already in the corpus and demand they match to the last
   decimal** after each import. This caught both ComputerBase extraction traps
   and it is cheap; a new import must not move an existing figure.
3. `npm run perf:games` after every import — `perfGames.test.js` is the gate,
   and it fails on drift in either direction.
4. **A before/after coverage sweep through the real engine**, over the four
   builds quoted in the corpus-expansion spec plus one mainstream CPU build
   (i5-13600K + RTX 4060) and one budget build (Ryzen 5 5600 + GTX 1660 Super).
   **The sweep is the evidence; the row count is not.**
5. Record `sourceConcentration` before and after, so the dilution is a measured
   figure rather than a claim.
6. Lint, build, and a browser check of the Performance tab at 1080p/1440p/4K on
   one covered and one uncovered build. **Restart the preview server after any
   `perf:fit`** — a forced page reload is not enough; the app's imported module
   stays stale.

**No figure in this document is reported as fact until the sweep has been run.**
The projected "7 games" and "87.7% → 57%" are estimates from chart counts.

## Explicitly out of scope

- **Preset normalisation across outlets.** Rejected on evidence; see finding 1.
- **Phase D — fitting 1080p.** `GPU_FIT_RESOLUTIONS` still excludes it. Phase E
  does not depend on it and does not change it.
- **The Performance tab UI redesign**, which follows as its own spec. Note that
  step 1 changes the row shape it will be designed against, which is why it runs
  after this phase rather than before.
- Calibrating Zen 4 vs Zen 5 IPC. Still unfitted, still pinned wrong-order by a
  test on purpose. More CPU-scaling data may make it fittable; that is a
  separate decision, not a silent side effect of this work.
- Any Supabase write, any push, any deploy.
