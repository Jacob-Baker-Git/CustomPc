# Real-data gaming performance engine — technical design

**Date:** 2026-08-07
**Status:** design approved, not yet planned
**Scope:** replace the invented-`perfScore` FPS heuristic with a measurement-backed frame-time engine, and build the "Run Performance Test" surface on top of it.

---

## 0. Context and scope

### What already exists

This is not a greenfield feature. The builder already ships a working FPS path:

| File | Role today |
|---|---|
| `src/lib/fpsEstimate.js` | `estimateFps(cpu, gpu, res)` — `min(gpuPerf × resFactor, cpuPerf × resFactor)` |
| `src/lib/gameFps.js` | `gameFps(...)` — same, times a per-game `fpsFactor` / `cpuFactor` |
| `src/lib/bottleneck.js` | `computeBottleneck` — compares the two sides, emits a verdict |
| `src/lib/partSynergy.js` | consumes `computeBottleneck`; feeds `partRatings` → the CustomPC score |
| `src/lib/valueScore.js` | `valuePerPound(part)` — perf points per £100 |
| `src/data/gamesData.json` | 22 games with `fpsFactor`, `cpuFactor`, `fpsCap` |
| `src/components/GamePerformanceList.jsx` | renders per-game FPS in the Summary |
| Supabase `games` table | live mirror of the bundled JSON |

Every number in that path descends from `perfScore`, which is a hand-assigned 0–100 figure, not a measurement. The catalogue's 559 parts are model-generated plausible estimates (see the project's legal notes) — the *product names* are real, the *prices and perf scores* are curated estimates. That is disclosed on the terms page and must stay disclosed.

### What this design changes

A new `src/lib/perfEngine/` module estimates frame times from **curated real measurements**, and drives a new Performance Test report. The GPU and CPU performance indices it uses are **derived from those measurements**, not from `perfScore`.

### What it deliberately does not change

`fpsEstimate.js`, `gameFps.js`, `bottleneck.js`, `partSynergy.js`, `partRatings.js` and `autoBuilder.js` are **untouched**. The CustomPC score and every auto-build recommendation behave exactly as they do today. Migrating them onto the new engine is a separate, separately-measured project (§8, Phase 6).

The consequence is that two models coexist and can disagree. The rule that resolves it:

> **The Performance Report is the only surface that quotes engine numbers. The ratings panel and `GamePerformanceList` keep quoting the old model until Phase 6.** Where both appear on one screen, the report is visually distinct and labelled with its model version.

### Non-goals

- No live pricing feed. Prices stay curated estimates with the existing `PRICE_SNAPSHOT` caveat.
- No user accounts, no server-side state, no telemetry. The site holds no personal data and that stays true.
- No third-party chart library. The CSP is first-party-only by design.
- No synthetic benchmark scores (3DMark, Cinebench, Time Spy). This engine models *game* frame times only.

---

## 1. System architecture

### 1.1 The shape of the problem, and the shape of the answer

79 GPUs × 80 CPUs × 22 games × 3 resolutions × ~3 presets ≈ **1.25 million cells**. An MVP curation budget is ~200–250 measurements. Direct lookup is therefore hopeless, and the interesting question is what structure makes 200 numbers cover a million cells without inventing anything.

The answer is that a frame is produced by two mostly-independent pipelines, so the model factorises:

```
t_gpu   how long the graphics card needs for this frame
t_cpu   how long the processor needs to prepare it
t_frame a blend of the two (§3.2)
```

`t_gpu` depends on the GPU, the game, the resolution and the preset. `t_cpu` depends on the CPU, the game and (weakly) the resolution. **Neither depends on the other part.** So the two terms can be fitted from separate measurements and combined afterwards — the cross product is *derived*, never curated.

This has a large practical consequence, and it is the single most important architectural decision here:

> **The two shapes of published review already isolate the two terms.**
> A GPU review tests many GPUs on one fixed top-end CPU — at 1440p and 4K the CPU term is negligible, so those results are almost pure `t_gpu`.
> A CPU review tests many CPUs on one fixed top-end GPU at 1080p — the GPU term is small and, once the GPU model is fitted, exactly subtractable, leaving `t_cpu`.

So the MVP dataset is roughly **50 GPU rows + 50 CPU rows per game family**, not 2,500 pairs. A smaller set of mid-range *pair* measurements is still collected, but as **held-out validation** — they are never fitted on, so they measure real error.

### 1.2 Layers

```
┌───────────────────────────────────────────────────────────────┐
│ CURATION (offline, repo)                                       │
│  data/benchmarks/sources.json     ~20 review sources           │
│  data/benchmarks/entries.json     ~250 measurements            │
│  data/benchmarks/validation.json  ~30 held-out pair results    │
└──────────────────────────┬────────────────────────────────────┘
                           │  npm run perf:fit
┌──────────────────────────▼────────────────────────────────────┐
│ FIT (build-time, Node)                                         │
│  scripts/fit-perf-model.mjs                                    │
│   · alternating least squares in log space (§3.6)              │
│   · emits fitted indices + per-cell constants + diagnostics    │
│   · fails the build if validation MAPE regresses               │
└──────────────────────────┬────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────┐
│ MODEL ARTEFACT (committed, ~60–90 KB)                          │
│  src/data/perfModel.json                                       │
│  src/data/perfModel.report.json   (diagnostics, not shipped)   │
└──────────────────────────┬────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────┐
│ RUNTIME (browser, pure functions)                              │
│  src/lib/perfEngine/                                           │
│    index.js        estimateBuildPerformance() — the contract   │
│    frameTime.js    the core model                              │
│    indices.js      index lookup + perfScore fallback prior     │
│    memory.js       RAM and VRAM adjustments                    │
│    lows.js         1% low modelling                            │
│    power.js        realistic system draw                       │
│    refresh.js      monitor refresh recommendation              │
│    confidence.js   confidence scoring                          │
│    cache.js        memoisation                                 │
└──────────────────────────┬────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────┐
│ UI  PerformanceReport.jsx and children (§5)                    │
└───────────────────────────────────────────────────────────────┘
```

**Why the fit is build-time.** The fitting pass is a few hundred lines of least squares over a few hundred rows. Running it in the browser would ship the raw corpus (large, and the thing with the licensing questions attached) and re-derive identical constants on every page load. Running it at build time ships a small artefact, keeps the raw corpus auditable in the repo, makes every constant diffable in review, and lets the fit *fail the build* when new data makes the model worse. Re-fitting after adding measurements is one command.

**Why the runtime is client-side.** The maths is deterministic over an artefact small enough to bundle. A REST round trip would add latency and an availability dependency to a calculation that takes under 5 ms locally, and would need infrastructure this static site does not have. The module contract is nonetheless specified in REST shape (§4) so an Edge Function wrapper is a thin later addition rather than a rewrite.

### 1.3 Frontend flow from the existing build page

```
BuilderScreen
 └ Summary tab (BuildSummary.jsx)
    ├ existing: parts list, price, GamePerformanceList (old model, unchanged)
    └ NEW  <RunPerformanceTest />
            click → setReportOpen(true)
                  → estimateBuildPerformance({ parts, resolution, presetId, gameIds })
                  → <PerformanceReport report={…} />
```

The click computes synchronously and reveals the report. **There is no fake progress bar.** The calculation takes single-digit milliseconds and pretending otherwise would be theatre in a feature whose entire selling point is honesty. If a future dataset makes it slow enough to matter, the honest fix is a real async boundary, not a simulated one.

Preconditions: the button is disabled with an explanatory label unless a CPU **and** a GPU are selected. RAM, PSU and storage are optional — their absence removes the corresponding adjustments and lowers confidence rather than blocking.

### 1.4 Caching strategy

Four layers, none of them a network cache, because there are no requests:

1. **Bundle cache.** `perfModel.json` is a static import, so Vite content-hashes it into the build. Netlify serves hashed assets immutable. A new model is a new filename; there is no staleness window.
2. **Optional live override.** A single-row Supabase `perf_model` table can carry a newer artefact, fetched by the existing `supabaseCatalog.js` pattern and swapped in the same way the parts catalogue is. This mirrors how a catalogue write already goes live with no deploy. **Guard:** the client rejects any artefact whose `modelVersion` major differs from the one it was built against, and keeps the bundled one. Without that guard a bad row silently breaks every estimate on the live site with no deploy to roll back.
3. **Per-report memoisation.** `cache.js` holds a `Map` keyed on `${cpuId}|${gpuId}|${ramId}|${resolution}|${presetId}` → report. Bounded to 50 entries, LRU. A user toggling between 1080p and 1440p re-renders instantly.
4. **Model-identity invalidation.** The memo `Map` lives in a `WeakMap` keyed on **the model object itself**, matching the pattern `partLevel()` already uses against the catalogue array. When the Supabase swap replaces the model, every memo is collected for free — no manual invalidation, no chance of serving stale numbers from a superseded model.

### 1.5 Versioning of benchmark data

Three independent version numbers, all stamped on every report:

| Field | Changes when | Consumed by |
|---|---|---|
| `modelVersion` (semver) | the *algorithm* changes. Major = output shape or meaning changed; minor = new term added; patch = constant retuned | the live-override compatibility guard; the report footer |
| `datasetVersion` (ISO date) | measurements are added, corrected or retired | the report footer; the "data as of" line |
| `fittedAt` (ISO timestamp) | every fit run | diagnostics only |

`entries.json` rows are **append-and-supersede, never edited in place**: a correction adds a new row and sets `supersededBy` on the old one. The corpus stays a truthful record of what was recorded and when, which is what makes the licensing position and the drift analysis (§9.3) defensible.

