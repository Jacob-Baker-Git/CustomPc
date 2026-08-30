# Performance corpus expansion — phases A, B and C

**Date:** 2026-08-11
**Status:** approved for A+B+C; D and E deferred to a follow-up decision
**Depends on:** `docs/superpowers/specs/2026-08-07-performance-engine-design.md`

## The problem

The corpus holds 804 entries and the Performance tab still answers almost nothing.
Measured against the real engine, not against the corpus size:

```
cpu-ryzen-7-9800x3d  gpu-rtx-4070   1440p   8 of 24 games
cpu-ryzen-7-9800x3d  gpu-rtx-5090   1440p   5 of 24 games
cpu-i5-13600k        gpu-rtx-4060   any     0 of 24 games
cpu-ryzen-5-5600     gpu-gtx-1660s  any     0 of 24 games
```

Four distinct causes, three of which this spec addresses:

1. **Seven measured games are not listed.** `cyberpunk`, `bg3`, `starfield`,
   `hogwarts`, `alan-wake-2`, `helldivers2` and `cs2` all have fitted cells in
   `perfModel.json` and none appear in `perfGames.json`, which is the list
   `PerformanceScreen` iterates. Their measurements cannot reach a user.
2. **Nine listed games have no measurements at all** and only pad the "no
   benchmark data yet" list.
3. **Three of Notebookcheck's benches are undeclared**, so ~2,600 already-cached
   rows are refused — including every row for Fortnite, Apex Legends, Elden Ring
   and Red Dead Redemption 2, which the reader already maps.
4. *(Deferred — phase E.)* Exactly **one** game has a CPU-side constant `B`, and
   12 of 80 CPUs have an index. This is why a mainstream CPU shows nothing, and
   no amount of GPU data fixes it.

## Principle this spec adds

**A game is listed because the corpus measures it, never because somebody typed
it in.** `perfGames.json` becomes a derived artefact with a test that fails when
it drifts from the corpus in either direction. That is the user's decision —
"only have games in the db that have data for them" — expressed structurally, so
it stays true after the next import instead of needing another tidy-up.

## Phase A — list what is already measured

**A1. Map two titles the catalogue already has ids for.**
`GAME_IDS` in `src/lib/perfEngine/notebookcheck.js` gains `'GTA V': 'gta5'` and
`'Dota 2 Reborn': 'dota2'`. Both ids exist in `gamesData.json`; the reader was
simply never told the outlet's spelling. 134 cached rows become eligible.

**A2. Regenerate the game list from the corpus.** New script
`scripts/build-perf-games.mjs` (`npm run perf:games`) reads
`data/benchmarks/entries.json` and writes `src/data/perfGames.json`:

- one entry per distinct `gameId` present in live (non-superseded) entries;
- `name` and `slug` from `data/games/gameMeta.json`, a new file keyed by id —
  display names are editorial and cannot be derived from an outlet's spelling.
  It is a **shared data file, not a constant in the build script**, because the
  importer has to validate against it too: `import-bench-tsv.mjs` currently
  checks incoming ids against `perfGames ∪ gamesData`, and once `perfGames` is
  derived from imports that becomes circular — a new title is absent from the
  list until it is imported and refused at import because it is absent from the
  list. `gameMeta` is the **permitted** set and a superset of the **listed** set;
  it also carries a row for every id a reader maps but the corpus has not
  measured yet. It is not `notebookcheck.js`'s `GAME_IDS`: that maps *one
  outlet's spelling* to an id and is per-outlet by nature, whereas the display
  name belongs to the id and is shared by every outlet. A missing `gameMeta` row
  fails the build rather than defaulting to the id;
- `presets` from the distinct `presetId`s the corpus actually holds for that
  game, each labelled and given a `tier` from a canonical `PRESET_META` table;
- existing German ComputerBase labels (`sehr-hoch` → "Sehr hoch", `kino` →
  "Kino") preserved in `PRESET_META`, because they are the preset the review ran
  and relabelling them to "Very high" would misquote the source;
- `fpsCap` carried across from `gamesData.json` where the id matches, so a
  hard-locked title keeps its cap.

A game with no live entries is not written. The nine unmeasured titles therefore
disappear as a consequence of the rule rather than by a delete list.

**A3. Pin it.** `perfGames.test.js` asserts, against the real corpus:
every listed game has ≥1 live entry; every game with ≥1 live entry is listed;
every listed preset appears in the corpus for that game; ids are unique; and no
id collides with a `gamesData.json` entry that carries a different name.

Regenerating is mandatory after any import — the same contract `npm run sitemap`
has, and the test is what enforces it.

## Phase B — declare three more Notebookcheck benches

Notebookcheck re-bases its desktop bench periodically and each per-GPU page pools
rows from every generation of it. `BENCHES` in `scripts/fetch-notebookcheck.mjs`
declares four; the cached pages name nineteen. The three worth adding, by volume:

| bench | cached rows | games | brings in |
|---|---|---|---|
| Ryzen 9 5900X | 1496 | 66 | Elden Ring, Dota 2, RDR2, Apex |
| Ryzen 9 3900X | 1101 | 72 | RDR2, Apex, Dota 2, Fortnite |
| Ryzen 7 2700X | 667 | 51 | Fortnite, Apex, GTA V |

