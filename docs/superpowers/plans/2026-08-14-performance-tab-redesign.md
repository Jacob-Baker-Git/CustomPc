# Performance tab redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 155-card frame-rate grid with one row per game showing 1080p / 1440p / 4K side by side, and strip the borders from the rest of the tab, without hiding any figure the page carries today.

**Architecture:** A new pure module `gameRows.js` owns the "which preset does this game show, and what goes in each column" rule so it is testable without React. `PerformanceScreen` calls `estimateBuildPerformance` once per resolution and feeds the three reports to that module. A new `FrameRateTable` renders a real `<table>`; `FpsCard`/`FpsCardGrid` are retired once their guarantees are re-pinned on the new components.

**Tech Stack:** React 19, Tailwind, Zustand, Vitest + @testing-library/react. `npx vite-node` for any script importing app modules — plain `node` cannot resolve this project's extensionless imports.

**Spec:** `docs/superpowers/specs/2026-08-14-performance-tab-redesign-design.md`

---

## ⚠️ Testing discipline: prove each test can fail

**Before committing any task, break the thing the test protects and confirm a
test goes red. Then revert.** Not optional, and not satisfied by watching the
suite pass.

**Nine tests that could not fail have shipped on this codebase.** The shape is
always the same: *an assertion already true for reasons other than the behaviour
under test.* The two most recent were a fixture whose bands all started at zero,
making "below every band" unreachable, and a follow-up fixture whose two bands
carried the same error, making "which band won" unobservable.

Watch for: a fixture missing the interesting case, a filter that can iterate zero
times, an assertion a default value satisfies, and **any test whose fixture makes
two branches produce identical output**.

---

## Two decisions the spec left open

Both are resolved here rather than during implementation.

**1. A game's cells can have different bases.** The 9800X3D reads `measured` at
1080p and `ceiling` at 1440p. The single Basis column shows **the weakest basis
among the cells actually shown**, matching the rule `rowBasis.js` already applies
within a row ("a row is only as strong as its weakest input"). The `±` band takes
the **maximum** `errorPct` across cells, so it can never understate. Per-cell
basis is listed in the expansion.

**2. The `≤` prefix is per cell**, driven by that cell's own `bound === 'upper'`,
not by the row's overall basis. A game can be a ceiling at 4K and a point
estimate at 1080p.

**3. The split bar becomes text.** The spec's accessibility section says the bar
keeps its `role="img"` + `aria-label`. There is no bar in the expansion — the
split is written out ("58% graphics — GPU-led") because a row expansion is a
description list, not a chart, and prose beats a bar with a label describing it.
The accessible content is strictly better; the spec line is satisfied in
substance, not in mechanism. **`aria-label` on a bar was the fallback for a
visual-only claim; there is no longer a visual-only claim to fall back from.**

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/perfEngine/gameRows.js` | Preset selection + grouping three reports into game rows. Pure, no React. | **Create** |
| `src/components/performance/basisText.js` | `BASIS_LABEL` + `CAVEAT_TEXT`, shared by old card and new row | **Create** |
| `src/components/performance/FrameRateRow.jsx` | One game's `<tr>` + its expansion `<tr>` | **Create** |
| `src/components/performance/FrameRateTable.jsx` | The `<table>`, headers, retarget, uncovered list | **Create** |
| `src/components/performance/PerformanceScreen.jsx` | Three engine calls, selection state, scroll-to-section | Modify |
| `src/components/performance/SummaryStrip.jsx` | "Held back by" → "Bottleneck", stating its base | Modify |
| `src/components/performance/BasisBar.jsx` | Mix counts games, not rows | Modify |
| `src/components/performance/StatPanel.jsx` | Borderless variant | Modify |
| `src/components/performance/FpsCard.jsx` | Retired | **Delete** (Task 9) |
| `src/components/performance/FpsCardGrid.jsx` | Retired | **Delete** (Task 9) |

`gameRows.js` lives under `perfEngine/` and not next to the component because it
is pure data shaping with no DOM in it, and because `PerformanceScreen` already
imports `onlyRealData` from `perfEngine/rowBasis` — same split, same place.

---

### Task 1: `gameRows.js` — the preset selection rule

The rule that decides which single preset a game's row shows. Pure and
table-driven so it can be exercised without building three reports.

**Files:**
- Create: `src/lib/perfEngine/gameRows.js`
- Test: `src/tests/gameRows.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/gameRows.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { selectPreset, BASIS_RANK } from '../lib/perfEngine/gameRows'

// A candidate is one preset of one game, with the set of resolutions it answers
// at. `row` is any answered row for that preset — they share preset metadata.
const cand = (over = {}) => ({
  presetKey: 'ultra|native',
  presetTier: 4,
  basis: 'ceiling',
  avgFps: 100,
  resolutions: new Set(['1080p', '1440p', '4k']),
  ...over,
})