A shared report (§5.6) embeds `modelVersion` + `datasetVersion` in its code, so opening an old link renders the numbers it was generated under, labelled *"estimated under model 1.2 · data as of March 2026"*, rather than silently re-computing to a different answer.

---

## 2. Data model

Storage follows the pattern the app already uses: **Supabase is the live source, a bundled JSON snapshot is the offline fallback, and both halves are written from one script so they cannot drift.** New tables get the same posture as `parts` — RLS public-SELECT-only, with `INSERT/UPDATE/DELETE/TRUNCATE` revoked from `anon` and `authenticated`.

The raw corpus (`sources`, `entries`, `validation`) lives **only in the repo**, not in Supabase. It is input to the build, not runtime data, and shipping it would put the compilation on a public endpoint for no benefit.

### 2.1 `data/benchmarks/sources.json` — provenance

One row per published review consulted. This table is the licensing defence and the drift audit trail; nothing may be entered without it.

```json
{
  "id": "src-hwub-2026-02-rtx5070-review",
  "outlet": "Hardware Unboxed",
  "title": "GeForce RTX 5070 Review, 1080p/1440p/4K Benchmarks",
  "url": "https://www.example-review-site.com/rtx-5070-review",
  "published": "2026-02-19",
  "accessed": "2026-08-07",
  "kind": "gpu-scaling",
  "testSystem": {
    "cpu": "AMD Ryzen 7 9800X3D",
    "cpuId": "cpu-ryzen-7-9800x3d",
    "ram": { "type": "DDR5", "speed": 6000, "capacityGb": 32, "sticks": 2 },
    "os": "Windows 11 24H2",
    "gpuDriver": "NVIDIA 572.16",
    "resizableBar": true
  },
  "notes": "Averages are 3-run means of the in-game benchmark. 1% lows published.",
  "entryCount": 14
}
```

`kind` is one of `gpu-scaling` (many GPUs, one CPU), `cpu-scaling` (many CPUs, one GPU), `pair` (a single specific combination), `memory-scaling` (one system, several RAM configurations). The fitter treats each kind differently (§3.6), so it is required, not decorative.

`cpuId` / `gpuId` resolve the review's test system against the catalogue. When a review's CPU is not in the catalogue the row is still usable — it just contributes to the GPU fit with an unresolved CPU term and carries a lower weight.

### 2.2 `data/benchmarks/entries.json` — the measurements

```json
{
  "id": "be-hwub-5070-cyberpunk-1440p-ultra",
  "sourceId": "src-hwub-2026-02-rtx5070-review",
  "gameId": "cyberpunk",
  "resolution": "1440p",
  "presetId": "ultra",
  "gpuId": "gpu-rtx-5070",
  "cpuId": "cpu-ryzen-7-9800x3d",
  "avgFps": 78.0,
  "lowFps": 61.0,
  "lowKind": "1%",
  "upscaling": "off",
  "rayTracing": false,
  "frameGen": false,
  "sceneNote": "built-in benchmark",
  "weight": 1.0,
  "supersededBy": null,
  "recordedAt": "2026-08-07"
}
```

Field notes that matter:

- **`upscaling`, `rayTracing`, `frameGen` are part of the cell key, not modifiers.** DLSS Quality is a different workload, not a multiplier on native. MVP fits `upscaling: "off"`, `rayTracing: false`, `frameGen: false` only; other combinations are stored but excluded from the fit until there is enough of them to fit their own cells. Mixing them in would poison every constant they touch.
- **`lowKind`** distinguishes `1%` from `0.1%` from `min`. Only `1%` feeds the lows fit; the others are stored for later.
- **`weight`** downgrades a measurement without deleting it — an outlet with a known-unusual test scene, or a figure read off a chart rather than a table, enters at 0.5.
- **`sceneNote`** is free text but required. Two outlets benchmarking Cyberpunk's built-in run and a walk through Dogtown are measuring different things, and when they disagree this field is how you find out why.

### 2.3 `src/data/gamesData.json` — extended, additively

The existing 22 rows keep `fpsFactor`, `cpuFactor` and `fpsCap` **unchanged**, because the old model still reads them and still drives the CustomPC score. New fields are additive:

```json
{
  "id": "cyberpunk",
  "name": "Cyberpunk 2077",
  "fpsFactor": 0.5,
  "cpuFactor": 0.75,

  "engine": "REDengine 4",
  "releaseYear": 2020,
  "genre": "open-world",
  "slug": "cyberpunk-2077",
  "minRamGb": 12,
  "recRamGb": 16,
  "memorySensitivity": 0.12,
  "presets": [
    { "id": "medium", "label": "Medium", "tier": 2,
      "vramNeedGb": { "1080p": 6.0, "1440p": 7.0, "4k": 9.0 } },
    { "id": "high", "label": "High", "tier": 3,
      "vramNeedGb": { "1080p": 7.0, "1440p": 8.5, "4k": 11.0 } },
    { "id": "ultra", "label": "Ultra", "tier": 4,
      "vramNeedGb": { "1080p": 8.0, "1440p": 10.0, "4k": 13.0 } }
  ]
}
```

- **`presets` are the game's real names**, not a global low/medium/high. "Epic" in Fortnite and "Ultra" in Cyberpunk are different words for roughly the same tier; `tier` is the canonical 1–5 rung used for cross-game fallback when a specific preset has no data.
- **`memorySensitivity`** is the exponent `e` in §3.4. Fitted where `memory-scaling` sources exist; otherwise a genre default with `basis: "default"` recorded.
- **`vramNeedGb`** is a curated figure per cell — the allocation at which measurements start showing the overflow signature (lows collapsing while averages hold). It is not the number the game's launcher reports.

### 2.4 `src/data/perfModel.json` — the fitted artefact (shipped)

```json
{
  "modelVersion": "1.0.0",
  "datasetVersion": "2026-08-07",
  "fittedAt": "2026-08-07T14:22:03.118Z",
  "entryCount": 247,
  "sourceCount": 19,
  "validation": { "n": 31, "mapeAvg": 0.061, "mapeLow": 0.094, "p90Avg": 0.118 },

  "blendK": 5.1,
  "resCpuScale": { "1080p": 1.0, "1440p": 1.012, "4k": 1.031 },
  "lowsHeadroomCoef": 0.24,

  "gpuIndex": {
    "gpu-rtx-4090":     { "1080p": 100.0, "1440p": 100.0, "4k": 100.0, "basis": "measured", "anchors": 13 },
    "gpu-rtx-5070":     { "1080p": 61.4, "1440p": 62.0,  "4k": 60.1,  "basis": "measured", "anchors": 11 },
    "gpu-rtx-4070ti":   { "1080p": 58.9, "1440p": 59.5,  "4k": 57.8,  "basis": "measured", "anchors": 8 },
    "gpu-rtx-4060":     { "1080p": 31.0, "1440p": 30.2,  "4k": 27.4,  "basis": "measured", "anchors": 6 },
    "gpu-rx-7600":      { "1080p": 29.8, "1440p": 28.9,  "4k": 26.1,  "basis": "prior",    "anchors": 0 }
  },

  "cpuIndex": {
    "cpu-ryzen-7-9800x3d": { "value": 100.0, "basis": "measured", "anchors": 14 },
    "cpu-ryzen-5-7600x":   { "value": 71.2,  "basis": "measured", "anchors": 9 },
    "cpu-i5-13400f":       { "value": 63.5,  "basis": "prior",    "anchors": 0 }
  },

  "gameConst": {
    "cyberpunk": {
      "1440p": {
        "ultra": { "A": 482.3, "B": 418.0, "lowBase": 1.38,
                   "sources": 4, "cv": 0.041, "medianDate": "2026-01" },
        "high":  { "A": 399.0, "B": 402.0, "lowBase": 1.35,
                   "sources": 3, "cv": 0.052, "medianDate": "2025-11" }
      }
    }
  },

  "exact": {
    "cpu-ryzen-7-9800x3d|gpu-rtx-5070|cyberpunk|1440p|ultra":
      { "frameTimeMs": 12.8205, "sources": 2, "entries": 3 }
  },

  "presetTierFallback": { "gpu": { "1": 1.72, "2": 1.31, "3": 1.0, "4": 0.86, "5": 0.74 },
                          "cpu": { "1": 1.14, "2": 1.06, "3": 1.0, "4": 0.97, "5": 0.94 } },

  "priors": {
    "gpu": { "form": "log-linear", "slope": 1.41, "intercept": -1.83, "r2": 0.941, "n": 48 },
    "cpu": { "form": "log-linear", "slope": 1.09, "intercept": -0.24, "r2": 0.887, "n": 44 }
  }
}
```

Three things to notice.

`exact` is the measured-combination short-circuit. The raw corpus never reaches the browser, so combinations somebody actually tested have to ride in the artefact or the engine could not prefer them over its own model. Keyed `cpuId|gpuId|gameId|resolution|presetId`, and where several sources measured the same combination they are averaged **in frame time, not in fps** — averaging frame rates over-weights the fastest source.

`basis: "prior"` means that part has **no measurement at all** and its index came from the `perfScore` regression. That is recorded per part, surfaced in the confidence score, and shown in the UI. The fallback is itself data-derived — the regression is fitted on the parts that have both a measured index and a `perfScore`, and its r² is published, so the fallback's own quality is a stated number rather than an assumption.

`cv` is the coefficient of variation across the sources that calibrated a cell. It is the honest measure of how much the outlets disagree, and it feeds confidence directly (§3.7).

### 2.5 `src/data/perfModel.report.json` — diagnostics (not shipped)

Per-entry residuals, per-part anchor counts, coverage heat map, validation table, and the list of every cell that fell back. Read in review; never imported by the app.

### 2.6 Supabase mirrors