**The verification rule is unchanged and binding: each bench's memory
specification is read off a Notebookcheck review that states it, and a bench
whose spec cannot be found is not declared.** This is not pedantry — the
13900K bench runs DDR5-6400 where the other three run 6000, so one shared
default would have filed a wrong figure against 17 rows. If a bench's RAM cannot
be verified, it is dropped from this phase and the spec records why, rather than
being folded into a neighbouring bench's source.

Each bench remains **its own source** with its own id, url, title and
`testSystem`, exactly as the existing four do. Three benches × the pages that
carry them, not one merged source.

Every existing refusal stays: unmapped part, unrecorded resolution, unreadable
preset, upscaling named without a quality, a 1% low below the row's own stated
minimum, and a configuration measured twice with conflicting results.

## Phase C — widen the mapped title list

`GAME_IDS` gains mainstream titles the cached pages measure well. Selection
criteria, applied in this order:

1. the title has near-complete P1 (1% low) coverage in the cache — a title
   measured without a 1% low weakens the `lowBase` fit for its cell;
2. it is a game a visitor would recognise and plausibly play;
3. it is not a re-measure of a title already mapped under a different patch
   (`Cyberpunk 2077 1.6` and `Cyberpunk 2077 1.0` are excluded — folding a 2020
   build's numbers into the current entry would attribute one version's
   performance to another).

Initial set, with cached row / P1 counts:

```
Watch Dogs Legion 66/66    Lies of P 53/53           Enshrouded 52/52
Lords of the Fallen 51/51  Ghostwire Tokyo 51/51     The Finals 47/47
Diablo 4 47/47             A Plague Tale Requiem 47/47
Star Wars Jedi Survivor 46/46   Dead Island 2 46/46  Atomic Heart 46/46
The Witcher 3 v4 46/46     God of War 46/46          Spider-Man Miles Morales 46/46
The Last of Us 45/45       Dead Space Remake 45/45   Resident Evil 4 Remake 43/43
Palworld 41/41             Ready or Not 41/41        Armored Core 6 40/40
Ratchet & Clank Rift Apart 40/40                     Doom Eternal 48/36
```

Each needs an id, display name and slug in `GAME_META`. New ids are namespaced by
the same convention already in use (`the-finals`, `diablo-4`, …) and must not
collide with `gamesData.json`.

A mapped title that yields zero importable rows after the benches are declared is
**removed from the mapping again** rather than left mapped-but-absent — phase A's
test makes the inverse (listed but unmeasured) impossible, and a mapping with no
output is the same problem one layer down.

## Data flow

```
cached NBC pages ─► notebookcheck.js (GAME_IDS, CPU_IDS, refusals)
                        │
                        ▼
        fetch-notebookcheck.mjs (BENCHES: 7 declared sources)
                        │  one TSV per page × bench
                        ▼
              import-bench-tsv.mjs ──► data/benchmarks/{sources,entries}.json
                        │
          ┌─────────────┴──────────────┐
          ▼                            ▼
  fit-perf-model.mjs            build-perf-games.mjs   (both re-run after import)
          │                            │
          ▼                            ▼
  src/data/perfModel.json      src/data/perfGames.json
          └──────────┬─────────────────┘
                     ▼
             PerformanceScreen
```

Nothing here touches Supabase. The benchmark corpus, the fitted model and the
game list are all repo files, so this work goes live only on a deploy — unlike a
catalogue write. `gamesData.json` and the Supabase `games` table are untouched:
they drive the legacy CustomPC score, which is guarded by
`legacyEngineUntouched.test.js` and must stay byte-identical.

## Verification

Per phase, before moving on:

1. `npm run perf:fit` — record entry count, source count, GPU/CPU fit parts,
   dropped-disconnected list and the concentration warnings.
2. `npm run perf:games` then the full suite — `perfGames.test.js` is the gate.
3. **Re-derive rows already in the corpus and demand they match to the last
   decimal.** This is the check that caught both ComputerBase extraction traps
   and it is cheap; declaring a new bench must not move an existing figure.
4. A before/after coverage sweep through the real engine over the same four
   builds quoted at the top of this document, plus two the new benches should
   newly cover. The sweep is the evidence, not the row count.
5. Lint, build, and a browser check of the Performance tab at 1080p / 1440p / 4K
   on one covered and one uncovered build.

Expected direction, to be replaced by measured figures as each phase lands:
phase A raises the anchor build from 8 answered to roughly 15 and removes nine
dead rows; phase B is the large one, adding four mainstream titles and thousands
of rows; phase C widens the list further. **No claim in this section is reported
as fact until the sweep has been run.**

## Explicitly out of scope

- **Phase D — fitting 1080p.** `GPU_FIT_RESOLUTIONS` excludes 1080p, so all 413
  1080p entries produce zero fitted cells and every 1080p index is copied from
  1440p. Deferred by decision; revisit after C.
- **Phase E — CPU-scaling imports.** The single largest coverage lever and the
  only fix for "mainstream CPU shows nothing". Deferred by decision; revisit
  after C.
- The Performance tab UI redesign, which follows this work as its own spec. The
  agreed direction is progressive disclosure: every figure stays on the page,
  with detail behind expanders rather than all of it visible at once.
- Any Supabase write, any push, any deploy.