describe('selectPreset', () => {
  it('prefers the preset covered at the most resolutions', () => {
    // The whole reason coverage outranks tier: the three columns have to
    // compare like with like, and a preset measured once cannot fill them.
    const wide = cand({ presetKey: 'high|native', presetTier: 3 })
    const narrow = cand({ presetKey: 'ultra|native', presetTier: 4,
                          resolutions: new Set(['1080p']) })
    expect(selectPreset([narrow, wide]).presetKey).toBe('high|native')
  })

  it('prefers the heaviest tier when coverage ties', () => {
    const heavy = cand({ presetKey: 'ultra|native', presetTier: 4 })
    const light = cand({ presetKey: 'low|native', presetTier: 1 })
    expect(selectPreset([light, heavy]).presetKey).toBe('ultra|native')
  })

  it('prefers the better-evidenced preset when coverage and tier tie', () => {
    // This is the German/English case: `sehr-hoch` and `very-high` are both
    // tier 4 and measure genuinely different settings.
    const weak = cand({ presetKey: 'sehr-hoch|native', basis: 'ceiling' })
    const strong = cand({ presetKey: 'very-high|native', basis: 'measured' })
    expect(selectPreset([weak, strong]).presetKey).toBe('very-high|native')
  })

  it('prefers the LOWER frame rate when coverage, tier and basis all tie', () => {
    // Under-promising, matching gamePresets.js: "the estimate errs toward a
    // LOWER frame rate... under-promising is the safer direction for a number
    // somebody is about to spend money on."
    const fast = cand({ presetKey: 'a|native', avgFps: 200 })
    const slow = cand({ presetKey: 'b|native', avgFps: 90 })
    expect(selectPreset([fast, slow]).presetKey).toBe('b|native')
  })

  it('falls back to presetKey so the result cannot depend on array order', () => {
    // The engine's existing heaviest-preset map breaks ties by array order,
    // which is how a 2.3x difference in F1 24 was being decided by nothing.
    const a = cand({ presetKey: 'aaa|native' })
    const b = cand({ presetKey: 'zzz|native' })
    expect(selectPreset([a, b]).presetKey).toBe('aaa|native')
    expect(selectPreset([b, a]).presetKey).toBe('aaa|native')
  })

  it('returns null for a game with no candidates', () => {
    expect(selectPreset([])).toBeNull()
  })

  it('ranks the four bases strongest to weakest', () => {
    expect(BASIS_RANK.measured).toBeGreaterThan(BASIS_RANK.modelled)
    expect(BASIS_RANK.modelled).toBeGreaterThan(BASIS_RANK['spec-derived'])
    expect(BASIS_RANK['spec-derived']).toBeGreaterThan(BASIS_RANK.ceiling)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/gameRows.test.js
```

Expected: FAIL — cannot resolve `../lib/perfEngine/gameRows`.

- [ ] **Step 3: Implement**

Create `src/lib/perfEngine/gameRows.js`:

```js
// Turns three per-resolution reports into one row per game.
//
// The Performance tab used to render one card per game AND preset — 60 cards at
// 1440p and 155 at 1080p once the prior and ceiling rows landed. This collapses
// that to one row per game with a column per resolution, which means choosing
// ONE preset per game: three columns that compare different settings are not a
// comparison.

export const RESOLUTIONS = ['1080p', '1440p', '4k']

// Strongest to weakest. Same names rowBasis.js composes.
export const BASIS_RANK = { measured: 3, modelled: 2, 'spec-derived': 1, ceiling: 0 }

// Which preset a game's collapsed row shows.
//
// COVERAGE OUTRANKS TIER, deliberately. A preset measured at one resolution
// cannot fill three columns, and a row whose columns are different settings is
// worse than a row on slightly lighter settings. Measured against the live
// corpus this costs one real tier drop across 56 games (Dragon's Dogma 2 shows
// High rather than Grafik priorisieren); the other five disagreements are the
// German/English and DLSS pairs, which are the SAME tier and differ only in
// label — and resolving those toward the English name is a gain.
//
// The last two rules never decide anything today. They exist because the
// engine's existing heaviest-preset map breaks ties by array order, which had a
// 2.3x difference in F1 24 being decided by nothing at all.
export function selectPreset(candidates) {
  if (!candidates?.length) return null
  return [...candidates].sort(compareCandidates)[0]
}

function compareCandidates(a, b) {
  const ca = a.resolutions?.size ?? 0
  const cb = b.resolutions?.size ?? 0
  if (ca !== cb) return cb - ca                                  // widest coverage
  const ta = a.presetTier ?? 0
  const tb = b.presetTier ?? 0
  if (ta !== tb) return tb - ta                                  // heaviest tier
  const ra = BASIS_RANK[a.basis] ?? -1
  const rb = BASIS_RANK[b.basis] ?? -1
  if (ra !== rb) return rb - ra                                  // best evidence
  if (a.avgFps !== b.avgFps) return a.avgFps - b.avgFps           // under-promise
  return a.presetKey.localeCompare(b.presetKey)                  // determinism
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/gameRows.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Prove each test can fail**

Break each rule in turn and confirm the matching test goes red, then revert:

| Mutation | Test that must go red |
|---|---|
| `if (ca !== cb)` → `if (false)` | prefers the preset covered at the most resolutions |
| `if (ta !== tb)` → `if (false)` | prefers the heaviest tier when coverage ties |
| `if (ra !== rb)` → `if (false)` | prefers the better-evidenced preset |
| `a.avgFps - b.avgFps` → `b.avgFps - a.avgFps` | prefers the LOWER frame rate |
| `a.presetKey.localeCompare(b.presetKey)` → `0` | falls back to presetKey |

- [ ] **Step 6: Commit**

```bash
git add src/lib/perfEngine/gameRows.js src/tests/gameRows.test.js
git commit -m "feat: choose one preset per game for the collapsed row"
```

---

### Task 2: `gameRows.js` — group three reports into game rows

**Files:**
- Modify: `src/lib/perfEngine/gameRows.js`
- Test: `src/tests/gameRowsBuild.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/gameRowsBuild.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildGameRows } from '../lib/perfEngine/gameRows'

const row = (over = {}) => ({
  rowId: 'g|ultra|native', gameId: 'g', name: 'Game', preset: 'Ultra',
  presetId: 'ultra', presetTier: 4, upscaling: 'native',
  avgFps: 100, lowFps: 80, frameTimeMs: 10, basis: 'ceiling', bound: 'upper',
  caveats: [], errorPct: null, cpuShare: null, limitedBy: null,
  ...over,
})

const reports = (byRes) => Object.fromEntries(
  Object.entries(byRes).map(([res, games]) => [res, { games }]),
)

describe('buildGameRows', () => {
  it('produces one entry per game, with a cell per resolution', () => {
    const out = buildGameRows(reports({
      '1080p': [row({ avgFps: 300 })],
      '1440p': [row({ avgFps: 200 })],
      '4k': [row({ avgFps: 100 })],
    }))
    expect(out).toHaveLength(1)
    expect(out[0].gameId).toBe('g')
    expect(out[0].cells['1080p'].avgFps).toBe(300)
    expect(out[0].cells['4k'].avgFps).toBe(100)
  })

  it('leaves a cell null where that resolution has no answer', () => {
    // Must be null, never 0 — the table renders a dash for null and a dash is
    // "no data", while a 0 reads as "zero frames per second".
    const out = buildGameRows(reports({
      '1080p': [row({ avgFps: 300 })],
      '1440p': [row({ avgFps: null, basis: 'none' })],
      '4k': [row({ avgFps: 100 })],
    }))
    expect(out[0].cells['1440p']).toBeNull()
    expect(out[0].cells['1080p'].avgFps).toBe(300)
  })

  it('uses the SAME preset in every cell', () => {
    // The whole point. A 1080p column showing Ultra beside a 4K column showing
    // High is not a comparison, and nothing on the row would say so.
    const out = buildGameRows(reports({
      '1080p': [
        row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, avgFps: 300 }),
        row({ rowId: 'g|high|native', presetId: 'high', presetTier: 3, avgFps: 400 }),
      ],
      '1440p': [row({ rowId: 'g|high|native', presetId: 'high', presetTier: 3, avgFps: 250 })],
      '4k': [row({ rowId: 'g|high|native', presetId: 'high', presetTier: 3, avgFps: 120 })],
    }))
    // `high` answers at three resolutions, `ultra` at one — coverage wins.
    expect(out[0].presetId).toBe('high')
    for (const res of ['1080p', '1440p', '4k']) {
      expect(out[0].cells[res].presetId, res).toBe('high')
    }
  })

  it('reports the WEAKEST basis across the cells it shows', () => {
    // Matches rowBasis.js: a row is only as strong as its weakest input. The
    // 9800X3D really does read `measured` at 1080p and `ceiling` at 1440p, so
    // this is the live case, not a hypothetical.
    const out = buildGameRows(reports({
      '1080p': [row({ basis: 'measured', bound: 'point' })],
      '1440p': [row({ basis: 'ceiling', bound: 'upper' })],
      '4k': [row({ basis: 'measured', bound: 'point' })],
    }))
    expect(out[0].basis).toBe('ceiling')
  })

  it('takes the WORST error band across the cells, never the average', () => {
    const out = buildGameRows(reports({
      '1080p': [row({ basis: 'spec-derived', errorPct: 6 })],
      '1440p': [row({ basis: 'spec-derived', errorPct: 34 })],
      '4k': [row({ basis: 'spec-derived', errorPct: 8 })],
    }))
    expect(out[0].errorPct).toBe(34)
  })

  it('lists the game’s other presets for the expansion', () => {
    const out = buildGameRows(reports({
      '1080p': [
        row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, avgFps: 300 }),
        row({ rowId: 'g|low|native', presetId: 'low', presetTier: 1, avgFps: 900 }),
      ],
      '1440p': [row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, avgFps: 200 })],
      '4k': [row({ rowId: 'g|ultra|native', presetId: 'ultra', presetTier: 4, avgFps: 100 })],
    }))
    expect(out[0].presetId).toBe('ultra')
    expect(out[0].otherPresets.map((p) => p.presetId)).toEqual(['low'])
  })

  it('drops a game nothing answered for', () => {
    const out = buildGameRows(reports({
      '1080p': [row({ avgFps: null, basis: 'none' })],
      '1440p': [row({ avgFps: null, basis: 'none' })],
      '4k': [row({ avgFps: null, basis: 'none' })],
    }))
    expect(out).toEqual([])
  })

  it('orders games by their best frame rate, fastest first', () => {
    const out = buildGameRows(reports({
      '1080p': [
        row({ gameId: 'slow', name: 'Slow', rowId: 'slow|ultra|native', avgFps: 40 }),
        row({ gameId: 'fast', name: 'Fast', rowId: 'fast|ultra|native', avgFps: 300 }),
      ],
      '1440p': [], '4k': [],
    }))
    expect(out.map((g) => g.gameId)).toEqual(['fast', 'slow'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/gameRowsBuild.test.js
```

Expected: FAIL — `buildGameRows` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/perfEngine/gameRows.js`:

```js
const presetKeyOf = (r) => `${r.presetId}|${r.upscaling}`

// `reports` is { '1080p': report, '1440p': report, '4k': report }. Missing
// resolutions are tolerated so a caller can pass fewer.
export function buildGameRows(reports, { resolutions = RESOLUTIONS } = {}) {
  // gameId -> presetKey -> { candidate fields, rowByRes }
  const games = new Map()

  for (const res of resolutions) {
    for (const r of reports?.[res]?.games ?? []) {
      if (!(r.avgFps > 0)) continue
      if (!games.has(r.gameId)) games.set(r.gameId, { name: r.name, presets: new Map() })
      const g = games.get(r.gameId)
      const key = presetKeyOf(r)
      if (!g.presets.has(key)) {
        g.presets.set(key, {
          presetKey: key, presetId: r.presetId, preset: r.preset,
          upscaling: r.upscaling, presetTier: r.presetTier,
          basis: r.basis, avgFps: r.avgFps,
          resolutions: new Set(), rowByRes: {},
        })
      }
      const p = g.presets.get(key)
      p.resolutions.add(res)
      p.rowByRes[res] = r
      // The candidate's basis and fps describe the preset as a whole, so take
      // the weakest basis and the lowest rate across the resolutions it covers
      // — the same conservative direction the tie-break uses.
      if ((BASIS_RANK[r.basis] ?? -1) < (BASIS_RANK[p.basis] ?? -1)) p.basis = r.basis
      if (r.avgFps < p.avgFps) p.avgFps = r.avgFps
    }
  }

  const out = []
  for (const [gameId, g] of games) {
    const candidates = [...g.presets.values()]
    const chosen = selectPreset(candidates)
    if (!chosen) continue

    const cells = {}
    for (const res of resolutions) cells[res] = chosen.rowByRes[res] ?? null
    const shown = resolutions.map((res) => cells[res]).filter(Boolean)

    // Weakest basis across the cells actually shown, and the worst error band.
    // Neither can overstate what the row is worth. See rowBasis.js.
    const basis = shown.reduce(
      (worst, r) => ((BASIS_RANK[r.basis] ?? -1) < (BASIS_RANK[worst] ?? -1) ? r.basis : worst),
      shown[0].basis,
    )
    const bands = shown.map((r) => r.errorPct).filter((v) => v != null)

    out.push({
      gameId,
      name: g.name,
      preset: chosen.preset,
      presetId: chosen.presetId,
      upscaling: chosen.upscaling,
      presetTier: chosen.presetTier,
      cells,
      basis,
      errorPct: bands.length ? Math.max(...bands) : null,
      // Every caveat seen on any shown cell, deduplicated — the expansion lists
      // them, and a caveat true at one resolution is still true of the row.
      caveats: [...new Set(shown.flatMap((r) => r.caveats ?? []))],
      otherPresets: candidates
        .filter((c) => c.presetKey !== chosen.presetKey)
        .sort((a, b) => (b.presetTier ?? 0) - (a.presetTier ?? 0)),
      bestFps: Math.max(...shown.map((r) => r.avgFps)),
    })
  }

  // Fastest game first, matching the order the engine already sorts rows into.
  return out.sort((a, b) => b.bestFps - a.bestFps || a.gameId.localeCompare(b.gameId))
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/gameRows.test.js src/tests/gameRowsBuild.test.js
```

Expected: PASS, 15 tests.

- [ ] **Step 5: Prove each test can fail**

| Mutation | Test that must go red |
|---|---|
| `cells[res] = chosen.rowByRes[res] ?? null` → `?? { avgFps: 0 }` | leaves a cell null where that resolution has no answer |
| the weakest-basis `reduce` → `shown[0].basis` | reports the WEAKEST basis across the cells it shows |
| `Math.max(...bands)` → `Math.min(...bands)` | takes the WORST error band |
| `otherPresets` filter removed | lists the game's other presets |
| final sort → `a.bestFps - b.bestFps` | orders games by their best frame rate |

- [ ] **Step 6: Commit**

```bash
git add src/lib/perfEngine/gameRows.js src/tests/gameRowsBuild.test.js
git commit -m "feat: group three per-resolution reports into one row per game"
```

---

### Task 3: Pin the rule against the real corpus

The two numbers this whole design rests on. If either moves a long way the
design needs re-justifying before it ships.

**Files:**
- Test: `src/tests/gameRowsCorpus.test.js`

- [ ] **Step 1: Write the test**

Create `src/tests/gameRowsCorpus.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { estimateBuildPerformance } from '../lib/perfEngine'
import { buildGameRows, RESOLUTIONS, BASIS_RANK } from '../lib/perfEngine/gameRows'
import model from '../data/perfModel.json'
import games from '../data/perfGames.json'
import parts from '../data/partsData.json'

const list = Array.isArray(parts) ? parts : parts.parts
const pick = (id) => list.find((p) => p.id === id)
const gameList = Array.isArray(games) ? games : games.games

const reportsFor = (cpuId, gpuId) => Object.fromEntries(RESOLUTIONS.map((res) => [
  res,
  estimateBuildPerformance({
    parts: { cpu: pick(cpuId), gpu: pick(gpuId) }, resolution: res, model, games: gameList,
  }),
]))

describe('the grouped rows against the committed corpus', () => {
  const rows = buildGameRows(reportsFor('cpu-i5-13600k', 'gpu-rtx-4070'))

  it('produces a row for most of the game list', () => {
    expect(rows.length).toBeGreaterThan(40)
  })

  it('fills close to 90% of the grid', () => {
    // The case for three columns at all. Measured at 89.9% when written: 41 of
    // 56 games fill all three, 13 fill two, 2 fill one. If this collapses, the
    // columns are mostly dashes and the design needs revisiting.
    const filled = rows.reduce(
      (n, g) => n + RESOLUTIONS.filter((res) => g.cells[res]).length, 0)
    const pct = filled / (rows.length * RESOLUTIONS.length) * 100
    expect(pct).toBeGreaterThan(80)
    expect(pct).toBeLessThanOrEqual(100)
  })

  it('shows the heaviest preset except in a handful of games', () => {
    // Coverage outranks tier, which can demote a game to lighter settings.
    //
    // ⚠️ Two different numbers get confused here. SIX of 56 games pick a
    // different preset than "heaviest" would — but five of those are the same
    // TIER (the German/English and DLSS label pairs), so they are not
    // demotions at all. Measured against the committed implementation, exactly
    // ONE game is a real tier drop: Dragon's Dogma 2 shows High (3
    // resolutions) instead of Grafik priorisieren (2).
    //
    // This counts tier drops, so the live figure is 1. The bound is loose on
    // purpose — it is a drift alarm, not a pin.
    let demoted = 0
    for (const g of rows) {
      const heaviest = Math.max(g.presetTier ?? 0,
        ...g.otherPresets.map((p) => p.presetTier ?? 0))
      if ((g.presetTier ?? 0) < heaviest) demoted++
    }
    expect(demoted).toBeLessThan(6)
  })

  it('never shows a cell whose preset differs from the row’s', () => {
    // The invariant the three columns depend on, asserted over the real corpus
    // rather than a fixture.
    for (const g of rows) {
      for (const res of RESOLUTIONS) {
        if (!g.cells[res]) continue
        expect(g.cells[res].presetId, `${g.gameId} ${res}`).toBe(g.presetId)
        expect(g.cells[res].upscaling, `${g.gameId} ${res}`).toBe(g.upscaling)
      }
    }
  })

  it('never reports a basis stronger than any cell it shows', () => {
    for (const g of rows) {
      const shown = RESOLUTIONS.map((r) => g.cells[r]).filter(Boolean)
      const weakest = Math.min(...shown.map((r) => BASIS_RANK[r.basis] ?? -1))
      expect(BASIS_RANK[g.basis], g.gameId).toBe(weakest)
    }
  })

  it('keeps a measured game measured for the build that has measurements', () => {
    // The 9800X3D + 4070 pair has 77 exact ROWS at 1080p; after grouping it has
    // 78 measured CELLS across all three resolutions. Different units — do not
    // "correct" one to the other. Grouping must not cost a measurement its
    // tier, but it MAY weaken the ROW whose 1440p cell is a ceiling, which is
    // why this counts cells rather than rows.
    const anchor = buildGameRows(reportsFor('cpu-ryzen-7-9800x3d', 'gpu-rtx-4070'))
    const measuredCells = anchor.reduce(
      (n, g) => n + RESOLUTIONS.filter((r) => g.cells[r]?.basis === 'measured').length, 0)
    expect(measuredCells).toBeGreaterThan(30)
  })
})
```

- [ ] **Step 2: Run it**

```bash
npx vitest run src/tests/gameRowsCorpus.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 3: Prove it can fail**

Set `RESOLUTIONS` in `gameRows.js` to `['1440p']` and confirm "fills close to
90% of the grid" still passes (it should — one column, fully filled) but
"produces a row for most of the game list" holds. Then set the coverage rule to
lose (`if (false)` on the `ca !== cb` branch) and confirm **"never shows a cell
whose preset differs from the row's"** stays green while **"shows the heaviest
preset except in a handful of games"** goes red — that pairing is what proves
the two assertions are testing different things. Revert.

- [ ] **Step 4: Commit**

```bash
git add src/tests/gameRowsCorpus.test.js
git commit -m "test: pin the grouping rule against the committed corpus"
```

---

### Task 4: Extract the basis and caveat text

Behaviour-preserving. Moves two maps out of `FpsCard` so the new row component
and the old card share one definition while both exist.

**Files:**
- Create: `src/components/performance/basisText.js`
- Modify: `src/components/performance/FpsCard.jsx:11-25`

- [ ] **Step 1: Create the module**

Create `src/components/performance/basisText.js`:

```js
// How each tier is named on screen, and why in words a reader can act on.
//
// Extracted from FpsCard so the card and the grouped table cannot drift apart
// while both exist. `spec-derived` and `ceiling` deliberately share a label:
// the difference between them is the "up to", which `bound` drives, not the
// tier name.
export const BASIS_LABEL = {
  measured: 'benchmarked',
  modelled: 'backed by real data',
  'spec-derived': 'estimate',
  ceiling: 'estimate',
}

// Keys are the caveat ids from rowBasis.js.
export const CAVEAT_TEXT = {
  'gpu-index-prior': 'The graphics card index came from its specs, not a benchmark of this card.',
  'cpu-index-prior': 'The processor index came from its specs, not a benchmark of this chip.',
  'no-cpu-constant': 'No review has measured processor performance in this game, so this is the graphics card’s ceiling.',
  'resolution-copied': 'No data at this resolution for this card; the figure is carried across from 1440p.',
  'index-extrapolated': 'This part sits outside the range the estimate was worked out over, so it is rougher than the ± figure suggests.',
}
```

- [ ] **Step 2: Point `FpsCard` at it**

In `src/components/performance/FpsCard.jsx`, delete the `BASIS_LABEL` and
`CAVEAT_TEXT` declarations (lines 9-25) and add to the imports:

```jsx
import { BASIS_LABEL, CAVEAT_TEXT } from './basisText'
```

- [ ] **Step 3: Run the tests**

```bash
npx vitest run src/tests/FpsCard.test.jsx
```

Expected: PASS, unchanged. This task changes no behaviour.

- [ ] **Step 4: Commit**

```bash
git add src/components/performance/basisText.js src/components/performance/FpsCard.jsx
git commit -m "refactor: share the basis and caveat text between card and table"
```

---

### Task 5: `FrameRateRow.jsx` — one game's row and its expansion

**Files:**
- Create: `src/components/performance/FrameRateRow.jsx`
- Test: `src/tests/FrameRateRow.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/FrameRateRow.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FrameRateRow from '../components/performance/FrameRateRow'

const cell = (over = {}) => ({
  avgFps: 100, lowFps: 80, frameTimeMs: 10, basis: 'ceiling', bound: 'upper',
  cpuShare: null, limitedBy: null, caveats: [], errorPct: null, presetId: 'ultra',
  upscaling: 'native', ...over,
})

const game = (over = {}) => ({
  gameId: 'g', name: 'Test Game', preset: 'Ultra', presetId: 'ultra',
  upscaling: 'native', presetTier: 4,
  cells: { '1080p': cell({ avgFps: 300 }), '1440p': cell({ avgFps: 200 }), '4k': cell({ avgFps: 100 }) },
  basis: 'ceiling', errorPct: null, caveats: [], otherPresets: [], bestFps: 300,
  ...over,
})

const renderRow = (props = {}) => render(
  <table><tbody>
    <FrameRateRow game={game(props.game)} target="1440p" onSelect={() => {}} {...props} />
  </tbody></table>,
)

describe('FrameRateRow', () => {
  it('shows a figure per resolution', () => {
    renderRow()
    for (const n of ['300', '200', '100']) {
      expect(screen.getByText(n)).toBeInTheDocument()
    }
  })

  it('renders a dash, not a zero, where a resolution has no answer', () => {
    // A zero reads as "zero frames per second". The gap is 10% of the grid.
    renderRow({ game: { cells: { '1080p': cell({ avgFps: 300 }), '1440p': null, '4k': cell({ avgFps: 100 }) } } })
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('marks a ceiling cell with ≤ and leaves a point estimate bare', () => {
    renderRow({ game: { cells: {
      '1080p': cell({ avgFps: 300, bound: 'upper' }),
      '1440p': cell({ avgFps: 200, bound: 'point' }),
      '4k': null,
    } } })
    // The ≤ belongs to the 1080p cell only.
    expect(screen.getByText('≤300')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.queryByText('≤200')).toBeNull()
  })

  it('labels the row with its basis and band', () => {
    renderRow({ game: { basis: 'spec-derived', errorPct: 34 } })
    expect(screen.getByText(/estimate/i)).toBeInTheDocument()
    expect(screen.getByText(/±34%/)).toBeInTheDocument()
  })

  it('hides the detail until expanded, then shows it', async () => {
    const user = userEvent.setup()
    renderRow({ game: { caveats: ['cpu-index-prior'] } })
    expect(screen.queryByText(/processor index came from its specs/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /test game/i }))
    expect(screen.getByText(/processor index came from its specs/i)).toBeInTheDocument()
  })

  it('lists the game’s other presets in the expansion', async () => {
    const user = userEvent.setup()
    renderRow({ game: { otherPresets: [
      { presetKey: 'low|native', presetId: 'low', preset: 'Low', presetTier: 1, avgFps: 900 },
    ] } })
    await user.click(screen.getByRole('button', { name: /test game/i }))
    expect(screen.getByText(/Low/)).toBeInTheDocument()
  })

  it('tells the caller which game was selected', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    renderRow({ onSelect })
    await user.click(screen.getByRole('button', { name: /test game/i }))
    expect(onSelect).toHaveBeenCalledWith('g')
  })

  it('says the split is not modelled rather than drawing a half-empty bar', async () => {
    // `1 - null` is 1 in JavaScript, so a bar drawn anyway shows a full GPU bar
    // labelled "Balanced" — two contradictory claims, neither measured.
    const user = userEvent.setup()
    renderRow()
    await user.click(screen.getByRole('button', { name: /test game/i }))
    expect(screen.getAllByText(/split not modelled/i).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/FrameRateRow.test.jsx
```

Expected: FAIL — cannot resolve `../components/performance/FrameRateRow`.

- [ ] **Step 3: Implement**

Create `src/components/performance/FrameRateRow.jsx`:

```jsx
import { useState } from 'react'
import { BASIS_LABEL, CAVEAT_TEXT } from './basisText'
import { RESOLUTIONS } from '../../lib/perfEngine/gameRows'

// One game: a summary row, and a detail row that opens under it.
//
// Replaces FpsCard, which drew a bordered box per game AND preset — 155 of them
// at 1080p once every catalogue CPU started answering.

function Cell({ row, isTarget }) {
  if (!row) {
    // A dash, never a zero. "0" reads as zero frames per second; this is "we
    // have nothing here", which is a different statement.
    return <td className={`px-2 py-1.5 text-right font-mono text-sm text-faint ${isTarget ? 'bg-surface-2' : ''}`}>—</td>
  }
  return (
    <td className={`px-2 py-1.5 text-right font-mono text-sm text-ink tabular-nums ${isTarget ? 'bg-surface-2' : ''}`}>
      {row.bound === 'upper' && <span className="text-muted">≤</span>}
      {row.avgFps}
    </td>
  )
}

export default function FrameRateRow({ game, target, onSelect, expanded, onToggle }) {
  // Uncontrolled unless the parent passes both — keeps the component usable in
  // a test without wiring selection state.
  const [ownOpen, setOwnOpen] = useState(false)
  const isOpen = expanded ?? ownOpen

  const toggle = () => {
    const next = !isOpen
    if (onToggle) onToggle(next)
    else setOwnOpen(next)
    if (next) onSelect?.(game.gameId)
  }

  const shown = RESOLUTIONS.map((r) => game.cells[r]).filter(Boolean)
  const split = shown.find((r) => r.cpuShare != null && r.limitedBy != null)

  return (
    <>
      {/* `data-game` is a test hook, deliberately. Expanding a row adds a
          SECOND <tr>, so counting `tbody tr` counts expansions as games — a
          test asserting "one row per game" would drift the moment anything
          opened. This attribute marks the summary rows only. */}
      <tr data-game={game.gameId} className="border-b border-line/60 hover:bg-surface-2/50">
        <td className="py-1.5 pl-2">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={isOpen}
            className="flex items-center gap-1.5 text-left text-sm text-ink"
          >
            <span aria-hidden="true" className="text-[10px] text-muted">{isOpen ? '⌄' : '›'}</span>
            {game.name}
          </button>
        </td>
        <td className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted">{game.preset}</td>
        {RESOLUTIONS.map((res) => (
          <Cell key={res} row={game.cells[res]} isTarget={res === target} />
        ))}
        <td className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider">
          <span className={game.basis === 'measured' ? 'text-good' : 'text-muted'}>
            {BASIS_LABEL[game.basis] ?? game.basis}
            {game.errorPct != null && ` ±${Math.round(game.errorPct)}%`}
          </span>
        </td>
      </tr>

      {isOpen && (
        <tr className="border-b border-line/60 bg-surface-2/30">
          <td colSpan={3 + RESOLUTIONS.length} className="px-2 pb-3 pt-1">
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <dl className="text-[11px] text-muted">
                {RESOLUTIONS.filter((r) => game.cells[r]).map((r) => (
                  <div key={r} className="flex justify-between gap-3 py-0.5">
                    <dt>1% low at {r}</dt>
                    <dd className="font-mono text-ink">{game.cells[r].lowFps ?? '—'}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 py-0.5">
                  <dt>Split</dt>
                  <dd className="text-ink">
                    {split
                      ? `${Math.round((1 - split.cpuShare) * 100)}% graphics — ${split.limitedBy === 'cpu' ? 'CPU-led' : split.limitedBy === 'gpu' ? 'GPU-led' : 'balanced'}`
                      : 'Split not modelled'}
                  </dd>
                </div>
              </dl>

              <div className="text-[11px] text-muted">
                {game.otherPresets.length > 0 && (
                  <p className="py-0.5">
                    <span className="text-ink">Also measured:</span>{' '}
                    {game.otherPresets.map((p) => p.preset).join(' · ')}
                  </p>
                )}
                <ul className="space-y-1">
                  {game.caveats.map((c) => (
                    <li key={c} className="leading-snug">{CAVEAT_TEXT[c] ?? c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/FrameRateRow.test.jsx
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Prove each test can fail**

| Mutation | Test that must go red |
|---|---|
| `—` in `Cell` → `0` | renders a dash, not a zero |
| `row.bound === 'upper'` → `false` | marks a ceiling cell with ≤ |
| `game.errorPct != null && …` removed | labels the row with its basis and band |
| `isOpen` always `true` | hides the detail until expanded |
| `onSelect?.(game.gameId)` removed | tells the caller which game was selected |
| `split` → `shown[0]` | says the split is not modelled |

- [ ] **Step 6: Commit**

```bash
git add src/components/performance/FrameRateRow.jsx src/tests/FrameRateRow.test.jsx
git commit -m "feat: render one game per row with a cell per resolution"
```

---

### Task 6: `FrameRateTable.jsx` — the table, its headers and the uncovered list

**Files:**
- Create: `src/components/performance/FrameRateTable.jsx`
- Test: `src/tests/FrameRateTable.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/FrameRateTable.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FrameRateTable from '../components/performance/FrameRateTable'

const cell = (avgFps) => ({
  avgFps, lowFps: avgFps - 20, frameTimeMs: 10, basis: 'ceiling', bound: 'upper',
  cpuShare: null, limitedBy: null, caveats: [], errorPct: null,
  presetId: 'ultra', upscaling: 'native',
})

const game = (id, name, best) => ({
  gameId: id, name, preset: 'Ultra', presetId: 'ultra', upscaling: 'native', presetTier: 4,
  cells: { '1080p': cell(best), '1440p': cell(best - 100), '4k': cell(best - 200) },
  basis: 'ceiling', errorPct: null, caveats: [], otherPresets: [], bestFps: best,
})

const rows = [game('a', 'Alpha', 400), game('b', 'Bravo', 300)]

describe('FrameRateTable', () => {
  it('is a real table with column headers', () => {
    // Three numeric columns per row is exactly the case a screen reader needs
    // headers for. A grid of divs gives it nothing to announce.
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    for (const h of ['1080p', '1440p', '4K']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(h, 'i') })).toBeInTheDocument()
    }
  })

  it('marks the build’s target resolution column', () => {
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    const th = screen.getByRole('columnheader', { name: /1440p/i })
    expect(th).toHaveAttribute('aria-current', 'true')
    // and the others are not
    expect(screen.getByRole('columnheader', { name: /1080p/i })).not.toHaveAttribute('aria-current', 'true')
  })

  it('retargets the build when a column header is clicked', async () => {
    const onTargetChange = vi.fn()
    const user = userEvent.setup()
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} onTargetChange={onTargetChange} />)
    await user.click(screen.getByRole('button', { name: /4K/i }))
    expect(onTargetChange).toHaveBeenCalledWith('4k')
  })

  it('lists games with no data, densely, below the table', () => {
    // Not dropped. A game silently missing reads as a bug, and the honest
    // statement of coverage is the point.
    render(<FrameRateTable rows={rows} target="1440p"
                           uncovered={[{ gameId: 'z', name: 'Zulu', presets: ['Ultra', 'High'] }]} />)
    expect(screen.getByText('Zulu')).toBeInTheDocument()
    expect(screen.getByText(/no benchmark data yet/i)).toBeInTheDocument()
  })

  it('renders no uncovered section when everything is covered', () => {
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    expect(screen.queryByText(/no benchmark data yet/i)).toBeNull()
  })

  it('renders a row per game, in the order given', () => {
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    const names = screen.getAllByRole('button').map((b) => b.textContent)
    expect(names.some((n) => n.includes('Alpha'))).toBe(true)
    expect(names.some((n) => n.includes('Bravo'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/FrameRateTable.test.jsx
```

Expected: FAIL — cannot resolve `../components/performance/FrameRateTable`.

- [ ] **Step 3: Implement**

Create `src/components/performance/FrameRateTable.jsx`:

```jsx
import { useState } from 'react'
import FrameRateRow from './FrameRateRow'
import { RESOLUTIONS } from '../../lib/perfEngine/gameRows'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

// The results, as a table rather than 155 bordered cards.
//
// A real <table> on purpose: three numeric columns per row is precisely the
// shape a screen reader needs <th scope="col"> for, and a grid of divs gives it
// nothing to announce.
export default function FrameRateTable({ rows, target, uncovered, onTargetChange, onSelect }) {
  const [openGameId, setOpenGameId] = useState(null)

  return (
    <>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th scope="col" className="py-1.5 pl-2 font-normal">Game</th>
            <th scope="col" className="px-2 py-1.5 font-normal">Preset</th>
            {RESOLUTIONS.map((res) => (
              <th
                key={res}
                scope="col"
                aria-current={res === target ? 'true' : undefined}
                className={`px-2 py-1.5 text-right font-normal ${
                  res === target ? 'bg-surface-2 text-ink' : ''}`}
              >
                {/* The header doubles as the resolution picker. The tab had no
                    way to change resolution at all — setResolution was called
                    in exactly one place, at setup — so this is the control,
                    rather than adding a separate one beside three columns that
                    already name the choices. */}
                <button
                  type="button"
                  onClick={() => onTargetChange?.(res)}
                  className="uppercase tracking-wider underline decoration-dotted underline-offset-2"
                >
                  {RES_LABEL[res]}
                </button>
              </th>
            ))}
            <th scope="col" className="px-2 py-1.5 text-right font-normal">Basis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <FrameRateRow
              key={g.gameId}
              game={g}
              target={target}
              expanded={openGameId === g.gameId}
              onToggle={(next) => setOpenGameId(next ? g.gameId : null)}
              onSelect={onSelect}
            />
          ))}
        </tbody>
      </table>

      {uncovered.length > 0 && (
        <section className="mt-3">
          <h4 className="text-[11px] uppercase tracking-wider text-muted">
            No benchmark data yet — {uncovered.length} game{uncovered.length === 1 ? '' : 's'}
          </h4>
          <ul className="mt-1.5 grid gap-x-5 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
            {uncovered.map((u) => (
              <li key={u.gameId} className="text-xs sm:flex sm:items-baseline sm:justify-between sm:gap-2">
                <span className="text-muted">{u.name}</span>
                <span className="block text-[10px] uppercase tracking-wider text-muted/70 sm:shrink-0">
                  {u.presets.join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/FrameRateTable.test.jsx
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Prove each test can fail**

| Mutation | Test that must go red |
|---|---|
| `<table>` → `<div>` | is a real table with column headers |
| `aria-current` line removed | marks the build's target resolution column |
| `onTargetChange?.(res)` removed | retargets the build when a column header is clicked |
| `uncovered.length > 0` → `false` | lists games with no data |
| `uncovered.length > 0` → `true` | renders no uncovered section when everything is covered |

- [ ] **Step 6: Commit**

```bash
git add src/components/performance/FrameRateTable.jsx src/tests/FrameRateTable.test.jsx
git commit -m "feat: render the results as a table with a column per resolution"
```

---

### Task 7: Wire the table into `PerformanceScreen`

**Files:**
- Modify: `src/components/performance/PerformanceScreen.jsx:26-149`
- Test: `src/tests/PerformanceScreen.test.jsx`

- [ ] **Step 1: Write the failing test**

Add to `src/tests/PerformanceScreen.test.jsx`, inside the existing top-level
`describe`:

```jsx
  it('calls the engine once per resolution, not once', () => {
    // Three columns need three reports. Getting this wrong either shows one
    // resolution three times or re-runs the engine on every render.
    estimateBuildPerformance.mockClear()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    const resolutions = estimateBuildPerformance.mock.calls.map((c) => c[0].resolution)
    expect(new Set(resolutions)).toEqual(new Set(['1080p', '1440p', '4k']))
    // ⚠️ Assert the COUNT too. Without this the test passes just as happily
    // when the memo is keyed wrongly and fires three calls per render — which
    // is the more likely defect, and the expensive one.
    expect(estimateBuildPerformance).toHaveBeenCalledTimes(3)
  })

  it('does not re-run the engine when only the filter changes', async () => {
    // The memo must be keyed on parts, not on filter state. Three engine calls
    // per checkbox tick is the regression this catches.
    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    estimateBuildPerformance.mockClear()
    await user.click(screen.getByRole('checkbox', { name: /only show real data/i }))
    expect(estimateBuildPerformance).not.toHaveBeenCalled()
  })

  it('shows one row per game rather than one per preset', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    const table = screen.getByRole('table')
    // Header row plus one row per game. The old grid produced 60 cards for
    // this build at 1440p; the games behind them number far fewer.
    // `tr[data-game]` counts SUMMARY rows only. Plain `tbody tr` would also
    // count expansion rows, so the assertion would drift the moment a row
    // opened — and would pass for the wrong reason if grouping broke but
    // something else added rows.
    const bodyRows = table.querySelectorAll('tbody tr[data-game]')
    expect(bodyRows.length).toBeGreaterThan(10)
    expect(bodyRows.length).toBeLessThan(60)
    // One row per DISTINCT game — the actual claim. Without this the bounds
    // above pass for any row count in range, including duplicated games.
    const ids = [...bodyRows].map((r) => r.dataset.game)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('applies the real-data filter BEFORE grouping, not after', async () => {
    // ⚠️ This fixture is built so the two implementations disagree. `ultra`
    // answers at three resolutions and would win preset selection on coverage,
    // but it is a ceiling row the filter removes. `high` answers at one and is
    // measured.
    //
    //   filter-then-group  -> `ultra` is gone before selection runs, `high` is
    //                         chosen, and the game shows one row reading High.
    //   group-then-filter  -> `ultra` was already chosen, the filter then drops
    //                         the whole game, and the table is empty.
    //
    // A test that only asserted "some rows are shown" would pass against both.
    // A row does NOT carry its own resolution — the report it sits in supplies
    // that. So the mock is keyed on the ARGUMENT, not on call order: a
    // mockReturnValueOnce chain would silently hand the real engine's output
    // back if the memo ever ran a fourth time, and would break outright if the
    // call order changed.
    const wide = (avgFps) => ({
      rowId: 'g|ultra|native', gameId: 'g', name: 'Split Test', preset: 'Ultra',
      presetId: 'ultra', presetTier: 4, upscaling: 'native', avgFps, lowFps: avgFps - 10,
      frameTimeMs: 5, basis: 'ceiling', bound: 'upper', caveats: [], errorPct: null,
      cpuShare: null, limitedBy: null,
    })
    const narrow = {
      rowId: 'g|high|native', gameId: 'g', name: 'Split Test', preset: 'High',
      presetId: 'high', presetTier: 3, upscaling: 'native', avgFps: 111, lowFps: 90,
      frameTimeMs: 9, basis: 'measured', bound: 'point', caveats: [], errorPct: null,
      cpuShare: null, limitedBy: null,
    }
    const byRes = {
      '1080p': [wide(300), narrow],   // `ultra` wide + `high` narrow
      '1440p': [wide(200)],
      '4k': [wide(100)],
    }
    estimateBuildPerformance.mockImplementation(
      ({ resolution }) => mixedReport(byRes[resolution] ?? []))

    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)

    // Unfiltered: coverage wins, so Ultra is the shown preset.
    expect(screen.getByText('Ultra')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /only show real data/i }))

    // Filtered: Ultra is gone, High survives, and the game is STILL LISTED.
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.queryByText('Ultra')).toBeNull()
    expect(screen.getByText('Split Test')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/PerformanceScreen.test.jsx
```

Expected: FAIL — the engine is called once, and there is no `table` role.

- [ ] **Step 3: Replace the report memo with three**

In `src/components/performance/PerformanceScreen.jsx`, replace the `report` memo
(lines 47-53) with:

```jsx
  // THREE reports, one per resolution — the table shows all three at once.
  // Everything that is not the table (tiles, bottleneck, power, thermals) reads
  // the build's TARGET resolution, which the store still owns and which
  // BuildSummary and the share code still follow.
  //
  // Keyed on parts + games only. The engine is single-digit ms, so 3x is still
  // nothing, but this must not be allowed to re-run per render.
  const reports = useMemo(
    () => (hasCore
      ? Object.fromEntries(RESOLUTIONS.map((res) => [
          res,
          estimateBuildPerformance({ parts: selectedParts, resolution: res,
                                     presetId: 'high', model: perfModel, games }),
        ]))
      : null),
    [hasCore, selectedParts, games],
  )
  const report = reports?.[resolution] ?? null
```

Add to the imports:

```jsx
import { buildGameRows, RESOLUTIONS } from '../../lib/perfEngine/gameRows'
import FrameRateTable from './FrameRateTable'
```

- [ ] **Step 4: Build the grouped rows, filtered first**

Replace the `allRows` / `shownRows` / `shownAnswered` block (lines 68-75) with:

```jsx
  const answered = report?.coverage?.gamesAnswered ?? 0
  const setResolution = useBuilderStore((s) => s.setResolution)

  // ⚠️ FILTER FIRST, THEN GROUP. Grouping first and filtering after would let a
  // game keep a preset the filter removed — the row would show a number the
  // filter existed to hide.
  const filteredReports = useMemo(() => {
    if (!reports) return null
    if (!realOnly) return reports
    return Object.fromEntries(Object.entries(reports).map(
      ([res, r]) => [res, { ...r, games: onlyRealData(r.games) }]))
  }, [reports, realOnly])

  const gameRows = useMemo(
    () => (filteredReports ? buildGameRows(filteredReports) : []),
    [filteredReports],
  )

  // Counted from the UNFILTERED reports, always — the mix must not be
  // shrinkable by hiding rows.
  const allGameRows = useMemo(
    () => (reports ? buildGameRows(reports) : []),
    [reports],
  )

  // Games the corpus answers nothing for, at any resolution, collapsed to one
  // line each naming their presets.
  const uncovered = useMemo(() => {
    const answeredIds = new Set(allGameRows.map((g) => g.gameId))
    const seen = new Map()
    for (const r of report?.games ?? []) {
      if (answeredIds.has(r.gameId)) continue
      if (!seen.has(r.gameId)) seen.set(r.gameId, { gameId: r.gameId, name: r.name, presets: [] })
      seen.get(r.gameId).presets.push(r.preset)
    }
    return [...seen.values()]
  }, [allGameRows, report])
```

- [ ] **Step 5: Swap the grid for the table**

Replace the `<FpsCardGrid rows={shownRows} />` branch and the two empty-state
conditions (lines 98-124) with:

```jsx
        {!hasCore ? (
          <p className="text-xs text-muted leading-relaxed">
            Pick a CPU and a graphics card to estimate frame rates.
          </p>
        ) : answered === 0 ? (
          <p className="max-w-[68ch] text-xs text-muted leading-relaxed">
            No benchmark data for these parts yet. The engine only reports figures it
            can trace to a published measurement, so rather than estimate around the
            gap it says nothing. Coverage grows as the benchmark corpus does — every
            section below is computed from the parts themselves and does not depend
            on it.
          </p>
        ) : gameRows.length === 0 ? (
          <p className="max-w-[68ch] text-xs text-muted leading-relaxed">
            Nothing here was measured. Every figure for this build is worked out from
            the parts&rsquo; specifications rather than from a benchmark of them, so
            the filter leaves nothing to show. Untick it to see the estimates and what
            each one is based on.
          </p>
        ) : (
          <FrameRateTable
            rows={gameRows}
            target={resolution}
            uncovered={uncovered}
            onTargetChange={setResolution}
            onSelect={setSelectedGameId}
          />
        )}
```

Update the `BasisBar` call to take game rows:

```jsx
        <BasisBar rows={allGameRows} realOnly={realOnly} onRealOnlyChange={setRealOnly} />
```

And the provenance footer, which now counts games:

```jsx
          {hasCore && ` · ${gameRows.length} game${gameRows.length === 1 ? '' : 's'} shown, ${report.coverage.rowsExact} measured directly`}
```

Update the section blurb, which named a single resolution:

```jsx
        blurb="Every game the corpus covers, at all three resolutions. One preset per game so the columns compare like with like — open a row for its other presets, its 1% lows and what each figure is based on."
```

- [ ] **Step 6: Add the selection state**

Beside the existing `realOnly` state:

```jsx
  const [selectedGameId, setSelectedGameId] = useState(null)
```

- [ ] **Step 7: Run the tests**

```bash
npx vitest run src/tests/PerformanceScreen.test.jsx
```

Expected: the three new tests PASS. **Several existing tests will fail** — they
assert against the card grid and a row-level mix. Leave them failing; Task 8
updates them deliberately.

- [ ] **Step 8: Commit**

```bash
git add src/components/performance/PerformanceScreen.jsx src/tests/PerformanceScreen.test.jsx
git commit -m "feat: feed the Performance tab three reports and one row per game"
```

---

### Task 8: The bottleneck tile, the per-game section, and the deliberate test updates

**Files:**
- Modify: `src/components/performance/SummaryStrip.jsx:53-61`
- Modify: `src/components/performance/BasisBar.jsx`
- Modify: `src/components/performance/PerformanceScreen.jsx`
- Test: `src/tests/SummaryStrip.test.jsx`, `src/tests/BasisBar.test.jsx`, `src/tests/PerformanceScreen.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/SummaryStrip.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SummaryStrip from '../components/performance/SummaryStrip'

const report = (over = {}) => ({
  coverage: { gamesAnswered: 53, gamesTotal: 60, gamesExact: 0 },
  bottleneck: {
    leaning: 'gpu', gpuLedGames: 4, cpuLedGames: 0, gamesConsidered: 4,
    verdict: 'Graphics-limited in 4 of 4 games.',
  },
  ...over,
})

describe('SummaryStrip', () => {
  it('calls the tile Bottleneck, not "Held back by"', () => {
    render(<SummaryStrip hasCore report={report()} power={{}} resolution="1440p" />)
    expect(screen.getByText(/bottleneck/i)).toBeInTheDocument()
    expect(screen.queryByText(/held back by/i)).toBeNull()
  })

  it('states the base the verdict was computed from', () => {
    // The verdict comes from the games with a fitted CPU constant — 4 of 53
    // covered. Without the denominator the tile reads as a whole-build claim
    // drawn from 7% of the rows.
    render(<SummaryStrip hasCore report={report()} power={{}} resolution="1440p" />)
    expect(screen.getByText(/4 of 4 games where the split is known/i)).toBeInTheDocument()
  })

  it('says so when no game has a split at all', () => {
    render(<SummaryStrip hasCore report={report({ bottleneck: null })} power={{}} resolution="1440p" />)
    expect(screen.getByText(/needs benchmark data/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/SummaryStrip.test.jsx
```

Expected: FAIL — the tile is labelled "Held back by".

- [ ] **Step 3: Update `SummaryStrip`**

Replace the second `<Tile>` (lines 53-61) with:

```jsx
      <Tile
        label="Bottleneck"
        value={hasCore ? leaningLabel : null}
        // ⚠️ States its own base. The verdict is computed only from games with a
        // fitted CPU constant — 4 of 53 covered for a typical build — so a bare
        // "4 graphics-limited" reads as a whole-build conclusion drawn from 7%
        // of the rows. `gamesConsidered` is the honest denominator.
        sub={report?.bottleneck
          ? `${report.bottleneck.gpuLedGames} of ${report.bottleneck.gamesConsidered} games where the split is known`
          : 'Needs benchmark data to say'}
        // A graphics-led frame is the healthy arrangement, so it is not "bad".
        tone={!report?.bottleneck ? 'ink' : leaning === 'cpu' ? 'bad' : 'good'}
      />
```

- [ ] **Step 4: Make the bottleneck section game-specific**

In `PerformanceScreen.jsx`, add above the return:

```jsx
  // The bottleneck section reflects the SELECTED game when there is one, and
  // the whole build otherwise. Per-game is far more accurate — the build-wide
  // verdict averages over the handful of games that have a split at all.
  const selectedRow = useMemo(() => {
    if (!selectedGameId) return null
    return report?.games?.find(
      (r) => r.gameId === selectedGameId && r.cpuShare != null) ?? null
  }, [selectedGameId, report])

  const bottleneckRef = useRef(null)
  // Scrolls the section into view when a game is picked, because the section
  // sits below a table that can be 56 rows long — updating it in place would be
  // invisible. `block: 'nearest'` avoids yanking the page when it is already on
  // screen, and reduced-motion users get an instant jump rather than a glide.
  useEffect(() => {
    if (!selectedGameId || !bottleneckRef.current) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    bottleneckRef.current.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth', block: 'nearest',
    })
  }, [selectedGameId])
```

Add `useEffect` and `useRef` to the React import. Then give the section its ref
and a per-game title:

```jsx
      <Section
        ref={bottleneckRef}
        title={selectedRow ? `What's holding back ${selectedRow.name}` : "What's holding it back"}
        blurb="Which part is the limit differs per game, so it is worked out from the frame rates rather than by comparing the two parts in the abstract."
      >
```

> `Section.jsx` does not currently take a ref. **This is React 19, where `ref` is
> an ordinary prop on a function component** — no `forwardRef` wrapper is needed.
> Change its signature to `({ title, blurb, children, className = '', ref })` and
> put `ref={ref}` on the `<section>`.

Inside the Bottleneck `StatPanel`, when a game is selected show that game rather
than the build summary:

```jsx
          <StatPanel
            title="Bottleneck"
            subtitle={selectedRow
              ? `${selectedRow.name} at ${selectedRow.preset}.`
              : report?.bottleneck
                ? report.bottleneck.verdict
                : 'Needs benchmark data before it can say anything.'}
            footnote={selectedRow ? undefined : report?.bottleneck?.nextUpgrade?.reason}
          >
            {selectedRow ? (
              <>
                <StatRow label="Limited by"
                         value={selectedRow.limitedBy === 'cpu' ? 'processor'
                           : selectedRow.limitedBy === 'gpu' ? 'graphics' : 'balanced'}
                         tone={selectedRow.limitedBy === 'cpu' ? 'bad' : 'good'} />
                <StatRow label="Card could do" value={selectedRow.gpuOnlyFps} unit="fps" />
                <StatRow label="Chip could feed" value={selectedRow.cpuOnlyFps} unit="fps" />
              </>
            ) : report?.bottleneck ? (
```

…keeping the existing build-wide `StatRow` list as the middle branch and the
existing `<StatRow label="Status" value="needs benchmark data" />` as the last.

When a game is selected but has no split, say so rather than falling back to the
build figure silently:

```jsx
  const selectedGame = gameRows.find((g) => g.gameId === selectedGameId) ?? null
```

and use `selectedGame && !selectedRow` to render:

```jsx
                <StatRow label="Status" value="split not modelled for this game"
                         hint="No review has measured processor performance in this game, so there is nothing to attribute the frame to." />
```

- [ ] **Step 5: Update `BasisBar` to count games**

In `BasisBar.jsx`, the mix now counts one entry per game shown. `basisMix`
already takes an array of anything carrying `basis`, so only the comment and the
wording change:

```jsx
  // ⚠️ Counted from the UNFILTERED game rows, always. If these totals moved when
  // the filter went on, the control could be used to make a thin evidence base
  // look solid — the exact failure this whole feature exists to prevent.
  //
  // One entry per GAME since the table groups by game. It read 60 (one per game
  // AND preset) against a table showing 56 rows, which looks like a counting bug.
  const mix = basisMix(rows)
```

- [ ] **Step 6: Update the tests that pinned the old shape**

`BasisBar.test.jsx` and `PerformanceScreen.test.jsx` assert row-level counts and
the card grid. **Read each one and say what changed in the commit message rather
than deleting it quietly** — these pinned real guarantees and the guarantees
still hold, one level up.

Concretely, three kinds of change:

1. **Fixtures become game rows, not engine rows.** Anywhere a test builds
   `{ rowId, basis, avgFps, … }` and passes it as a `rows` entry, it now needs
   the `buildGameRows` shape — `{ gameId, name, preset, cells: { '1080p': …,
   '1440p': …, '4k': … }, basis, errorPct, caveats, otherPresets, bestFps }`.

2. **Counts move from rows to games.** `PerformanceScreen.test.jsx`'s
   `/^0 benchmarked$/` assertion still holds, but any test asserting
   `60 estimated` becomes the game count. Assert the relationship rather than
   the literal where you can — e.g. that the mix totals equal
   `screen.getByRole('table').querySelectorAll('tbody tr[data-game]').length`
   — so the number does not need chasing every time the corpus grows.

3. **`answers for an unindexed processor…`** currently asserts
   `getAllByText(/estimate/i).length > 0` against cards. It still passes against
   table rows; verify rather than assume.

The invariant that must survive completely unchanged: **the filter never changes
the mix totals.** If updating a test makes that one easier to satisfy, the update
is wrong.

- [ ] **Step 7: Run everything**

```bash
npx vitest run
```

```bash
npm run lint
```

Expected: all green.

- [ ] **Step 8: Prove each new test can fail**

| Mutation | Test that must go red |
|---|---|
| tile label back to `"Held back by"` | calls the tile Bottleneck |
| `of ${report.bottleneck.gamesConsidered} games where the split is known` → `graphics-limited` | states the base the verdict was computed from |
| `selectedRow` forced to `null` | the per-game bottleneck tests |
| `basisMix(rows)` → `basisMix(shownRows)` | the filter never changes the mix totals |

- [ ] **Step 9: Commit**

```bash
git add src/components/performance src/tests
git commit -m "feat: name the tile Bottleneck, state its base, and make the section per-game"
```

---

### Task 9: Retire the cards and de-border the rest of the tab

**Files:**
- Delete: `src/components/performance/FpsCard.jsx`, `src/components/performance/FpsCardGrid.jsx`
- Delete: `src/tests/FpsCard.test.jsx`
- Modify: `src/components/performance/StatPanel.jsx`

- [ ] **Step 1: Confirm nothing still imports the cards**

```bash
grep -rn "FpsCard" src/ --include=*.jsx --include=*.js
```

Expected: only the files about to be deleted. If `PerformanceScreen` still
imports `FpsCardGrid`, Task 7 was not finished.

- [ ] **Step 2: Delete them**

```bash
git rm src/components/performance/FpsCard.jsx src/components/performance/FpsCardGrid.jsx src/tests/FpsCard.test.jsx
```

`FpsCard.test.jsx` goes because every guarantee it held is now pinned on
`FrameRateRow.test.jsx`: the tier label, the `±` band, the "up to"/`≤` marker
driven by `bound` rather than the label, and the caveats hidden until expanded.
**Check each of its assertions has a counterpart before deleting** — if one does
not, add it to `FrameRateRow.test.jsx` first.

- [ ] **Step 3: Take the borders off `StatPanel`**

The tab carries 170 bordered panels. Sections keep their heading and gain a
hairline rule; the panels inside stop drawing boxes.

Replace the whole of `src/components/performance/StatPanel.jsx`:

```jsx
// A titled group of stats. Kept deliberately plain: this is a data page, and
// the job is legibility down a column rather than decoration.
//
// The border came off when the frame-rate cards did. With 155 of those gone the
// remaining panels were the only boxes left on the page, which made eight
// reference panels look like the loudest thing on it. The Section heading and
// the rule between sections carry the grouping now.
export default function StatPanel({ title, subtitle, children, footnote }) {
  return (
    <section className="py-1">
      <header className="mb-2">
        <h3 className="text-sm text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted leading-relaxed">{subtitle}</p>}
      </header>
      {children}
      {footnote && (
        <p className="mt-2.5 border-t border-line pt-2 text-[10px] text-muted leading-relaxed">
          {footnote}
        </p>
      )}
    </section>
  )
}
```

The `footnote` rule stays — it separates a caveat from the figures above it
inside one panel, which is a different job from boxing the panel.

- [ ] **Step 4: Put a rule between sections**

⚠️ **`Section.jsx` currently carries a comment saying the opposite** — *"Spacing
does the separating, not more borders. Adding rules between groups on a page
already full of bordered cards just adds noise."* That reasoning was correct and
its **premise has now changed**: the page is no longer full of bordered cards.
Update the comment rather than silently contradicting it.

In `Section.jsx`, change the `<section>` line and the comment above it:

```jsx
// Spacing separated these groups while the page was full of bordered cards —
// adding rules on top of all those boxes would have been noise. StatPanel lost
// its border when the 155 frame-rate cards went, so a hairline rule is now the
// only thing marking where one band ends and the next begins.
export default function Section({ title, blurb, children, className = '', ref }) {
  return (
    <section
      ref={ref}
      className={`mt-7 border-t border-line pt-5 first:mt-0 first:border-t-0 first:pt-0 ${className}`}
    >
```

- [ ] **Step 5: Run everything**

```bash
npx vitest run
```

```bash
npm run lint
```

The panel count itself is checked in the browser in Task 10 — it dropped from
170, and that is the number the user's complaint was about.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/performance src/tests
git commit -m "refactor: retire the fps cards and take the borders off the tab"
```

---

### Task 10: Responsive, browser verification, and the full sweep

**Files:**
- Modify: `src/components/performance/FrameRateTable.jsx`, `FrameRateRow.jsx`

- [ ] **Step 1: Write the failing test**

Add to `src/tests/FrameRateTable.test.jsx`:

```jsx
  it('hides the non-target resolution columns on narrow screens', () => {
    // Six columns do not fit 375px. The other two resolutions move into the
    // expanded row rather than being dropped, and the table never scrolls
    // sideways — the page body must never scroll horizontally.
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    const off = screen.getByRole('columnheader', { name: /1080p/i })
    expect(off.className).toMatch(/hidden/)
    expect(off.className).toMatch(/sm:table-cell/)
    const on = screen.getByRole('columnheader', { name: /1440p/i })
    expect(on.className).not.toMatch(/hidden/)
  })
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/FrameRateTable.test.jsx
```

Expected: FAIL — no `hidden` class on the off-target headers.

- [ ] **Step 3: Implement**

In `FrameRateTable.jsx`, add to the resolution `<th>` className:

```jsx
                className={`px-2 py-1.5 text-right font-normal ${
                  res === target ? 'bg-surface-2 text-ink' : 'hidden sm:table-cell'}`}
```

Apply the same conditional to `Cell`'s `<td>` in `FrameRateRow.jsx`:

```jsx
  const hide = isTarget ? '' : 'hidden sm:table-cell'
```

…and add the off-target figures to the expansion so nothing is lost on mobile:

```jsx
                {RESOLUTIONS.filter((r) => r !== target && game.cells[r]).map((r) => (
                  <div key={`avg-${r}`} className="flex justify-between gap-3 py-0.5 sm:hidden">
                    <dt>Average at {r}</dt>
                    <dd className="font-mono text-ink">
                      {game.cells[r].bound === 'upper' ? '≤' : ''}{game.cells[r].avgFps}
                    </dd>
                  </div>
                ))}
```

`FrameRateRow` needs `target` for this, which it already receives.

- [ ] **Step 4: Run everything**

```bash
npx vitest run
```

```bash
npm run lint
```

```bash
npm run build
```

- [ ] **Step 5: Verify in the browser**

Start the dev server and open the Performance tab. Seed a build with an
unindexed CPU (`cpu-i5-13600k` + `gpu-rtx-4070`) by writing `localStorage`
`custompc-builder-v1` and reloading — `navigate` strips the hash, so set
`window.location.hash` after.

Confirm:

- one row per game, three columns, dashes where a resolution has no answer
- `≤` on ceiling cells, bare figures on point estimates
- the 1440p column is marked; **clicking the 4K header retargets** and the tiles,
  bottleneck and power figures all move with it
- expanding a row shows 1% lows, the split or "not modelled", the other presets
  and the caveats
- expanding **scrolls the bottleneck section into view** and retitles it
- the bottleneck tile reads "Bottleneck" with its denominator
- **the bordered-panel count is under 20**, from 170:
  `document.querySelectorAll('[class*="rounded"][class*="border"]').length`
- `resize_window` to 375: only the target column shows, the others appear in the
  expansion, and **the page body does not scroll horizontally**
- **no console errors** — read them in a FRESH TAB, because HMR errors from
  mid-edit states persist in the buffer and are not real failures

- [ ] **Step 6: Sweep for regressions in the numbers**

The figures must not have moved — nothing in this plan touches the engine, so
**any change in a frame rate is a bug in this work**.

Create `scripts/tmp-sweep.mjs` (throwaway, **not committed**):

```js
// Throwaway: every answered row, hashed, so a presentation change can prove it
// moved no number. Run on this branch and on main; the digests must match.
import { createHash } from 'node:crypto'
import { estimateBuildPerformance } from '../src/lib/perfEngine/index.js'
import model from '../src/data/perfModel.json' with { type: 'json' }
import games from '../src/data/perfGames.json' with { type: 'json' }
import parts from '../src/data/partsData.json' with { type: 'json' }

const list = Array.isArray(parts) ? parts : parts.parts
const pick = (id) => list.find((p) => p.id === id)
const BUILDS = [
  ['cpu-i5-13600k', 'gpu-rtx-4070'],
  ['cpu-ryzen-7-9800x3d', 'gpu-rtx-4070'],
  ['cpu-ryzen-5-5600', 'gpu-rtx-3060-12gb'],
]

const lines = []
for (const [cpuId, gpuId] of BUILDS) {
  for (const res of ['1080p', '1440p', '4k']) {
    const r = estimateBuildPerformance({
      parts: { cpu: pick(cpuId), gpu: pick(gpuId) }, resolution: res, model, games,
    })
    for (const g of r.games.filter((x) => x.avgFps > 0).sort((a, b) => a.rowId.localeCompare(b.rowId))) {
      lines.push(`${cpuId}|${gpuId}|${res}|${g.rowId}|${g.avgFps}|${g.lowFps}|${g.basis}|${g.bound}`)
    }
  }
}
console.log(`rows: ${lines.length}`)
console.log(`digest: ${createHash('md5').update(lines.join('\n')).digest('hex')}`)
```

```bash
npx vite-node scripts/tmp-sweep.mjs
```

Record the row count and digest, then:

```bash
git stash && git checkout main && npx vite-node scripts/tmp-sweep.mjs
```

```bash
git checkout - && git stash pop
```

Expected: **identical row count and digest on both sides.**

⚠️ `scripts/tmp-sweep.mjs` is untracked, so `git checkout main` carries it
across — that is why the comparison works. Delete it afterwards:

```bash
rm scripts/tmp-sweep.mjs
```

- [ ] **Step 7: Commit**

```bash
git add src/components/performance src/tests
git commit -m "feat: show only the target resolution column on narrow screens"
```

---

## Done when

- A build with an unindexed CPU shows one row per game with 1080p, 1440p and 4K
  side by side, and roughly 90% of the grid filled.
- No game's columns compare different presets, asserted over the real corpus.
- A resolution with no answer renders a dash; a ceiling cell renders `≤`.
- Clicking a column header retargets the build, and the tiles, bottleneck and
  power all follow.
- The bottleneck tile is named "Bottleneck" and states the base its verdict came
  from; the section below retitles and scrolls into view for the selected game,
  and says "split not modelled for this game" for the ~48 of 53 that have none.
- The filter still cannot change the mix totals.
- Bordered panels are under 20, from 170.
- At 375px only the target column shows and the page does not scroll sideways.
- `npx vitest run`, `npm run lint`, `npm run build` all green.
- **Every new assertion proved failable by mutation.**
- No frame rate has changed anywhere — no task touches the engine.
- Nothing pushed, nothing deployed, no Supabase write.