| Table | Contents | Grants |
|---|---|---|
| `games` | extended rows from §2.3 | existing: public SELECT only |
| `perf_model` | single row, `data jsonb` holding §2.4 | public SELECT only; writes revoked from anon/authenticated |

Both are written by the same script that writes the JSON, as the parts catalogue already is, and verified with the same `md5(string_agg(...))` checksum method. A `perf_model` write goes live instantly with no deploy — so it is subject to the same rule as a catalogue write: **ask first.**

---

## 3. Performance estimation algorithm

### 3.1 Everything is a frame time

The single most consequential decision in the model. Frame times add and average linearly; frame *rates* do not. A model that interpolates FPS between two anchors is wrong in a way that is invisible until you check it — halfway between 60 and 120 fps is 80, not 90.

```
fps = 1000 / t        t in milliseconds
```

All fitting, interpolation, blending and penalty application happen in milliseconds. Conversion to FPS happens once, at the boundary, on the way to the UI.

### 3.2 Combining the two pipelines

The obvious model is `t = max(t_gpu, t_cpu)`, and it is what the current code does. It is wrong in a specific and important way: real hardware overlaps CPU and GPU work imperfectly, so when the two terms are close, measurements sit **above** the max — typically 8–12% above at parity. `max()` therefore over-predicts hardest exactly where most real builds live, near the crossover.

Use a p-norm soft-max:

```
t_frame = ( t_gpu^k + t_cpu^k ) ^ (1/k)
```

- `k → ∞` reduces to `max()`; `k = 1` is straight addition (perfect serialisation, no overlap).
- The excess over `max()` at parity is exactly `2^(1/k) − 1`. So `k = 5.1` sits **15% above the max when the two terms are equal**, 2.4% above at a 1.5:1 ratio, and 0.6% at 2:1. `k = 8` would give 9% at parity.
- **`k` is fitted, not chosen.** Published crossover behaviour puts the parity excess somewhere in the 5–15% band, which brackets `k` between roughly 5 and 8 — a wide enough spread to matter and a narrow enough one to fit. The `pair` and `cpu-scaling` measurements near the crossover determine it (§3.6, pass 4). Every `k` in this document is illustrative; none of it is a claim about hardware.

This one change also dissolves an awkwardness in the existing bottleneck code, which has to special-case "mildly GPU-bound is the healthy normal state" with separate scoring branches. Under the p-norm, a mild GPU bound simply produces a frame time close to `t_gpu`, and the CPU's contribution falls out of the same number.

### 3.3 The two terms

```
t_gpu = A[game][res][preset] / gpuIndex[gpu][res]  ×  vramFactorAvg
t_cpu = B[game][preset] × resCpuScale[res] / cpuIndex[cpu]  ×  ramFactorCpu
```

`A` is in millisecond·index units; `gpuIndex` is a dimensionless relative-throughput scalar anchored so the fastest measured card at 1440p is 100.

**`gpuIndex` is per-resolution.** A card with abundant memory bandwidth scales better at 4K than its 1080p standing suggests, and collapsing that into one number bakes an error of several percent into every 4K estimate. Three numbers per card; where only one resolution has data the others are copied across and the copy is recorded so confidence can reflect it.

**`resCpuScale` is near 1.** CPU work per frame is roughly resolution-independent — that is what "CPU-bound" means — but not exactly: higher resolutions shift a little work and slightly reduce achievable draw-call rates. Fitted values land around `{1080p: 1.00, 1440p: 1.01, 4k: 1.03}`. If the fit ever returns something far from that, the fit is wrong, not the hardware, and `perf:fit` asserts the range.

**Presets are cell keys, not multipliers.** `A` and `B` are fitted per `(game, resolution, preset)`, so a preset with real data needs no multiplier at all. `presetTierFallback` exists only for presets with no measurements, applied to the nearest fitted tier, and using it lowers confidence.

### 3.4 RAM adjustment

RAM affects the **CPU term and the 1% lows**. It does not meaningfully affect GPU-limited frame times, and applying it to the average is the mistake most FPS calculators make.

Three independent effects, all computable from fields the catalogue already carries (`ramType`, `speed`, `capacityGb`, `specs.sticks`):

**Speed.** Relative to a platform baseline determined by the CPU's socket:

```js
const RAM_BASELINE = { AM5: 6000, LGA1851: 6000, LGA1700: 5600, AM4: 3200, LGA1200: 3200 }
const RAM_EFFECTIVE_CAP = { AM5: 6400, LGA1851: 7200, LGA1700: 7200, AM4: 3800, LGA1200: 3600 }

function ramSpeedFactor(cpu, ram, game) {
  if (!ram?.speed) return 1                       // no data → no penalty, ever
  const base = RAM_BASELINE[cpu.socket] ?? ram.speed
  const cap  = RAM_EFFECTIVE_CAP[cpu.socket] ?? Infinity
  const eff  = Math.min(ram.speed, cap)           // past the fabric cliff, faster RAM buys nothing
  const e    = game.memorySensitivity ?? 0.12
  return Math.pow(base / eff, e)                  // >1 slows the CPU term
}
```

The `RAM_EFFECTIVE_CAP` matters: DDR5-8000 on AM5 runs the memory controller in a decoupled mode and is routinely *slower* than 6000 in games. Modelling it as 33% faster would be a confident, well-formatted lie.

**Channels.** `specs.sticks === 1` is single-channel and roughly halves memory bandwidth. It is a large, real, frequently-missed penalty:

```js
const ramChannelFactor = (ram) => (ram?.specs?.sticks === 1 ? 1.18 : 1.0)   // on t_cpu
```

Two of the 52 catalogue RAM kits are single-stick, so this fires rarely but is dramatic when it does — and it is exactly the kind of mistake a builder wants flagged before they buy.

**Capacity.** Below a game's floor, the effect is stutter, not a lower average:

```js
function ramCapacityFactors(ram, game) {
  const gb = ram?.capacityGb ?? 0
  if (!gb || !game.minRamGb) return { avg: 1, low: 1 }
  if (gb < game.minRamGb) return { avg: 1.25, low: 1.90 }   // paging: lows fall off a cliff
  if (gb < (game.recRamGb ?? 0)) return { avg: 1.05, low: 1.25 }
  return { avg: 1, low: 1 }
}
```

**Missing metadata never penalises.** No RAM selected, or a kit with no `speed`, yields factor 1 and a confidence deduction — the same rule `partSynergy` already follows, and for the same reason: a gap in the catalogue is not evidence of a slow part.

### 3.5 VRAM penalty

The distinguishing signature of VRAM exhaustion is that **1% lows collapse while the average barely moves.** A model that applies one multiplier to both misses the phenomenon entirely and produces a comfortable-looking average for a build that stutters constantly.

```js
function vramFactors(gpu, game, res, presetId) {
  const have = gpu?.specs?.vram
  const need = game.presets?.find(p => p.id === presetId)?.vramNeedGb?.[res]
  if (!have || !need) return { avg: 1, low: 1, deficitGb: 0 }

  const deficit = Math.max(0, need - have)
  if (deficit === 0) return { avg: 1, low: 1, deficitGb: 0 }

  const d = deficit / need                       // fractional shortfall
  const knee = Math.max(0, d - 0.15)             // below ~15% short, the cache absorbs it

  return {
    avg: 1 + 0.30 * d + 2.2 * knee * knee,
    low: 1 + 1.10 * d + 6.5 * knee * knee,
    deficitGb: Number(deficit.toFixed(1)),
  }
}
```

The coefficients are fitted against the VRAM-limited measurements in the corpus — 8 GB cards at 1440p Ultra in the heavier titles are the natural calibration set. Until there are enough of those, they carry stated defaults and `basis: "default"`, and any cell using them is capped at `confidence ≤ 60`.

The UI must say so in words when `deficitGb > 0`, because the number alone under-sells it: *"8 GB is about 2 GB short for Ultra at 1440p — expect the stutter to be worse than the average frame rate suggests."*

### 3.6 Fitting (build-time, `scripts/fit-perf-model.mjs`)

The fit is an alternating least squares over a two-way additive model in log space. Taking logs turns the multiplicative model into a linear one:

```
log t_gpu = log A[g][r][p] − log gpuIndex[x][r]
```

which is a standard row-effect + column-effect decomposition, robust to sparse and unbalanced data — exactly the shape of a curated corpus where some GPUs appear in 11 games and some in 2.

```
PASS 1 — GPU index, from kind="gpu-scaling"
  Keep entries at 1440p and 4K (CPU term negligible with a top-end test CPU).
  Fit EACH RESOLUTION SEPARATELY, and anchor all three to the SAME GPU := 100.
    Within one resolution the scale is arbitrary — only ratios are determined —
    so anchoring each resolution independently would make the three numbers
    incomparable. Pinning the same card to 100 everywhere is what makes
    "the 4060 is 31.0 at 1080p but 27.4 at 4K" mean something: it is relative
    to the anchor card, and it says the 4060 falls further behind at 4K.
  Iterate to convergence (typically 6–10 rounds, tol 1e-6):
    a) for each cell (g,r,p): log A := weighted mean over entries of
                              (log t_obs + log gpuIndex[x][r])
    b) for each gpu, res:     log gpuIndex := weighted mean over entries of
                              (log A[g][r][p] − log t_obs)
    c) re-anchor so the anchor GPU stays 100 (removes the scale drift ALS introduces)

PASS 2 — CPU index, from kind="cpu-scaling"
  These are 1080p, top-end GPU. t_gpu is small but NOT negligible, so subtract it
  using PASS 1's model, inverting the p-norm with the current k:
      t_cpu_obs = ( t_obs^k − t_gpu_est^k ) ^ (1/k)
  Guard: if t_gpu_est >= t_obs the entry is GPU-bound and carries no CPU signal —
  drop it and record it in the diagnostics rather than clamping it to zero.
  Anchor: the most-measured CPU := 100. Same ALS over (game, preset) × cpu.

PASS 3 — 1% lows
  For every entry with lowKind="1%", compute the observed ratio t_low/t_avg,
  regress out the modelled cpuShare and vram terms, and take the residual
  weighted mean as lowBase[game][res][preset].

PASS 4 — global constants k, resCpuScale, lowsHeadroomCoef
  1-D golden-section search on k over the crossover entries (those where
  0.6 < t_cpu/t_gpu < 1.6), minimising weighted log-residual.
  resCpuScale from cpu-scaling sources that publish multiple resolutions.
  Repeat PASS 1–3 once with the new k. Two outer iterations suffice.

PASS 5 — priors for uncovered parts
  Log-linear regression of measured index on perfScore, per category.
  Report n, r², and residual spread. Parts with no measurement take the
  regression value and basis:"prior".

PASS 6 — validation
  Predict every held-out `validation.json` pair. Report MAPE on averages and
  on lows, plus p90 error. FAIL THE BUILD if mapeAvg regresses by more than
  0.5 points against the committed model, unless PERF_FIT_ACCEPT_REGRESSION=1.
```

