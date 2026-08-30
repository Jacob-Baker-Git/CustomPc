# Estimates backed by hardware facts, and an honest basis for every row

**Status:** approved design, not yet planned
**Date:** 2026-08-13
**Builds on:** `2026-08-07-performance-engine-design.md` (§2.4 already specifies `basis: "prior"`; this is that deferred piece, plus one more)

---

## The problem, measured

The performance tab is blank or near-blank for almost everybody. Measured on the
committed model, against an RTX 4070:

| | 1080p | 1440p | 4K |
|---|---:|---:|---:|
| 23 of the 24 indexed CPUs | 0 | 5 | 5 |
| `ryzen-7-9800x3d` (the fit anchor, has exact rows) | 77 | 36 | 35 |
| **the other 54 catalogue CPUs** | **0** | **0** | **0** |

Three independent causes. Fixing any one leaves the others untouched, which is why
all three are in scope:

1. **Breadth.** 54 of 80 catalogue CPUs and 39 of 79 GPUs have no index, so those
   builds answer nothing at all. A part gets an index only if a review charted it.
2. **Depth.** A game row needs a per-cell GPU constant `A` **and** a CPU constant
   `B`. Only **10 cells** have both — 5 games × 1440p/4K. **121 cells have `A`
   alone** and are currently refused outright. So even a fully indexed build sees
   5 games.
3. **1080p answers nothing at all**, for anyone, because it has **zero** `A`
   constants — the GPU fit excludes the resolution outright. The most common gaming
   resolution is the emptiest one. See §4.

Depth is capped by outlets disagreeing on vocabulary, not by data volume. GPU
reviews come from Notebookcheck (English preset names, native); CPU reviews come
from ComputerBase (German preset names, deliberate heavy upscaling to remove the
GPU from a CPU measurement). `ghost-of-tsushima` has `very-high|native` on the GPU
side and `sehr-hoch|native` on the CPU side; those are the same words in two
languages and measured **0.725 apart on identical hardware**, so they must not be
merged. More CPU reviews will not raise depth.

## What we are building

Three levers — one per cause — the labelling that makes all three safe, and the
controls that put the detail within reach without putting it on screen at once.

| § | Lever | Fixes |
|---|---|---|
| 1 | Part priors from `perfScore`, with published held-out error | breadth |
| 2 | GPU-limited rows for `A`-only cells, as upper bounds | depth |
| 4 | Fit 1080p, rejecting rows the GPU did not limit | 1080p |
| 3, 5 | Four-tier basis, per-row caveats, three controls | makes the above honest |

**Nothing here loosens the founding rule.** A number nobody measured must never be
indistinguishable from one that was. This design widens what the engine will
answer and makes the basis of every answer visible, in that order.

---

## 1. Part priors — an index from the hardware's own facts

`perf:fit` fits a regression from the catalogue's `perfScore` to the measured
index, and writes **the coefficients and its own leave-one-out error** into
`perfModel.json`. The browser applies the stored coefficients; it never refits.

Publishing the error is the point. It converts "we guessed" into "we inferred,
and here is how well that inference does on parts held out of its own fit."

### Fitted forms, chosen on leave-one-out error, not r²

In-sample r² rewards overfitting and at n=24 that is the whole risk. Every form
below was scored by predicting each part from a fit that excluded it.

**CPU — linear on `perfScore`.** n=24, median **5.5%**, p90 13.5%, worst 15.3%.
Adding `cores`, `boostClock` and `tdp` did not improve it (median 5.5–6.9%, worst
up to 21.4%) — `perfScore` already encodes what they would say. The simplest form
wins on the evidence.

All 56 unindexed CPUs carry a `perfScore` and every one falls inside the measured
span 40–106. This is interpolation; there is no extrapolation case to handle.

**GPU — log-log (power law) on `perfScore`.** Clearly better in the tail than
linear (p90 27.4% vs 47.4% at 1440p). A linear fit has a negative intercept and
collapses at the bottom of the range.

GPU accuracy is strongly band-dependent, and that is *predictable in advance*,
which is what makes it shippable:

| `perfScore` band | LOO median | LOO worst | unindexed cards there |
|---|---:|---:|---:|
| ≥ 60 | 6.7% | 13.5% | 7 |
| 40–60 | 4.4% | 27.4% | 10 |
| 25–40 | 34.2% | **89.6%** | 14 |
| < 25 | 21.0% | 29.4% | 8 |

### Every card gets an estimate; weak ones carry a wide band

