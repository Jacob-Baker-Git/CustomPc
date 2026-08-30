# Performance engine phase E — CPU-scaling data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revive the dead `modelled` tier by putting upscaling into the cell key, then importing both ComputerBase reviews in full so seven games carry both a GPU-side `A` and a CPU-side `B`, and mainstream processors get an index.

**Architecture:** Three ordered steps. Tasks 1–5 are a structural change to the cell key, gated by a refit that must reproduce every existing constant byte-for-byte. Tasks 6–8 are data imports into the corrected shape. Task 9 indexes the processors people actually buy, which needs only connectivity to the existing CPU set, not new games.

**Tech Stack:** Plain-Node ESM scripts (`scripts/*.mjs`), zero-import modules under `src/lib/perfEngine/`, Vitest, PowerShell for corpus inspection on Windows.

**Spec:** `docs/superpowers/specs/2026-08-11-perf-engine-phase-e-cpu-scaling-design.md`

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/perfEngine/indices.js` | Lookup into the fitted artefact | Add `cellKeyFor`; `cellFor` and `exactKey` take upscaling |
| `src/lib/perfEngine/perfGamesList.js` | Derive the game list from the corpus | Group presets by id **and** upscaling |
| `src/lib/perfEngine/index.js` | Public engine contract | Pass `preset.upscaling` through; extend `rowId` |
| `scripts/fit-perf-model.mjs` | Fit the corpus into `perfModel.json` | Cell keys and exact keys carry upscaling |
| `scripts/compare-perf-model.mjs` | **New.** Migration gate | Diff two model artefacts, ignoring key spelling |
| `data/benchmarks/inbox/*.tsv` | Corpus source of truth | Two reviews imported in full |

`build-perf-games.mjs` needs no change — it delegates entirely to `perfGamesList.js`.

---

### Task 1: Put upscaling in the cell key

**Files:**
- Modify: `src/lib/perfEngine/indices.js`
- Test: `src/tests/perfEngineIndices.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/perfEngineIndices.test.js`:

```js
describe('cell keys carry upscaling', () => {
  const model = {
    gameConst: {
      wukong: {
        '1440p': {
          'kino|native': { A: 100, B: 50 },
          'kino|quality': { A: 160, B: 50 },
        },
      },
    },
  }

  it('separates the same preset measured at different render scales', () => {
    expect(cellFor(model, { id: 'wukong' }, '1440p', 'kino', 'native').A).toBe(100)
    expect(cellFor(model, { id: 'wukong' }, '1440p', 'kino', 'quality').A).toBe(160)
  })

  it('returns null for an upscaling mode nobody measured', () => {
    expect(cellFor(model, { id: 'wukong' }, '1440p', 'kino', 'performance')).toBeNull()
  })

  it('builds the composite key in one place', () => {
    expect(cellKeyFor('kino', 'native')).toBe('kino|native')
  })

  it('keys the exact table on upscaling too', () => {
    expect(exactKey({
      cpu: { id: 'c' }, gpu: { id: 'g' }, game: { id: 'wukong' },
      resolution: '1440p', presetId: 'kino', upscaling: 'quality',
    })).toBe('c|g|wukong|1440p|kino|quality')
  })
})
```

Add `cellKeyFor` to the existing import at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/tests/perfEngineIndices.test.js
```

Expected: FAIL — `cellKeyFor is not a function`, and the `cellFor` calls return `undefined` because the leaf key is still `kino`.

- [ ] **Step 3: Implement**

In `src/lib/perfEngine/indices.js`, add above `cellFor`:

```js
// The cell key, built in ONE place so no caller concatenates it by hand.
//
// Upscaling is part of the key because it is part of the measurement. Without
// it an `A` fitted from DLSS-Quality rows pairs with a `B` fitted from native
// rows, and the blended frame time describes neither — the eighth instance of
// this engine's founding failure mode, a number nobody measured presented
// exactly like one that was.
export function cellKeyFor(presetId, upscaling) {
  return `${presetId}|${upscaling}`
}
```

Replace the body of `cellFor`:

```js
export function cellFor(model, game, resolution, presetId, upscaling) {
  const cell = model?.gameConst?.[game?.id]?.[resolution]?.[cellKeyFor(presetId, upscaling)]
  if (!(cell?.A > 0)) return null
  return cell
}
```

Replace `exactKey`:

```js
export function exactKey({ cpu, gpu, game, resolution, presetId, upscaling }) {
  return `${cpu?.id}|${gpu?.id}|${game?.id}|${resolution}|${presetId}|${upscaling}`
}
```

Update `hasCoverage` so its `cellFor` call passes upscaling:

```js
export function hasCoverage(model, { cpu, gpu, game, resolution, presetId, upscaling }) {
  return (
    gpuIndexFor(model, gpu, resolution).value > 0 &&
    cpuIndexFor(model, cpu).value > 0 &&
    cellFor(model, game, resolution, presetId, upscaling)?.B > 0
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/tests/perfEngineIndices.test.js
```

Expected: PASS. Older tests in this file that call `cellFor(model, game, res, presetId)` with four arguments will now fail — update each to pass `'native'` as the fifth argument and adjust their fixture leaf keys from `presetId` to `` `${presetId}|native` ``.

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfEngine/indices.js src/tests/perfEngineIndices.test.js
git commit -m "feat: key a benchmark cell by the render scale it was measured at"
```

---

### Task 2: Derive upscaling into the game list

**Files:**
- Modify: `src/lib/perfEngine/perfGamesList.js`
- Test: `src/tests/perfGamesList.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/perfGamesList.test.js`:

```js
it('lists a preset once per render scale it was measured at', () => {
  const { games, problems } = buildPerfGames({
    meta: {
      games: { wukong: { name: 'Black Myth: Wukong', slug: 'black-myth-wukong' } },
      presets: { kino: { label: 'Kino', tier: 4 } },
    },
    entries: [
      { gameId: 'wukong', presetId: 'kino', upscaling: 'native' },
      { gameId: 'wukong', presetId: 'kino', upscaling: 'quality' },
      { gameId: 'wukong', presetId: 'kino', upscaling: 'quality' },
    ],
  })

  expect(problems).toEqual([])
  expect(games[0].presets).toEqual([
    { id: 'kino', label: 'Kino', tier: 4, upscaling: 'native' },
    { id: 'kino', label: 'Kino (DLSS/FSR Quality)', tier: 4, upscaling: 'quality' },
  ])
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/tests/perfGamesList.test.js
```

Expected: FAIL — one preset entry with no `upscaling` field.

- [ ] **Step 3: Implement**

In `src/lib/perfEngine/perfGamesList.js`, add near the top:

```js
// An upscaled frame rate is not a native one, so a preset measured at two render
// scales is two listed presets. The suffix is what stops the page rendering two
// rows both labelled "Ultra" that mean different things.
const UPSCALING_LABELS = {
  native: null,
  'ultra-quality': 'DLSS/FSR Ultra Quality',
  quality: 'DLSS/FSR Quality',
  balanced: 'DLSS/FSR Balanced',
  performance: 'DLSS/FSR Performance',
}
```

Change the counting loop to key on preset **and** upscaling:

```js
  // gameId -> "presetId|upscaling" -> how many live entries use it
  const seen = new Map()
  for (const e of live) {
    if (!seen.has(e.gameId)) seen.set(e.gameId, new Map())
    const presets = seen.get(e.gameId)
    const key = `${e.presetId}|${e.upscaling}`
    presets.set(key, (presets.get(key) ?? 0) + 1)
  }
```

Change the preset-building loop:

```js
    const presets = []
    for (const [key, count] of presetCounts) {
      const [presetId, upscaling] = key.split('|')
      const presetMeta = meta.presets[presetId]
      if (!presetMeta) {
        problems.push(`preset "${presetId}" (used by ${gameId}) has no gameMeta entry — ` +
                      'its tier cannot be guessed, it is what preset fallback compares')
        continue
      }
      if (!(upscaling in UPSCALING_LABELS)) {
        problems.push(`upscaling "${upscaling}" (used by ${gameId}) is not a known render ` +
                      'scale — it cannot be labelled, and an unlabelled scale reads as native')
        continue
      }
      const base = gameMeta.presetLabels?.[presetId] ?? presetMeta.label
      const suffix = UPSCALING_LABELS[upscaling]
      presets.push({
        id: presetId,
        label: suffix ? `${base} (${suffix})` : base,
        tier: presetMeta.tier,
        upscaling,
        count,
      })
    }
```

And extend the sort and the emitted shape:

```js
    presets.sort((a, b) =>
      a.tier - b.tier || b.count - a.count ||
      a.id.localeCompare(b.id) || a.upscaling.localeCompare(b.upscaling))
```

```js
      presets: presets.map(({ id, label, tier, upscaling }) => ({ id, label, tier, upscaling })),
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/tests/perfGamesList.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfEngine/perfGamesList.js src/tests/perfGamesList.test.js
git commit -m "feat: list a preset once per render scale the corpus measured"
```

---

### Task 3: Pass upscaling through the engine

**Files:**
- Modify: `src/lib/perfEngine/index.js:17-34`
- Test: `src/tests/perfEngine.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/perfEngine.test.js`:

```js
it('gives a native and an upscaled row of one preset different identities', () => {
  const games = [{
    id: 'wukong', name: 'Black Myth: Wukong',
    presets: [
      { id: 'kino', label: 'Kino', tier: 4, upscaling: 'native' },
      { id: 'kino', label: 'Kino (DLSS/FSR Quality)', tier: 4, upscaling: 'quality' },
    ],
  }]
  const model = {
    gpuIndex: { g: { '1440p': 100, basis: 'measured' } },
    cpuIndex: { c: { value: 100, basis: 'measured' } },
    gameConst: {
      wukong: {
        '1440p': {
          'kino|native': { A: 2000, B: 800 },
          'kino|quality': { A: 1250, B: 800 },
        },
      },
    },
    exact: {}, blendK: 5.1,
  }

  const out = estimateBuildPerformance({
    parts: { cpu: { id: 'c' }, gpu: { id: 'g' } },
    resolution: '1440p', model, games,
  })

  const ids = out.games.map((r) => r.rowId)
  expect(ids).toContain('wukong|kino|native')
  expect(ids).toContain('wukong|kino|quality')
  const native = out.games.find((r) => r.rowId === 'wukong|kino|native')
  const quality = out.games.find((r) => r.rowId === 'wukong|kino|quality')
  expect(quality.avgFps).toBeGreaterThan(native.avgFps)
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/tests/perfEngine.test.js
```

Expected: FAIL — both rows share `rowId` `wukong|kino`, and `cellFor` finds nothing because it is still called without upscaling.

- [ ] **Step 3: Implement**

In `src/lib/perfEngine/index.js`, replace the first two lines of `estimateGame`:

```js
  const cell = cellFor(model, game, resolution, preset.id, preset.upscaling)
  const measured = exactFor(model, {
    cpu, gpu, game, resolution, presetId: preset.id, upscaling: preset.upscaling,
  })
```

and extend `rowId` in `base`:

```js
    // One row per game, preset AND render scale. Two presets of one game are two
    // different measurements, and so are a native and an upscaled run of the
    // same preset — React needs to tell all of them apart.
    rowId: `${game.id}|${preset.id}|${preset.upscaling}`,
```

Add `upscaling: preset.upscaling` to `base` immediately after `presetTier`, so the UI can label the row without re-deriving it.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/tests/perfEngine.test.js
```

Expected: PASS.

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: failures only in tests whose fixtures use the old leaf key or the old `rowId`. Update each fixture to the new shape — do **not** relax an assertion to accommodate it.

Two suites need more than a fixture edit:

- **`src/tests/perfGames.test.js`** asserts the committed `perfGames.json` against what the corpus would produce. Its per-preset assertions must now expect an `upscaling` field on every preset entry, and the "every listed preset appears in the corpus" check must compare `presetId` **and** `upscaling` — otherwise it passes while the two have drifted apart, which is the exact failure the file exists to catch.
- **`src/tests/PerformanceScreen.test.jsx`** asserts single matches, so a preset label now carrying a scale suffix (`Kino (DLSS/FSR Quality)`) can turn a previously-unique string into a near-duplicate. Fix by asserting on the fuller label, never by loosening to a substring match.

- [ ] **Step 6: Commit**

```bash
git add src/lib/perfEngine/index.js src/tests/
git commit -m "feat: give a row its own identity per render scale"
```

---

### Task 4: Fit into the new cell shape

**Files:**
- Modify: `scripts/fit-perf-model.mjs:89-99`, `:133-138`, `:194-248`

- [ ] **Step 1: Change the two fits' cell keys**

In the pass-1 loop, replace the `cellKey` line:

```js
      cellKey: `${e.gameId}|${e.presetId}|${e.upscaling}`,
```

In the pass-2 `cpuObs.push`, the same:

```js
    cellKey: `${e.gameId}|${e.presetId}|${e.upscaling}`,
```

- [ ] **Step 2: Change how a cell key is unpacked into the artefact**

In the `gameConst` assembly, replace both `const [gameId, presetId] = cellKey.split('|')` occurrences with:

```js
    const [gameId, presetId, upscaling] = cellKey.split('|')
    const leaf = `${presetId}|${upscaling}`
```

and use `leaf` wherever `presetId` indexed the leaf, in both the GPU block and the CPU block. The GPU block becomes:

```js
    gameConst[gameId] ??= {}
    gameConst[gameId][res] ??= {}
    gameConst[gameId][res][leaf] = {
      ...(gameConst[gameId][res][leaf] ?? {}),
      A: round(A, 2),
      ...cellStats(live, gameId, res, presetId, upscaling),
      ...lowBaseFor(live, gameId, res, presetId, upscaling),
    }
```

- [ ] **Step 3: Make the two helpers filter on upscaling**

`lowBaseFor` and `cellStats` currently pool every row of a `game|preset|resolution`, which would mix render scales back together one level down. Change both signatures and both filters:

```js
function lowBaseFor(rows, gameId, res, presetId, upscaling) {
  const withLows = rows.filter((e) =>
    e.gameId === gameId && e.resolution === res && e.presetId === presetId &&
    e.upscaling === upscaling &&
    e.lowKind === '1%' && e.lowFps > 0 && e.avgFps > 0)
```

```js
function cellStats(rows, gameId, res, presetId, upscaling) {
  const inCell = rows.filter((e) =>
    e.gameId === gameId && e.resolution === res && e.presetId === presetId &&
    e.upscaling === upscaling)
```

- [ ] **Step 4: Key the exact table on upscaling**

In the exact-match block:

```js
  const key = `${e.cpuId}|${e.gpuId}|${e.gameId}|${e.resolution}|${e.presetId}|${e.upscaling}`
```

This must stay identical to `exactKey` in `indices.js`. A mismatch here is silent — the table simply never hits.

- [ ] **Step 5: Refit**

```bash
npm run perf:fit
```

Expected: same summary line as before — `Fitted 1752 entries from 52 sources -> 40 GPU indices, 12 CPU indices.`

- [ ] **Step 6: Commit**

```bash
git add scripts/fit-perf-model.mjs src/data/perfModel.json src/data/perfModel.report.json
git commit -m "feat: fit cells per render scale"
```

---

### Task 5: The migration gate — prove no constant moved

This is the task that makes the refactor safe. The corpus has **0 of 249 cells mixing upscaling**, so re-partitioning is a no-op and every fitted constant must come out identical. Any movement is a bug in the migration.

**Files:**
- Create: `scripts/compare-perf-model.mjs`

- [ ] **Step 1: Recover the pre-change artefact**

`HEAD~1` is the Task 4 commit, so `HEAD~2` is the last model fitted under the old key.

```bash
git show HEAD~2:src/data/perfModel.json > perfModel.before.json
```

Write it to the repo root and delete it after the gate passes — it must not be committed.

- [ ] **Step 2: Write the comparison script**

Create `scripts/compare-perf-model.mjs`:

```js
// Proves a cell-key migration moved no fitted constant.
//
//   node scripts/compare-perf-model.mjs <before.json> <after.json>
//
// The leaf key gains an upscaling component, so keys are compared after
// stripping it. Every A, B, lowBase, sources and cv must be identical.
import { readFileSync } from 'node:fs'
import { argv, exit } from 'node:process'

const [, , beforePath, afterPath] = argv
const before = JSON.parse(readFileSync(beforePath, 'utf8'))
const after = JSON.parse(readFileSync(afterPath, 'utf8'))

const FIELDS = ['A', 'B', 'lowBase', 'lowSources', 'sources', 'cv']
const problems = []

function cells(model) {
  const out = new Map()
  for (const [gameId, byRes] of Object.entries(model.gameConst ?? {})) {
    for (const [res, byLeaf] of Object.entries(byRes)) {
      for (const [leaf, cell] of Object.entries(byLeaf)) {
        // "kino" (before) and "kino|native" (after) are the same cell.
        const presetId = leaf.split('|')[0]
        out.set(`${gameId}|${res}|${presetId}`, cell)
      }
    }
  }
  return out
}

const a = cells(before)
const b = cells(after)

for (const key of a.keys()) if (!b.has(key)) problems.push(`cell vanished: ${key}`)
for (const key of b.keys()) if (!a.has(key)) problems.push(`cell appeared: ${key}`)

for (const [key, cellA] of a) {
  const cellB = b.get(key)
  if (!cellB) continue
  for (const f of FIELDS) {
    if (cellA[f] !== cellB[f]) problems.push(`${key}.${f}: ${cellA[f]} -> ${cellB[f]}`)
  }
}

for (const side of ['gpuIndex', 'cpuIndex']) {
  const keysA = Object.keys(before[side] ?? {}).sort().join(',')
  const keysB = Object.keys(after[side] ?? {}).sort().join(',')
  if (keysA !== keysB) problems.push(`${side} membership changed`)
  for (const id of Object.keys(before[side] ?? {})) {
    if (JSON.stringify(before[side][id]) !== JSON.stringify(after[side]?.[id])) {
      problems.push(`${side}.${id} moved`)
    }
  }
}

if (problems.length) {
  console.error(`MIGRATION GATE FAILED — ${problems.length} difference(s):\n`)
  for (const p of problems.slice(0, 40)) console.error(`  ${p}`)
  exit(1)
}
console.log(`Gate passed: ${a.size} cells and both index tables identical.`)
```

- [ ] **Step 3: Run the gate**

```bash
node scripts/compare-perf-model.mjs perfModel.before.json src/data/perfModel.json
```

Expected: `Gate passed: 249 cells and both index tables identical.`

**If it fails, stop.** Do not proceed to the imports and do not adjust the gate to pass — the whole value of this task is that it is a real check.

- [ ] **Step 4: Regenerate the game list and run everything**

```bash
npm run perf:games
```

Expected: `Wrote 48 games (was 48).` with no additions or removals — every existing entry is native, so only preset labels gain a scale where the corpus holds one.

```bash
npm test
npm run lint
npm run build
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add scripts/compare-perf-model.mjs src/data/perfGames.json
git commit -m "feat: add the gate proving a cell-key change moves no constant"
```

---

### Task 6: Import the ComputerBase GPU review in full

**Files:**
- Rename + rewrite: `data/benchmarks/inbox/computerbase-rx9070-sample-raster.tsv` → `data/benchmarks/inbox/computerbase-rx9070-raster.tsv` (the file is no longer a sample, and the header comment saying it is must go with the name)
- Modify: `data/games/gameMeta.json`

Article: `https://www.computerbase.de/artikel/grafikkarten/amd-radeon-rx-9070-xt-rx-9070-test.91578/`, benchmark charts on `seite-3`, `seite-4`, `seite-5`. Fetch with a browser User-Agent and `Accept-Language: de-DE` — plain WebFetch does not reach it.

Chart values are in each bar's `data-value` attribute, so figures are transcribed, never read off an image.

- [ ] **Step 1: Extract every rasteriser chart**

Read chart titles from `class="chart__title nojs-block"`. Each game appears as `<Game>, <resolution>, <upscaling>` — e.g. `Ghost of Tsushima, 2.560 × 1.440, DLSS/FSR Native`.

Map resolutions: `2.560 × 1.440` → `1440p`, `3.840 × 2.160` → `4k`.

Map upscaling from the title suffix: `TAA Native` / `DLSS/FSR Native` / no suffix → `native`; `DLSS/FSR Quality` → `quality`; `TSR Ultra Quality` → `ultra-quality`.

- [ ] **Step 2: Apply the exclusions — all four are already documented, keep them**

- **`3.440 × 1.440`** — 21:9 ultrawide, 34% more pixels than 16:9 at the same height. `RESOLUTIONS` has no slot; filing it as 1440p asserts a pixel count nobody measured.
- **Lego: Horizon Adventures** — `70 % TSR` is not a named upscaling mode.
- **Arc B570** — no catalogue part.
- **Any cell with an average but no P1** — lands with no low, never an invented one.

- [ ] **Step 3: Add a `gameMeta.json` row for every new title**

Each needs `name`, `slug` and — if its preset id is new — a `presets` entry with a `tier`. New titles include COD: Black Ops 6, Dragon Age: The Veilguard, Empire of the Ants, Final Fantasy XVI, God of War: Ragnarök, Indiana Jones und der große Kreis, Kingdom Come: Deliverance 2, MechWarrior 5: Clans, Satisfactory, Silent Hill 2, Spider-Man 2.

**`gameMeta.json` is the permitted set and the importer validates against it — never against `perfGames.json`, which is derived and would be circular.**

Ids must not collide with `src/data/gamesData.json`.

- [ ] **Step 4: Re-derive the four already-imported games and demand they match**

Before importing anything, re-extract `black-myth-wukong`, `ghost-of-tsushima`, `space-marine-2` and `stalker-2` with the new extractor and diff against the 160 rows already in the TSV.

**Every figure must match to the last decimal.** This check caught both ComputerBase extraction traps (hidden `chart__row--hidden` rows, and `chart__label--outside` on bars too short to hold their label) — both of which silently drop the *slowest* cards and bias the corpus upward.

- [ ] **Step 5: Import and refit**

```bash
npm run perf:import -- data/benchmarks/inbox/computerbase-rx9070-raster.tsv
npm run perf:fit
npm run perf:games
```

Record from the run: entry count, source count, GPU/CPU fit parts, dropped-disconnected list, and `sourceConcentration`.

- [ ] **Step 6: Verify and commit**

```bash
npm test
```

```bash
git add data/benchmarks/ data/games/gameMeta.json src/data/perfModel.json src/data/perfModel.report.json src/data/perfGames.json
git commit -m "feat: import the whole ComputerBase GPU parcours, not a sample of it"
```

---

### Task 7: Import the ComputerBase CPU review in full

**Files:**
- Modify: `data/benchmarks/inbox/computerbase-9800x3d-ghost-of-tsushima-720p.tsv` (rename to `computerbase-9800x3d-720p.tsv`)

Article: `https://www.computerbase.de/artikel/prozessoren/amd-ryzen-7-9800x3d-test.90151/seite-2` — 47 charts, 838 rows, 15 games.

The source is **already declared** with a verified test system (RTX 4090, DDR5-5600CL32, Windows 11 24H2, GeForce 565.90), so no new bench verification is owed.

- [ ] **Step 1: Take only the `FPS, Durchschnitt` and `FPS, 1% Perzentil` charts**

Each game has three charts; the third is `CPU Package Power` and is **not** a frame rate. Importing it as one would be a category error.

- [ ] **Step 2: Exclude the non-stock rows mechanically**

Each row's memory configuration is in `class="chart__item-title-addtl"` — e.g. `253/253 W, DDR5-5600CL32`. Keep **only** rows reading `DDR5-5600CL32`. That single filter removes every documented exclusion at once:

- **7800X3D** (`DDR5-5200CL30`) and **5800X3D** (`DDR4-3200CL14`) — different memory from the review's standard, so not the recorded test system;
- **Turbo-Mode / DDR5-OC rows** (`DDR5-7800CL38`, `DDR5-8200CL38`, `DDR5-7600CL38`) — non-stock configurations that collide on entry id with their stock counterparts, where the importer's dedupe silently keeps whichever lands first.

- [ ] **Step 3: Read each game's preset and upscaling off the article, per game**

The review states them individually — "Preset Hoch", "Preset Ultrahoch", "Preset Max", "Preset sehr hoch", "Preset Ultra High".

**A game whose preset or upscaling cannot be read off the source is not imported.** Do not default, and do not carry a preset across from the GPU review — same outlet is not same setting.

- [ ] **Step 4: Re-derive Ghost of Tsushima and demand it matches**

The 12 rows already in the corpus must come out identical. `cpu-ryzen-7-9800x3d` must still read `199.2 / 158.8`.

- [ ] **Step 5: Import, refit, and measure what it bought**

```bash
npm run perf:import -- data/benchmarks/inbox/computerbase-9800x3d-720p.tsv
npm run perf:fit
npm run perf:games
```

Count the cells that now hold **both** `A` and `B`:

```bash
node -e "const m=require('./src/data/perfModel.json');let n=0;const g=new Set();for(const[id,byRes]of Object.entries(m.gameConst))for(const byLeaf of Object.values(byRes))for(const c of Object.values(byLeaf))if(c.A>0&&c.B>0){n++;g.add(id)}console.log('cells with A and B:',n,'games:',g.size,[...g].join(', '))"
```

Expected: seven games — `ghost-of-tsushima`, `space-marine-2`, `dragons-dogma-2`, `f1-24`, `frostpunk-2`, `horizon-forbidden-west`, `outcast-2`. Hellblade 2 and Star Wars Outlaws join only if their CPU-side upscaling matches the GPU side's `quality`; after Task 1 a mismatch produces two separate cells and answers nothing, rather than a wrong number.

**Report the number the command prints, not the number this plan predicts.**

- [ ] **Step 6: Commit**

```bash
git add data/benchmarks/ src/data/perfModel.json src/data/perfModel.report.json src/data/perfGames.json
git commit -m "feat: import fourteen more games from the CPU review already declared"
```

---

### Task 8: Coverage sweep — the evidence

**Files:**
- Create: `scratch/sweep-phase-e.mjs` (throwaway; `scratch/` is gitignored)

- [ ] **Step 1: Write the sweep**

It must call the engine the way the UI does. Run it with `npx vite-node` — plain `node` cannot resolve this project's extensionless imports.

```js
import { estimateBuildPerformance } from '../src/lib/perfEngine/index.js'
import model from '../src/data/perfModel.json'
import games from '../src/data/perfGames.json'
import parts from '../src/data/partsData.json'

const byId = Object.fromEntries(parts.map((p) => [p.id, p]))
const builds = [
  ['cpu-ryzen-7-9800x3d', 'gpu-rtx-4070'],
  ['cpu-ryzen-7-9800x3d', 'gpu-rtx-5090'],
  ['cpu-i5-13600k', 'gpu-rtx-4060'],
  ['cpu-ryzen-5-5600', 'gpu-gtx-1660s'],
]

for (const [cpuId, gpuId] of builds) {
  for (const resolution of ['1080p', '1440p', '4k']) {
    const out = estimateBuildPerformance({
      parts: { cpu: byId[cpuId], gpu: byId[gpuId] }, resolution, model, games,
    })
    const c = out?.coverage
    console.log(`${cpuId.padEnd(22)} ${gpuId.padEnd(16)} ${resolution.padEnd(6)} ` +
      `${c ? `${c.gamesAnswered}/${c.gamesTotal} answered, ${c.gamesExact} exact` : 'no answer'}`)
  }
}
```

- [ ] **Step 2: Run it and record the table**

```bash
npx vite-node scratch/sweep-phase-e.mjs
```

The baseline to beat, measured before this phase: the two 9800X3D builds answered 23/20/19 of 48; **both mainstream builds answered 0 of 48 at every resolution.**

**The sweep is the evidence. The row count is not.** If the mainstream builds still read 0, Task 9 is the reason and it has not run yet.

- [ ] **Step 3: Record the concentration change**

```bash
node -e "const r=require('./src/data/perfModel.report.json');console.log(r.sourceConcentration.byOutlet.map(o=>o.outlet+' '+(o.share*100).toFixed(1)+'%').join('  '))"
```

Expected direction: Notebookcheck falls from 87.7% toward ~57%. Report the measured figure.

- [ ] **Step 4: Check it in a browser**

```bash
npm run dev
```

**Restart the preview server after any `perf:fit`** — a forced page reload is not enough, because the app's imported module stays stale. `preview_stop` then `preview_start`.

Check the Performance tab at 1080p / 1440p / 4K on one covered build and one uncovered build. Confirm every tier is labelled (`measured` / `modelled` / `from specs`) and no bare number appears.

---

### Task 9: Index the processors people actually buy

**Files:**
- Create: `data/benchmarks/inbox/computerbase-<cpu-review>-720p.tsv`

Targets: mainstream current (i5-13600K, i5-14600K, Ryzen 5 7600, Ryzen 7 7800X3D) and the budget/older AM4 + LGA1200 tail (Ryzen 5 5600, 5700X, i5-12400F, 10th/11th-gen Intel).

- [ ] **Step 1: Find candidate ComputerBase processor reviews**

They live under `https://www.computerbase.de/artikel/prozessoren/` and carry the same chart markup already proven here (`chart__title nojs-block`, `chart__item-title-addtl`, `data-value`). Fetch with a browser User-Agent and `Accept-Language: de-DE`.

The 9800X3D article cross-links its predecessors, so start from the page already cached in this work and follow its `prozessoren/` links:

```powershell
$ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
$r = Invoke-WebRequest -Uri 'https://www.computerbase.de/artikel/prozessoren/amd-ryzen-7-9800x3d-test.90151/seite-2' -UserAgent $ua -Headers @{'Accept-Language'='de-DE,de;q=0.9'}
[regex]::Matches($r.Content,'/artikel/prozessoren/[a-z0-9\-]+\.\d+/') | ForEach-Object { $_.Value } | Sort-Object -Unique
```

Judge each candidate on **Step 2's connectivity test before extracting anything** — that is what decides whether a review is usable, not how many chips it covers.

- [ ] **Step 2: Check connectivity BEFORE extracting anything**

**A new review must share at least one processor with the existing set** — `cpu-ryzen-7-9800x3d`, `cpu-i9-14900k`, `cpu-i9-14900ks`, `cpu-i7-14700k`, `cpu-i5-14600k`, `cpu-ryzen-9-9950x`, `cpu-ryzen-9-9900x`, `cpu-ryzen-7-9700x`, `cpu-ryzen-5-9600x`, `cpu-intel-ultra-9-285k`, `cpu-intel-ultra-7-265k`, `cpu-intel-ultra-5-245k`.

Without a shared processor, `fitTwoWay` places the whole review outside the anchor's component and `fit-perf-model` discards every CPU in it as disconnected. A review with no overlap is worthless here however good its data.

**It does not need to share games.** Once indexed, a processor answers on every cell that already has an `A` and a `B` — so a review adding only older chips still puts them on the board across all of Task 7's games.

- [ ] **Step 3: Declare the source with its own verified test system**

Read the memory specification off the review that states it. **A review whose memory specification cannot be found is not declared** — the rule that caught the 13900K bench running DDR5-6400 where its neighbours run 6000. One shared default would have filed a wrong figure against 17 rows.

- [ ] **Step 4: Import, refit, re-sweep**

```bash
npm run perf:import -- data/benchmarks/inbox/<file>.tsv
npm run perf:fit
npm run perf:games
npx vite-node scratch/sweep-phase-e.mjs
```

Confirm `droppedDisconnected` in `perfModel.report.json` does **not** list the new processors. If it does, connectivity failed — the review shares no processor with the anchor's component, and its data cannot be used.

- [ ] **Step 5: Full verification and commit**

```bash
npm test
npm run lint
npm run build
```

```bash
git add data/benchmarks/ src/data/perfModel.json src/data/perfModel.report.json src/data/perfGames.json
git commit -m "feat: index the processors an auto-build actually recommends"
```

---

## Done when

- The migration gate passes: 249 cells and both index tables identical across the cell-key change.
- Seven games (measured, not predicted) carry both `A` and `B`.
- The sweep shows a mainstream CPU build answering more than 0 of 48.
- Notebookcheck's corpus share is recorded before and after.
- `npm test`, `npm run lint`, `npm run build` all green.
- Nothing pushed, nothing deployed, no Supabase write.