That last line is the mechanism that keeps the model honest as data grows. Adding measurements is supposed to make it better; if it makes it worse, something about the new data or the model is wrong and the build should say so before the numbers reach anyone.

### 3.7 Normalising across sources

Different outlets test different scenes, drivers, RAM and OS builds. Handling that is the hardest part of the whole design and it deserves to be explicit rather than hand-waved into an "average".

**What the design does:**

1. **Never average raw FPS across sources.** Averaging a built-in-benchmark number with a walk-through-a-city number produces a figure that describes neither.
2. **Overlap-based scale factors.** Where two sources measure the same `(gpu, cpu, game, res, preset)`, their ratio is that pair's relative offset. Chain those overlaps to a common baseline, least-squares, exactly as a levelling network is adjusted. Sources with no overlap are **not** normalised — they enter unadjusted and their cells carry a lower confidence.
3. **The factorisation does most of the work for free.** A source's systematic offset is largely absorbed into the per-cell constant `A`, and the *shape* of a GPU-scaling curve — which is what determines the indices — is far more consistent across outlets than its absolute level. This is why the model is fitted on shapes and not on absolute numbers.
4. **Disagreement is measured, not hidden.** `cv` per cell is computed and shipped. A cell where four outlets agree within 4% and a cell where two disagree by 25% should not produce the same-looking answer, and under this design they do not.
5. **Curation preference order**, applied when choosing what to record: sources publishing 1% lows and a full test system > sources publishing averages only > sources with an unstated methodology. Charts-only sources enter at `weight: 0.5`.

### 3.8 Confidence score

Deductive from 100, so every deduction is nameable in the UI:

```js
function confidence(ctx) {
  let c = 100
  const reasons = []

  // 1. how direct is the match
  if (ctx.exactCell)               { /* 0 */ }
  else if (ctx.cellFitted)         { c -= 8;  reasons.push('interpolated between measured parts') }
  if (ctx.presetFromTier)          { c -= 10; reasons.push('this preset was not measured directly') }
  if (ctx.resolutionCopied)        { c -= 8;  reasons.push('index measured at another resolution') }

  // 2. how far from the nearest anchor, in log space (doubling = 1.0)
  c -= Math.min(25, 12 * Math.abs(Math.log2(ctx.gpuIndex / ctx.nearestGpuAnchorIndex)))
  c -= Math.min(25, 12 * Math.abs(Math.log2(ctx.cpuIndex / ctx.nearestCpuAnchorIndex)))

  // 3. do the sources agree
  c -= Math.min(20, 200 * (ctx.cellCv ?? 0.05))
  if ((ctx.cellSources ?? 0) < 2) { c -= 6; reasons.push('only one source for this game') }

  // 4. no measurement at all for this part
  if (ctx.gpuBasis === 'prior') { c -= 30; reasons.push(`no benchmark data for the ${ctx.gpuName}`) }
  if (ctx.cpuBasis === 'prior') { c -= 30; reasons.push(`no benchmark data for the ${ctx.cpuName}`) }

  // 5. staleness, and unmodelled build gaps
  c -= Math.min(12, 3 * ctx.yearsSinceMedianMeasurement)
  if (!ctx.ram)             { c -= 5; reasons.push('no memory selected') }
  if (ctx.vramDefaultsUsed) { c = Math.min(c, 60) }

  return { score: Math.round(Math.max(10, Math.min(99, c))), reasons }
}
```

It never returns 100. This is an estimate and the number should never claim otherwise.

Bands: **85+ measured · 70–84 confident · 50–69 modelled · below 50 rough**. The band is what the UI shows; the reasons are what the tooltip shows.

### 3.9 Power draw

Summing TDPs is the conservative sizing number and `systemDrawW` already does it — that stays, unchanged, feeding the PSU warning. The report needs a *realistic* figure, and the engine can produce a better one because it already knows which side is limiting:

```js
function estimatePower(parts, frame) {
  const gpuTdp = parts.gpu?.tdp ?? 0
  const cpuTdp = parts.cpu?.tdp ?? 0

  // A GPU-limited frame runs the card near board power. A CPU-limited frame
  // leaves it waiting, and it draws less. cpuShare is 0 (pure GPU-bound) to
  // 1 (pure CPU-bound) and comes straight out of the frame-time model.
  const gpuLoad = 0.98 - 0.35 * frame.cpuShare
  const cpuLoad = 0.42 + 0.30 * frame.cpuShare   // games rarely load a CPU past ~70% of PL1

  const board  = 35
  const ram    = 3 * (parts.ram?.specs?.sticks ?? 2)
  const drives = 6
  const fans   = 2 * (parts.fans?.specs?.count ?? 3)
  const misc   = 12

  const gaming = gpuTdp * gpuLoad + cpuTdp * cpuLoad + board + ram + drives + fans + misc
  const peak   = gpuTdp * 1.0 + cpuTdp * 0.95 + board + ram + drives + fans + misc
  const idle   = 18 + 0.06 * gpuTdp + 0.10 * cpuTdp

  return {
    idleW: Math.round(idle),
    gamingW: Math.round(gaming),
    peakW: Math.round(peak),
    // transient spikes are what actually trip a supply, not sustained draw
    recommendedPsuW: Math.ceil((peak * 1.35) / 50) * 50,
    psuHeadroomPct: parts.psu?.wattage
      ? Math.round((100 * parts.psu.wattage) / peak - 100) : null,
    loadPointPct: parts.psu?.wattage
      ? Math.round((100 * gaming) / parts.psu.wattage) : null,
  }
}
```

`loadPointPct` is worth showing: an 850 W unit running a 320 W build sits at 38% load, which is quiet and efficient, and that is a genuinely useful thing to tell someone who is wondering whether they over-bought.

### 3.10 Monitor refresh recommendation

```js
const PANEL_RATES = [60, 75, 100, 120, 144, 165, 180, 240, 360, 480]

// The 25th percentile, so ~75% of the selected library meets or beats the
// recommendation. Taking a HIGH percentile would size the panel off the single
// lightest esports title and leave every real game short of it — the opposite
// of the advice a buyer needs.
const REFRESH_PERCENTILE = 0.25

function recommendRefresh(perGameResults, catalogueMonitors, resolution) {
  const avgs = perGameResults.map(r => r.avgFps).sort((a, b) => a - b)
  const basis = avgs[Math.min(avgs.length - 1,
                              Math.floor(REFRESH_PERCENTILE * avgs.length))]
  const target = PANEL_RATES.filter(r => r <= basis).pop() ?? 60

  return {
    refreshHz: target,
    basisFps: Math.round(basis),
    reachedIn: perGameResults.filter(r => r.avgFps >= target).length,
    ofGames: perGameResults.length,
    matches: catalogueMonitors
      .filter(m => m.refresh >= target && m.resolution === resolution)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3),
  }
}
```

The 36 catalogue monitors already carry `refresh` and `resolution`, so this needs no new data. It is also the least intrusive place a price link ever appears (§7).

### 3.11 Full pseudocode

```js
export function estimateBuildPerformance({ parts, resolution = '1440p',
                                           presetId = 'high', gameIds,
                                           model, games, monitors = [] }) {
  const { cpu, gpu, ram } = parts
  if (!cpu || !gpu) return null

  const gIdx = gpuIndexFor(model, gpu, resolution)   // { value, basis, copiedFrom }
  const cIdx = cpuIndexFor(model, cpu)

  const results = selectGames(games, gameIds).map((game) => {
    const preset = resolvePreset(game, presetId)          // exact, or nearest tier
    const cell   = cellFor(model, game, resolution, preset)

    const vram = vramFactors(gpu, game, resolution, preset.id)
    const ramC = ramCapacityFactors(ram, game)
    const ramT = ramSpeedFactor(cpu, ram, game) * ramChannelFactor(ram)

    const tGpu = (cell.A / gIdx.value) * vram.avg
    const tCpu = (cell.B * model.resCpuScale[resolution] / cIdx.value) * ramT

    const k = model.blendK
    let t = Math.pow(Math.pow(tGpu, k) + Math.pow(tCpu, k), 1 / k) * ramC.avg

    // engine caps are a ceiling on fps, i.e. a floor on frame time
    if (game.fpsCap) t = Math.max(t, 1000 / game.fpsCap)

    const cpuShare = Math.pow(tCpu, k) / (Math.pow(tGpu, k) + Math.pow(tCpu, k))

    const lowRatio = cell.lowBase
      * (1 + model.lowsHeadroomCoef * cpuShare * cpuShare)
      * (vram.low / vram.avg)
      * (ramC.low / ramC.avg)
    const tLow = t * lowRatio

    return {
      gameId: game.id, name: game.name, preset: preset.label,
      avgFps: Math.round(1000 / t),
      lowFps: Math.round(1000 / tLow),
      frameTimeMs: Number(t.toFixed(2)),
      cpuShare: Number(cpuShare.toFixed(3)),
      limitedBy: cpuShare > 0.62 ? 'cpu' : cpuShare < 0.38 ? 'gpu' : 'balanced',
      atEngineCap: Boolean(game.fpsCap && Math.round(1000 / t) >= game.fpsCap),
      vramShortGb: vram.deficitGb,
      confidence: confidence({ ...cell, gpuBasis: gIdx.basis, cpuBasis: cIdx.basis, /* … */ }),
    }
  })

  const frame = aggregate(results)                       // mean cpuShare, weighted by playtime-neutral
  return {
    modelVersion: model.modelVersion,
    datasetVersion: model.datasetVersion,
    resolution, presetId,
    games: results,
    bottleneck: bottleneckSummary(results, cpu, gpu, resolution),
    power: estimatePower(parts, frame),
    refresh: recommendRefresh(results, monitors, resolution),
    value: valueSummary(results, parts),
    confidence: overallConfidence(results),
  }
}
```