**Decision:** do not refuse below a threshold. The 22 cards under `perfScore` 40
include the RTX 3060 — one of the most widely owned GPUs there is, and its owners
are exactly the people planning an upgrade. A rough number they can see is rough
serves them better than a blank tab.

So the artefact publishes **per-band** LOO error, and a row estimated from a
low-band card states its own band's error (`±35%`) rather than the model's
average. The uncertainty travels with the specific card, not with the feature.

### Artefact shape

```jsonc
"prior": {
  "cpu": {
    "form": "linear", "slope": 0.520, "intercept": 34.04,
    "n": 24, "domain": [40, 106],
    "bands": [{ "maxPerfScore": null, "looMedianPct": 5.5, "looP90Pct": 13.5 }]
  },
  "gpu": {
    "1440p": {
      "form": "loglog", "slope": 0.0, "intercept": 0.0, "n": 40,
      "bands": [
        { "maxPerfScore": 25,   "looMedianPct": 21.0, "looP90Pct": 29.4 },
        { "maxPerfScore": 40,   "looMedianPct": 34.2, "looP90Pct": 89.6 },
        { "maxPerfScore": 60,   "looMedianPct": 4.4,  "looP90Pct": 27.4 },
        { "maxPerfScore": null, "looMedianPct": 6.7,  "looP90Pct": 13.5 }
      ]
    },
    "4k": { "form": "loglog", "…": "same shape, fitted separately" }
  }
}
```

Every numeric value above is **computed by `perf:fit` on every run** — the CPU
slope/intercept and the LOO percentages are today's measured figures shown to make
the shape concrete, and the GPU coefficients are zeroed rather than invented
because they have not been fitted yet.

**Band boundaries are fixed constants; the error inside each is recomputed.**
25/40/60 were chosen by reading the error-vs-`perfScore` curve and are declared in
one place. Fitting the boundaries themselves against n=40 would overfit the very
tail this exists to describe honestly. If a refit ever shows the curve has moved,
the boundaries are edited deliberately, not drifted into.

---

## 2. GPU-limited rows — answering the 121 cells that have `A` alone

Where a cell has `A` but no `B`, compute the GPU term alone and return the result
as an **upper bound**, not a point estimate.

This is truthful rather than a workaround: with the CPU term unknown, the GPU term
genuinely is the ceiling. The row reads **"up to 94 fps"**, with "processor effect
not measured for this game" available on expand.

`indices.js` already anticipates this — its `cellFor` deliberately requires only
`A`, and its comment notes that callers needing the two-way split must check
`cell.B > 0` themselves. The `modelled` guard in `index.js` is the single place
that currently refuses, and the single place this change lands.

**We show these even when the build looks CPU-bound.** Suppressing them would
reintroduce blank rows for precisely the budget builds lever 1 just fixed, and the
"up to" framing is already the honest one for that case.

---

## 3. Row basis — four tiers, weakest input wins

| `basis` | meaning | label | bound |
|---|---|---|---|
| `measured` | this exact CPU+GPU+game+settings was benchmarked | **Benchmarked** | point |
| `modelled` | `A` and `B` both fitted, both indices measured | **Backed by real data** | point |
| `spec-derived` | any input came from a prior | **Estimate** | point |
| `ceiling` | no `B` for this game | **Estimate (upper bound)** | upper |

**`spec-derived` is not a new name.** `FpsCard.jsx` already carries it in its
`BASIS_LABEL` map, against a tier the engine has never produced — the UI was written
expecting exactly this. Reusing it beats inventing `estimated` beside it. Only its
user-facing wording changes, from "from specs" to "Estimate"; `ceiling` is the one
genuinely new tier.

A derived row is only as strong as its weakest input, so a prior index anywhere
demotes it to `spec-derived`, and a missing `B` demotes it to `ceiling`.

**An exact measurement is exempt, and that is not a loophole.** `exactFor` does
not require a part to be indexed, so a benchmark of an unindexed chip is
reachable — and the indices feed only the *split*, never the frame time. A
reading somebody took stays `measured` however its split was obtained, and
carries no caveats, because every caveat describes a derivation that did not
happen. Demoting it would push a real benchmark out of the "only show real data"
filter below. **Understating the evidence is the same class of error as
overstating it**, and the founding rule is violated by both.

Stated as one rule: the only route to `measured` is an exact benchmark of this
combination, and an exact benchmark always takes it.

Alongside the headline tier each row carries `caveats[]` naming the *specific*
reasons — `cpu-index-prior`, `gpu-index-prior`, `no-cpu-constant`,
`resolution-copied`. The badge shows the tier; the caveats appear on expand. That
matches the progressive-disclosure direction already agreed for this tab.

