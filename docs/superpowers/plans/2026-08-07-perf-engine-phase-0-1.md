# Performance Engine — Phases 0 & 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the benchmark curation harness and an exact-match frame-time FPS engine that runs alongside the existing FPS heuristic without touching it, and that behaves correctly — saying "not enough data yet" rather than guessing — when the corpus is empty.

**Architecture:** Hand-curated benchmark measurements live in `data/benchmarks/` as versioned JSON. A build-time script (`npm run perf:fit`) fits a GPU index and a CPU index out of those measurements by alternating least squares in log space, and emits a small artefact `src/data/perfModel.json`. The browser ships only the artefact. All estimation happens in frame times (milliseconds), never in FPS, and the two pipelines combine through a fitted p-norm rather than `max()`.

**Tech Stack:** React 19 + Vite, Vitest (jsdom, globals), plain ESM JavaScript (no TypeScript), Tailwind with the existing design tokens, Node `.mjs` scripts.

**Spec:** `docs/superpowers/specs/2026-08-07-performance-engine-design.md` — §1, §2, §3.1–3.3, §3.6, §3.12, §4, §5.1–5.3, §8 Phases 0–1.

---

## Before you start

**The working tree has an uncommitted `src/data/partsData.json`** that is nothing to do with this work. **Every commit in this plan uses explicit `git add <paths>`. Never `git add -A` or `git add .`** — it would sweep that file into an unrelated commit.

**`docs/superpowers/**` stays untracked.** Do not stage the spec or this plan.

**Do not push.** Commits are local only unless the user explicitly asks otherwise.

**Two modules you must not modify:** `src/lib/fpsEstimate.js`, `src/lib/gameFps.js`, `src/lib/bottleneck.js`. They feed `partSynergy` → `partRatings` → the CustomPC score and every auto-build result. Task 1 installs a tripwire that fails if they move.

**Node import gotcha:** `scripts/*.mjs` run under plain Node, which cannot resolve extensionless imports. Any `src/lib/` module a script imports must use explicit `.js` extensions in its own imports. `fitTwoWay.js` (Task 7) is written with **zero imports** for exactly this reason. Modules that only ever load in the browser or under Vitest may stay extensionless, matching the rest of the codebase.

---

## File structure

**Created**

| Path | Responsibility |
|---|---|
| `data/benchmarks/README.md` | curation rules, licensing posture, how to add an entry |
| `data/benchmarks/sources.json` | one row per published review consulted |
| `data/benchmarks/entries.json` | the measurements |
| `data/benchmarks/validation.json` | held-out pair measurements, never fitted on |
| `src/lib/benchSchema.js` | pure validators for the corpus; shared by the harness and the integrity test |
| `src/lib/gamePresets.js` | canonical preset ladder + per-game override resolution |
| `src/lib/perfEngine/frameTime.js` | ms↔fps, the p-norm blend, cpuShare, engine caps |
| `src/lib/perfEngine/fitTwoWay.js` | alternating least squares in log space (no imports) |
| `src/lib/perfEngine/indices.js` | index lookup + exact-match short-circuit |
| `src/lib/perfEngine/index.js` | `estimateBuildPerformance` — the public contract |
| `src/data/perfModel.json` | the fitted artefact (generated, committed) |
| `src/data/perfModel.report.json` | fit diagnostics (generated, committed, never imported by the app) |
| `scripts/add-bench-entry.mjs` | guided curation harness |
| `scripts/fit-perf-model.mjs` | the fit pipeline and artefact emitter |
| `src/components/RunPerformanceTest.jsx` | the button + open/closed state |
| `src/components/performance/PerformanceReport.jsx` | report shell |
| `src/components/performance/FpsCard.jsx` | one game's result |
| `src/components/performance/FpsCardGrid.jsx` | the grid + empty state |
| `src/tests/fixtures/syntheticCorpus.js` | deterministic known-ground-truth corpus for fit tests |

**Modified**

| Path | Change |
|---|---|
| `src/data/gamesData.json` | add `slug` to all 22 rows. Additive only. |
| `src/components/BuildSummary.jsx` | render `<RunPerformanceTest />` |
| `package.json` | `perf:fit` and `perf:add` scripts |

**Tests created:** `legacyEngineUntouched`, `perfModelIntegrity`, `gamePresets`, `perfEngineFrameTime`, `perfFit`, `perfEngineIndices`, `perfEngine`, `RunPerformanceTest` — all under `src/tests/`.

---

## Task 1: Freeze the legacy engine

The tripwire that makes "alongside, not replacing" enforceable. Written before any engine code exists.

**Files:**
- Test: `src/tests/legacyEngineUntouched.test.js`

- [ ] **Step 1: Write the characterisation test**

Create `src/tests/legacyEngineUntouched.test.js`:

```js
import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'
import gamesData from '../data/gamesData.json'
import { estimateFps } from '../lib/fpsEstimate'
import { gameFps } from '../lib/gameFps'
import { computeBottleneck } from '../lib/bottleneck'

const part = (id) => partsData.find((p) => p.id === id)
const game = (id) => gamesData.find((g) => g.id === id)

// Characterisation test. These are not "correct" answers — they are TODAY'S
// answers, recorded before the performance engine existed.
//
// The engine is deliberately built ALONGSIDE these three modules rather than on
// top of them, because they feed partSynergy -> partRatings -> the CustomPC
// score, and every auto-build recommendation. If engine work ever leaks into
// this path, every rating in the app moves silently and nothing else would
// catch it. A diff here means the blast radius grew: stop and go and find out
// why before updating a single number below.
describe('the legacy FPS path is untouched by the performance engine', () => {
  it('estimateFps returns its frozen values', () => {
    const cases = [
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '1080p', 140],
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '1440p', 105],
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '4k', 67],
      ['cpu-i5-13400f', 'gpu-rtx-4090', '1080p', 154],
      ['cpu-ryzen-7-9800x3d', 'gpu-rtx-4060', '1440p', 60],
    ]
    for (const [cpuId, gpuId, res, expected] of cases) {
      expect(estimateFps(part(cpuId), part(gpuId), res)).toBe(expected)
    }
  })

  it('gameFps returns its frozen values', () => {
    const cpu = part('cpu-ryzen-5-7600x')
    const gpu = part('gpu-rtx-5070')
    const cases = [
      ['cs2', 273],
      ['cyberpunk', 53],
      ['fortnite', 168],
      ['tarkov', 100],
      ['elden-ring', 60],
    ]
    for (const [gameId, expected] of cases) {
      expect(gameFps(cpu, gpu, '1440p', game(gameId), 'high')).toBe(expected)
    }
  })

  it('computeBottleneck returns its frozen values', () => {
    const cases = [
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '1080p',
       { balancePct: 92, limitedBy: 'none', cpuFps: 168, gpuFps: 140 }],
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '1440p',
       { balancePct: 84, limitedBy: 'none', cpuFps: 154, gpuFps: 105 }],
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '4k',
       { balancePct: 74, limitedBy: 'gpu', cpuFps: 140, gpuFps: 67 }],
      ['cpu-i5-13400f', 'gpu-rtx-4090', '1080p',
       { balancePct: 77, limitedBy: 'cpu', cpuFps: 154, gpuFps: 200 }],
      ['cpu-ryzen-7-9800x3d', 'gpu-rtx-4060', '1440p',
       { balancePct: 64, limitedBy: 'gpu', cpuFps: 220, gpuFps: 60 }],
    ]
    for (const [cpuId, gpuId, res, expected] of cases) {
      const got = computeBottleneck(part(cpuId), part(gpuId), res)
      expect({
        balancePct: got.balancePct, limitedBy: got.limitedBy,
        cpuFps: got.cpuFps, gpuFps: got.gpuFps,
      }).toEqual(expected)
    }
  })

  it('the legacy modules import nothing from the performance engine', async () => {
    const fs = await import('node:fs/promises')
    for (const file of ['fpsEstimate.js', 'gameFps.js', 'bottleneck.js', 'partSynergy.js']) {
      const src = await fs.readFile(new URL(`../lib/${file}`, import.meta.url), 'utf8')
      expect(src).not.toMatch(/perfEngine|perfModel/)
    }
  })
})
```

- [ ] **Step 2: Run it and confirm it passes now**

```bash
npx vitest run src/tests/legacyEngineUntouched.test.js
```

Expected: **4 passed**. This test passes on the first run by design — it records existing behaviour. If any value differs, the frozen numbers were mis-transcribed; recompute them rather than editing the source modules.

- [ ] **Step 3: Commit**

```bash
git add src/tests/legacyEngineUntouched.test.js
git commit -m "$(cat <<'EOF'
test: freeze the legacy FPS path before building the engine beside it

fpsEstimate/gameFps/bottleneck feed partRatings and autoBuilder. The new
performance engine must not touch them, and nothing else would notice if it
did. Records today's values plus an import guard.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Benchmark corpus schema and integrity audit

**Files:**
- Create: `data/benchmarks/sources.json`, `data/benchmarks/entries.json`, `data/benchmarks/validation.json`, `data/benchmarks/README.md`
- Create: `src/lib/benchSchema.js`
- Test: `src/tests/perfModelIntegrity.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/perfModelIntegrity.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { auditCorpus, validateSource, validateEntry, RESOLUTIONS } from '../lib/benchSchema'
import partsData from '../data/partsData.json'
import gamesData from '../data/gamesData.json'
import sources from '../../data/benchmarks/sources.json'
import entries from '../../data/benchmarks/entries.json'
import validation from '../../data/benchmarks/validation.json'

