# Performance tab redesign — one row per game, three resolutions — Design

**Status:** approved 2026-08-14
**Supersedes the layout half of:** `docs/superpowers/specs/2026-08-07-performance-engine-design.md`
(the engine contract there is unchanged)

## The problem, measured

The tab renders **170 bordered panels**. A build with an unindexed CPU produces
**60 result cards at 1440p and 155 at 1080p** — up from 5 before the
estimates-and-honest-basis work landed at `2043c38`. The card grid was designed
when a well-covered build answered 23 rows; at 155 it is a wall of boxes.

The user's two complaints, verbatim: *"i dont like how its still very blocky and
lots boxes when all games are showing"* and *"you cant select that res is
shown"*.

The second is literally true. `setResolution` is called in exactly one place —
`SetupFlow.jsx:99`, from the use-case profile — and no UI can change it
afterwards, so the tab is stuck with whatever setup chose.

## Goal

Make the results scannable at 155 rows, show all three resolutions at once, and
calm the rest of the tab — without hiding any figure the page carries today.

---

## 1. The row model

**One row per game, not per game × preset.** Presets fold underneath.

Each game shows **one preset**, chosen so that the three resolution columns
compare like with like. The rule, in order:

1. **Widest resolution coverage** — the preset answering at the most resolutions
2. Heaviest `presetTier`
3. Best basis — `measured` > `modelled` > `spec-derived` > `ceiling`
4. Lower `avgFps` (under-promise, matching the principle already in
   `gamePresets.js:23`)
5. `presetId` ascending — present only to make the result deterministic

Rules 4 and 5 never decide anything in the current corpus; they exist so the
choice cannot depend on array order, which is how the engine's existing
"heaviest preset" map (`perfEngine/index.js:207`) currently breaks ties.

### Why coverage outranks tier, measured

Putting coverage first was a deliberate trade — it can show a lighter preset than
the game's heaviest. Against the live corpus that costs almost nothing:

| | |
|---|---|
| games where widest-covered ≠ heaviest | **6 of 56** |
| of those, same tier (label differs only) | **5** |
| of those, a real tier drop | **1** — Dragon's Dogma 2 shows High (3 resolutions) instead of Grafik priorisieren (2) |
| grid fill, coverage-first | **89.9%** |
| grid fill, heaviest-per-resolution | 91.7% |

The five same-tier cases are the German/English and DLSS-variant pairs
(`ultrahoch`/`ultra`, `sehr-hoch`/`very-high`, `ultra`/`ultra (DLSS Quality)`).
**Twelve games have a tied top tier**, and the rule resolves every one of them
toward the English label — a UX gain that falls out for free.

⚠️ **This is not preset equivalence.** `sehr-hoch` and `very-high` measure
genuinely different settings and are 0.725 apart on identical hardware; the
corpus keeps them separate on purpose. The rule picks which one to *show*, and
the expanded row still lists both.

---

## 2. The table

```
▸ | Game | Preset | 1080p | 1440p | 4K | Basis
```

- **Grid fill is 89.9%** — with one preset locked per game, **41 of 56** games
  fill all three columns, 13 fill two, 2 fill one. A resolution with no answer
  renders **an em dash, never a zero**.

  (91.7% / 44 games is the figure for letting the preset vary per column, which
  §1 rejected. Quote the 89.9% — it is the one this design produces.)
- A ceiling row prefixes its figure with **`≤`** instead of the words "up to".
  At three columns the words do not fit; the symbol carries the same claim, and
  `bound === 'upper'` still drives it.
- **Basis** keeps today's wording — *benchmarked* / *backed by real data* /
  *estimate* — with its `±` band where one exists. Per `rowBasis.js`, a ceiling
  row carries no band unless the GPU index itself came from a prior.
- The column matching the build's target resolution is **visually marked**.
  Clicking a column header **retargets the build** (writes `setResolution`).
  That is the answer to "you can't select the res": all three are visible, and
  the header doubles as the picker, so no separate control is added.

### Expanded row

Everything the card carried, per game: 1% low at each resolution, frame time,
the CPU/GPU split bar or "Split not modelled", **the other presets measured for
this game with their own figures**, and the caveats currently behind **Why?**
(`CAVEAT_TEXT` moves across unchanged).

### The real-data filter

`onlyRealData` filters the **underlying rows first, then groups**. A game
survives if any of its rows is real data, and the preset rule then runs over
only the surviving rows — so the shown preset is always one the filter kept.

---

## 3. The engine call

`estimateBuildPerformance` takes a single resolution and returns `coverage`,
`bottleneck`, `power` and `meanCpuShare` for it. Three columns therefore means
**calling it three times** in the `useMemo`, keyed on parts + model + games.

The report is single-digit ms, so 3× is still nothing — but it is a real change
in how the screen consumes the engine, and the memo must not be allowed to
re-run per render.