### 3.12 Testing strategy

Vitest, in `src/tests/`, matching the repo's existing conventions:

| Test | Asserts |
|---|---|
| `perfEngineModel.test.js` | frame-time algebra: p-norm reduces to `max` as k→∞ and to sum at k=1; FPS↔ms round-trips; engine caps floor the frame time |
| `perfEngineMemory.test.js` | RAM/VRAM factor curves are monotonic, continuous at the knee, and **exactly 1.0 when metadata is missing** |
| `perfEngineConfidence.test.js` | never returns 100; a `prior` basis on either side always lands below the "confident" band; every deduction has a reason string |
| `perfFit.test.js` | the ALS fit recovers known indices from a **noise-free** synthetic corpus to within 0.01%, and from a sparse corpus with ±1% noise to within 3%. (Measured on the prototype: 4×10⁻¹⁴ % and 1.6% respectively.) |
| `perfValidation.test.js` | reads `perfModel.report.json`, asserts `mapeAvg ≤ 0.10` — the accuracy floor, in CI |
| `perfModelIntegrity.test.js` | every `gpuId`/`cpuId`/`gameId` in the corpus resolves against the catalogue; every source has a URL and a date; no orphaned entries |
| `perfEngineRegression.test.js` | snapshot of 12 representative builds — the before/after sweep, in test form |
| `legacyEngineUntouched.test.js` | `gameFps`/`estimateFps`/`computeBottleneck` still return their current values for a fixed input set |

That last one is the guard on the "alongside, migrate later" decision. It fails loudly if the new work leaks into the old path, which is the failure mode that would otherwise silently move every CustomPC score.

Alongside it, the corpus needs the same treatment `catalogueCompatibility.test.js` gives the parts catalogue: an audit that asks *"is anything unusable?"* rather than only checking pairs. `perfModelIntegrity.test.js` is that audit, and it must be re-run after every data widening.

---

## 4. API design

The engine is a client-side module, so the contract below is the **module contract**. It is specified in REST shape so that a Supabase Edge Function wrapper (`supabase/functions/performance/`) is a thin adapter rather than a redesign — but that wrapper is explicitly out of scope until something external needs it.

| REST form | Module form |
|---|---|
| `POST /api/performance/calculate` | `estimateBuildPerformance(input)` |
| `GET /api/performance/build/:code` | `estimateBuildPerformance(decodeBuild(code))` |
| `GET /api/performance/model` | `getModelMeta()` |
| `GET /api/performance/coverage?gpuId=…` | `getCoverage({ gpuId })` |

### 4.1 `POST /api/performance/calculate`

**Request**

```json
{
  "cpuId": "cpu-ryzen-5-7600x",
  "gpuId": "gpu-rtx-5070",
  "ramId": "ram-corsair-ddr5-32",
  "psuId": "psu-corsair-rm750e",
  "storageId": "storage-samsung-990-2tb",
  "coolerId": "cooler-noctua-d15",
  "resolution": "1440p",
  "presetId": "high",
  "gameIds": ["cyberpunk", "warzone", "cs2", "fortnite"]
}
```

`cpuId` and `gpuId` are required. Everything else is optional; omitting a part removes its adjustment and deducts confidence rather than failing. `gameIds` omitted means all games in the catalogue.

**Response `200`**

```json
{
  "modelVersion": "1.0.0",
  "datasetVersion": "2026-08-07",
  "generatedAt": "2026-08-07T14:31:00.412Z",
  "resolution": "1440p",
  "presetId": "high",

  "build": {
    "cpu": { "id": "cpu-ryzen-5-7600x", "name": "AMD Ryzen 5 7600X" },
    "gpu": { "id": "gpu-rtx-5070", "name": "NVIDIA GeForce RTX 5070", "vramGb": 12 },
    "totalPrice": 1249.94
  },

  "games": [
    {
      "gameId": "cs2", "name": "Counter-Strike 2", "preset": "High",
      "avgFps": 341, "lowFps": 208, "frameTimeMs": 2.93,
      "limitedBy": "cpu", "cpuShare": 0.91,
      "atEngineCap": false, "vramShortGb": 0,
      "confidence": { "score": 88, "band": "measured", "reasons": [] }
    },
    {
      "gameId": "fortnite", "name": "Fortnite", "preset": "High",
      "avgFps": 198, "lowFps": 141, "frameTimeMs": 5.05,
      "limitedBy": "balanced", "cpuShare": 0.55,
      "atEngineCap": false, "vramShortGb": 0,
      "confidence": { "score": 83, "band": "confident",
                      "reasons": ["interpolated between measured parts"] }
    },
    {
      "gameId": "warzone", "name": "Call of Duty: Warzone", "preset": "High",
      "avgFps": 164, "lowFps": 119, "frameTimeMs": 6.10,
      "limitedBy": "balanced", "cpuShare": 0.48,
      "atEngineCap": false, "vramShortGb": 0,
      "confidence": { "score": 81, "band": "confident",
                      "reasons": ["interpolated between measured parts"] }
    },
    {
      "gameId": "cyberpunk", "name": "Cyberpunk 2077", "preset": "High",
      "avgFps": 142, "lowFps": 102, "frameTimeMs": 7.03,
      "limitedBy": "gpu", "cpuShare": 0.363,
      "atEngineCap": false, "vramShortGb": 0,
      "confidence": { "score": 78, "band": "confident",
                      "reasons": ["interpolated between measured parts"] }
    }
  ],

  "bottleneck": {
    "limitedBy": "balanced",
    "cpuShareMean": 0.575,
    "gpuOnlyFpsMean": 232,
    "cpuOnlyFpsMean": 248,
    "balancePct": 91,
    "verdict": "Well matched at 1440p. The CPU leads in CS2 and Fortnite; the GPU leads in Cyberpunk 2077 — which is the healthy arrangement at this resolution.",
    "nextUpgrade": { "category": "gpu", "reason": "Raises the heaviest titles; the CPU has headroom left at 1440p." }
  },

  "power": {
    "idleW": 44, "gamingW": 322, "peakW": 415,
    "recommendedPsuW": 600, "psuHeadroomPct": 81, "loadPointPct": 43
  },

  "refresh": {
    "refreshHz": 144, "basisFps": 164, "reachedIn": 3, "ofGames": 4,
    "matches": [
      { "id": "mon-dell-s2721dgf", "name": "Dell S2721DGF 27\" QHD 165Hz",
        "refresh": 165, "resolution": "1440p", "price": 329.99 }
    ]
  },

  "value": { "fpsPerHundredPounds": 14.5, "medianAvgFps": 181, "totalPrice": 1249.94 },

  "confidence": { "score": 83, "band": "confident",
                  "coverage": { "gpuBasis": "measured", "cpuBasis": "measured",
                                "gamesWithDirectData": 3, "gamesModelled": 1 } },

  "caveat": "Estimates from published benchmark measurements, normalised across sources. Real results vary with drivers, settings, background load and the specific scene."
}
```

**Errors**

```json
{ "error": "unknown_part", "field": "gpuId", "value": "gpu-nope",
  "message": "No catalogue part with that id." }
```

`400 unknown_part` · `400 missing_required` (no CPU or no GPU) · `400 unsupported_resolution` (must pass the same allow-list `buildCodec.js` already enforces) · `422 no_model` (model artefact unreadable — the client falls back to the bundled one and never surfaces this).

### 4.2 `GET /api/performance/build/:shareCode`

Takes an existing share code. Query params `?res=1440p&preset=high&games=cs2,cyberpunk` override what the code carries. Same response body. **The 4096-character cap and the resolution allow-list from `buildCodec.js` apply unchanged** — this endpoint must not become a second, softer entry point for share-code input.

### 4.3 `GET /api/performance/model`

```json
{
  "modelVersion": "1.0.0", "datasetVersion": "2026-08-07",
  "fittedAt": "2026-08-07T14:22:03.118Z",
  "entryCount": 247, "sourceCount": 19,
  "coverage": { "gpusMeasured": 48, "gpusTotal": 79,
                "cpusMeasured": 44, "cpusTotal": 80,
                "gamesMeasured": 20, "gamesTotal": 22 },
  "validation": { "n": 31, "mapeAvg": 0.061, "mapeLow": 0.094 },
  "sources": [
    { "outlet": "Hardware Unboxed", "entries": 41, "lastPublished": "2026-02-19" }
  ]
}
```

This one is public-facing on purpose: it is the page the methodology link points at (§9.5), and publishing the coverage and error figures is the cheapest trust-building move available.

