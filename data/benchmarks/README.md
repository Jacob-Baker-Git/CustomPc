# Benchmark corpus

Hand-curated measurements from published reviews. **Input to the build, never
shipped to the browser** — `npm run perf:fit` turns this into
`src/data/perfModel.json`, and only that artefact reaches the client.

## Rules

1. **Enter by hand, through `npm run perf:add`.** Never scrape. Automated
   collection is what turns "recording facts" into "extracting a database", and
   it usually breaches the outlet's terms independently of copyright.
2. **Spread across outlets, so nobody's compilation is substantially taken.**
   That is the whole licensing position, and it is still the goal — but it is
   **advisory, not enforced.** `npm run perf:fit` prints `WARN: <outlet> supplies
   N% of the corpus — dilute when data allows` for any outlet above **20%**, and
   **never fails on it**. There is no second threshold, and no entry-count
   carve-out. The only thing that makes `perf:fit` exit non-zero is the anchor
   check — the anchor GPU missing a measurement at one of the fitted
   resolutions, which would leave each resolution fitted in its own gauge.

   It *was* a hard cap, removed deliberately on 2026-08-10 (the reasoning is in
   `scripts/fit-perf-model.mjs`, above `OUTLET_SHARE_NOTE`). Three reasons: it
   failed the build the moment real data arrived — one ComputerBase review
   supplied 74% of 216 entries, so 216 genuine measurements sat unused while the
   Performance tab answered a single game; it was applied per **review** while
   appealing to not taking one **outlet's** compilation, so two articles from one
   outlet read as independent and a real 80% presented itself as 74%; and a share
   cap can be satisfied by taking *more* from everybody, which reduces nobody's
   taking.

   **Validity is still enforced everywhere it was** — a row missing an upscaling
   mode, a part that cannot be mapped, or a low contradicting its own minimum is
   still rejected. What is gone is only the refusal to run. The imbalance is
   written into the artefact as `sourceConcentration`, so dilution is driven by a
   number rather than by somebody remembering.
3. **Every entry needs its source, and every source needs a URL, a date and a
   full test system.** An unattributed number cannot be normalised, audited or
   withdrawn.
4. **Never edit an entry in place.** To correct one, add a new row and set
   `supersededBy` on the old one. The corpus stays a truthful record of what was
   recorded and when — which is what makes both the licensing position and the
   drift analysis defensible.
5. **`validation.json` is never fitted on.** It is the held-out set that
   measures real error. Moving a row into it after seeing the fit result
   destroys the only honest accuracy number the project has.
6. **Prefer sources that publish 1% lows and a full test system.** Charts-only
   figures go in at `weight: 0.5`.

## Which reviews are worth entering

- **`gpu-scaling`** — many GPUs, one fixed top-end CPU. Isolates the GPU term.
  Enter the 1440p and 4K figures; 1080p is contaminated by the CPU.
- **`cpu-scaling`** — many CPUs, one fixed top-end GPU at 1080p. Isolates the
  CPU term.
- **`pair`** — one specific combination. Goes in `validation.json`, not
  `entries.json`.
- **`memory-scaling`** — one fixed system, several RAM configurations. Isolates
  how much memory speed and capacity move a given game. Not used by the fit
  yet; it feeds the memory term, which lands later. Worth recording when you
  come across one, because these reviews are rare.

The first two shapes are why the corpus needs ~50 GPU rows and ~50 CPU rows rather
than 2,500 pairs: the model fits the two terms separately and derives the cross
product.

## Takedown

Every entry carries `sourceId`. Removing an outlet entirely is one filter and
one re-fit. Because the model is fitted rather than stored, losing a source
degrades accuracy slightly instead of leaving holes.