**`errorPct` is the worst contributing band, not a combination.** A row whose GPU
index came from a `±35%` band and whose CPU index came from a `±5.5%` one reports
**±35%**. Combining them in quadrature would imply the two errors are independent
and quantified, and neither is true — these are held-out prediction errors, not
measurement uncertainties. Taking the worst is the claim we can actually defend.

A `ceiling` row reports `errorPct` only from its indices. The missing `B` is **not**
folded into a percentage, because its effect is unbounded below — that is precisely
why the row is presented as an upper bound instead of a point.

### Tab-level summary

One line above the table: how many rows are benchmarked, backed by real data, and
estimated. The mix is then visible without reading every row, and a build sitting
entirely on estimates cannot look like one sitting on measurements.

---

## 5. Controls

Three controls, following the progressive-disclosure direction already set for this
tab — everything present, most of it folded away.

**A. "Only show real data" toggle.** Sits with the summary line. **Off by default**,
so the full picture is what you land on and nothing is hidden by a setting you did
not choose. Switched on, it drops `estimated` and `ceiling` rows and leaves only
`measured` and `modelled`. The summary line keeps reporting the true totals while
it is on, so turning it on cannot disguise how thin the measured set is.

**B. Per-row expander.** Opens that row's caveats: which index came from specs and
from which `perfScore` band, whether the CPU effect was measured for that game, the
`±` figure, and whether the resolution was copied. The badge answers *how much do I
trust this*; the expander answers *why*.

**C. "How is this worked out?" popover.** One info control near the summary,
explaining the four tiers and what the prior actually is — a regression on the
catalogue's own `perfScore` with its held-out error published. Follows the existing
`ScoreInfo.jsx` popover pattern rather than inventing a second explainer idiom.

### No recalculate button — DECIDED 2026-08-13, dropped

The report is computed in a `useMemo` in `PerformanceScreen.jsx:44` and recomputes
whenever parts or resolution change. It takes single-digit milliseconds.

A "Recalculate" control over that is either a no-op or actively misleading: a button
implies the figures on screen might be stale, and they never are. The original
engine design rejected a fake progress bar for the same reason — *"pretending
otherwise would be theatre in a feature whose entire selling point is honesty."*

The alternative considered and also rejected: gating the **first** render behind an
explicit "Estimate performance" action, so the tab opens on an explanation of what
the engine does and does not know. Defensible — it front-loads the honesty — but it
is a change to the tab's entry behaviour rather than a button on the results, and
control C already carries that explanation without making anyone click to see their
own numbers.

**The report stays reactive.** Controls A, B and C above are the whole of the UI
addition.

---

## Where the changes land

| File | Change |
|---|---|
| `src/lib/perfEngine/prior.js` | **new** — applies stored coefficients + band lookup. Pure, no fitting. |
| `src/lib/perfEngine/gpuBound.js` | **new** — the "did the GPU set this frame rate?" test (§4), pure and independently testable |
| `scripts/fit-perf-model.mjs` | fits both regressions and per-band LOO; adds `1080p` to `GPU_FIT_RESOLUTIONS` behind the §4 rejection; writes `prior` and the rejection count |
| `src/lib/perfEngine/fitTwoWay.js` | residual-based rejection inside the existing iteration |
| `src/lib/perfEngine/indices.js` | `cpuIndexFor`/`gpuIndexFor` return `basis: 'prior'` with `errorPct` when no measurement exists |
| `src/lib/perfEngine/index.js` | the `modelled` guard admits `A`-only cells as `ceiling`; row basis composition; `caveats[]` |
| `src/components/performance/FpsCard.jsx` | tier badge, "up to" for `ceiling`, `±` band, per-row expander (control B) |
| `src/components/performance/SummaryStrip.jsx` | the mix line, the real-data-only toggle (control A), the explainer popover (control C) |

One definition, two readers: the fit script writes the coefficients, `prior.js`
applies them. Neither reimplements the other — the same split `pageMeta.js` uses.
`gpuBound.js` is separated from the fit script for the same reason `benchSchema.js`
is: the rejection rule is the load-bearing honesty claim in §4 and has to be
testable without running a fit.

## Testing

- A prior-derived index can **never** surface with `basis: 'measured'`. The
  founding rule, as an assertion.
- The published LOO error matches a recomputation from the corpus — the fallback's
  stated quality has to be true, or publishing it is worse than not.