### 4.4 `GET /api/performance/coverage?gpuId=gpu-rtx-5070`

```json
{
  "partId": "gpu-rtx-5070", "basis": "measured",
  "index": { "1080p": 61.4, "1440p": 62.0, "4k": 60.1 },
  "anchors": 11,
  "games": ["cyberpunk", "warzone", "cs2", "fortnite", "…"],
  "sources": ["Hardware Unboxed", "Digital Foundry"],
  "nearestMeasuredNeighbours": ["gpu-rtx-4070ti", "gpu-rx-7800xt"]
}
```

Feeds the `/gpu/:slug` SEO page (§6) and the "why is confidence low here?" disclosure.

---

## 5. Frontend integration

### 5.1 The button

`src/components/RunPerformanceTest.jsx`, rendered in `BuildSummary.jsx` beneath the parts list, and again on the Build tab next to `BuildRatingPanel`.

States: **enabled** (CPU + GPU present) · **disabled with a reason** (`"Pick a CPU and graphics card to run a performance test"`) · **open** (label becomes "Hide performance test"). No spinner, no simulated delay.

### 5.2 The report

`src/components/performance/PerformanceReport.jsx`, composed of small single-purpose children in the style the repo already uses:

```
PerformanceReport
├ PerfHeader          resolution + preset selectors, model version, overall confidence
├ FpsCardGrid         one FpsCard per game
├ BottleneckPanel     BottleneckBar + verdict + next-upgrade line
├ PowerPanel          idle/gaming/peak, PSU headroom, load point
├ RefreshPanel        recommended Hz + up to 3 catalogue monitors
├ ValuePanel          fps per £100, comparison against the build's price band
└ PerfFooter          methodology link, source count, data-as-of date, FPS_CAVEAT
```

Changing resolution or preset in `PerfHeader` recomputes from the memo cache — instant, no refetch.

### 5.3 FPS cards

```
┌─────────────────────────────────┐
│ Cyberpunk 2077          High    │
│                                 │
│  142 fps       102 fps          │
│  average        1% low          │
│                                 │
│  █████████████░░░░░░░  GPU-led  │
│  ● confident · 78               │
└─────────────────────────────────┘
```

- Average is the large figure; 1% low sits beside it at equal visual weight, **not** as a footnote. The gap between them is the most useful thing on the card — a build with 142/102 and one with 142/48 feel completely different, and only the second number says so.
- The bar is `cpuShare`, filled from the GPU end, with the label following it.
- `ConfidenceChip` colours by band using the existing tokens (`bg-good` / `bg-ok` / `bg-bad`), with the reason list behind a disclosure — the same expandable-detail pattern `BuildRatingPanel` already uses for weak-link rows.
- `vramShortGb > 0` adds a warning strip: *"12 GB is 1 GB short at these settings — expect stutter beyond what the average suggests."*
- `atEngineCap` reuses the existing "engine cap" label from `GamePerformanceList`.

### 5.4 Charts

**Inline SVG, no chart library.** The CSP is first-party-only and the dependency list is deliberately short; adding a charting package to draw three bar charts would be the largest new dependency in the project. Three components, ~60 lines each:

- `FpsBarChart` — horizontal bars, games sorted by average, a lighter overlay for the 1% low, and a dashed rule at the recommended refresh rate. Reading whether a build clears 144 Hz should be one glance.
- `BottleneckBar` — a two-segment bar, CPU-led/GPU-led, marked at the balanced band.
- `FrameTimeStrip` — average vs 1% low frame times in ms, which makes the consistency story legible in the units the model actually works in.

All three must satisfy the palette-contrast test that already pins the design tokens, and carry a `<title>`/`aria-label` so the numbers are reachable without seeing the chart.

### 5.5 Where it sits relative to the existing FPS list

`GamePerformanceList` (old model) stays in the Summary. The report is a distinct panel with its own surface and header, and its footer names the model version. If having both on one screen proves confusing in use, the resolution is to migrate `GamePerformanceList` onto the engine — which is Phase 6 — **not** to quietly delete it and move the ratings panel onto a model it was never calibrated against.

### 5.6 Shareable report

Extend the existing share codec rather than inventing a second one:

- `buildCodec.js` gains optional `presetId` and `gameIds` alongside the existing `resolution`, plus `modelVersion` and `datasetVersion`.
- New route `#/report/<code>` via `usePageRoute`, which already owns the slashed-hash namespace.
- **All existing hardening applies unchanged**: the 4096-char cap before `atob`, the resolution allow-list, the budget clamp, and the category allow-list against prototype pollution. `presetId` and `gameIds` get the same treatment — allow-listed against the games catalogue and the game's own preset list, never trusted as keys.
- Opening a report generated under an older model shows *"estimated under model 1.2 · data as of March 2026"* and offers a "re-run under the current model" button. Silently recomputing would mean a shared link showing different numbers to two people, which is worse than a slightly stale one.
- Copy-to-clipboard produces a Markdown summary via the existing `buildMarkdown.js` helper.

### 5.7 Accessibility

Every figure exists as text, not only as a bar. Confidence bands are named in words as well as coloured — `bg-good`/`bg-ok`/`bg-bad` alone would fail for colour-blind users. Body copy uses `text-muted` (7.18:1), never `text-faint`, and the FPS caveat follows the same rule as every other piece of legal copy in the app.

---

## 6. SEO strategy

> **Dependency, stated plainly: none of this can ship on the current routing.** Every route is a hash route, so Google discards the fragment and the site has exactly one indexable URL. `/builds/…`, `/gpu/…` and `/cpu/…` cannot exist until real paths and prerendering land. That is a separate project (§8, Phase 7) and this section specifies what it would produce, not something Phase 1–5 delivers.

### 6.1 URL scheme

| Pattern | Count | Content |
|---|---|---|
| `/gpu/:slug` | 79 | index, per-game FPS across three resolutions, CPU pairing table, power, coverage |
| `/cpu/:slug` | 80 | index, per-game FPS, GPU pairing table, platform and memory notes |
| `/builds/:cpu-slug-:gpu-slug` | curated ~120 | the full report for a named pairing, with the parts list that produced it |
| `/games/:slug` | 22 | hardware requirements, "what runs this at 60/144 fps", preset comparison |
| `/methodology` | 1 | how the engine works, sources, coverage, validation error |

**Do not generate all 6,320 CPU×GPU combinations.** Thin, near-duplicate pages at that volume are a doorway-content pattern and can suppress the whole domain. Generate `/builds/` pages only for pairings that (a) have real measured data on both sides and (b) correspond to a coherent build the auto-builder would actually produce. ~120 good pages beat 6,320 bad ones, and the set can grow as coverage does.

The existing SEO notes already flag the same trap for the 559 part pages: **a bare spec table reads as thin content.** These pages avoid it because they carry something genuinely unique — measured frame rates, a bottleneck verdict, a power figure, and a named source list.

### 6.2 Generation

A build-time step, `scripts/gen-seo-pages.mjs`, running after `perf:fit`:

1. Read `perfModel.json` + the catalogue.
2. Choose the page set by the coverage rules above.
3. Render each to static HTML with real content in the markup — not an empty `#root`.
4. Emit into `dist/` and regenerate `public/sitemap.xml` with real `lastmod` dates from `datasetVersion`.

Prerendering is the load-bearing part. Real paths without it get pages Google can reach but that contain nothing on arrival.

### 6.3 Metadata per page type

`/gpu/rtx-5070`:

```html
<title>RTX 5070 Gaming Performance — FPS in 22 Games (1080p/1440p/4K) | Custom PC Builder</title>
<meta name="description" content="Measured RTX 5070 frame rates across 22 games at 1080p, 1440p and 4K, with 1% lows, power draw and the CPUs that pair well with it. Data from 19 published reviews, updated August 2026.">
<link rel="canonical" href="https://custompcbuilder.netlify.app/gpu/rtx-5070">
```

`/builds/ryzen-7600-rtx-5070`:

```html
<title>Ryzen 5 7600 + RTX 5070: Real FPS in 22 Games | Custom PC Builder</title>
<meta name="description" content="What a Ryzen 5 7600 and RTX 5070 actually deliver — 164 fps in Warzone at 1440p High, 142 in Cyberpunk 2077, with 1% lows, bottleneck analysis and a 322 W measured-basis power estimate.">
```

Rules across all types: **titles carry the specific number where there is one** — "164 fps in Warzone at 1440p" is a click, "gaming performance" is not. Descriptions stay 140–160 characters and name the data source and its date, because freshness is the whole pitch. Canonicals are absolute. Every page reuses the existing complete OG/Twitter block from `index.html` with page-specific `og:title`/`og:description`, and a generated OG image via the `scripts/og-image.mjs` pipeline that already exists.

### 6.4 Structured data

JSON-LD on every page. `Dataset` on `/methodology` (a real, honest fit for a curated benchmark corpus), `FAQPage` on game pages where "will X run Y" is answered directly, and `BreadcrumbList` throughout.

**Do not use `Product` + `AggregateRating` markup on part pages.** There are no reviews and no ratings, and inventing structured data to win a rich snippet is the same category of mistake as inventing specifications — with the added detail that Google issues manual actions for it.

### 6.5 Internal linking

Each `/builds/` page links to both its `/cpu/` and `/gpu/` page and to the games it covers. Each `/gpu/` page links to its best-value pairings. The builder deep-links into the relevant `/builds/` page when a user lands on a matching configuration, and every SEO page has a prominent "open this build in the 3D builder" call to action — the pages exist to feed the tool, not to be the destination.

---

## 7. Monetization hooks

**Current state, and it stays this way for now:** there is no affiliate relationship. `AMAZON_TAG` and `AFFILIATE_DISCLOSURE` were deleted on 2 August, the terms page affirmatively says *not an affiliate, no commission*, and `retailerLinks.test.js` + `legalContent.test.js` assert those constants stay gone. **This design does not reinstate them and does not modify those two tests.**

