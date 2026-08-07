# Benchmark corpus

Hand-curated measurements from published reviews. **Input to the build, never
shipped to the browser** — `npm run perf:fit` turns this into
`src/data/perfModel.json`, and only that artefact reaches the client.

## Rules

1. **Enter by hand, through `npm run perf:add`.** Never scrape. Automated
   collection is what turns "recording facts" into "extracting a database", and
   it usually breaches the outlet's terms independently of copyright.
2. **No source may exceed 20% of entries.** `npm run perf:fit` fails above that
   and warns above 15%. Spreading across outlets is the whole licensing
   position: nobody's compilation is substantially taken.
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

These two shapes are why the corpus needs ~50 GPU rows and ~50 CPU rows rather
than 2,500 pairs: the model fits the two terms separately and derives the cross
product.

## Takedown

Every entry carries `sourceId`. Removing an outlet entirely is one filter and
one re-fit. Because the model is fitted rather than stored, losing a source
degrades accuracy slightly instead of leaving holes.