// The corpus audit, in the spirit of catalogueCompatibility.test.js: it asks
// "is anything unusable?" rather than only checking rows in isolation. An
// entry naming a part that is not in the catalogue does not error anywhere —
// it silently contributes nothing to the fit and disappears.
describe('benchmark corpus integrity', () => {
  it('passes on the real corpus', () => {
    expect(auditCorpus({ sources, entries, parts: partsData, games: gamesData })).toEqual([])
  })

  it('passes on the held-out validation set too', () => {
    expect(auditCorpus({ sources, entries: validation, parts: partsData, games: gamesData }))
      .toEqual([])
  })

  it('an empty corpus is valid — the engine must ship before the data does', () => {
    expect(auditCorpus({ sources: [], entries: [], parts: partsData, games: gamesData }))
      .toEqual([])
  })

  it('rejects a source with no url or date', () => {
    expect(validateSource({ id: 's1', outlet: 'X', kind: 'gpu-scaling' }))
      .toEqual(expect.arrayContaining([
        expect.stringContaining('url'), expect.stringContaining('published'),
      ]))
  })

  it('rejects an entry naming a part that is not in the catalogue', () => {
    const problems = validateEntry(
      { id: 'e1', sourceId: 's1', gameId: 'cs2', resolution: '1440p', presetId: 'high',
        gpuId: 'gpu-does-not-exist', cpuId: 'cpu-ryzen-5-7600x', avgFps: 200 },
      { sourceIds: new Set(['s1']), partIds: new Set(partsData.map((p) => p.id)),
        gameIds: new Set(gamesData.map((g) => g.id)) },
    )
    expect(problems.join(' ')).toMatch(/gpu-does-not-exist/)
  })

  it('rejects an unknown resolution', () => {
    const problems = validateEntry(
      { id: 'e2', sourceId: 's1', gameId: 'cs2', resolution: '8k', presetId: 'high',
        gpuId: 'gpu-rtx-5070', cpuId: 'cpu-ryzen-5-7600x', avgFps: 200 },
      { sourceIds: new Set(['s1']), partIds: new Set(partsData.map((p) => p.id)),
        gameIds: new Set(gamesData.map((g) => g.id)) },
    )
    expect(problems.join(' ')).toMatch(/resolution/)
    expect(RESOLUTIONS).toEqual(['1080p', '1440p', '4k'])
  })

  it('rejects a non-positive or absurd frame rate', () => {
    const ctx = { sourceIds: new Set(['s1']), partIds: new Set(partsData.map((p) => p.id)),
                  gameIds: new Set(gamesData.map((g) => g.id)) }
    const base = { id: 'e3', sourceId: 's1', gameId: 'cs2', resolution: '1440p',
                   presetId: 'high', gpuId: 'gpu-rtx-5070', cpuId: 'cpu-ryzen-5-7600x' }
    expect(validateEntry({ ...base, avgFps: 0 }, ctx).join(' ')).toMatch(/avgFps/)
    expect(validateEntry({ ...base, avgFps: 5000 }, ctx).join(' ')).toMatch(/avgFps/)
  })

  it('rejects a 1% low above the average', () => {
    const problems = validateEntry(
      { id: 'e4', sourceId: 's1', gameId: 'cs2', resolution: '1440p', presetId: 'high',
        gpuId: 'gpu-rtx-5070', cpuId: 'cpu-ryzen-5-7600x',
        avgFps: 120, lowFps: 140, lowKind: '1%' },
      { sourceIds: new Set(['s1']), partIds: new Set(partsData.map((p) => p.id)),
        gameIds: new Set(gamesData.map((g) => g.id)) },
    )
    expect(problems.join(' ')).toMatch(/lowFps/)
  })

  it('rejects a numeric field typed as a string', () => {
    // `"200" >= 1` is true in JavaScript, so a bare range check waves this
    // through. Hand-typed JSON is exactly where it happens.
    const ctx = { sourceIds: new Set(['s1']), partIds: new Set(partsData.map((p) => p.id)),
                  gameIds: new Set(gamesData.map((g) => g.id)) }
    const base = { id: 'e5', sourceId: 's1', gameId: 'cs2', resolution: '1440p',
                   presetId: 'high', gpuId: 'gpu-rtx-5070', cpuId: 'cpu-ryzen-5-7600x' }
    expect(validateEntry({ ...base, avgFps: '200' }, ctx).join(' ')).toMatch(/avgFps/)
    expect(validateEntry({ ...base, avgFps: 200, lowFps: '150', lowKind: '1%' }, ctx).join(' '))
      .toMatch(/lowFps/)
    expect(validateEntry({ ...base, avgFps: 200, weight: '1' }, ctx).join(' ')).toMatch(/weight/)
    // and the valid forms still pass, so this is not rejecting everything
    expect(validateEntry({ ...base, avgFps: 200, weight: 1 }, ctx)).toEqual([])
  })

  it('rejects duplicate entry ids', () => {
    const dupe = { id: 'same', sourceId: 's1', gameId: 'cs2', resolution: '1440p',
                   presetId: 'high', gpuId: 'gpu-rtx-5070', cpuId: 'cpu-ryzen-5-7600x',
                   avgFps: 200 }
    const problems = auditCorpus({
      sources: [{ id: 's1', outlet: 'X', title: 'T', url: 'https://e.test/a',
                  published: '2026-01-01', accessed: '2026-01-02', kind: 'gpu-scaling',
                  testSystem: { cpu: 'X', ram: { type: 'DDR5', speed: 6000, capacityGb: 32, sticks: 2 } } }],
      entries: [dupe, { ...dupe }], parts: partsData, games: gamesData,
    })
    expect(problems.join(' ')).toMatch(/duplicate/i)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/perfModelIntegrity.test.js
```

Expected: FAIL — `Failed to resolve import "../lib/benchSchema"`.

- [ ] **Step 3: Create the three empty corpus files**

`data/benchmarks/sources.json`:

```json
[]
```

`data/benchmarks/entries.json`:

```json
[]
```

`data/benchmarks/validation.json`:

```json
[]
```

- [ ] **Step 4: Write the schema module**

Create `src/lib/benchSchema.js`:

```js
// Validators for the hand-curated benchmark corpus.
//
// Pure and dependency-free so the curation harness (scripts/add-bench-entry.mjs)
// and the integrity test can share exactly one definition of "valid". A rule
// enforced in only one of those two places is a rule that leaks.

export const RESOLUTIONS = ['1080p', '1440p', '4k']
export const SOURCE_KINDS = ['gpu-scaling', 'cpu-scaling', 'pair', 'memory-scaling']
export const LOW_KINDS = ['1%', '0.1%', 'min']

// Nothing renders faster than this, and nothing playable is slower. A figure
// outside the range is a transcription error, not a measurement.
const FPS_MIN = 1
const FPS_MAX = 2000

const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isHttpUrl = (v) => typeof v === 'string' && /^https?:\/\/\S+$/.test(v)
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0

// Type-check before range-checking. `"200" >= 1` is true in JavaScript, so a
// bare comparison waves through a hand-typed string — which is precisely the
// mistake this schema exists to catch at 11pm on entry number forty.
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v)
const inRange = (v, lo, hi) => isNumber(v) && v >= lo && v <= hi

export function validateSource(source) {
  const p = []
  const at = source?.id ?? '(no id)'
  if (!nonEmpty(source?.id)) p.push(`${at}: id is required`)
  if (!nonEmpty(source?.outlet)) p.push(`${at}: outlet is required`)
  if (!nonEmpty(source?.title)) p.push(`${at}: title is required`)
  if (!isHttpUrl(source?.url)) p.push(`${at}: url must be an http(s) URL`)
  if (!isIsoDate(source?.published)) p.push(`${at}: published must be YYYY-MM-DD`)
  if (!isIsoDate(source?.accessed)) p.push(`${at}: accessed must be YYYY-MM-DD`)
  if (!SOURCE_KINDS.includes(source?.kind)) {
    p.push(`${at}: kind must be one of ${SOURCE_KINDS.join(', ')}`)
  }
  // The test system is what makes two sources comparable at all. Without it a
  // measurement is a number with no context and cannot be normalised.
  const ts = source?.testSystem
  if (!ts || typeof ts !== 'object') p.push(`${at}: testSystem is required`)
  else {
    if (!nonEmpty(ts.cpu)) p.push(`${at}: testSystem.cpu is required`)
    if (!ts.ram || typeof ts.ram !== 'object') p.push(`${at}: testSystem.ram is required`)
    else if (!(isNumber(ts.ram.speed) && ts.ram.speed > 0)) {
      p.push(`${at}: testSystem.ram.speed must be a positive number (MT/s)`)
    }
  }
  return p
}

export function validateEntry(entry, { sourceIds, partIds, gameIds }) {
  const p = []
  const at = entry?.id ?? '(no id)'
  if (!nonEmpty(entry?.id)) p.push(`${at}: id is required`)
  if (!sourceIds.has(entry?.sourceId)) p.push(`${at}: unknown sourceId ${entry?.sourceId}`)
  if (!gameIds.has(entry?.gameId)) p.push(`${at}: unknown gameId ${entry?.gameId}`)
  if (!partIds.has(entry?.gpuId)) p.push(`${at}: unknown gpuId ${entry?.gpuId}`)
  if (!partIds.has(entry?.cpuId)) p.push(`${at}: unknown cpuId ${entry?.cpuId}`)
  if (!RESOLUTIONS.includes(entry?.resolution)) {
    p.push(`${at}: resolution must be one of ${RESOLUTIONS.join(', ')}`)
  }
  if (!nonEmpty(entry?.presetId)) p.push(`${at}: presetId is required`)
  if (!inRange(entry?.avgFps, FPS_MIN, FPS_MAX)) {
    p.push(`${at}: avgFps must be a number between ${FPS_MIN} and ${FPS_MAX}`)
  }
  if (entry?.lowFps != null) {
    if (!inRange(entry.lowFps, FPS_MIN, FPS_MAX)) {
      p.push(`${at}: lowFps must be a number between ${FPS_MIN} and ${FPS_MAX}`)
    } else if (entry.lowFps > entry.avgFps) {
      p.push(`${at}: lowFps ${entry.lowFps} is above avgFps ${entry.avgFps}`)
    }
    if (!LOW_KINDS.includes(entry.lowKind)) {
      p.push(`${at}: lowKind must be one of ${LOW_KINDS.join(', ')} when lowFps is present`)
    }
  }
  if (entry?.weight != null && !(isNumber(entry.weight) && entry.weight > 0 && entry.weight <= 1)) {
    p.push(`${at}: weight must be a number in (0, 1]`)
  }
  return p
}

export function auditCorpus({ sources, entries, parts, games }) {
  const problems = []
  const sourceIds = new Set()
  for (const s of sources) {
    problems.push(...validateSource(s))
    if (sourceIds.has(s?.id)) problems.push(`duplicate source id ${s.id}`)
    sourceIds.add(s?.id)
  }

  const partIds = new Set(parts.map((x) => x.id))
  const gameIds = new Set(games.map((g) => g.id))
  const entryIds = new Set()
  for (const e of entries) {
    problems.push(...validateEntry(e, { sourceIds, partIds, gameIds }))
    if (entryIds.has(e?.id)) problems.push(`duplicate entry id ${e.id}`)
    entryIds.add(e?.id)
  }

  // A source nobody cites is dead weight that still counts toward the
  // per-source concentration cap, so it has to be visible.
  const cited = new Set(entries.map((e) => e?.sourceId))
  for (const id of sourceIds) {
    if (!cited.has(id) && entries.length > 0) problems.push(`source ${id} has no entries`)
  }
  return problems
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/tests/perfModelIntegrity.test.js
```

Expected: **10 passed**.

- [ ] **Step 6: Write the curation README**

Create `data/benchmarks/README.md`:

```markdown
# Benchmark corpus

Hand-curated measurements from published reviews. **Input to the build, never
shipped to the browser** — `npm run perf:fit` turns this into
`src/data/perfModel.json`, and only that artefact reaches the client.

## Rules

1. **Enter by hand, through `npm run perf:add`.** Never scrape. Automated
   collection is what turns "recording facts" into "extracting a database", and
   it usually breaches the outlet's terms independently of copyright.
2. **No source may exceed 20% of entries.** Spreading across outlets is the
   whole licensing position: nobody's compilation is substantially taken.
   ⚠️ **This is currently a rule you keep by hand.** The automatic check —
   `npm run perf:fit` failing above 20% and warning above 15% — arrives with
   the fit pipeline. Until then nothing enforces it, so count as you go.
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
```

- [ ] **Step 7: Commit**

```bash
git add data/benchmarks src/lib/benchSchema.js src/tests/perfModelIntegrity.test.js
git commit -m "$(cat <<'EOF'
feat: add the benchmark corpus schema and its integrity audit

One shared definition of "valid entry" for the harness and the test, so a rule
cannot be enforced in only one of them. Audits the whole corpus the way
catalogueCompatibility does the catalogue: an entry naming a missing part fails
silently otherwise.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Canonical game presets

Phase 1 needs a preset key, and games do not share preset names. Real per-game names arrive with the measurements that use them (the harness records them); until then a canonical ladder applies.

**Files:**
- Create: `src/lib/gamePresets.js`
- Test: `src/tests/gamePresets.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/gamePresets.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { CANONICAL_PRESETS, presetsFor, resolvePreset } from '../lib/gamePresets'
import gamesData from '../data/gamesData.json'

describe('gamePresets', () => {
  it('exposes a four-rung canonical ladder', () => {
    expect(CANONICAL_PRESETS.map((p) => p.id)).toEqual(['low', 'medium', 'high', 'ultra'])
    expect(CANONICAL_PRESETS.map((p) => p.tier)).toEqual([1, 2, 3, 4])
  })

  it('falls back to the canonical ladder for a game with no presets of its own', () => {
    expect(presetsFor({ id: 'x' })).toEqual(CANONICAL_PRESETS)
  })

  it("uses the game's own presets when it has them", () => {
    const own = [{ id: 'epic', label: 'Epic', tier: 4 }]
    expect(presetsFor({ id: 'fortnite', presets: own })).toEqual(own)
  })

  it('resolves an exact preset id directly', () => {
    const r = resolvePreset({ id: 'x' }, 'high')
    expect(r.preset.id).toBe('high')
    expect(r.exact).toBe(true)
  })

  it('falls back to the nearest tier when the id is unknown', () => {
    // "epic" is not on the canonical ladder; tier 4 is the nearest thing to it.
    const game = { id: 'fortnite', presets: [{ id: 'epic', label: 'Epic', tier: 4 }] }
    const r = resolvePreset(game, 'ultra')
    expect(r.preset.id).toBe('epic')
    expect(r.exact).toBe(false)
  })

  it('falls back to tier 3 for an unrecognisable preset id', () => {
    const r = resolvePreset({ id: 'x' }, 'nonsense')
    expect(r.preset.id).toBe('high')
    expect(r.exact).toBe(false)
  })

  it('every catalogue game resolves a high preset exactly', () => {
    // No catalogue game has its own presets yet, so all 22 take the canonical
    // ladder and match exactly. Asserting the id and the flag rather than mere
    // truthiness means this notices when that stops being true — which is
    // precisely when the curation harness starts populating game.presets.
    for (const game of gamesData) {
      const { preset, exact } = resolvePreset(game, 'high')
      expect(preset.id, `${game.id} resolved ${preset.id}`).toBe('high')
      expect(exact, `${game.id} was not an exact match`).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/gamePresets.test.js
```

Expected: FAIL — `Failed to resolve import "../lib/gamePresets"`.

- [ ] **Step 3: Write the module**

Create `src/lib/gamePresets.js`:

```js
// Games do not share preset names — Fortnite's "Epic" and Cyberpunk's "Ultra"
// are different words for roughly the same rung. `tier` is the canonical rung
// (1 = lowest), and it is what cross-game fallback compares.
//
// Real per-game preset names are NOT invented here. They arrive attached to the
// measurements that use them: the curation harness records the preset a review
// actually tested, and that populates `game.presets` over time. Until a game
// has its own, the canonical ladder applies and the report says which preset it
// is quoting.
export const CANONICAL_PRESETS = [
  { id: 'low', label: 'Low', tier: 1 },
  { id: 'medium', label: 'Medium', tier: 2 },
  { id: 'high', label: 'High', tier: 3 },
  { id: 'ultra', label: 'Ultra', tier: 4 },
]

// High, not Medium. An unrecognised preset id resolves to the higher rung so
// the estimate errs toward a LOWER frame rate. Under-promising is the safer
// direction for a number somebody is about to spend money on.
const DEFAULT_TIER = 3

export function presetsFor(game) {
  return game?.presets?.length ? game.presets : CANONICAL_PRESETS
}

// { preset, exact } — `exact` false means the caller asked for a preset this
// game does not have and got the nearest tier instead, which costs confidence
// downstream rather than being silently equivalent.
export function resolvePreset(game, presetId) {
  const presets = presetsFor(game)
  const exact = presets.find((p) => p.id === presetId)
  if (exact) return { preset: exact, exact: true }

  const wantedTier =
    CANONICAL_PRESETS.find((p) => p.id === presetId)?.tier ?? DEFAULT_TIER
  // Seeded explicitly rather than leaning on reduce's no-initial-value form,
  // matching snapToLadder in priceBands.js.
  //
  // ⚠️ On an exact tie the FIRST entry in the array wins. That is unreachable
  // on the canonical ladder, whose tiers are unique — an exact id match always
  // fires before this. It goes live the moment a game gets its own `presets`
  // in gamesData.json, and at that point the order you write them in silently
  // decides ties. Write them lowest tier first.
  const nearest = presets.reduce(
    (best, p) => (Math.abs(p.tier - wantedTier) < Math.abs(best.tier - wantedTier) ? p : best),
    presets[0],
  )
  return { preset: nearest, exact: false }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/tests/gamePresets.test.js
```

Expected: **7 passed**.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gamePresets.js src/tests/gamePresets.test.js
git commit -m "$(cat <<'EOF'
feat: add the canonical preset ladder for the performance engine

Real per-game preset names arrive with the measurements that use them rather
than being invented up front. Games without their own fall back to the ladder,
and a non-exact resolution is reported so it can cost confidence later.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Game slugs

**Files:**
- Modify: `src/data/gamesData.json` (all 22 rows — additive)
- Test: `src/tests/gamePresets.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/tests/gamePresets.test.js`:

```js
describe('game slugs', () => {
  it('every game has a URL-safe slug', () => {
    for (const game of gamesData) {
      expect(game.slug, `${game.id} has no slug`).toBeTruthy()
      expect(game.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('slugs are unique', () => {
    const slugs = gamesData.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('the legacy fields the old engine reads are all still present', () => {
    // gameFps still drives the CustomPC score. Adding fields is fine; losing
    // one would move every rating in the app.
    for (const game of gamesData) {
      expect(typeof game.fpsFactor).toBe('number')
      expect(typeof game.cpuFactor).toBe('number')
      expect(typeof game.name).toBe('string')
    }
  })

  it('the legacy field VALUES are unchanged, for every game', () => {
    // The type check above would wave through fpsFactor: 2.6 -> 9.9. This file
    // gets edited every time the performance engine gains a data field, and
    // legacyEngineUntouched.test.js only pins five of the 22 games — so
    // without this the other 17 could drift silently and move the CustomPC
    // score with them. [fpsFactor, cpuFactor, fpsCap ?? null]
    const FROZEN = {
      'lol': [3, 2.6, null],
      'valorant': [2.8, 2.5, null],
      'cs2': [2.6, 2.2, null],
      'dota2': [2.4, 1.9, null],
      'rocket-league': [2.5, 2.4, null],
      'r6-siege': [2.3, 2.1, null],
      'overwatch2': [2.2, 2, 600],
      'minecraft': [1.9, 1.1, null],
      'fortnite': [1.6, 1.5, null],
      'apex': [1.5, 1.4, 300],
      'gta5': [1.5, 1.3, 180],
      'marvel-rivals': [1.2, 1.1, null],
      'warzone': [1.1, 1, null],
      'tarkov': [1.1, 0.65, null],
      'elden-ring': [0.9, 1.2, 60],
      'helldivers2': [0.9, 0.8, null],
      'bg3': [0.85, 0.7, null],
      'hogwarts': [0.8, 0.75, null],
      'rdr2': [0.75, 0.9, null],
      'starfield': [0.65, 0.7, null],
      'cyberpunk': [0.5, 0.75, null],
      'alan-wake-2': [0.4, 0.8, null],
    }
    expect(gamesData.map((g) => g.id).sort()).toEqual(Object.keys(FROZEN).sort())
    for (const game of gamesData) {
      expect([game.fpsFactor, game.cpuFactor, game.fpsCap ?? null], game.id)
        .toEqual(FROZEN[game.id])
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/gamePresets.test.js
```

Expected: FAIL — `lol has no slug`.

- [ ] **Step 3: Add the slug to every row**

Edit `src/data/gamesData.json`, adding `"slug"` after `"name"` on each row. The complete mapping:

```
lol            → league-of-legends
valorant       → valorant
cs2            → counter-strike-2
dota2          → dota-2
rocket-league  → rocket-league
r6-siege       → rainbow-six-siege
overwatch2     → overwatch-2
minecraft      → minecraft-java
fortnite       → fortnite
apex           → apex-legends
gta5           → gta-v
marvel-rivals  → marvel-rivals
warzone        → call-of-duty-warzone
tarkov         → escape-from-tarkov
elden-ring     → elden-ring
helldivers2    → helldivers-2
bg3            → baldurs-gate-3
hogwarts       → hogwarts-legacy
rdr2           → red-dead-redemption-2
starfield      → starfield
cyberpunk      → cyberpunk-2077
alan-wake-2    → alan-wake-2
```

For example the first row becomes:

```json
{ "id": "lol", "name": "League of Legends", "slug": "league-of-legends", "fpsFactor": 3.0, "cpuFactor": 2.6 },
```

**`gamesData.json` is an LF file** — verified byte-level: 24 LF, zero CR, and `git ls-files --eol` reports `i/lf w/lf`. (`partsData.json` and `peripheralsData.json` ARE CRLF in the working tree; do not generalise from them.) `core.autocrlf=true` is set locally, so `git add` prints a LF→CRLF warning — that is a pending future normalisation, not the file's current state, and converting the file would itself be the line-ending change.

What actually matters is the diff shape: `git diff --stat src/data/gamesData.json` must report **22 insertions and 22 deletions**, one changed line per game. A whole-file rewrite means an editor normalised the endings, and it makes the change unreviewable.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/tests/gamePresets.test.js src/tests/legacyEngineUntouched.test.js
```

Expected: **14 passed** across the two files (10 in `gamePresets.test.js`, 4 in `legacyEngineUntouched.test.js`). The legacy test passing here is the point — the change is additive.

- [ ] **Step 5: Sync Supabase — ASK FIRST**

The `games` table mirrors this file and **a Supabase write goes live on the public site instantly, with no deploy**. Do not run it unprompted.

Ask the user: *"gamesData.json now carries a `slug` on all 22 rows. Shall I apply the matching update to the Supabase `games` table? It goes live immediately."*

Only on an explicit yes, apply via the Supabase MCP `execute_sql`, updating each row's `data` jsonb with its slug, then verify both sides agree:

```sql
select count(*) filter (where data ? 'slug') as with_slug, count(*) as total from games;
```

Expected: `with_slug = 22, total = 22`.

- [ ] **Step 6: Commit**

```bash
git add src/data/gamesData.json src/tests/gamePresets.test.js
git commit -m "$(cat <<'EOF'
feat: give every game a URL-safe slug

Additive only — the fpsFactor/cpuFactor fields the old engine reads are pinned
by a test, because losing one would move every CustomPC score.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: The frame-time core

**Files:**
- Create: `src/lib/perfEngine/frameTime.js`
- Test: `src/tests/perfEngineFrameTime.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/perfEngineFrameTime.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  msToFps, fpsToMs, blendFrameTime, cpuShare, limitedBy, applyFpsCap,
} from '../lib/perfEngine/frameTime'

describe('frame time conversion', () => {
  it('round-trips fps through ms', () => {
    for (const fps of [30, 60, 144, 341]) {
      expect(msToFps(fpsToMs(fps))).toBeCloseTo(fps, 9)
    }
  })

  it('returns 0 fps for a non-positive frame time rather than Infinity', () => {
    expect(msToFps(0)).toBe(0)
    expect(msToFps(-1)).toBe(0)
  })
})

describe('blendFrameTime', () => {
  it('approaches max() as k grows', () => {
    expect(blendFrameTime(10, 6, 200)).toBeCloseTo(10, 4)
  })

  it('is straight addition at k = 1', () => {
    expect(blendFrameTime(10, 6, 1)).toBeCloseTo(16, 9)
  })

  it('sits above max() at parity by exactly 2^(1/k) - 1', () => {
    // This is the whole reason the engine does not use max(): real hardware
    // overlaps imperfectly, so measurements sit ABOVE the max near the
    // crossover — which is where most real builds live.
    for (const k of [4, 5.1, 8]) {
      expect(blendFrameTime(10, 10, k) / 10).toBeCloseTo(Math.pow(2, 1 / k), 9)
    }
    expect(blendFrameTime(10, 10, 5.1) / 10).toBeCloseTo(1.1456, 3)
  })

  it('converges on max() as the terms separate', () => {
    expect(blendFrameTime(20, 10, 5.1) / 20).toBeCloseTo(1.0057, 3)
  })

  it('is monotonic in each term', () => {
    expect(blendFrameTime(11, 6, 5.1)).toBeGreaterThan(blendFrameTime(10, 6, 5.1))
    expect(blendFrameTime(10, 7, 5.1)).toBeGreaterThan(blendFrameTime(10, 6, 5.1))
  })

  it('degrades to the other term when one is missing', () => {
    expect(blendFrameTime(0, 6, 5.1)).toBe(6)
    expect(blendFrameTime(10, 0, 5.1)).toBe(10)
  })
})

describe('cpuShare', () => {
  it('is 0.5 at parity', () => {
    expect(cpuShare(10, 10, 5.1)).toBeCloseTo(0.5, 9)
  })

  it('rises toward 1 as the CPU term dominates', () => {
    expect(cpuShare(5, 20, 5.1)).toBeGreaterThan(0.99)
    expect(cpuShare(20, 5, 5.1)).toBeLessThan(0.01)
  })

  it('stays within [0, 1]', () => {
    for (const [g, c] of [[1, 100], [100, 1], [7, 7], [0, 5], [5, 0]]) {
      const s = cpuShare(g, c, 5.1)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
})

describe('limitedBy', () => {
  it('names the limiter, with a balanced band in the middle', () => {
    expect(limitedBy(0.9)).toBe('cpu')
    expect(limitedBy(0.5)).toBe('balanced')
    expect(limitedBy(0.1)).toBe('gpu')
  })
})

describe('applyFpsCap', () => {
  it('an fps ceiling is a frame-time floor', () => {
    expect(applyFpsCap(4, 60)).toBeCloseTo(1000 / 60, 9)
  })

  it('leaves a frame time already below the cap alone', () => {
    expect(applyFpsCap(20, 60)).toBe(20)
  })

  it('is a no-op with no cap', () => {
    expect(applyFpsCap(4, null)).toBe(4)
    expect(applyFpsCap(4, 0)).toBe(4)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/perfEngineFrameTime.test.js
```

Expected: FAIL — `Failed to resolve import "../lib/perfEngine/frameTime"`.

- [ ] **Step 3: Write the module**

Create `src/lib/perfEngine/frameTime.js`:

```js
// Everything in the engine is a frame time in milliseconds.
//
// Frame times add and average linearly; frame RATES do not. Halfway between 60
// and 120 fps is 80, not 90 — a model that interpolates fps is wrong in a way
// that stays invisible until someone checks it. Conversion to fps happens once,
// at the boundary, on the way to the UI.

export const msToFps = (ms) => (ms > 0 ? 1000 / ms : 0)
export const fpsToMs = (fps) => (fps > 0 ? 1000 / fps : Infinity)

// The GPU and CPU pipelines overlap, but imperfectly. Taking max() assumes
// perfect overlap and so under-states the frame time whenever the two terms are
// close — which is exactly where most real builds sit. A p-norm interpolates
// between the two extremes: k -> infinity is max() (perfect overlap), k = 1 is
// addition (no overlap at all). The excess over max() at parity is exactly
// 2^(1/k) - 1, so k is a directly interpretable knob — and it is FITTED against
// the crossover measurements, never chosen by hand.
export function blendFrameTime(tGpu, tCpu, k) {
  if (!(tGpu > 0)) return tCpu > 0 ? tCpu : 0
  if (!(tCpu > 0)) return tGpu
  return Math.pow(Math.pow(tGpu, k) + Math.pow(tCpu, k), 1 / k)
}

// How much of the frame the CPU is responsible for: 0 = purely GPU-bound,
// 1 = purely CPU-bound. It falls out of the same p-norm as the frame time, so
// the bottleneck verdict and the frame rate can never contradict each other.
// ⚠️ With BOTH terms absent this returns 0, which limitedBy() reads as
// "GPU-led" — it cannot distinguish no data from a confirmed GPU bound. Every
// caller is expected to establish coverage before asking, the way
// estimateBuildPerformance checks both indices are > 0 first. Do not call it
// to find out whether you have data; call it once you know you do.
export function cpuShare(tGpu, tCpu, k) {
  if (!(tGpu > 0)) return tCpu > 0 ? 1 : 0
  if (!(tCpu > 0)) return 0
  const g = Math.pow(tGpu, k)
  const c = Math.pow(tCpu, k)
  return c / (g + c)
}

// A mildly GPU-led frame is the healthy normal state, so the middle band is
// wide and only a real imbalance gets named.
export const CPU_LED_ABOVE = 0.62
export const GPU_LED_BELOW = 0.38

export function limitedBy(share) {
  if (share > CPU_LED_ABOVE) return 'cpu'
  if (share < GPU_LED_BELOW) return 'gpu'
  return 'balanced'
}

// An engine frame cap is a ceiling on fps, which is a FLOOR on frame time.
export function applyFpsCap(ms, fpsCap) {
  return fpsCap > 0 ? Math.max(ms, fpsToMs(fpsCap)) : ms
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/tests/perfEngineFrameTime.test.js
```

Expected: **15 passed**.

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfEngine/frameTime.js src/tests/perfEngineFrameTime.test.js
git commit -m "$(cat <<'EOF'
feat: add the frame-time core of the performance engine

Milliseconds throughout, because frame times add and frame rates do not. The
p-norm blend replaces max(), which assumes perfect CPU/GPU overlap and so
under-states the frame time exactly at the crossover where most builds sit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: The two-way least-squares fitter

**Files:**
- Create: `src/lib/perfEngine/fitTwoWay.js` (**no imports** — a Node script loads it)
- Create: `src/tests/fixtures/syntheticCorpus.js`
- Test: `src/tests/perfFit.test.js`

- [ ] **Step 1: Write the fixture**

Create `src/tests/fixtures/syntheticCorpus.js`:

```js
// A corpus with KNOWN ground truth, so the fitter can be checked against an
// answer rather than against itself. Deterministic — a flaky numerical test is
// worse than none, because it teaches people to re-run until it passes.

// Linear congruential generator. Not good randomness; perfectly good
// reproducibility, which is the only property that matters here.
export function makeRng(seed = 7) {
  let s = seed
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
}

export const TRUE_INDEX = { a: 100, b: 74.5, c: 51.2, d: 33.8, e: 22.1 }
export const TRUE_CELL = { g1: 420, g2: 610, g3: 285, g4: 950 }

// dropRate simulates a hand-curated corpus: nobody benchmarks every card in
// every game, so the matrix is sparse and unbalanced.
export function makeObservations({ dropRate = 0, noise = 0, seed = 7 } = {}) {
  const rnd = makeRng(seed)
  const obs = []
  for (const [partKey, index] of Object.entries(TRUE_INDEX)) {
    for (const [cellKey, cellConst] of Object.entries(TRUE_CELL)) {
      if (rnd() < dropRate) continue
      const jitter = 1 + (rnd() - 0.5) * noise
      obs.push({ cellKey, partKey, logT: Math.log((cellConst / index) * jitter), weight: 1 })
    }
  }
  return obs
}
```

- [ ] **Step 2: Write the failing test**

Create `src/tests/perfFit.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { fitTwoWay } from '../lib/perfEngine/fitTwoWay'
import { makeObservations, TRUE_INDEX, TRUE_CELL } from './fixtures/syntheticCorpus'

const worstError = (fitted, truth) =>
  Math.max(...Object.entries(truth).map(([k, v]) => Math.abs(fitted.get(k) - v) / v))

describe('fitTwoWay', () => {
  it('recovers known indices exactly from a complete, noise-free corpus', () => {
    const fit = fitTwoWay(makeObservations(), { anchorPartKey: 'a', anchorValue: 100 })
    expect(fit.converged).toBe(true)
    expect(worstError(fit.index, TRUE_INDEX)).toBeLessThan(1e-6)
    expect(worstError(fit.cellConst, TRUE_CELL)).toBeLessThan(1e-6)
  })

  it('recovers them from a sparse corpus with 1% noise to within 3%', () => {
    // 35% of cells missing, +/-1% measurement noise — roughly what hand
    // curation from real reviews looks like.
    const fit = fitTwoWay(makeObservations({ dropRate: 0.35, noise: 0.02 }),
                          { anchorPartKey: 'a', anchorValue: 100 })
    expect(fit.converged).toBe(true)
    expect(worstError(fit.index, TRUE_INDEX)).toBeLessThan(0.03)
  })

  it('pins the anchor part to the anchor value exactly', () => {
    const fit = fitTwoWay(makeObservations({ dropRate: 0.3 }),
                          { anchorPartKey: 'c', anchorValue: 100 })
    expect(fit.index.get('c')).toBeCloseTo(100, 9)
    expect(fit.anchorPartKey).toBe('c')
  })

  it('re-anchoring rescales indices without changing their ratios', () => {
    const a = fitTwoWay(makeObservations(), { anchorPartKey: 'a' })
    const c = fitTwoWay(makeObservations(), { anchorPartKey: 'c' })
    expect(a.index.get('b') / a.index.get('d'))
      .toBeCloseTo(c.index.get('b') / c.index.get('d'), 6)
  })

  it('falls back to the most-observed part when the named anchor is absent', () => {
    const obs = makeObservations().filter((o) => o.partKey !== 'a')
    const fit = fitTwoWay(obs, { anchorPartKey: 'a', anchorValue: 100 })
    expect(fit.anchorPartKey).not.toBe('a')
    expect(fit.index.get(fit.anchorPartKey)).toBeCloseTo(100, 9)
  })

  it('handles an empty corpus without throwing', () => {
    const fit = fitTwoWay([], { anchorPartKey: 'a' })
    expect(fit.index.size).toBe(0)
    expect(fit.cellConst.size).toBe(0)
    expect(fit.converged).toBe(true)
  })

  it('reports every part as connected when the corpus is one component', () => {
    const fit = fitTwoWay(makeObservations({ dropRate: 0.3 }), { anchorPartKey: 'a' })
    expect(fit.disconnected).toEqual([])
    expect(fit.connected.size).toBe(Object.keys(TRUE_INDEX).length)
  })

  it('names the parts whose scale the data cannot relate to the anchor', () => {
    // Two reviews sharing no hardware AND no game. The fit converges happily
    // and produces a cross-cluster ratio that is an artefact of both clusters
    // starting from the same initialisation — a number nobody measured,
    // indistinguishable from one that was. This is the case that has to be
    // caught, because the fit itself gives no hint of it.
    const twoClusters = [
      { cellKey: 'g1', partKey: 'a', logT: Math.log(4) },
      { cellKey: 'g1', partKey: 'b', logT: Math.log(8) },
      { cellKey: 'g2', partKey: 'a', logT: Math.log(6) },
      { cellKey: 'g2', partKey: 'b', logT: Math.log(12) },
      { cellKey: 'g3', partKey: 'c', logT: Math.log(5) },
      { cellKey: 'g3', partKey: 'd', logT: Math.log(400) },
      { cellKey: 'g4', partKey: 'c', logT: Math.log(7) },
      { cellKey: 'g4', partKey: 'd', logT: Math.log(560) },
    ]
    const fit = fitTwoWay(twoClusters, { anchorPartKey: 'a', anchorValue: 100 })
    expect(fit.converged).toBe(true)          // it does NOT fail loudly on its own
    expect([...fit.connected].sort()).toEqual(['a', 'b'])
    expect(fit.disconnected.sort()).toEqual(['c', 'd'])

    // Ratios WITHIN a component are still sound — b is half of a in both.
    expect(fit.index.get('a') / fit.index.get('b')).toBeCloseTo(2, 6)
    expect(fit.index.get('c') / fit.index.get('d')).toBeCloseTo(80, 6)
  })

  it('one shared cell is enough to connect two otherwise separate reviews', () => {
    const bridged = [
      { cellKey: 'g1', partKey: 'a', logT: Math.log(4) },
      { cellKey: 'g1', partKey: 'b', logT: Math.log(8) },
      { cellKey: 'g2', partKey: 'b', logT: Math.log(12) },
      { cellKey: 'g2', partKey: 'c', logT: Math.log(6) },
    ]
    const fit = fitTwoWay(bridged, { anchorPartKey: 'a', anchorValue: 100 })
    expect(fit.disconnected).toEqual([])
    // a:b = 2 from g1, b:c = 1:2 from g2, so a:c = 1:1 through the bridge.
    expect(fit.index.get('a') / fit.index.get('c')).toBeCloseTo(1, 6)
  })

  it('honours weights — a downweighted outlier moves the fit less', () => {
    const clean = makeObservations()
    const withOutlier = [...clean,
      { cellKey: 'g1', partKey: 'b', logT: Math.log(1000), weight: 1 }]
    const withDownweighted = [...clean,
      { cellKey: 'g1', partKey: 'b', logT: Math.log(1000), weight: 0.05 }]
    const errFull = Math.abs(fitTwoWay(withOutlier, { anchorPartKey: 'a' }).index.get('b')
      - TRUE_INDEX.b)
    const errDown = Math.abs(fitTwoWay(withDownweighted, { anchorPartKey: 'a' }).index.get('b')
      - TRUE_INDEX.b)
    expect(errDown).toBeLessThan(errFull)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

```bash
npx vitest run src/tests/perfFit.test.js
```

Expected: FAIL — `Failed to resolve import "../lib/perfEngine/fitTwoWay"`.

- [ ] **Step 4: Write the fitter**

Create `src/lib/perfEngine/fitTwoWay.js`:

```js
// Alternating least squares over a two-way additive model in log space.
//
// The model is multiplicative — observed frame time = cellConst / partIndex —
// and taking logs turns it into a row-effect plus column-effect decomposition:
//
//     log t = log cellConst - log partIndex
//
// which alternates to a solution in a handful of passes and stays well-behaved
// on a sparse, unbalanced matrix. That matters: hand curation produces a corpus
// where one GPU appears in eleven games and another in two.
//
// NO IMPORTS. scripts/fit-perf-model.mjs loads this under plain Node, which
// cannot resolve the extensionless imports used elsewhere in src/lib.

// Which parts are reachable from the anchor by walking part -> shared cell ->
// part. The decomposition determines index ratios only WITHIN a connected
// component: two components sharing no cell have no measurement relating them,
// so their relative scale is not in the data at all.
//
// This is not a hypothetical. It is what happens when two reviews share no
// hardware and no game. Alternating least squares does not fail on it — it
// converges happily and hands back a confident-looking cross-component ratio
// that is purely an artefact of both components starting from the same
// initialisation. A number nobody measured, presented exactly like one that was
// measured, is the single failure this engine exists to prevent, so the caller
// is told which parts it may trust.
function reachableFrom(anchorPartKey, byPart, byCell) {
  const parts = new Set([anchorPartKey])
  const cells = new Set()
  const stack = [anchorPartKey]
  while (stack.length > 0) {
    for (const o of byPart.get(stack.pop()) ?? []) {
      if (cells.has(o.cellKey)) continue
      cells.add(o.cellKey)
      for (const sibling of byCell.get(o.cellKey) ?? []) {
        if (!parts.has(sibling.partKey)) {
          parts.add(sibling.partKey)
          stack.push(sibling.partKey)
        }
      }
    }
  }
  // Cells matter as much as parts. A cell measured ONLY by parts outside the
  // anchor's component gets a constant fitted in that component's own arbitrary
  // gauge, and nothing about its shape says so — combine it with a properly
  // anchored part index later and you get the same fabricated number the part
  // filter was added to prevent, one level up.
  return { parts, cells }
}

function weightedMean(rows, valueOf) {
  let totalWeight = 0
  let total = 0
  for (const row of rows) {
    const w = row.weight ?? 1
    totalWeight += w
    total += w * valueOf(row)
  }
  return totalWeight > 0 ? total / totalWeight : 0
}

// observations: [{ cellKey, partKey, logT, weight? }]
// Returns { index, cellConst, anchorPartKey, iterations, converged, connected,
// connectedCells, disconnected } — the SAME shape on every path, including the
// empty-corpus one. The two maps hold LINEAR values (already exponentiated).
// `connected`/`connectedCells` are Sets for O(1) "may I trust this?" checks;
// `disconnected` is an Array because callers enumerate and report it.
export function fitTwoWay(observations, {
  anchorPartKey, anchorValue = 100, tol = 1e-10, maxIter = 500,
} = {}) {
  const partKeys = [...new Set(observations.map((o) => o.partKey))]
  const cellKeys = [...new Set(observations.map((o) => o.cellKey))]
  if (partKeys.length === 0) {
    // Every field the populated path returns, so callers never have to guess
    // whether the empty case is shaped differently. It is not.
    return { index: new Map(), cellConst: new Map(), anchorPartKey: null,
             iterations: 0, converged: true,
             connected: new Set(), connectedCells: new Set(), disconnected: [] }
  }

  const byCell = new Map(cellKeys.map((k) => [k, []]))
  const byPart = new Map(partKeys.map((k) => [k, []]))
  for (const o of observations) {
    byCell.get(o.cellKey).push(o)
    byPart.get(o.partKey).push(o)
  }

  const logIndex = new Map(partKeys.map((k) => [k, 0]))
  const logCell = new Map(cellKeys.map((k) => [k, 0]))

  let iterations = 0
  let converged = false
  for (; iterations < maxIter; iterations++) {
    let delta = 0
    for (const c of cellKeys) {
      const next = weightedMean(byCell.get(c), (r) => r.logT + logIndex.get(r.partKey))
      delta = Math.max(delta, Math.abs(next - logCell.get(c)))
      logCell.set(c, next)
    }
    for (const p of partKeys) {
      const next = weightedMean(byPart.get(p), (r) => logCell.get(r.cellKey) - r.logT)
      delta = Math.max(delta, Math.abs(next - logIndex.get(p)))
      logIndex.set(p, next)
    }
    if (delta < tol) { converged = true; iterations += 1; break }
  }

  // Re-anchor. The decomposition is only determined up to a constant shift
  // between the two effects, so without this the indices drift run to run and
  // stop being comparable. Shifting both sides by the same amount leaves every
  // predicted frame time untouched.
  let anchor = anchorPartKey
  if (!logIndex.has(anchor)) {
    anchor = partKeys.reduce((best, k) =>
      (byPart.get(k).length > byPart.get(best).length ? k : best))
  }
  const shift = Math.log(anchorValue) - logIndex.get(anchor)
  for (const p of partKeys) logIndex.set(p, logIndex.get(p) + shift)
  for (const c of cellKeys) logCell.set(c, logCell.get(c) + shift)

  // Only the anchor's own component has a meaningful scale (see reachableFrom).
  // Everything else is reported so the caller can refuse to use it, rather than
  // silently quoting a number no measurement supports.
  const { parts: connected, cells: connectedCells } = reachableFrom(anchor, byPart, byCell)
  const disconnected = partKeys.filter((k) => !connected.has(k))

  return {
    index: new Map([...logIndex].map(([k, v]) => [k, Math.exp(v)])),
    cellConst: new Map([...logCell].map(([k, v]) => [k, Math.exp(v)])),
    anchorPartKey: anchor,
    iterations,
    converged,
    connected,
    connectedCells,
    disconnected,
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/tests/perfFit.test.js
```

Expected: **10 passed**. (Reference figures, measured: noise-free worst error 4.26×10⁻¹⁴ % converging in 2 passes; 35%-sparse with ±1% noise, worst error 1.59% in 24 passes. If your error magnitudes are far from these, investigate rather than loosening a threshold.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/perfEngine/fitTwoWay.js src/tests/fixtures/syntheticCorpus.js src/tests/perfFit.test.js
git commit -m "$(cat <<'EOF'
feat: add the two-way least-squares fitter for benchmark indices

Log space turns the multiplicative model into a separable row/column
decomposition, which is what lets a sparse hand-curated corpus produce a dense
index. Checked against a synthetic corpus with known ground truth rather than
against itself.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: The fit pipeline script

**Files:**
- Create: `scripts/fit-perf-model.mjs`
- Create: `src/data/perfModel.json`, `src/data/perfModel.report.json` (generated)
- Modify: `package.json`

- [ ] **Step 1: Write the script**

Create `scripts/fit-perf-model.mjs`:

```js
// Fits the benchmark corpus into src/data/perfModel.json.
//
//   npm run perf:fit
//
// Runs at BUILD time, never in the browser: the client ships the small fitted
// artefact, not the raw corpus. That keeps the corpus auditable in the repo,
// makes every constant diffable in review, and lets a bad data drop fail the
// build instead of reaching a user.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fitTwoWay } from '../src/lib/perfEngine/fitTwoWay.js'

const MODEL_VERSION = '1.0.0'
const RESOLUTIONS = ['1080p', '1440p', '4k']

// GPU-scaling reviews use a top-end CPU, so at these resolutions the CPU term is
// small enough to ignore for the GPU fit. 1080p is deliberately excluded from
// the GPU fit for the opposite reason — there the CPU is doing the limiting.
const GPU_FIT_RESOLUTIONS = ['1440p', '4k']

// Illustrative starting value. Pass 4 (Phase 3) fits it against the crossover
// measurements; until then it is declared, not discovered, and the artefact
// records which.
const DEFAULT_BLEND_K = 5.1
const DEFAULT_RES_CPU_SCALE = { '1080p': 1.0, '1440p': 1.012, '4k': 1.031 }

// No single outlet may dominate: the licensing position rests on nobody's
// compilation being substantially taken.
const SOURCE_SHARE_WARN = 0.15
const SOURCE_SHARE_FAIL = 0.20

// The share cap alone is unsatisfiable on a young corpus: with N evenly-split
// outlets each holds 1/N, so nothing under FIVE sources can ever clear 20% and
// the very first curation session would fail the build with perfectly good
// data. Two absolute escapes, because what the law actually cares about is
// whether a substantial part of somebody's compilation was taken — and twelve
// figures is not substantial however large a share of a small corpus it is:
//
//   · below CONCENTRATION_MIN_CORPUS total entries, share is not meaningful
//     enough to act on at all
//   · a source holding fewer than SOURCE_MIN_ABSOLUTE entries is never a
//     substantial taking, whatever its share
const CONCENTRATION_MIN_CORPUS = 40
const SOURCE_MIN_ABSOLUTE = 15

const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'))
const write = (rel, data) =>
  writeFileSync(fileURLToPath(new URL(rel, import.meta.url)),
                `${JSON.stringify(data, null, 2)}\n`)

const sources = read('../data/benchmarks/sources.json')
const entries = read('../data/benchmarks/entries.json')
const validation = read('../data/benchmarks/validation.json')
const parts = read('../src/data/partsData.json')

const sourceById = new Map(sources.map((s) => [s.id, s]))
const live = entries.filter((e) => !e.supersededBy)

// --- source concentration -------------------------------------------------
const perSource = new Map()
for (const e of live) perSource.set(e.sourceId, (perSource.get(e.sourceId) ?? 0) + 1)
const warnings = []
if (live.length >= CONCENTRATION_MIN_CORPUS) {
  for (const [id, n] of perSource) {
    const share = n / live.length
    if (n < SOURCE_MIN_ABSOLUTE) continue
    if (share > SOURCE_SHARE_FAIL) {
      console.error(`FAIL: source ${id} is ${(share * 100).toFixed(1)}% of the corpus ` +
                    `(${n} of ${live.length} entries, cap ${SOURCE_SHARE_FAIL * 100}%). ` +
                    `Add entries from other outlets.`)
      process.exit(1)
    }
    if (share > SOURCE_SHARE_WARN) {
      warnings.push(`source ${id} is ${(share * 100).toFixed(1)}% of the corpus`)
    }
  }
} else if (live.length > 0) {
  warnings.push(`corpus is only ${live.length} entries — the per-source ` +
                `concentration cap does not apply below ${CONCENTRATION_MIN_CORPUS}`)
}

// --- pass 1: GPU index, one fit per resolution ----------------------------
// Each resolution is fitted separately but anchored to the SAME card, so the
// three numbers stay comparable. Anchoring each independently would make
// "31.0 at 1080p, 27.4 at 4K" meaningless.
const gpuEntries = live.filter((e) =>
  sourceById.get(e.sourceId)?.kind === 'gpu-scaling' &&
  GPU_FIT_RESOLUTIONS.includes(e.resolution))

const anchorGpuId = mostCommon(gpuEntries.map((e) => e.gpuId))
const gpuFits = {}
for (const res of RESOLUTIONS) {
  const inRes = gpuEntries.filter((e) => e.resolution === res)
  gpuFits[res] = fitTwoWay(
    inRes.map((e) => ({
      cellKey: `${e.gameId}|${e.presetId}`,
      partKey: e.gpuId,
      logT: Math.log(1000 / e.avgFps),
      weight: e.weight ?? 1,
    })),
    { anchorPartKey: anchorGpuId, anchorValue: 100 },
  )
}

// --- pass 2: CPU index ----------------------------------------------------
// CPU-scaling reviews run a top-end GPU at 1080p. The GPU term is small but not
// zero, so where pass 1 can price it the p-norm is inverted to subtract it.
//
// ⚠️ In the STANDARD workflow that subtraction does not fire. Pass 1 skips
// 1080p (the CPU contaminates it), so there is no fitted cell constant at
// 1080p to price the GPU term with, and `gpuFrameTime` returns null — the CPU
// index simply absorbs the small GPU term instead. That is a known Phase 1
// approximation, not an accident: within one review the absorbed term is a
// constant that lands in B, so it does not distort CPU-to-CPU ratios; across
// reviews using different test GPUs it introduces a few percent. The
// subtraction path below is live only for the atypical case of a cpu-scaling
// entry at a resolution pass 1 did fit. Phase 2 closes this properly.
const cpuEntries = live.filter((e) => sourceById.get(e.sourceId)?.kind === 'cpu-scaling')
const k = DEFAULT_BLEND_K
const cpuObs = []
const droppedGpuBound = []
for (const e of cpuEntries) {
  const tObs = 1000 / e.avgFps
  const tGpu = gpuFrameTime(e)
  let tCpu = tObs
  if (tGpu != null) {
    const residual = Math.pow(tObs, k) - Math.pow(tGpu, k)
    if (residual <= 0) {
      // The entry is GPU-bound: it carries no CPU signal at all. Clamping it to
      // zero would invent one, so drop it and say so in the diagnostics.
      droppedGpuBound.push(e.id)
      continue
    }
    tCpu = Math.pow(residual, 1 / k)
  }
  cpuObs.push({
    cellKey: `${e.gameId}|${e.presetId}`,
    partKey: e.cpuId,
    logT: Math.log(tCpu / (DEFAULT_RES_CPU_SCALE[e.resolution] ?? 1)),
    weight: e.weight ?? 1,
  })
}
const anchorCpuId = mostCommon(cpuEntries.map((e) => e.cpuId))
const cpuFit = fitTwoWay(cpuObs, { anchorPartKey: anchorCpuId, anchorValue: 100 })

// --- assemble the artefact -----------------------------------------------
// A part outside the anchor's connected component has no measurement relating
// its scale to the anchor's — fitTwoWay hands back a number for it anyway, and
// that number is an artefact of the initialisation, not data. Drop those parts
// entirely: the engine then reports "no benchmark data" for them, which is
// true, instead of a fabricated index that looks exactly like a real one.
const droppedDisconnected = []
const gpuIndex = {}
for (const res of RESOLUTIONS) {
  const usable = gpuFits[res].connected
  for (const gpuId of gpuFits[res].disconnected) {
    droppedDisconnected.push({ kind: 'gpu', res, partId: gpuId })
  }
  for (const [gpuId, value] of gpuFits[res].index) {
    if (!usable.has(gpuId)) continue
    gpuIndex[gpuId] ??= { basis: 'measured', anchors: 0 }
    gpuIndex[gpuId][res] = round(value, 2)
  }
}
for (const gpuId of Object.keys(gpuIndex)) {
  gpuIndex[gpuId].anchors = gpuEntries.filter((e) => e.gpuId === gpuId).length
  // A resolution with no data of its own copies 1440p, and records that it did
  // so — the copy costs confidence later rather than passing as a measurement.
  const copied = []
  for (const res of RESOLUTIONS) {
    if (gpuIndex[gpuId][res] == null && gpuIndex[gpuId]['1440p'] != null) {
      gpuIndex[gpuId][res] = gpuIndex[gpuId]['1440p']
      copied.push(res)
    }
  }
  if (copied.length) gpuIndex[gpuId].copiedResolutions = copied
}

const cpuIndex = {}
for (const cpuId of cpuFit.disconnected) {
  droppedDisconnected.push({ kind: 'cpu', res: null, partId: cpuId })
}
for (const [cpuId, value] of cpuFit.index) {
  if (!cpuFit.connected.has(cpuId)) continue
  cpuIndex[cpuId] = {
    value: round(value, 2), basis: 'measured',
    anchors: cpuEntries.filter((e) => e.cpuId === cpuId).length,
  }
}

// Cells get the same treatment as parts. A cell measured only by parts outside
// the anchor's component was fitted in that component's own arbitrary gauge, so
// its constant is not comparable with a properly anchored index — pairing the
// two would rebuild the fabricated number the part filter exists to stop, one
// level up. Dropping the cell makes the engine say "no data" for that game,
// which is the truth.
const gameConst = {}
for (const res of RESOLUTIONS) {
  for (const [cellKey, A] of gpuFits[res].cellConst) {
    if (!gpuFits[res].connectedCells.has(cellKey)) {
      droppedDisconnected.push({ kind: 'gpu-cell', res, cellKey })
      continue
    }
    const [gameId, presetId] = cellKey.split('|')
    gameConst[gameId] ??= {}
    gameConst[gameId][res] ??= {}
    gameConst[gameId][res][presetId] = {
      ...(gameConst[gameId][res][presetId] ?? {}),
      A: round(A, 2),
      ...cellStats(live, gameId, res, presetId),
    }
  }
}
for (const [cellKey, B] of cpuFit.cellConst) {
  if (!cpuFit.connectedCells.has(cellKey)) {
    droppedDisconnected.push({ kind: 'cpu-cell', res: null, cellKey })
    continue
  }
  const [gameId, presetId] = cellKey.split('|')
  for (const res of RESOLUTIONS) {
    gameConst[gameId] ??= {}
    gameConst[gameId][res] ??= {}
    gameConst[gameId][res][presetId] = {
      ...(gameConst[gameId][res][presetId] ?? {}), B: round(B, 2),
    }
  }
}

// --- exact-match table ----------------------------------------------------
// A combination that was actually measured should return the measurement, not
// a model of it. The raw corpus never reaches the browser, so the exact rows
// have to ride in the artefact. Where several sources measured the same
// combination they are averaged in FRAME TIME, not in fps — averaging fps
// weights the fast source too heavily.
const exactGroups = {}
for (const e of live) {
  const key = `${e.cpuId}|${e.gpuId}|${e.gameId}|${e.resolution}|${e.presetId}`
  ;(exactGroups[key] ??= []).push(e)
}
const exact = {}
for (const [key, rows] of Object.entries(exactGroups)) {
  const totalWeight = rows.reduce((s, r) => s + (r.weight ?? 1), 0)
  const meanMs =
    rows.reduce((s, r) => s + (r.weight ?? 1) * (1000 / r.avgFps), 0) / totalWeight
  exact[key] = {
    frameTimeMs: round(meanMs, 4),
    sources: new Set(rows.map((r) => r.sourceId)).size,
    entries: rows.length,
  }
}

const model = {
  modelVersion: MODEL_VERSION,
  datasetVersion: new Date().toISOString().slice(0, 10),
  fittedAt: new Date().toISOString(),
  entryCount: live.length,
  sourceCount: sources.length,
  blendK: DEFAULT_BLEND_K,
  blendKBasis: 'default',        // becomes 'fitted' in Phase 3
  resCpuScale: DEFAULT_RES_CPU_SCALE,
  anchors: { gpu: anchorGpuId ?? null, cpu: anchorCpuId ?? null },
  gpuIndex,
  cpuIndex,
  gameConst,
  exact,
}

write('../src/data/perfModel.json', model)
write('../src/data/perfModel.report.json', {
  fittedAt: model.fittedAt,
  warnings,
  gpuFit: Object.fromEntries(RESOLUTIONS.map((r) =>
    [r, { iterations: gpuFits[r].iterations, converged: gpuFits[r].converged,
          parts: gpuFits[r].index.size }])),
  cpuFit: { iterations: cpuFit.iterations, converged: cpuFit.converged,
            parts: cpuFit.index.size },
  droppedGpuBound,
  // Parts the corpus cannot relate to the anchor. A long list means the corpus
  // has split into islands — usually because a batch of entries shares no game
  // with anything already in it. The fix is data, not code: add one review
  // covering a game and a part both islands already have.
  droppedDisconnected,
  coverage: {
    gpusMeasured: Object.keys(gpuIndex).length,
    gpusTotal: parts.filter((p) => p.category === 'gpu').length,
    cpusMeasured: Object.keys(cpuIndex).length,
    cpusTotal: parts.filter((p) => p.category === 'cpu').length,
  },
  // Populated in Phase 2, once there is enough corpus to hold data back.
  validation: { n: validation.length, mapeAvg: null, mapeLow: null },
})

for (const w of warnings) console.warn(`WARN: ${w}`)
console.log(`Fitted ${live.length} entries from ${sources.length} sources -> ` +
            `${Object.keys(gpuIndex).length} GPU indices, ` +
            `${Object.keys(cpuIndex).length} CPU indices.`)
if (live.length === 0) {
  console.log('The corpus is empty. The model is a valid empty artefact — the ' +
              'engine reports "not enough data" rather than guessing.')
}

// --- helpers --------------------------------------------------------------
function round(n, dp) { return Number(n.toFixed(dp)) }

function mostCommon(values) {
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = null
  for (const [v, n] of counts) if (best == null || n > counts.get(best)) best = v
  return best
}

function gpuFrameTime(entry) {
  const idx = gpuFits[entry.resolution]?.index.get(entry.gpuId)
  const A = gpuFits[entry.resolution]?.cellConst.get(`${entry.gameId}|${entry.presetId}`)
  return idx > 0 && A > 0 ? A / idx : null
}

// Source count and spread for a cell — the honest measure of how much the
// outlets disagree, which feeds the confidence score in Phase 2.
function cellStats(rows, gameId, res, presetId) {
  const inCell = rows.filter((e) =>
    e.gameId === gameId && e.resolution === res && e.presetId === presetId)
  const sourceCount = new Set(inCell.map((e) => e.sourceId)).size
  if (inCell.length < 2) return { sources: sourceCount, cv: null }
  const fps = inCell.map((e) => e.avgFps)
  const mean = fps.reduce((a, b) => a + b, 0) / fps.length
  const sd = Math.sqrt(fps.reduce((s, f) => s + (f - mean) ** 2, 0) / (fps.length - 1))
  return { sources: sourceCount, cv: round(sd / mean, 4) }
}
```

- [ ] **Step 2: Add the npm scripts**

In `package.json`, add to `"scripts"` after `"og:image"`:

```json
    "perf:fit": "node scripts/fit-perf-model.mjs",
    "perf:add": "node scripts/add-bench-entry.mjs"
```

- [ ] **Step 3: Run it against the empty corpus**

```bash
npm run perf:fit
```

Expected output:

```
Fitted 0 entries from 0 sources -> 0 GPU indices, 0 CPU indices.
The corpus is empty. The model is a valid empty artefact — the engine reports "not enough data" rather than guessing.
```

This must succeed. An engine that only works once data exists cannot be developed before the data exists.

- [ ] **Step 4: Verify the artefact shape**

```bash
node -e "const m=require('./src/data/perfModel.json');console.log(m.modelVersion,m.entryCount,Object.keys(m).join(','))"
```

Expected: `1.0.0 0 modelVersion,datasetVersion,fittedAt,entryCount,sourceCount,blendK,blendKBasis,resCpuScale,anchors,gpuIndex,cpuIndex,gameConst,exact`

- [ ] **Step 5: Commit**

```bash
git add scripts/fit-perf-model.mjs src/data/perfModel.json src/data/perfModel.report.json package.json
git commit -m "$(cat <<'EOF'
feat: add the build-time benchmark fit pipeline

Emits a small artefact the client can ship, keeping the raw corpus in the repo
where it stays auditable and diffable. Fails the build if one outlet exceeds
20% of entries, and drops CPU-scaling entries that turn out GPU-bound rather
than inventing a CPU signal for them.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: The curation harness

**Files:**
- Create: `scripts/add-bench-entry.mjs`

- [ ] **Step 1: Write the harness**

Create `scripts/add-bench-entry.mjs`:

```js
// Guided entry for the benchmark corpus.
//
//   npm run perf:add
//
// Curation quality is decided here. A loose intake cannot be fixed later: a
// number recorded without its scene, settings and test system can never be
// normalised against another outlet, and nobody will remember where it came
// from. So this refuses incomplete entries rather than accepting them with
// gaps, and it refuses an ambiguous part name rather than guessing which card
// you meant.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { validateSource, validateEntry, RESOLUTIONS, SOURCE_KINDS, LOW_KINDS }
  from '../src/lib/benchSchema.js'

const path = (rel) => fileURLToPath(new URL(rel, import.meta.url))
const read = (rel) => JSON.parse(readFileSync(path(rel), 'utf8'))
const write = (rel, data) => writeFileSync(path(rel), `${JSON.stringify(data, null, 2)}\n`)

const parts = read('../src/data/partsData.json')
const games = read('../src/data/gamesData.json')
const sources = read('../data/benchmarks/sources.json')
const entries = read('../data/benchmarks/entries.json')
const validation = read('../data/benchmarks/validation.json')

const rl = createInterface({ input: stdin, output: stdout })
const ask = async (q, fallback = '') => {
  const a = (await rl.question(fallback ? `${q} [${fallback}] ` : `${q} `)).trim()
  return a || fallback
}

const today = new Date().toISOString().slice(0, 10)

// Refuses rather than guesses. "RTX 4070" matches both the 4070 and the 4070
// Ti; picking one silently is how a corpus quietly fills with wrong parts.
async function resolvePart(category, prompt) {
  for (;;) {
    const query = await ask(prompt)
    if (!query) continue
    const pool = parts.filter((p) => p.category === category)
    const exact = pool.find((p) => p.id === query)
    if (exact) return exact.id
    const matches = pool.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    if (matches.length === 1) {
      console.log(`  -> ${matches[0].id}  (${matches[0].name})`)
      return matches[0].id
    }
    if (matches.length === 0) {
      console.log(`  no ${category} matches "${query}". Try part of the model name.`)
      continue
    }
    console.log(`  "${query}" is ambiguous — ${matches.length} matches:`)
    for (const m of matches.slice(0, 12)) console.log(`    ${m.id}  ${m.name}`)
    console.log('  Type the exact id.')
  }
}

async function chooseFrom(label, options) {
  for (;;) {
    const a = await ask(`${label} (${options.join(' / ')})`)
    if (options.includes(a)) return a
    console.log(`  must be one of: ${options.join(', ')}`)
  }
}

async function pickSource() {
  if (sources.length) {
    console.log('\nExisting sources:')
    sources.forEach((s, i) => console.log(`  ${i + 1}. ${s.outlet} — ${s.title} (${s.published})`))
    const a = await ask('Source number, or "new"', 'new')
    if (a !== 'new') {
      const chosen = sources[Number(a) - 1]
      if (chosen) return chosen
      console.log('  no such source; creating a new one')
    }
  }

  console.log('\nNew source:')
  const source = {
    id: '', outlet: await ask('Outlet (e.g. Hardware Unboxed)'),
    title: await ask('Article title'),
    url: await ask('URL'),
    published: await ask('Published date (YYYY-MM-DD)'),
    accessed: today,
    kind: await chooseFrom('Kind', SOURCE_KINDS),
    testSystem: {
      cpu: await ask('Test system CPU (as written in the review)'),
      ram: {
        type: await ask('Test RAM type', 'DDR5'),
        speed: Number(await ask('Test RAM speed (MT/s)', '6000')),
        capacityGb: Number(await ask('Test RAM capacity (GB)', '32')),
        sticks: Number(await ask('Test RAM sticks', '2')),
      },
      os: await ask('OS', 'Windows 11'),
      gpuDriver: await ask('GPU driver', 'not stated'),
    },
    notes: await ask('Methodology notes (how are the averages produced?)'),
  }
  source.id = `src-${slug(source.outlet)}-${source.published}-${slug(source.title).slice(0, 24)}`

  const problems = validateSource(source)
  if (problems.length) {
    console.error('\nSource rejected:')
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  sources.push(source)
  return source
}

function slug(s) {
  return String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const source = await pickSource()

console.log(`\nAdding entries against: ${source.outlet} — ${source.title}`)
console.log('Blank game id to finish.\n')

const gameIds = new Set(games.map((g) => g.id))
const partIds = new Set(parts.map((p) => p.id))
const sourceIds = new Set(sources.map((s) => s.id))
let added = 0

for (;;) {
  const gameId = await ask(`Game id (${games.slice(0, 5).map((g) => g.id).join(', ')}, ...)`)
  if (!gameId) break
  if (!gameIds.has(gameId)) { console.log('  unknown game id'); continue }

  const resolution = await chooseFrom('Resolution', RESOLUTIONS)
  const presetId = await ask('Preset id AS THE REVIEW NAMES IT (high, ultra, epic, ...)')
  const gpuId = await resolvePart('gpu', 'GPU:')
  const cpuId = await resolvePart('cpu', 'CPU:')
  const avgFps = Number(await ask('Average fps'))
  const lowRaw = await ask('1% low fps (blank if not published)')
  const lowFps = lowRaw ? Number(lowRaw) : null
  const lowKind = lowFps == null ? null : await chooseFrom('Low kind', LOW_KINDS)

  const entry = {
    id: `be-${slug(source.outlet)}-${gameId}-${resolution}-${presetId}-${gpuId}-${cpuId}`,
    sourceId: source.id, gameId, resolution, presetId, gpuId, cpuId, avgFps,
    ...(lowFps == null ? {} : { lowFps, lowKind }),
    upscaling: await ask('Upscaling', 'off'),
    rayTracing: (await ask('Ray tracing (y/n)', 'n')) === 'y',
    frameGen: (await ask('Frame generation (y/n)', 'n')) === 'y',
    sceneNote: await ask('Scene (e.g. "built-in benchmark")'),
    weight: Number(await ask('Weight — 1 for a published table, 0.5 read off a chart', '1')),
    supersededBy: null,
    recordedAt: today,
  }

  const problems = validateEntry(entry, { sourceIds, partIds, gameIds })
  if (!entry.sceneNote) problems.push('sceneNote is required')
  if (problems.length) {
    console.log('  rejected:')
    for (const p of problems) console.log(`    - ${p}`)
    continue
  }

  // `pair` sources are held-out validation and must never reach the fit —
  // scoring the model on data it was fitted to measures nothing.
  const target = source.kind === 'pair' ? validation : entries
  if (target.some((e) => e.id === entry.id)) {
    console.log('  an entry with this id already exists — correct it by adding a')
    console.log('  new row and setting supersededBy on the old one, never in place')
    continue
  }
  target.push(entry)
  added += 1
  console.log(`  added (${source.kind === 'pair' ? 'validation' : 'corpus'}), ${added} this session\n`)
}

write('../data/benchmarks/sources.json', sources)
write('../data/benchmarks/entries.json', entries)
write('../data/benchmarks/validation.json', validation)
await rl.close()

console.log(`\nWrote ${added} entries. Now run: npm run perf:fit`)
```

- [ ] **Step 2: Verify it starts and validates**

⚠️ **A bare `printf | node` does not work here, and the reason is worth knowing.** `readline/promises` attaches a one-shot `line` listener per `question()`. When a pipe delivers the whole payload in one burst before the next listener is attached, the surplus lines are dropped rather than queued: the first prompt gets its answer, every later one hangs, and Node exits 13 with "Detected unsettled top-level await". That is the harness working correctly against a hostile input method, not a bug in it — a human typing in a real terminal is naturally paced.

Also note the input must NOT begin with `new`: the "Source number, or new" prompt only appears `if (sources.length)`, and the corpus is empty at this point, so a leading `new` would be swallowed as the outlet name and shift every field by one.

Drive it with a paced writer instead. Save as `scripts/_probe.mjs`, run it, then **delete it**:

```js
import { spawn } from 'node:child_process'
const lines = ['Test Outlet', 'A Review', 'not-a-url', '2026-01-01', 'gpu-scaling',
               'X', 'DDR5', '6000', '32', '2', 'Win11', '572', 'notes']
const child = spawn('node', ['scripts/add-bench-entry.mjs'], { stdio: ['pipe', 'inherit', 'inherit'] })
let i = 0
const tick = () => {
  if (i < lines.length) { child.stdin.write(`${lines[i++]}\n`); setTimeout(tick, 60) }
  else child.stdin.end()
}
setTimeout(tick, 600)
child.on('exit', (code) => console.log('EXIT CODE:', code))
```

```bash
node scripts/_probe.mjs
```

Expected: `EXIT CODE: 1`, preceded by `Source rejected:` listing `url must be an http(s) URL` and `published must be YYYY-MM-DD`. This proves the shared validator is wired in rather than the harness carrying its own looser rules.

- [ ] **Step 3: Verify nothing was written**

```bash
node -e "console.log(require('./data/benchmarks/sources.json').length)"
```

Expected: `0`. A rejected source must not be persisted.

- [ ] **Step 4: Commit**

```bash
git add scripts/add-bench-entry.mjs
git commit -m "$(cat <<'EOF'
feat: add the guided benchmark curation harness

Refuses incomplete entries and ambiguous part names rather than guessing —
curation quality is decided at intake and cannot be retro-fixed. Shares its
validators with the integrity test so there is one definition of valid. Routes
`pair` sources to the held-out validation set automatically.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Index lookup and the exact-match short-circuit

**Files:**
- Create: `src/lib/perfEngine/indices.js`
- Test: `src/tests/perfEngineIndices.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/perfEngineIndices.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { gpuIndexFor, cpuIndexFor, cellFor, exactFor, hasCoverage }
  from '../lib/perfEngine/indices'

const model = {
  modelVersion: '1.0.0',
  gpuIndex: {
    'gpu-rtx-5070': { '1080p': 61.4, '1440p': 62.0, '4k': 60.1, basis: 'measured', anchors: 11 },
    // A copied resolution still carries the VALUE — Task 7 writes the 1440p
    // number into the empty slot and records the copy alongside it, so
    // `copiedResolutions` is metadata about a value that is present, never a
    // flag standing in for an absent one.
    'gpu-rtx-4060': { '1080p': 30.2, '1440p': 30.2, '4k': 30.2, basis: 'measured', anchors: 4,
                      copiedResolutions: ['1080p', '4k'] },
  },
  cpuIndex: { 'cpu-ryzen-5-7600x': { value: 71.2, basis: 'measured', anchors: 9 } },
  gameConst: {
    cyberpunk: { '1440p': { high: { A: 399.0, B: 402.0, sources: 3, cv: 0.052 } } },
  },
  exact: {
    'cpu-ryzen-5-7600x|gpu-rtx-5070|cyberpunk|1440p|high':
      { frameTimeMs: 7.4074, sources: 2, entries: 2 },
  },
}

describe('gpuIndexFor', () => {
  it('returns the measured index for the requested resolution', () => {
    expect(gpuIndexFor(model, { id: 'gpu-rtx-5070' }, '1440p'))
      .toEqual({ value: 62.0, basis: 'measured', anchors: 11, resolutionCopied: false })
  })

  it('flags a resolution that was copied rather than measured', () => {
    const r = gpuIndexFor(model, { id: 'gpu-rtx-4060' }, '4k')
    expect(r.resolutionCopied).toBe(true)
  })

  it('returns basis "none" for an uncovered card — never a guess', () => {
    // Phase 2 replaces this with a perfScore-derived prior. Until then the
    // honest answer is "no data", and the UI says so.
    expect(gpuIndexFor(model, { id: 'gpu-rx-9999', perfScore: 50 }, '1440p'))
      .toEqual({ value: null, basis: 'none', anchors: 0, resolutionCopied: false })
  })

  it('returns basis "none" for a missing part', () => {
    expect(cpuIndexFor(model, null).basis).toBe('none')
  })
})

describe('cellFor', () => {
  it('returns the fitted constants for a covered cell', () => {
    const cell = cellFor(model, { id: 'cyberpunk' }, '1440p', 'high')
    expect(cell).toMatchObject({ A: 399.0, B: 402.0, sources: 3 })
  })

  it('returns null for an uncovered cell', () => {
    expect(cellFor(model, { id: 'cyberpunk' }, '4k', 'high')).toBeNull()
    expect(cellFor(model, { id: 'starfield' }, '1440p', 'high')).toBeNull()
  })
})

describe('exactFor', () => {
  it('returns the measurement for a combination that was actually tested', () => {
    expect(exactFor(model, {
      cpu: { id: 'cpu-ryzen-5-7600x' }, gpu: { id: 'gpu-rtx-5070' },
      game: { id: 'cyberpunk' }, resolution: '1440p', presetId: 'high',
    })).toEqual({ frameTimeMs: 7.4074, sources: 2, entries: 2 })
  })

  it('returns null when any part of the key differs', () => {
    const base = { cpu: { id: 'cpu-ryzen-5-7600x' }, gpu: { id: 'gpu-rtx-5070' },
                   game: { id: 'cyberpunk' }, resolution: '1440p', presetId: 'high' }
    expect(exactFor(model, { ...base, resolution: '4k' })).toBeNull()
    expect(exactFor(model, { ...base, presetId: 'ultra' })).toBeNull()
    expect(exactFor(model, { ...base, cpu: { id: 'cpu-other' } })).toBeNull()
  })

  it('returns null against a model with no exact table', () => {
    expect(exactFor({}, { cpu: { id: 'a' }, gpu: { id: 'b' }, game: { id: 'c' },
                          resolution: '1440p', presetId: 'high' })).toBeNull()
  })
})

describe('hasCoverage', () => {
  it('is true only when both indices and the cell are present', () => {
    const cpu = { id: 'cpu-ryzen-5-7600x' }
    const gpu = { id: 'gpu-rtx-5070' }
    const game = { id: 'cyberpunk' }
    expect(hasCoverage(model, { cpu, gpu, game, resolution: '1440p', presetId: 'high' })).toBe(true)
    expect(hasCoverage(model, { cpu, gpu, game, resolution: '4k', presetId: 'high' })).toBe(false)
    expect(hasCoverage(model, { cpu, gpu: { id: 'gpu-x' }, game, resolution: '1440p', presetId: 'high' }))
      .toBe(false)
  })

  it('is false against an empty model', () => {
    const empty = { gpuIndex: {}, cpuIndex: {}, gameConst: {} }
    expect(hasCoverage(empty, {
      cpu: { id: 'a' }, gpu: { id: 'b' }, game: { id: 'c' },
      resolution: '1440p', presetId: 'high',
    })).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/perfEngineIndices.test.js
```

Expected: FAIL — `Failed to resolve import "../lib/perfEngine/indices"`.

- [ ] **Step 3: Write the module**

Create `src/lib/perfEngine/indices.js`:

```js
// Lookup into the fitted artefact.
//
// Every accessor reports the BASIS of what it returns, not just a number. That
// distinction is the whole trust story: "measured" and "we had nothing and made
// something up" must never be indistinguishable to the caller, and the only way
// to guarantee that is to make the basis impossible to drop.

const EMPTY_INDEX = { value: null, basis: 'none', anchors: 0, resolutionCopied: false }

export function gpuIndexFor(model, gpu, resolution) {
  const row = gpu?.id ? model?.gpuIndex?.[gpu.id] : null
  const value = row?.[resolution]
  if (!(value > 0)) return { ...EMPTY_INDEX }
  return {
    value,
    basis: row.basis ?? 'measured',
    anchors: row.anchors ?? 0,
    resolutionCopied: Boolean(row.copiedResolutions?.includes(resolution)),
  }
}

export function cpuIndexFor(model, cpu) {
  const row = cpu?.id ? model?.cpuIndex?.[cpu.id] : null
  if (!(row?.value > 0)) return { ...EMPTY_INDEX }
  return {
    value: row.value,
    basis: row.basis ?? 'measured',
    anchors: row.anchors ?? 0,
    resolutionCopied: false,
  }
}

// The fitted per-cell constants. A is the GPU-side constant, B the CPU-side.
export function cellFor(model, game, resolution, presetId) {
  const cell = model?.gameConst?.[game?.id]?.[resolution]?.[presetId]
  if (!(cell?.A > 0) || !(cell?.B > 0)) return null
  return cell
}

export function exactKey({ cpu, gpu, game, resolution, presetId }) {
  return `${cpu?.id}|${gpu?.id}|${game?.id}|${resolution}|${presetId}`
}

// A combination somebody actually measured. The whole point of curating real
// data is that where it exists it is used directly, so this short-circuits the
// model rather than feeding it.
export function exactFor(model, context) {
  // Guard the way the index accessors do. Without it a missing part stringifies
  // to the literal "undefined" in the key, and a table containing a key of that
  // shape would match it. Unreachable through estimateBuildPerformance, which
  // returns early without a CPU and a GPU — but this module's entire contract
  // is that a caller cannot accidentally receive a number it did not earn, and
  // an accessor that depends on someone else checking first does not honour it.
  if (!context?.cpu?.id || !context?.gpu?.id || !context?.game?.id) return null
  return model?.exact?.[exactKey(context)] ?? null
}

// Can this exact combination be estimated from measurement alone? Phase 1
// answers only where this is true and says "not enough data" everywhere else.
export function hasCoverage(model, { cpu, gpu, game, resolution, presetId }) {
  return (
    gpuIndexFor(model, gpu, resolution).value > 0 &&
    cpuIndexFor(model, cpu).value > 0 &&
    cellFor(model, game, resolution, presetId) != null
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/tests/perfEngineIndices.test.js
```

Expected: **11 passed**.

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfEngine/indices.js src/tests/perfEngineIndices.test.js
git commit -m "$(cat <<'EOF'
feat: add index lookup that always reports its basis

"measured" and "we had nothing" must never be indistinguishable to a caller, so
the basis travels with every value rather than being derivable separately.
Uncovered parts return null, not a guess — the prior arrives in Phase 2.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `estimateBuildPerformance`

**Files:**
- Create: `src/lib/perfEngine/index.js`
- Test: `src/tests/perfEngine.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/perfEngine.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { estimateBuildPerformance } from '../lib/perfEngine'

const cpu = { id: 'cpu-ryzen-5-7600x', name: 'AMD Ryzen 5 7600X', socket: 'AM5' }
const gpu = { id: 'gpu-rtx-5070', name: 'NVIDIA GeForce RTX 5070', specs: { vram: 12 } }
const games = [
  { id: 'cyberpunk', name: 'Cyberpunk 2077', slug: 'cyberpunk-2077', fpsFactor: 0.5, cpuFactor: 0.75 },
  { id: 'elden-ring', name: 'Elden Ring', slug: 'elden-ring', fpsFactor: 0.9, cpuFactor: 1.2, fpsCap: 60 },
  { id: 'starfield', name: 'Starfield', slug: 'starfield', fpsFactor: 0.65, cpuFactor: 0.7 },
]

const model = {
  modelVersion: '1.0.0',
  datasetVersion: '2026-08-07',
  blendK: 5.1,
  resCpuScale: { '1080p': 1.0, '1440p': 1.012, '4k': 1.031 },
  gpuIndex: { 'gpu-rtx-5070': { '1440p': 62.0, basis: 'measured', anchors: 11 } },
  cpuIndex: { 'cpu-ryzen-5-7600x': { value: 71.2, basis: 'measured', anchors: 9 } },
  gameConst: {
    cyberpunk: { '1440p': { high: { A: 399.0, B: 402.0, sources: 3, cv: 0.052 } } },
    'elden-ring': { '1440p': { high: { A: 200.0, B: 200.0, sources: 2, cv: 0.03 } } },
  },
}

const run = (over = {}) => estimateBuildPerformance({
  parts: { cpu, gpu }, resolution: '1440p', presetId: 'high',
  model, games, ...over,
})

describe('estimateBuildPerformance', () => {
  it('returns null without a CPU or a GPU', () => {
    expect(run({ parts: { gpu } })).toBeNull()
    expect(run({ parts: { cpu } })).toBeNull()
  })

  it('reproduces the spec worked example from the fitted model', () => {
    // t_gpu = 399.0 / 62.0                    = 6.4355 ms
    // t_cpu = 402.0 * 1.012 / 71.2            = 5.7138 ms
    // t     = (6.4355^5.1 + 5.7138^5.1)^(1/5.1) = 7.009 ms  ->  143 fps
    //
    // The spec's worked example says 142. The difference is the DDR5-5600
    // memory factor, which is Phase 3 — Phase 1 has no memory term at all, so
    // it lands one frame higher. That is expected, not a discrepancy.
    const row = run().games.find((g) => g.gameId === 'cyberpunk')
    expect(row.frameTimeMs).toBeCloseTo(7.01, 2)
    expect(row.avgFps).toBe(143)
    expect(row.limitedBy).toBe('gpu')
    expect(row.cpuShare).toBeCloseTo(0.353, 2)
    expect(row.basis).toBe('modelled')
  })

  it('prefers a real measurement over the model when one exists', () => {
    // 7.4074 ms is 135 fps. The fitted model would say 143. Where somebody
    // actually measured the combination, the measurement wins — that is the
    // entire point of curating real data.
    const withExact = {
      ...model,
      exact: { 'cpu-ryzen-5-7600x|gpu-rtx-5070|cyberpunk|1440p|high':
                 { frameTimeMs: 7.4074, sources: 2, entries: 2 } },
    }
    const row = run({ model: withExact }).games.find((g) => g.gameId === 'cyberpunk')
    expect(row.avgFps).toBe(135)
    expect(row.basis).toBe('measured')
    expect(row.sources).toBe(2)
    // The split still comes from the model — a measurement is a frame time, not
    // an attribution of it — so the verdict is unchanged.
    expect(row.limitedBy).toBe('gpu')
  })

  it('reports a measurement even when the cell itself was never fitted', () => {
    const onlyExact = {
      ...model, gameConst: {},
      exact: { 'cpu-ryzen-5-7600x|gpu-rtx-5070|cyberpunk|1440p|high':
                 { frameTimeMs: 8.0, sources: 1, entries: 1 } },
    }
    const row = run({ model: onlyExact }).games.find((g) => g.gameId === 'cyberpunk')
    expect(row.avgFps).toBe(125)
    expect(row.basis).toBe('measured')
    // Nothing can attribute the frame without the fitted constants, so the
    // split is reported as unknown rather than invented.
    expect(row.cpuShare).toBeNull()
    expect(row.limitedBy).toBeNull()
  })

  it('respects an engine frame cap', () => {
    const row = run().games.find((g) => g.gameId === 'elden-ring')
    expect(row.avgFps).toBe(60)
    expect(row.atEngineCap).toBe(true)
  })

  it('reports no data rather than guessing for an uncovered game', () => {
    const row = run().games.find((g) => g.gameId === 'starfield')
    expect(row.basis).toBe('none')
    expect(row.avgFps).toBeNull()
  })

  it('sorts covered games above uncovered ones, fastest first', () => {
    // cyberpunk 143, elden-ring capped at 60, starfield uncovered.
    const ids = run().games.map((g) => g.gameId)
    expect(ids).toEqual(['cyberpunk', 'elden-ring', 'starfield'])
  })

  it('summarises coverage across the selected games', () => {
    const report = run()
    expect(report.coverage).toEqual({
      gamesAnswered: 2, gamesExact: 0, gamesTotal: 3,
      gpuBasis: 'measured', cpuBasis: 'measured',
    })
  })

  it('stamps the model and dataset versions on the report', () => {
    const report = run()
    expect(report.modelVersion).toBe('1.0.0')
    expect(report.datasetVersion).toBe('2026-08-07')
    expect(report.resolution).toBe('1440p')
    expect(report.presetId).toBe('high')
  })

  it('returns an all-uncovered report against an empty model, and does not throw', () => {
    const empty = { modelVersion: '1.0.0', datasetVersion: '2026-01-01', blendK: 5.1,
                    resCpuScale: { '1440p': 1.012 }, gpuIndex: {}, cpuIndex: {}, gameConst: {} }
    const report = run({ model: empty })
    expect(report.coverage.gamesAnswered).toBe(0)
    expect(report.games.every((g) => g.basis === 'none')).toBe(true)
  })

  it('limits to the requested games', () => {
    expect(run({ gameIds: ['cyberpunk'] }).games.map((g) => g.gameId)).toEqual(['cyberpunk'])
  })

  it('is a pure function — the same input gives an identical result', () => {
    expect(run()).toEqual(run())
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/perfEngine.test.js
```

Expected: FAIL — `Failed to resolve import "../lib/perfEngine"`.

- [ ] **Step 3: Write the module**

Create `src/lib/perfEngine/index.js`:

```js
import { blendFrameTime, cpuShare, limitedBy, applyFpsCap, msToFps } from './frameTime'
import { gpuIndexFor, cpuIndexFor, cellFor, exactFor } from './indices'
import { resolvePreset } from '../gamePresets'

// The public contract of the performance engine.
//
// Phase 1 answers ONLY where the corpus covers the exact combination, and
// returns basis "none" everywhere else. Interpolation, the perfScore prior and
// confidence scoring arrive in Phase 2; 1% lows, memory and VRAM in Phase 3.
// Shipping the honest gap first is deliberate — an engine that fills holes
// before it can say how good the filling is has no way to earn trust back.

function estimateGame({ game, model, cpu, gpu, gpuIdx, cpuIdx, resolution, presetId }) {
  const { preset, exact: presetExact } = resolvePreset(game, presetId)
  const cell = cellFor(model, game, resolution, preset.id)
  const measured = exactFor(model, { cpu, gpu, game, resolution, presetId: preset.id })

  const base = { gameId: game.id, name: game.name, preset: preset.label, presetExact }

  // The frame SPLIT always comes from the fitted model, even when the frame
  // TIME is a measurement — a measurement is a duration, not an attribution of
  // it. Without the fitted constants there is nothing to attribute with, so the
  // split is reported as unknown rather than invented.
  const modelled = cell && gpuIdx.value > 0 && cpuIdx.value > 0
    ? (() => {
        const tGpu = cell.A / gpuIdx.value
        const tCpu = (cell.B * (model.resCpuScale?.[resolution] ?? 1)) / cpuIdx.value
        const share = cpuShare(tGpu, tCpu, model.blendK)
        return { frameTimeMs: blendFrameTime(tGpu, tCpu, model.blendK), share }
      })()
    : null

  // A real measurement of this exact combination beats a model of it.
  const source = measured
    ? { ms: measured.frameTimeMs, basis: 'measured', sources: measured.sources }
    : modelled
      ? { ms: modelled.frameTimeMs, basis: 'modelled', sources: cell.sources ?? 0 }
      : null

  if (!source) {
    return { ...base, avgFps: null, frameTimeMs: null, cpuShare: null,
             limitedBy: null, atEngineCap: false, basis: 'none', sources: 0 }
  }

  const capped = applyFpsCap(source.ms, game.fpsCap)
  const avgFps = Math.round(msToFps(capped))

  // "the reported rate sits at the engine's ceiling", NOT "flooring changed the
  // number". Those agree everywhere except exactly at the cap — which is the
  // likeliest real reading there is for a hard-locked game, since a reviewer
  // benchmarking a rock-solid 60 fps lock records exactly 60. Comparing frame
  // times instead reported false in precisely that case.
  //
  // It also does the disclosure work for a measured row the cap binds: the
  // number shown is then the ceiling rather than the raw reading, and this is
  // what says so.
  const atEngineCap = Boolean(game.fpsCap && avgFps >= game.fpsCap)

  return {
    ...base,
    avgFps,
    frameTimeMs: Number(capped.toFixed(2)),
    cpuShare: modelled ? Number(modelled.share.toFixed(3)) : null,
    limitedBy: modelled ? limitedBy(modelled.share) : null,
    atEngineCap,
    basis: source.basis,
    sources: source.sources,
  }
}

export function estimateBuildPerformance({
  parts, resolution = '1440p', presetId = 'high', gameIds, model, games,
}) {
  const cpu = parts?.cpu
  const gpu = parts?.gpu
  if (!cpu || !gpu || !model || !games) return null

  const gpuIdx = gpuIndexFor(model, gpu, resolution)
  const cpuIdx = cpuIndexFor(model, cpu)

  const selected = gameIds?.length
    ? games.filter((g) => gameIds.includes(g.id))
    : games

  const rows = selected
    .map((game) => estimateGame({ game, model, cpu, gpu, gpuIdx, cpuIdx, resolution, presetId }))
    // Covered games first, fastest first within each group. An uncovered row is
    // still shown — a silently missing game reads as a bug, not as a gap.
    .sort((a, b) => {
      if ((a.avgFps == null) !== (b.avgFps == null)) return a.avgFps == null ? 1 : -1
      return (b.avgFps ?? 0) - (a.avgFps ?? 0)
    })

  return {
    modelVersion: model.modelVersion,
    datasetVersion: model.datasetVersion,
    resolution,
    presetId,
    build: {
      cpu: { id: cpu.id, name: cpu.name },
      gpu: { id: gpu.id, name: gpu.name, vramGb: gpu.specs?.vram ?? null },
    },
    games: rows,
    coverage: {
      // Answered at all vs answered from a direct measurement of this exact
      // combination. Collapsing the two would hide the difference between
      // "we measured this" and "we derived it", which is the distinction the
      // whole engine exists to preserve.
      gamesAnswered: rows.filter((r) => r.basis !== 'none').length,
      gamesExact: rows.filter((r) => r.basis === 'measured').length,
      gamesTotal: rows.length,
      gpuBasis: gpuIdx.basis,
      cpuBasis: cpuIdx.basis,
    },
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/tests/perfEngine.test.js
```

Expected: **12 passed**.

- [ ] **Step 5: Run the whole suite**

```bash
npm run test:run
```

Expected: every previously-passing test still passes, including `legacyEngineUntouched`. Note the new total.

- [ ] **Step 6: Commit**

```bash
git add src/lib/perfEngine/index.js src/tests/perfEngine.test.js
git commit -m "$(cat <<'EOF'
feat: add estimateBuildPerformance, the engine's public contract

Answers only where the corpus covers the exact combination and reports basis
"none" everywhere else. Shipping the honest gap before the interpolation is
deliberate: an engine that fills holes before it can say how good the filling
is has no way to earn trust back.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: The report UI

**Files:**
- Create: `src/components/performance/FpsCard.jsx`, `FpsCardGrid.jsx`, `PerformanceReport.jsx`
- Create: `src/components/RunPerformanceTest.jsx`
- Test: `src/tests/RunPerformanceTest.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/RunPerformanceTest.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RunPerformanceTest from '../components/RunPerformanceTest'

const cpu = { id: 'cpu-ryzen-5-7600x', name: 'AMD Ryzen 5 7600X', socket: 'AM5' }
const gpu = { id: 'gpu-rtx-5070', name: 'NVIDIA GeForce RTX 5070', specs: { vram: 12 } }
const games = [
  { id: 'cyberpunk', name: 'Cyberpunk 2077', fpsFactor: 0.5, cpuFactor: 0.75 },
  { id: 'starfield', name: 'Starfield', fpsFactor: 0.65, cpuFactor: 0.7 },
]
const model = {
  modelVersion: '1.0.0', datasetVersion: '2026-08-07', blendK: 5.1,
  resCpuScale: { '1440p': 1.012 },
  gpuIndex: { 'gpu-rtx-5070': { '1440p': 62.0, basis: 'measured', anchors: 11 } },
  cpuIndex: { 'cpu-ryzen-5-7600x': { value: 71.2, basis: 'measured', anchors: 9 } },
  gameConst: { cyberpunk: { '1440p': { high: { A: 399.0, B: 402.0, sources: 3 } } } },
}

const setup = (over = {}) => render(
  <RunPerformanceTest parts={{ cpu, gpu }} resolution="1440p" model={model} games={games} {...over} />,
)

describe('RunPerformanceTest', () => {
  it('is disabled with a reason until a CPU and a GPU are picked', () => {
    setup({ parts: { cpu } })
    const button = screen.getByRole('button', { name: /performance test/i })
    expect(button).toBeDisabled()
    expect(screen.getByText(/pick a cpu and a graphics card/i)).toBeInTheDocument()
  })

  it('shows no report until the button is clicked', () => {
    setup()
    expect(screen.queryByText('Cyberpunk 2077')).not.toBeInTheDocument()
  })

  it('renders the FPS cards on click', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /run performance test/i }))
    expect(screen.getByText('Cyberpunk 2077')).toBeInTheDocument()
    expect(screen.getByText('143')).toBeInTheDocument()
  })

  it('says so plainly for a game with no data, instead of showing a number', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /run performance test/i }))
    expect(screen.getByText('Starfield')).toBeInTheDocument()
    expect(screen.getByText(/no benchmark data yet/i)).toBeInTheDocument()
  })

  it('toggles closed again', async () => {
    setup()
    const button = screen.getByRole('button', { name: /run performance test/i })
    await userEvent.click(button)
    await userEvent.click(screen.getByRole('button', { name: /hide performance test/i }))
    expect(screen.queryByText('Cyberpunk 2077')).not.toBeInTheDocument()
  })

  it('shows the coverage count and model version in the footer', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /run performance test/i }))
    expect(screen.getByText(/1 of 2 games estimated/i)).toBeInTheDocument()
    expect(screen.getByText(/model 1\.0\.0/i)).toBeInTheDocument()
  })

  it('explains itself when the corpus covers nothing at all', async () => {
    const empty = { ...model, gpuIndex: {}, cpuIndex: {}, gameConst: {} }
    setup({ model: empty })
    await userEvent.click(screen.getByRole('button', { name: /run performance test/i }))
    expect(screen.getByText(/no benchmark data for these parts yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/RunPerformanceTest.test.jsx
```

Expected: FAIL — `Failed to resolve import "../components/RunPerformanceTest"`.

- [ ] **Step 3: Write `FpsCard.jsx`**

Create `src/components/performance/FpsCard.jsx`:

```jsx
// One game's result.
//
// A row with no data shows that fact rather than being dropped: a game silently
// missing from the list reads as a bug, and a game showing an invented number
// is worse than either.
export default function FpsCard({ row }) {
  if (row.basis === 'none') {
    return (
      <div className="rounded-lg border border-line bg-surface p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-ink">{row.name}</span>
          <span className="text-[11px] uppercase tracking-wider text-muted">{row.preset}</span>
        </div>
        <p className="mt-2 text-[11px] text-muted">No benchmark data yet</p>
      </div>
    )
  }

  // A measurement is a duration, not an attribution of it — so a row can have
  // a frame rate and no split, when the corpus measured this exact combination
  // but never fitted the cell that would divide the frame. `1 - null` is 1 in
  // JavaScript, so drawing the bar anyway shows a full GPU bar labelled
  // "Balanced": two contradictory claims, neither of them measured.
  const splitKnown = row.cpuShare != null && row.limitedBy != null
  const gpuPct = splitKnown ? Math.round((1 - row.cpuShare) * 100) : 0
  const label = row.limitedBy === 'cpu' ? 'CPU-led'
    : row.limitedBy === 'gpu' ? 'GPU-led' : 'Balanced'

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink">{row.name}</span>
        <span className="text-[11px] uppercase tracking-wider text-muted">{row.preset}</span>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl text-ink">{row.avgFps}</span>
        <span className="text-[11px] text-muted">fps average</span>
        {/* Whether somebody measured THIS combination or the model derived it
            is the distinction the engine exists to preserve. The footer counts
            them in aggregate; without this the two are identical on the card. */}
        {row.basis === 'measured' && (
          <span className="ml-1.5 text-[10px] uppercase tracking-wider text-good">measured</span>
        )}
        {row.atEngineCap && (
          <span className="ml-auto text-[10px] text-muted">engine cap</span>
        )}
      </div>

      {/* The split is stated in words as well as drawn: a bar alone is
          unreadable to a screen reader and to anyone colour-blind. */}
      {splitKnown ? (
        <div className="mt-2.5 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
            role="img"
            aria-label={`${gpuPct}% of the frame is GPU work — ${label}`}
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${gpuPct}%` }} />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
        </div>
      ) : (
        <p className="mt-2.5 text-[10px] uppercase tracking-wider text-muted">
          Split not modelled
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write `FpsCardGrid.jsx`**

Create `src/components/performance/FpsCardGrid.jsx`:

```jsx
import FpsCard from './FpsCard'

export default function FpsCardGrid({ rows }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {rows.map((row) => <FpsCard key={row.gameId} row={row} />)}
    </div>
  )
}
```

- [ ] **Step 5: Write `PerformanceReport.jsx`**

Create `src/components/performance/PerformanceReport.jsx`:

```jsx
import FpsCardGrid from './FpsCardGrid'
import { FPS_CAVEAT } from '../../lib/siteContent'

export default function PerformanceReport({ report }) {
  if (!report) return null
  const { coverage } = report
  const nothingCovered = coverage.gamesAnswered === 0

  return (
    <section className="mt-3 rounded-xl border border-line bg-surface-2 p-3.5">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm text-ink">Performance test</h3>
        <span className="text-[11px] text-muted">
          {report.resolution} · {report.presetId}
        </span>
      </header>

      {nothingCovered ? (
        <p className="text-xs leading-relaxed text-muted">
          No benchmark data for these parts yet. The engine only reports figures it
          can trace to a published measurement, so rather than estimate around the
          gap it says nothing. Coverage grows as the benchmark corpus does.
        </p>
      ) : (
        <FpsCardGrid rows={report.games} />
      )}

      {/* text-muted, not text-faint: faint fails WCAG AA for body text, and a
          caveat nobody can read is not a caveat. Same rule as every other piece
          of legal copy in the app. */}
      <footer className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-muted">
        <p>
          {coverage.gamesAnswered} of {coverage.gamesTotal} games estimated
          {coverage.gamesExact > 0 && `, ${coverage.gamesExact} measured directly`} ·
          {' '}model {report.modelVersion} · data as of {report.datasetVersion}
        </p>
        <p className="mt-1">{FPS_CAVEAT}</p>
      </footer>
    </section>
  )
}
```

- [ ] **Step 6: Write `RunPerformanceTest.jsx`**

Create `src/components/RunPerformanceTest.jsx`:

```jsx
import { useMemo, useState } from 'react'
import { estimateBuildPerformance } from '../lib/perfEngine'
import PerformanceReport from './performance/PerformanceReport'

// The click reveals a result that is already computed — there is no spinner and
// no simulated delay. The calculation takes single-digit milliseconds, and
// faking latency in a feature whose entire selling point is honesty would be
// theatre. If the dataset ever makes it genuinely slow, the fix is a real async
// boundary, not a pretend one.
export default function RunPerformanceTest({
  parts, resolution, model, games, presetId = 'high',
}) {
  const [open, setOpen] = useState(false)
  const ready = Boolean(parts?.cpu && parts?.gpu)

  const report = useMemo(
    () => (ready && open
      ? estimateBuildPerformance({ parts, resolution, presetId, model, games })
      : null),
    [ready, open, parts, resolution, presetId, model, games],
  )

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={!ready}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line"
      >
        {open ? 'Hide performance test' : 'Run performance test'}
      </button>

      {!ready && (
        <p className="mt-1.5 text-[11px] text-muted">
          Pick a CPU and a graphics card to run a performance test.
        </p>
      )}

      {open && <PerformanceReport report={report} />}
    </div>
  )
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
npx vitest run src/tests/RunPerformanceTest.test.jsx
```

Expected: **7 passed**.

- [ ] **Step 8: Lint**

```bash
npm run lint
```

Expected: clean. If `react-refresh/only-export-components` fires, a component file is exporting a non-component constant — move it into `src/lib/`, as `PeripheralFilterPanel` had to.

- [ ] **Step 9: Commit**

```bash
git add src/components/RunPerformanceTest.jsx src/components/performance src/tests/RunPerformanceTest.test.jsx
git commit -m "$(cat <<'EOF'
feat: add the Run performance test button and report

Reveals a synchronously-computed result with no fake spinner. Games with no
data say so on the card rather than being dropped or filled in, and the whole
report explains itself when the corpus covers nothing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Wire into the build summary

**Files:**
- Modify: `src/components/BuildSummary.jsx`
- Test: `src/tests/BuildSummary.test.jsx` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/tests/BuildSummary.test.jsx`, inside the existing top-level `describe('BuildSummary', …)`. The file mounts with a bare `render(<BuildSummary />)` after seeding the store in a `beforeEach`; match that, do not introduce a second pattern:

```jsx
  it('offers a performance test alongside the existing frame-rate list', () => {
    // `useCase` must be set explicitly. useBuilderStore is a persisted
    // singleton and this file's beforeEach does not reset that key, so an
    // earlier test in the file leaves 'office' behind — under which
    // `framePaced` is false and the frame-rate toggle is not rendered at all.
    // Two sibling tests already do this for the same reason.
    useBuilderStore.setState({ selectedParts: { cpu, gpu }, useCase: 'gaming' })
    render(<BuildSummary />)
    expect(screen.getByRole('button', { name: /run performance test/i })).toBeInTheDocument()
    // The old list stays. It quotes the old model, which still drives the
    // CustomPC score — the two coexist until Phase 6 migrates it.
    expect(screen.getByRole('button', { name: /frame rates @/i })).toBeInTheDocument()
  })

  it('disables the performance test until a CPU and a GPU are picked', () => {
    useBuilderStore.setState({ selectedParts: { cpu } })
    render(<BuildSummary />)
    expect(screen.getByRole('button', { name: /run performance test/i })).toBeDisabled()
  })
```

`cpu` and `gpu` are the module-level constants the file already defines (`cpu-ryzen-7-7700x` and `gpu-rtx-4060ti`).

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/BuildSummary.test.jsx
```

Expected: FAIL — `Unable to find an accessible element with the role "button" and name /performance test/i`.

- [ ] **Step 3: Wire it in**

In `src/components/BuildSummary.jsx`, add the imports next to the existing `GamePerformanceList` import (line ~13):

```jsx
import RunPerformanceTest from './RunPerformanceTest'
import perfModel from '../data/perfModel.json'
```

Read the games catalogue alongside the parts one, next to the existing `partsData` selector (line ~67):

```jsx
  const gamesData = useCatalogStore((s) => s.games)
```

Then render the button immediately after the closing `)}` of the existing frame-rate block (the one ending around line 217):

```jsx
              <RunPerformanceTest
                parts={selectedParts}
                resolution={resolution}
                model={perfModel}
                games={gamesData}
              />
```

**Leave `GamePerformanceList` exactly where it is.** The two coexist by design: it still quotes the old model, which still drives the CustomPC score. Migrating it is Phase 6, and doing it here would move every rating in the app.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/tests/BuildSummary.test.jsx
```

Expected: all tests in the file pass, including the new one.

- [ ] **Step 5: Run the full suite, lint and build**

```bash
npm run test:run && npm run lint && npm run build
```

Expected: all green. The build must succeed with the empty `perfModel.json` — an artefact with empty objects is valid input.

- [ ] **Step 6: Verify in the browser**

Start the dev server via the preview tool (`.claude/launch.json` entry `dev` → `npm run dev`, port 5173), then:
1. Enter the builder and select any CPU and any GPU.
2. Open the Summary tab.
3. Confirm the **Run performance test** button is present and enabled.
4. Click it. With an empty corpus, expect *"No benchmark data for these parts yet…"* — **that is the correct Phase 1 result**, not a failure.
5. Confirm the existing **Frame rates @ …** disclosure still works and still shows the old model's numbers.
6. Check the console for errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/BuildSummary.jsx src/tests/BuildSummary.test.jsx
git commit -m "$(cat <<'EOF'
feat: offer the performance test from the build summary

Sits alongside the existing frame-rate list rather than replacing it — that
list still quotes the old model, which still drives the CustomPC score.
Migrating it is a separate, separately-measured change.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Seed the corpus and close the loop

The first real data. This is the task that proves the whole pipeline, and it is **not** a code task.

**Files:**
- Modify: `data/benchmarks/*.json` (via the harness), `src/data/perfModel.json` (via the fit)

> ⚠️ **`npm run perf:add` needs a real terminal.** It is interactive and, as Task 8 documents, piping a burst of lines at it drops all but the first. Run it by hand in a TTY; do not try to script it with `printf`.

- [ ] **Step 1: Ask the user before curating**

Entering benchmark data is judgement work about which sources to trust, and the licensing posture depends on the spread. Ask:

> *"The pipeline is ready end to end. To seed it I need benchmark measurements from published reviews — ideally 2 or 3 GPU-scaling reviews (many GPUs, one fixed CPU, 1440p and 4K) and 2 or 3 CPU-scaling reviews (many CPUs, one GPU, 1080p), covering 4 to 6 games. Do you want to pick the sources and enter them yourself with `npm run perf:add`, or shall I propose a source list for you to approve first?"*

Do not enter data from sources the user has not seen. Do not invent measurements under any circumstances — a fabricated benchmark defeats the entire purpose of the feature and contradicts the terms page.

- [ ] **Step 2: Enter the seed corpus**

```bash
npm run perf:add
```

Target for a useful Phase 1: **40–60 entries**, at least 4 games, at least 6 GPUs and 6 CPUs, no source over 15% of entries.

- [ ] **Step 3: Fit**

```bash
npm run perf:fit
```

Expected: a line reporting the entry count and the number of GPU and CPU indices produced. No `FAIL:` line about source concentration.

- [ ] **Step 4: Check the diagnostics**

```bash
node -e "const r=require('./src/data/perfModel.report.json');console.log(JSON.stringify(r,null,2))"
```

Check: `converged: true` on every fit; `coverage` counts look right; `droppedGpuBound` is short (a long list means the CPU-scaling sources were not actually CPU-limited and are the wrong reviews to use); and **`droppedDisconnected` is empty** (anything in it means the corpus has split into islands with no measurement relating them — fix by adding a review that shares a game and a part with both sides, not by changing code).

- [ ] **Step 5: Run the integrity test and the full suite**

```bash
npx vitest run src/tests/perfModelIntegrity.test.js && npm run test:run
```

Expected: all green. `perfModelIntegrity` now audits real rows rather than an empty array, and `legacyEngineUntouched` still passes.

- [ ] **Step 6: Verify in the browser**

Reload the dev server (a long-running tab serves the model it started with — the same trap the parts catalogue has). Select a CPU and GPU that are both in the corpus, run the test, and confirm real numbers appear with the covered games first. Then select a part that is *not* covered and confirm it reports no data rather than a number.

- [ ] **Step 7: Commit**

```bash
git add data/benchmarks src/data/perfModel.json src/data/perfModel.report.json
git commit -m "$(cat <<'EOF'
data: seed the benchmark corpus and fit the first model

First real measurements through the pipeline. Sources spread across outlets,
each entry carrying its provenance, held-out pairs kept out of the fit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 exit criteria

- [ ] `npm run test:run` green, including `legacyEngineUntouched`
- [ ] `npm run lint` clean
- [ ] `npm run build` succeeds
- [ ] `npm run perf:fit` succeeds on both an empty and a populated corpus
- [ ] A build whose CPU and GPU are both in the corpus returns measured frame rates
- [ ] A build with an uncovered part reports "no benchmark data yet" and never a guess
- [ ] `GamePerformanceList`, `partRatings` and `autoBuilder` behave exactly as before
- [ ] No source exceeds 20% of the corpus

## Deviations from the spec, and why

Three places this plan departs from `2026-08-07-performance-engine-design.md`. Each is a deliberate scoping call, not an oversight — raise them with the user if any looks wrong.

1. **§2.3's `gamesData.json` extension is cut back to `slug` alone.** The spec adds `vramNeedGb`, `memorySensitivity`, `minRamGb`, `recRamGb`, `engine` and per-game `presets` in Phase 0. Phase 1 uses none of them — VRAM and memory are Phase 3 — and filling them in now would mean **inventing figures for 22 games**, which the project's standing "do not invent specifications" rule forbids and the terms page contradicts. Real preset names arrive attached to the measurements that use them, via the harness. The rest lands in Phase 3 alongside the code that reads it.

2. **The validation MAPE gate is deferred to Phase 2.** The spec's Phase 1 exit names `mapeAvg ≤ 0.12`. Phase 1 has no interpolation — it answers only where the corpus covers the combination, so held-out error is near zero by construction and the gate would measure nothing. The fit script writes `validation: { n, mapeAvg: null, mapeLow: null }` and the gate turns on in Phase 2, when there is something to validate.

3. **The exact-match table is a new artefact field**, added because §8 Phase 1 requires the short-circuit and the raw corpus never reaches the browser — so measured combinations have to ride in the artefact. `model.exact`, keyed `cpuId|gpuId|gameId|resolution|presetId`, averaged in frame time across sources. **The spec's §2.4 has already been updated to match**, so the two documents are in sync; keep them that way if the shape changes during implementation.

## What Phase 1 deliberately does not do

Interpolation between measured parts, the `perfScore` fallback prior, confidence scoring, 1% lows, RAM and VRAM adjustment, bottleneck panel, power, refresh recommendation, value scoring, shareable reports. Each is specified in the design document and scheduled in §8. **Do not pull any of them forward** — Phase 2's job is to fill the gaps Phase 1 leaves visible, and it needs those gaps visible to know it worked.