**Everything that is not the table reads `reports[targetResolution]`**: the
summary tiles, the bottleneck, power, thermals, memory. The store's `resolution`
keeps its current meaning — the resolution this build is *for* — and keeps
driving `BuildSummary` and the share code, so nothing about `encodeBuild`
changes.

---

## 4. Layout of the rest of the tab

**The narrative order is kept exactly as it is** — results → what limits them →
power and cooling → the hardware. That order was chosen deliberately on
2026-08-08 to move frame rates from ninth to second, and nothing here disturbs
it.

What changes is the chrome: **borders come out**, replaced by a hairline rule
and a section heading. Stat rows sit in two columns. `Section.jsx` keeps
carrying the hierarchy in its heading so the contents stay quiet. This is where
most of the 170 panels go.

---

## 5. The bottleneck

### The tile

The summary tile currently labelled **"Held back by"** becomes **"Bottleneck"**.

It **states its own base on the tile**. The verdict is computed from the games
with a fitted CPU constant — **4 of 53 covered at 1440p** — so the tile reads
along the lines of *"graphics-limited in 4 of 4 games where the split is known"*
rather than implying a whole-build conclusion drawn from 7% of the rows.

### The section

"What's holding it back" **stays where it is** and becomes **game-specific**:
selecting a game in the table updates it to that game, and the section
**scrolls into view** on selection.

- Selection is the row expander — expanding a game selects it.
- With nothing selected the section shows the build-wide verdict, as today.
- The scroll uses `block: 'nearest'` and respects
  `prefers-reduced-motion: reduce` by falling back to `behavior: 'auto'`.

⚠️ **Expect this to say "not modelled" most of the time, and that is correct.**
A per-game bottleneck needs `cpuShare != null`, which needs a fitted `B`. Only
**5 cells at 1440p and 2 at 1080p** have one, so roughly 5 of 53 covered games
can produce a verdict. The other 48 say the split is not modelled — the same
reason 55 of 60 rows read *ceiling*. The feature is correct and will fill in as
the CPU-side corpus grows; it must not be made to look fuller than it is.

---

## 6. Responsive

Six columns do not fit 375px. **Below `sm`, only the target resolution's column
is shown**; the other two move into the expanded row. The table never scrolls
horizontally and the page body never does either.

The two traps already recorded for this tab still apply: `divide-x` on a
wrapping flex row draws a stray border, so the summary band stays a grid; and a
long preset name ("Grafik priorisieren") must not be allowed to squeeze a game
title into a mid-word wrap.

---

## 7. Accessibility

- The table is a real `<table>` with `<th scope="col">`, not a grid of divs.
  Three numeric columns per row is exactly the case screen readers need headers
  for.
- The expander is a `<button>` with `aria-expanded`, as `FpsCard` already does.
- A column header that retargets the build is a `<button>` inside the `<th>`,
  with the current target marked `aria-current="true"` — colour alone must not
  carry it.
- The split bar keeps its existing `role="img"` + `aria-label`, which states the
  split in words.

---

## 8. Testing

- **The preset rule is a pure function, tested directly** — a table-driven test
  over fixtures covering: widest-coverage wins, tier tie-break, basis tie-break,
  fps tie-break, and full determinism when everything ties.
- **A corpus test** asserting the rule against the real model: grid fill stays
  near 90%, and the count of games where it disagrees with heaviest-preset stays
  in single figures. Both are the numbers this design rests on.
- **The filter still cannot change the mix totals** — the existing invariant,
  re-asserted at the game level.
- **A game with a gap renders a dash, not a zero** — pinned, because a zero
  reads as "0 fps" rather than "no data".
- **Every assertion must be proved failable by mutation before commit.** Nine
  tests-that-could-not-fail have shipped on this codebase; the discipline stays.

### Tests that will need updating, deliberately

`PerformanceScreen.test.jsx` and `BasisBar.test.jsx` assert against the card
grid and a row-level mix. The mix moves to **one entry per game shown**, using
the chosen preset at the target resolution, so "60 estimated" becomes "56
estimated". Update them and say so in the commit rather than deleting them.

---

## Not in scope

- Changing the engine's contract, the fitted model, or any number it returns.
- Re-tiering the German presets. The tie is resolved for display only; fixing it
  at the source is a corpus job with its own risks.
- The `data/benchmarks/README.md` 20%-share doc/code mismatch.
- Deploying. `main` is 27 commits ahead of origin and nothing here changes that.

## Open risks

- **The bottleneck section is mostly inert today** (5 of 53 games). Accepted
  above with eyes open.
- **Three engine calls per render** if the memo is keyed wrongly. Guard with a
  test that the engine is called exactly three times per parts change.
- **Retargeting from a column header is a build-wide write** that also changes
  the share code. It is the behaviour chosen, but it wants a clear label so a
  click does not read as "preview".