- Every `ceiling` row carries `bound: 'upper'`; no `ceiling` row renders a bare
  point figure.
- A prior is never applied outside its fitted `domain` without saying so.
- **The two 1080p rejection rules agree.** The residual threshold is calibrated
  against the 176 peer-ratio observations whose status is known independently; a
  test pins that agreement so the cheap rule cannot drift from the expensive one.
- **The `elden-ring` 60 fps cap stays rejected at 1080p.** A named regression test
  for the case that proved the rule has to be about *any* limiter, not the CPU.
- `perf:fit` warns if the 1080p rejection rate moves far from the measured ~4.5%.
- The "only show real data" toggle never changes the counts in the summary line.
- **Before/after answered-row sweep across a spread of builds**, committed as a
  fixture. Scoring and builder changes get measured here, never read — the house
  rule that has already caught two real auto-build bugs. Expected direction: 1440p
  and 4K roughly 5 → ~40 answered per build, 1080p 0 → ~145 cells available, and
  54 CPUs going from a blank tab to a populated one.

---

## 4. Fitting 1080p — reject rows the GPU did not limit

1080p currently has **zero** `A` constants. `GPU_FIT_RESOLUTIONS` excludes it at
`fit-perf-model.mjs:21` on the grounds that "there the CPU is doing the limiting",
so a GPU index fitted from it would book CPU limitation as GPU performance. That
reasoning is sound but **the blanket exclusion is too broad for this corpus**, and
it is why the most common gaming resolution is the emptiest.

### The evidence

1080p is the *largest* bucket in the corpus: **1058 rows, 47 games, 151 cells with
two or more distinct GPUs** — more than 1440p or 4K. And it is mostly mid-range
cards on fast test CPUs, where 1080p remains genuinely GPU-bound.

Measured directly: across 30 cells holding 176 card-observations at both 1080p and
1440p, only **8 (4.5%)** show a 1080p frame rate suppressed relative to their peers.
The blanket exclusion throws away ~95% good data to avoid ~5% bad.

### The rule: exclude rows where something other than the GPU set the frame rate

A card GPU-bound at both resolutions has a 1080p/1440p fps ratio determined by the
GPU's own work, and that ratio is consistent across the cards in a cell. A card
held down at 1080p — by a CPU wall, by anything — has a ratio materially **below**
its peers. That gap is the detector, and it needs no assumption about which CPU or
which card.

**The cause does not matter, and must not be guessed at.** The detector flagged
`elden-ring` with `rx-6800` and `rtx-2060-super` both at ratio exactly 1.00 — that
is the game's hard 60 fps engine cap, not a processor. A CPU wall, an engine frame
cap and a vsync are equally disqualifying for fitting a GPU index and equally
indistinguishable in the data. So the rule is stated as *"the GPU did not set this
frame rate"*, never as *"the CPU limited this"*.

**Known engine caps get an exact rule, not a statistical one.** `perfGames.json`
already declares `fpsCap` for three games — `elden-ring` 60, `gta5` 180, `apex` 300
— and the engine already applies it when *producing* an estimate. Fitting needs the
opposite: a row at or near a declared cap is measuring the cap, not the card, and is
rejected outright. That is exact and needs no peers. The statistical test then
covers the limiters nothing has declared.

Both paths live in `gpuBound.js` behind one predicate, so a caller cannot apply one
and forget the other.

### Coverage limit, and how the rest is handled

The peer-ratio test needs the same card measured in the same cell at both
resolutions, which holds for only 176 of the 1058 1080p rows. For the remainder the
fit uses **residual-based rejection**: fit, drop rows sitting far below their own
prediction, refit. Rows held down by an external limiter fall below a GPU-only
prediction; ordinary noise scatters both ways. `fitTwoWay` already iterates, so
this is a rejection step inside an existing loop rather than new machinery.

The peer-ratio test then serves as the **calibration** for that threshold: it gives
176 rows whose status is known independently, and the residual threshold is chosen
to agree with them. A test pins that agreement, so the cheap rule stays honest
against the expensive one.

### What this is worth

1080p goes from **0 answered cells to a projected ~145** (151 fittable, less the
~4.5% rejected), across 47 games — at the resolution most visitors are building
for. Rejected rows are counted and reported by `perf:fit`; a rejection rate far
from ~5% means the detector or the corpus changed, and is worth a warning.

---

## Explicitly out of scope

- Importing new CPU reviews. Worth doing, unrelated to this, and it raises breadth
  only — never depth.
- The performance tab's visual redesign, which is already separately planned.