What it adds is a **self-enforcing placeholder**: the slots are named, positioned and ready, but inert, and they carry their own legal obligation in a form that cannot be quietly dropped.

### 7.1 The slot

```js
// src/lib/retailerSlots.js
//
// PLACEHOLDER — no affiliate relationship exists today. `disclosure` is null and
// the href is a plain amazon.co.uk search URL, exactly as retailerLinks.js emits.
//
// BEFORE adding any tag or ref parameter, ALL of the following are required:
//   1. an accepted Amazon Associates application, and site registration
//   2. the exact phrase "As an Amazon Associate I earn from qualifying purchases"
//   3. a visible disclosure ABOVE the link in all three places it appears:
//      the parts browser listings, the summary price note, and the footer
//      (CMA/ASA require it visible before the click, not in a policy page)
//   4. the terms page's "not an affiliate, no commission" line updated
//
// retailerSlots.test.js FAILS if a tag or ref appears while `disclosure` is null.
// That test is the enforcement — do not weaken it to make a link work.

export function retailerSlot(part) {
  return { href: searchUrl(part), label: 'Find best price', disclosure: null, monetised: false }
}
```

```js
// src/tests/retailerSlots.test.js
it('never emits a monetised link without its disclosure', () => {
  for (const part of allParts) {
    const slot = retailerSlot(part)
    if (/[?&](tag|ref)=/.test(slot.href) || slot.monetised) {
      expect(slot.disclosure).toBeTruthy()
      expect(slot.disclosure).toContain('As an Amazon Associate I earn from qualifying purchases')
    }
  }
})
```

The existing legal notes warn that a constant sitting at `''` invites someone to fill it in without restoring the disclosure that legally travels with it. This construction is the answer: the placeholder exists, but filling it in without the disclosure breaks the build.

### 7.2 Where the slots sit

Four positions, chosen so a future link never interrupts a decision in progress:

| Position | Component | Why here |
|---|---|---|
| Below the recommended monitor | `RefreshPanel` | The user has just been told what refresh rate to buy. This is the highest-intent, lowest-friction placement on the page. |
| Beside the next-upgrade suggestion | `BottleneckPanel` | The engine has just identified the one part worth changing. A price next to that is help, not an advert. |
| In the value comparison row | `ValuePanel` | Comparing fps-per-pound against alternatives is inherently a price context. |
| Parts list rows in the report | `PerformanceReport` | Where `retailerLinks` already puts them elsewhere in the app. |

**Not** in the FPS cards, not in the confidence disclosure, and never above the numbers. The report's credibility is the product; a link that arrives before the answer spends that credibility to save a scroll.

### 7.3 Value scoring — real, and shippable now

Value scoring needs no affiliate relationship and ships in Phase 5. It extends the existing `valuePerPound(part)` to the build level:

```js
export function buildValue(report, parts) {
  const price = totalPrice(parts)
  const median = medianAvgFps(report.games)
  return {
    fpsPerHundredPounds: Number((median / (price / 100)).toFixed(1)),
    medianAvgFps: median,
    totalPrice: price,
    // "your build vs what this money usually buys" — the comparison that
    // actually helps, computed from auto-build at the same budget
    versusBudgetPar: comparePar(report, price),
  }
}
```

`versusBudgetPar` is the interesting one: run `buildForUseCase` at the same budget, estimate *that* build, and report the difference. It answers "am I getting my money's worth?" — which is the question, and it does it without a single price feed or partner.

**The `PRICE_SNAPSHOT` caveat applies to every figure here.** Value scores computed from curated estimate prices are themselves estimates, and the panel says so in the same place and the same words the rest of the app already uses.

---

## 8. MVP implementation plan

Effort is working days for a solo developer already fluent in this codebase. Data curation is the long pole and runs in parallel from Phase 0 onward — it is quoted separately because it is not blocked by code.

### Phase 0 — Foundation and curation harness · 3–4 days

- `data/benchmarks/` schema, `sources.json` / `entries.json` / `validation.json`.
- `scripts/add-bench-entry.mjs` — a guided prompt that will not accept an entry without a source URL, date, test system and settings. Curation quality is decided here; a loose intake never recovers.
- `perfModelIntegrity.test.js` — ids resolve, sources complete, no orphans.
- Extend `gamesData.json` additively (§2.3), JSON + Supabase in one script, checksum both sides.
- Seed corpus: 40–60 entries across 6 games, enough to exercise the fit.

**Exit:** integrity test green, corpus loads, catalogue checksums match on both sides.

### Phase 1 — Exact-match FPS engine · 5–7 days

- `scripts/fit-perf-model.mjs` passes 1–2 (GPU and CPU indices) and 6 (validation).
- `perfEngine/frameTime.js`, `indices.js`, `index.js`.
- Exact-cell short-circuit: a measured `(cpu, gpu, game, res, preset)` returns the measurement, untouched by the model.
- `RunPerformanceTest` + a minimal `PerformanceReport` with `FpsCardGrid` (averages only).
- `legacyEngineUntouched.test.js` from day one.

**Exit:** a build with measured parts returns measured numbers; `mapeAvg ≤ 0.12` on held-out pairs.

### Phase 2 — Interpolation, priors and confidence · 3–4 days

- Fit passes 3–5: preset-tier fallback, resolution copying, `perfScore` priors.
- `confidence.js` + `ConfidenceChip` + the reasons disclosure.
- `getCoverage()` and `/api/performance/model` equivalents.
- Corpus to ~150 entries; every catalogue GPU and CPU now returns something, labelled.

**Exit:** all 79 GPUs and 80 CPUs produce an estimate with an honest basis; `mapeAvg ≤ 0.10`.

### Phase 3 — Bottleneck, 1% lows, RAM and VRAM · 4–5 days

- `memory.js`, `lows.js`; fit pass 3 for `lowBase` and pass 4 for `k`.
- `BottleneckPanel`, `BottleneckBar`, the next-upgrade line.
- 1% lows on every card; the VRAM warning strip.
- Corpus to ~250 entries, weighted toward sources that publish 1% lows and toward VRAM-limited configurations.

**Exit:** `mapeLow ≤ 0.15`; an 8 GB card at 1440p Ultra visibly reproduces the collapsing-lows signature.

### Phase 4 — Power and refresh · 2–3 days

- `power.js`, `refresh.js`; `PowerPanel`, `RefreshPanel` with the three catalogue monitors.
- The `retailerSlots.js` placeholder and its enforcing test (§7.1).

**Exit:** power figures sit within ~10% of published system-draw measurements on the validation builds; `systemDrawW` and the PSU warning are provably unchanged.

### Phase 5 — Value scoring and shareable reports · 3–4 days

- `buildValue`, `versusBudgetPar`, `ValuePanel`.
- `buildCodec` extension, `#/report/<code>`, model-version labelling, Markdown export.
- All existing codec hardening re-asserted against the new fields.

**Exit:** a shared report opens under its original model version with the correct numbers and the correct label.

**Running total for the feature: 17–23 days**, plus roughly 6–10 days of curation spread across Phases 0–3.

### Phase 6 — Migrate the ratings path · 3–5 days · *separate decision*

Point `partSynergy` at the engine and retire `fpsEstimate`/`gameFps`/`bottleneck`. Gated on a full before/after sweep across budgets × use cases, because it moves every CustomPC score and every auto-build result. The repo's own history is clear that scoring changes are measured with a sweep and never by reading, and that the sweep runs through `buildForUseCase`, not `autoBuild` directly.

### Phase 7 — SEO pages · 5–8 days · *blocked on routing*

Requires the hash-route-to-real-path rework (a further 3–5 days, touching navigation and share links) plus a prerender step. Everything in §6 depends on it. Worth doing — the long-tail traffic is real — but it is a different project with a different risk profile.

### Sequencing note

Phases 1–5 ship in order and each is independently useful. Phase 0's curation harness is the highest-leverage day in the plan: everything downstream inherits the discipline of the intake, and a corpus with missing provenance cannot be retro-fixed.

---

## 9. Risks and mitigations

### 9.1 Benchmark data licensing

**The risk.** In the UK, individual facts are not copyrightable, but a *compilation* attracts the sui generis database right, which protects investment in obtaining, verifying and presenting it. Extracting a substantial part of one outlet's benchmark database — even by hand — infringes it. Repeated extraction of insubstantial parts that cumulatively amount to a substantial part also infringes.

**Mitigations, in order of importance:**

1. **Spread across sources.** ~250 entries drawn from ~19 outlets is ~13 figures each — nobody's compilation is substantially taken. Enforced by a fit-time assertion: **no single source may exceed 20% of entries**, and the build warns above 15%.
2. **Transform, don't republish.** The site never displays a source's numbers. It displays *fitted indices and derived estimates* — a genuinely new work, produced by a documented method, from which the inputs cannot be recovered.
3. **Attribute anyway.** `/methodology` lists every source with outlet, title, link and date. Not legally required for facts, but it costs nothing, it is what an honest project does, and it converts a potential complaint into traffic for the outlet.
4. **Never scrape.** Manual entry through the Phase 0 harness only. No automated collection, which also keeps the project clear of ToS terms that prohibit it independently of copyright.
5. **Honour takedowns immediately.** `sourceId` is on every entry, so removing one outlet entirely is one filter and one re-fit. Because the model is fitted rather than stored, losing a source degrades accuracy slightly instead of leaving holes.
6. **Prefer sources that invite citation.** Outlets publishing under CC licences, and manufacturers' own published figures, carry no risk at all. Weight the corpus toward them where the data quality allows.

**Residual risk: low, not zero.** It is bounded by the fact that no source's compilation is reproducible from what ships, and by an immediate, mechanical takedown path.

### 9.2 Data quality

**The risk.** Outlets test different scenes with different drivers on different memory. Two "Cyberpunk 1440p Ultra" numbers can differ 25% for entirely legitimate reasons.

**Mitigations.** `sceneNote` and the full `testSystem` are mandatory (§2.1–2.2), so disagreement is diagnosable rather than mysterious. The model fits *shapes*, not absolute levels, and shapes agree across outlets far better than levels do. Per-cell `cv` is computed, shipped and fed into confidence, so a contested cell openly looks less certain than a settled one. Held-out validation measures real error rather than fit quality, and a regression fails the build. Suspect sources get `weight: 0.5` instead of deletion, preserving the record.

### 9.3 Performance drift over time

**The risk.** Drivers, game patches and Windows updates move real frame rates by 10–20% over a couple of years. A 2024 measurement describes a game that no longer exists in that form.

**Mitigations.** Every entry carries `published`; every cell carries `medianDate`; confidence deducts 3 points per year, capped at 12. `datasetVersion` is shown on every report and every page. The `/methodology` coverage table exposes which cells are getting old, so the refresh backlog is visible rather than discovered. Append-and-supersede means a refresh adds rows and demotes old ones, keeping the drift itself measurable — the delta between a superseded entry and its replacement *is* the drift, and it can be reported.

**Accepted:** a game that receives a major engine update needs its cells re-measured, not adjusted. There is no honest shortcut, and the plan should not pretend there is one.

### 9.4 Hardware naming inconsistencies

**The risk.** "RTX 4070 Ti" / "GeForce RTX 4070 Ti" / "4070Ti" / "RTX 4070Ti SUPER" — and worse, AIB variants with different clocks, and genuinely distinct parts sharing a name (RTX 4080 12 GB, RX 6900 XT XTXH, the several Ryzen 5 5600 variants).

**Mitigations.** **Catalogue ids are the only identifier the corpus uses** — `gpu-rtx-4070ti`, never a name string. The Phase 0 harness resolves a typed name against the catalogue and *refuses the entry* if it is ambiguous, rather than guessing. `perfModelIntegrity.test.js` asserts every id in the corpus resolves. An `aliases` array on catalogue parts maps the name variants seen in the wild to the canonical id, for the harness and for the SEO slug router. AIB variants are deliberately **not** modelled — the index is for the reference specification, and the report says so.

### 9.5 User trust

**The risk.** This is the one that actually decides whether the feature is worth building. An FPS estimator that is confidently wrong is worse than no estimator, and users have been trained to distrust them for good reason.

**Mitigations.**

- **Confidence is never hidden and never 100.** Every card shows its band; every deduction has a plain-English reason.
- **"No data for this card" is said out loud**, not smoothed over into a number that looks like the others.
- **A public `/methodology` page** with the source list, the coverage table and the *actual validation error*. Publishing "median error 6.1%, 90th percentile 11.8%" is a stronger trust signal than any amount of polish, and it is free.
- **Averages and 1% lows have equal visual weight.** Quoting only averages is the standard way these tools mislead.
- **`FPS_CAVEAT` stays**, next to the numbers, in `text-muted` and not `text-faint` — the existing rule that a disclaimer nobody can read is not a disclaimer.
- **The comparison to the old model is a feature, not an embarrassment.** If the engine disagrees with `GamePerformanceList`, that is a real signal about the old heuristic and a reason to accelerate Phase 6.

### 9.6 The catalogue's own provenance

**The risk, stated honestly because it is the one most likely to be forgotten:** the 559 catalogue parts are model-generated plausible estimates. Attaching real measured benchmarks to them creates a mixed artefact — real frame rates against estimated prices.

**Why it is acceptable:** the *product names* are real, so a real measurement genuinely applies to the named part. The engine retires `perfScore` from the FPS path entirely, which makes the performance figures strictly more truthful than what ships today.

**What must not happen:** value scores and price comparisons inherit the estimate caveat and must display it, because an fps-per-pound figure is only as real as its denominator. The `PRICE_SNAPSHOT` caveat is not optional decoration in `ValuePanel`.

---

## Appendix A — worked example

Ryzen 5 7600X + RTX 5070, 32 GB DDR5-5600 (2×16), Cyberpunk 2077, 1440p, High.

```
gpuIndex[gpu-rtx-5070][1440p] = 62.0    basis measured, 11 anchors
cpuIndex[cpu-ryzen-5-7600x]   = 71.2    basis measured, 9 anchors
cell = gameConst.cyberpunk['1440p'].high → A = 399.0, B = 402.0, lowBase = 1.35
                                            sources 3, cv 0.052, medianDate 2025-11
        (A and B are in ms·index units, so dividing by a dimensionless index
         yields milliseconds directly)

VRAM   need 8.5 GB at 1440p High, have 12 GB → no deficit → avg 1.00, low 1.00
RAM    AM5 baseline 6000, kit 5600 (under the 6400 cap), e = 0.12
       speed factor = (6000/5600)^0.12 = 1.0083
       2 sticks → channel factor 1.00;  32 GB ≥ 16 GB rec → capacity 1.00, 1.00

t_gpu = 399.0 / 62.0 × 1.00                       = 6.435 ms
t_cpu = 402.0 × 1.012 / 71.2 × 1.0083             = 5.761 ms

t     = (6.435^5.1 + 5.761^5.1)^(1/5.1)           = 7.03 ms
        max() alone would have said 6.435 ms → 155 fps, a 9% over-estimate
fps   = 1000 / 7.03                                = 142  →  reported 142 fps avg

cpuShare = 5.761^5.1 / (6.435^5.1 + 5.761^5.1)     = 0.363  → limitedBy "gpu"

lowRatio = 1.35 × (1 + 0.24 × 0.363²) × 1.00 × 1.00 = 1.393
t_low    = 7.03 × 1.393 = 9.79 ms  →  102 fps 1% low

confidence: 100
  − 8   cell interpolated (no exact 7600X + 5070 measurement)
  − 12 × |log2(62.0/59.5)| = 0.7   nearest GPU anchor is the 4070 Ti
  − 12 × |log2(71.2/74.0)| = 0.7   nearest CPU anchor
  − 200 × 0.052 = 10.4             three sources, moderate disagreement
  − 3 × 0.75 = 2.25                data median Nov 2025
  = 78  →  band "confident"
```

Reported: **142 fps average, 102 fps 1% low, GPU-led, confidence 78 (confident)**.

Power for the same build (§3.9), using the real catalogue TDPs — RTX 5070 250 W,
Ryzen 5 7600X 105 W — and the mean `cpuShare` of 0.575 across the four selected games:

```
gpuLoad = 0.98 − 0.35 × 0.575 = 0.779      cpuLoad = 0.42 + 0.30 × 0.575 = 0.593
gaming  = 250 × 0.779 + 105 × 0.593 + 35 + 6 + 6 + 6 + 12  = 322 W
peak    = 250 × 1.00  + 105 × 0.95  + 65                    = 415 W
idle    = 18 + 0.06 × 250 + 0.10 × 105                      = 44 W
recommendedPsuW = ceil(415 × 1.35 / 50) × 50                = 600 W
with the 750 W unit selected: 81% headroom, sitting at 43% load while gaming
```

---

## Appendix B — file manifest

**New**

```
data/benchmarks/sources.json
data/benchmarks/entries.json
data/benchmarks/validation.json
scripts/add-bench-entry.mjs
scripts/fit-perf-model.mjs
src/data/perfModel.json                    (generated, committed)
src/data/perfModel.report.json             (generated, committed, not imported)
src/lib/perfEngine/index.js
src/lib/perfEngine/frameTime.js
src/lib/perfEngine/indices.js
src/lib/perfEngine/memory.js
src/lib/perfEngine/lows.js
src/lib/perfEngine/power.js
src/lib/perfEngine/refresh.js
src/lib/perfEngine/confidence.js
src/lib/perfEngine/cache.js
src/lib/retailerSlots.js
src/components/RunPerformanceTest.jsx
src/components/performance/PerformanceReport.jsx
src/components/performance/PerfHeader.jsx
src/components/performance/FpsCard.jsx
src/components/performance/FpsCardGrid.jsx
src/components/performance/FpsBarChart.jsx
src/components/performance/BottleneckPanel.jsx
src/components/performance/BottleneckBar.jsx
src/components/performance/FrameTimeStrip.jsx
src/components/performance/PowerPanel.jsx
src/components/performance/RefreshPanel.jsx
src/components/performance/ValuePanel.jsx
src/components/performance/ConfidenceChip.jsx
src/tests/perfEngineModel.test.js
src/tests/perfEngineMemory.test.js
src/tests/perfEngineConfidence.test.js
src/tests/perfEngineRegression.test.js
src/tests/perfFit.test.js
src/tests/perfValidation.test.js
src/tests/perfModelIntegrity.test.js
src/tests/retailerSlots.test.js
src/tests/legacyEngineUntouched.test.js
```

**Modified**

```
src/data/gamesData.json        additive fields only (§2.3)
src/lib/buildCodec.js          optional presetId + gameIds, same hardening
src/components/BuildSummary.jsx  renders <RunPerformanceTest />
src/hooks/usePageRoute.js      #/report/<code>
package.json                   perf:fit, perf:add scripts
```

**Explicitly untouched**

```
src/lib/fpsEstimate.js  src/lib/gameFps.js  src/lib/bottleneck.js
src/lib/partSynergy.js  src/lib/partRatings.js  src/lib/autoBuilder.js
src/lib/retailerLinks.js  src/lib/legalContent.js
src/tests/retailerLinks.test.js  src/tests/legalContent.test.js
```
