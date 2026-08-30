# Performance Corpus Expansion (Phases A–C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Performance tab list every game the corpus measures and only those, and roughly triple what it can answer by declaring three more Notebookcheck benches and mapping the mainstream titles those benches carry.

**Architecture:** A new editorial metadata file, `data/games/gameMeta.json`, becomes the single list of game ids the corpus is *allowed* to hold, with display names and preset labels. A new pure module derives `src/data/perfGames.json` from the corpus intersected with that metadata, so the shipped game list is generated rather than hand-maintained, and a test fails if it drifts in either direction. The Notebookcheck reader then gains more title mappings and the fetch script gains more declared benches, each with its memory specification verified from a review that states it.

**Tech Stack:** Node 20 ESM scripts under `scripts/`, zero-import pure modules under `src/lib/perfEngine/`, Vitest, plain JSON data files. No new dependencies.

**Node is not on the bash PATH on this machine.** Every command below assumes PowerShell with `$env:PATH = "C:\Program Files\nodejs;$env:PATH"` already applied, or a shell where `node` resolves.

---

## File Structure

**Created:**
- `data/games/gameMeta.json` — editorial metadata: which game ids may exist, their display name and slug, the canonical preset ladder, and per-game preset label overrides. The *permitted* set; not the *listed* set.
- `src/lib/perfEngine/perfGamesList.js` — pure `buildPerfGames({ meta, entries, legacy })`. Zero imports so plain Node in `scripts/` can load it, matching `concentration.js` and `archEfficiency.js`.
- `scripts/build-perf-games.mjs` — thin wrapper: read, build, refuse on problems, write `src/data/perfGames.json`.
- `src/tests/perfGamesList.test.js` — unit tests for the pure builder.
- `src/tests/perfGames.test.js` — the drift gate, run against the real corpus.

**Modified:**
- `scripts/import-bench-tsv.mjs:61` — validate game ids against `gameMeta ∪ gamesData`, not `perfGames ∪ gamesData`. This breaks the circularity: a new title cannot be imported while the list it must appear in is derived from imports.
- `scripts/add-bench-entry.mjs:25` — same union, for the interactive path.
- `src/tests/perfModelIntegrity.test.js:11` — same union.
- `src/lib/perfEngine/notebookcheck.js:41-76` — more titles in `GAME_IDS`, more benches' CPUs in `CPU_IDS`.
- `scripts/fetch-notebookcheck.mjs:37-67` — more entries in `BENCHES`.
- `src/data/perfGames.json` — becomes generated output.
- `package.json:20` — add `"perf:games": "node scripts/build-perf-games.mjs"`.

**Not touched:** `src/data/gamesData.json`, the Supabase `games` table, `partsData.json`, anything the legacy CustomPC score reads. `legacyEngineUntouched.test.js` must stay green throughout.

---

## Baseline — capture before changing anything

### Task 0: Record the starting position

**Files:**
- Create: `scratch/coverage-sweep.mjs` (throwaway, deleted in Task 12 — do NOT commit)
- Modify: `.gitignore`

- [ ] **Step 1: Keep the scratch directory out of git**

`scratch/` is not currently ignored, and the sweep script has to live inside the
repo because it imports `../src/lib/perfEngine/index.js` — vite-node resolves it
relative to the file. Add to `.gitignore`, after the `.superpowers/` block:

```
# Throwaway measurement scripts (coverage sweeps, before/after captures)
scratch/
```

```bash
git add .gitignore
git commit -m "chore: ignore the scratch directory used for measurement sweeps"
```

- [ ] **Step 2: Write the sweep script**

Create `scratch/coverage-sweep.mjs`:

```js
// Throwaway. Reports what the REAL engine answers for a fixed set of builds, so
// every claim in this plan is a measurement rather than a row count. Run through
// vite-node: plain node cannot resolve this project's extensionless imports.
import { estimateBuildPerformance } from '../src/lib/perfEngine/index.js'
import model from '../src/data/perfModel.json'
import games from '../src/data/perfGames.json'
import parts from '../src/data/partsData.json'

const byId = (id) => parts.find((p) => p.id === id)

// Four builds quoted in the spec, plus two the new benches should newly cover.
const COMBOS = [
  ['cpu-ryzen-7-9800x3d', 'gpu-rtx-4070'],
  ['cpu-ryzen-7-9800x3d', 'gpu-rtx-5090'],
  ['cpu-i5-13600k', 'gpu-rtx-4060'],
  ['cpu-ryzen-5-5600', 'gpu-gtx-1660s'],
  ['cpu-i9-14900k', 'gpu-rx-6800'],
  ['cpu-ryzen-9-7950x', 'gpu-rtx-4070'],
]

for (const [cpuId, gpuId] of COMBOS) {
  const cpu = byId(cpuId)
  const gpu = byId(gpuId)
  if (!cpu || !gpu) { console.log(`MISSING PART ${cpuId} / ${gpuId}`); continue }
  for (const res of ['1080p', '1440p', '4k']) {
    const r = estimateBuildPerformance({
      parts: { cpu, gpu }, resolution: res, presetId: 'high', model, games,
    })
    const c = r.coverage
    const presets = [...new Set(r.games.filter((g) => g.basis !== 'none').map((g) => g.preset))]
    console.log(
      `${cpuId.padEnd(22)} ${gpuId.padEnd(16)} ${res.padEnd(6)} ` +
      `answered ${String(c.gamesAnswered).padStart(2)}/${String(c.gamesTotal).padStart(2)}  ` +
      `measured ${String(c.gamesExact).padStart(2)}  ` +
      `modelled ${String(c.gamesAnswered - c.gamesExact).padStart(2)}  ` +
      `copiedRes=${c.gpuResolutionCopied ? 'y' : 'n'}  presets[${presets.join(', ')}]`,
    )
  }
}
```

- [ ] **Step 3: Run it and save the output**

Run: `npx vite-node scratch/coverage-sweep.mjs > scratch/before.txt; type scratch\before.txt`

Expected: 18 lines. The first four builds should reproduce the spec's figures — `gpu-rtx-4070` at 1440p answering 8 of 24, `cpu-i5-13600k` answering 0 at every resolution. If they do not, stop and reconcile before continuing; the plan's premise is wrong.

- [ ] **Step 4: Record the model's own counters**

Run: `node -e "const m=require('./src/data/perfModel.json');console.log('entries',m.entryCount,'sources',m.sourceCount,'gpuIdx',Object.keys(m.gpuIndex).length,'cpuIdx',Object.keys(m.cpuIndex).length,'games',Object.keys(m.gameConst).length)"`

Expected: `entries 804 sources 22 gpuIdx 39 cpuIdx 12 games 21`

Write both outputs into the task's completion note. Do not commit `scratch/`.

---

## Phase A — list what is already measured

### Task 1: The editorial metadata file

**Files:**
- Create: `data/games/gameMeta.json`

**This file is the PERMITTED set, which is a superset of the LISTED set.** It needs
a row for every id the corpus holds *and* every id any reader maps, because a
mapped title can start producing rows at any import and `buildPerfGames` refuses
to invent a display name for one it does not know. The corpus holds 22 game ids
and 9 preset ids; `GAME_IDS` in `notebookcheck.js` maps a further nine that have
no measurements yet (`elden-ring`, `rdr2`, `fortnite`, `apex`, `marvel-rivals`,
`dragon-age-veilguard`, `silent-hill-2`, `satisfactory`, `frostpunk-2`). All 31
go in. The first five carry names copied verbatim from `gamesData.json`, because
Task 3's "never contradicts the legacy list" test compares them.

- [ ] **Step 1: Create the file**

Preset tiers follow `CANONICAL_PRESETS` in `src/lib/gamePresets.js` (low 1, medium 2, high 3, ultra 4). `sehr-hoch` is German for "very high" and is already tier 4 in the current `perfGames.json`, so `very-high` is tier 4 too — they are the same rung named by two outlets.

Create `data/games/gameMeta.json`:

```json
{
  "_comment": "Editorial metadata for the performance corpus. This is the set of game ids the corpus is ALLOWED to hold, and it is a SUPERSET of what ships: the importer validates against it, and build-perf-games.mjs emits perfGames.json for the subset that has measurements. Every id any reader maps needs a row here, measured or not, because a mapped title can start producing rows at any import and the builder will not invent a display name. Display names belong to the id and are shared by every outlet; an outlet's own spelling belongs in that outlet's reader (GAME_IDS in notebookcheck.js).",
  "presets": {
    "low": { "label": "Low", "tier": 1 },
    "medium": { "label": "Medium", "tier": 2 },
    "high": { "label": "High", "tier": 3 },
    "very-high": { "label": "Very high", "tier": 4 },
    "ultra": { "label": "Ultra", "tier": 4 },
    "epic": { "label": "Epic", "tier": 4 },
    "sehr-hoch": { "label": "Sehr hoch", "tier": 4 },
    "kino": { "label": "Kino", "tier": 4 },
    "max-details": { "label": "Max. Details", "tier": 4 }
  },
  "games": {
    "alan-wake-2": { "name": "Alan Wake 2", "slug": "alan-wake-2" },
    "apex": { "name": "Apex Legends", "slug": "apex-legends" },
    "bg3": { "name": "Baldur's Gate 3", "slug": "baldurs-gate-3" },
    "black-myth-wukong": { "name": "Black Myth: Wukong", "slug": "black-myth-wukong" },
    "cod-black-ops-6": { "name": "Call of Duty: Black Ops 6", "slug": "call-of-duty-black-ops-6" },
    "cs2": { "name": "Counter-Strike 2", "slug": "counter-strike-2" },
    "cyberpunk": { "name": "Cyberpunk 2077", "slug": "cyberpunk-2077" },
    "doom-the-dark-ages": {
      "name": "Doom: The Dark Ages", "slug": "doom-the-dark-ages",
      "presetLabels": { "max-details": "Max. Details, TAA nativ" }
    },
    "dragon-age-veilguard": { "name": "Dragon Age: The Veilguard", "slug": "dragon-age-the-veilguard" },
    "dragons-dogma-2": { "name": "Dragon's Dogma 2", "slug": "dragons-dogma-2" },
    "elden-ring": { "name": "Elden Ring", "slug": "elden-ring" },
    "f1-24": { "name": "F1 24", "slug": "f1-24" },
    "final-fantasy-16": { "name": "Final Fantasy XVI", "slug": "final-fantasy-xvi" },
    "fortnite": { "name": "Fortnite", "slug": "fortnite" },
    "frostpunk-2": { "name": "Frostpunk 2", "slug": "frostpunk-2" },
    "ghost-of-tsushima": { "name": "Ghost of Tsushima", "slug": "ghost-of-tsushima" },
    "god-of-war-ragnarok": { "name": "God of War Ragnarök", "slug": "god-of-war-ragnarok" },
    "hellblade-2": { "name": "Senua's Saga: Hellblade II", "slug": "senuas-saga-hellblade-2" },
    "helldivers2": { "name": "Helldivers 2", "slug": "helldivers-2" },
    "hogwarts": { "name": "Hogwarts Legacy", "slug": "hogwarts-legacy" },
    "horizon-forbidden-west": { "name": "Horizon Forbidden West", "slug": "horizon-forbidden-west" },
    "indiana-jones-great-circle": { "name": "Indiana Jones and the Great Circle", "slug": "indiana-jones-and-the-great-circle" },
    "kingdom-come-deliverance-2": { "name": "Kingdom Come: Deliverance 2", "slug": "kingdom-come-deliverance-2" },
    "marvel-rivals": { "name": "Marvel Rivals", "slug": "marvel-rivals" },
    "rdr2": { "name": "Red Dead Redemption 2", "slug": "red-dead-redemption-2" },
    "satisfactory": { "name": "Satisfactory", "slug": "satisfactory" },
    "silent-hill-2": { "name": "Silent Hill 2", "slug": "silent-hill-2" },
    "space-marine-2": { "name": "Warhammer 40,000: Space Marine 2", "slug": "warhammer-40k-space-marine-2" },
    "stalker-2": { "name": "S.T.A.L.K.E.R. 2: Heart of Chornobyl", "slug": "stalker-2-heart-of-chornobyl" },
    "star-wars-outlaws": { "name": "Star Wars Outlaws", "slug": "star-wars-outlaws" },
    "starfield": { "name": "Starfield", "slug": "starfield" }
  }
}
```

The nine ids with no measurements yet (`apex`, `dragon-age-veilguard`,
`elden-ring`, `fortnite`, `frostpunk-2`, `marvel-rivals`, `rdr2`, `satisfactory`,
`silent-hill-2`) are permitted but will not be listed — `buildPerfGames` only
emits ids the corpus measures. Four of them gain measurements in Phase B; the
rest are pruned in Task 11 if they still have none.

- [ ] **Step 2: Verify it covers the corpus exactly**

Run:

```bash
node -e "const m=require('./data/games/gameMeta.json'),e=require('./data/benchmarks/entries.json'),l=require('./src/data/gamesData.json');const g=new Set(e.map(x=>x.gameId)),p=new Set(e.map(x=>x.presetId));console.log('ids:',Object.keys(m.games).length);console.log('games missing from meta:',[...g].filter(x=>!m.games[x]).join(', ')||'none');console.log('presets missing from meta:',[...p].filter(x=>!m.presets[x]).join(', ')||'none');const byId=new Map(l.map(x=>[x.id,x]));console.log('name clashes with the legacy list:',Object.entries(m.games).filter(([id,v])=>byId.has(id)&&byId.get(id).name!==v.name).map(([id])=>id).join(', ')||'none')"
```

Expected:

```
ids: 31
games missing from meta: none
presets missing from meta: none
name clashes with the legacy list: none
```

A name clash fails Task 3's `never contradicts the legacy list about a shared id`
test — fix it here by copying the legacy name verbatim, not there.

- [ ] **Step 3: Commit**

```bash
git add data/games/gameMeta.json
git commit -m "feat: add the editorial metadata the game list is derived from"
```

---

### Task 2: The pure builder

**Files:**
- Create: `src/lib/perfEngine/perfGamesList.js`
- Test: `src/tests/perfGamesList.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/perfGamesList.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildPerfGames } from '../lib/perfEngine/perfGamesList'

const META = {
  presets: {
    low: { label: 'Low', tier: 1 },
    high: { label: 'High', tier: 3 },
    ultra: { label: 'Ultra', tier: 4 },
    'sehr-hoch': { label: 'Sehr hoch', tier: 4 },
  },
  games: {
    alpha: { name: 'Alpha', slug: 'alpha' },
    beta: { name: 'Beta', slug: 'beta', presetLabels: { ultra: 'Ultra, all details' } },
  },
}

const entry = (over) => ({
  gameId: 'alpha', presetId: 'high', supersededBy: null, ...over,
})

describe('buildPerfGames', () => {
  it('lists only games the corpus measures', () => {
    const { games, problems } = buildPerfGames({ meta: META, entries: [entry()] })
    expect(problems).toEqual([])
    expect(games.map((g) => g.id)).toEqual(['alpha'])
  })

  it('drops a game whose only entries are superseded', () => {
    const { games } = buildPerfGames({
      meta: META, entries: [entry({ gameId: 'beta', supersededBy: 'be-newer' })],
    })
    expect(games.map((g) => g.id)).toEqual([])
  })

  it('orders presets lowest tier first, because resolvePreset breaks ties on array order', () => {
    const { games } = buildPerfGames({
      meta: META,
      entries: [entry({ presetId: 'ultra' }), entry({ presetId: 'low' }), entry()],
    })
    expect(games[0].presets.map((p) => p.id)).toEqual(['low', 'high', 'ultra'])
    expect(games[0].presets.map((p) => p.tier)).toEqual([1, 3, 4])
  })

  it('breaks a tier tie on measurement count, so the output is deterministic', () => {
    const { games } = buildPerfGames({
      meta: META,
      entries: [
        entry({ presetId: 'ultra' }),
        entry({ presetId: 'sehr-hoch' }), entry({ presetId: 'sehr-hoch' }),
      ],
    })
    expect(games[0].presets.map((p) => p.id)).toEqual(['sehr-hoch', 'ultra'])
  })

  it('prefers a per-game preset label over the canonical one', () => {
    const { games } = buildPerfGames({
      meta: META, entries: [entry({ gameId: 'beta', presetId: 'ultra' })],
    })
    expect(games[0].presets[0].label).toBe('Ultra, all details')
  })

  it('carries fpsCap across from the legacy list where the id matches', () => {
    const { games } = buildPerfGames({
      meta: META, entries: [entry()], legacy: [{ id: 'alpha', fpsCap: 60 }],
    })
    expect(games[0].fpsCap).toBe(60)
  })

  it('omits fpsCap entirely when the legacy list has none', () => {
    const { games } = buildPerfGames({ meta: META, entries: [entry()], legacy: [{ id: 'alpha' }] })
    expect(games[0]).not.toHaveProperty('fpsCap')
  })

  it('reports a measured game with no metadata instead of inventing a name', () => {
    const { games, problems } = buildPerfGames({
      meta: META, entries: [entry({ gameId: 'gamma' })],
    })
    expect(games.map((g) => g.id)).toEqual([])
    expect(problems.join(' ')).toMatch(/gamma/)
  })

  it('reports a preset with no metadata rather than guessing its tier', () => {
    const { problems } = buildPerfGames({
      meta: META, entries: [entry({ presetId: 'cinematic' })],
    })
    expect(problems.join(' ')).toMatch(/cinematic/)
  })

  it('is sorted by id, so the diff is stable across runs', () => {
    const { games } = buildPerfGames({
      meta: META, entries: [entry({ gameId: 'beta' }), entry({ gameId: 'alpha' })],
    })
    expect(games.map((g) => g.id)).toEqual(['alpha', 'beta'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/perfGamesList.test.js`
Expected: FAIL — cannot resolve `../lib/perfEngine/perfGamesList`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/perfEngine/perfGamesList.js`:

```js
// Derives the Performance tab's game list from the corpus.
//
// A game is listed because the corpus MEASURES it, never because somebody typed
// it in. The nine titles that used to sit in perfGames.json with no measurement
// anywhere were not a data problem — they were a list nobody could keep true by
// hand. This makes the list a consequence of the data, and perfGames.test.js
// fails the build when the file drifts from it in either direction.
//
// Zero imports: scripts/ runs this under plain Node, which cannot resolve this
// project's extensionless relative imports.

// Editorial metadata is REQUIRED, never defaulted. A missing name would fall
// back to the id and ship "black-myth-wukong" to a reader as a game title; a
// missing preset tier would have to be guessed, and the tier is what
// resolvePreset compares when a game lacks the preset the caller asked for.
export function buildPerfGames({ meta, entries, legacy = [] }) {
  const problems = []
  const live = entries.filter((e) => !e.supersededBy)

  const fpsCapById = new Map(
    legacy.filter((g) => g.fpsCap != null).map((g) => [g.id, g.fpsCap]),
  )

  // gameId -> presetId -> how many live entries use it
  const seen = new Map()
  for (const e of live) {
    if (!seen.has(e.gameId)) seen.set(e.gameId, new Map())
    const presets = seen.get(e.gameId)
    presets.set(e.presetId, (presets.get(e.presetId) ?? 0) + 1)
  }

  const games = []
  for (const [gameId, presetCounts] of [...seen].sort((a, b) => a[0].localeCompare(b[0]))) {
    const gameMeta = meta.games[gameId]
    if (!gameMeta) {
      problems.push(`"${gameId}" is measured by the corpus but has no gameMeta entry — ` +
                    'add a display name and slug rather than defaulting to the id')
      continue
    }

    const presets = []
    for (const [presetId, count] of presetCounts) {
      const presetMeta = meta.presets[presetId]
      if (!presetMeta) {
        problems.push(`preset "${presetId}" (used by ${gameId}) has no gameMeta entry — ` +
                      'its tier cannot be guessed, it is what preset fallback compares')
        continue
      }
      presets.push({
        id: presetId,
        label: gameMeta.presetLabels?.[presetId] ?? presetMeta.label,
        tier: presetMeta.tier,
        count,
      })
    }
    if (presets.length === 0) continue

    // Lowest tier first. resolvePreset in gamePresets.js breaks an EXACT TIE on
    // array order — its own comment says "write them lowest tier first" — so
    // this sort decides which preset the page quotes when two share a tier.
    // Count then id break the remaining ties, so two runs over the same corpus
    // produce byte-identical output.
    presets.sort((a, b) => a.tier - b.tier || b.count - a.count || a.id.localeCompare(b.id))

    const game = {
      id: gameId,
      name: gameMeta.name,
      slug: gameMeta.slug,
      presets: presets.map(({ id, label, tier }) => ({ id, label, tier })),
    }
    // An engine cap floors the frame rate and the 1% low alike. It is a property
    // of the GAME, so it is carried across from the legacy list rather than
    // restated — one hard-locked title, one place it is recorded.
    const cap = fpsCapById.get(gameId)
    if (cap != null) game.fpsCap = cap

    games.push(game)
  }

  return { games, problems }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tests/perfGamesList.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfEngine/perfGamesList.js src/tests/perfGamesList.test.js
git commit -m "feat: derive the performance game list from the corpus"
```

---

### Task 3: The generator script and the drift gate

**Files:**
- Create: `scripts/build-perf-games.mjs`
- Modify: `package.json`
- Test: `src/tests/perfGames.test.js`

- [ ] **Step 1: Write the failing drift test**

Create `src/tests/perfGames.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildPerfGames } from '../lib/perfEngine/perfGamesList'
import perfGames from '../data/perfGames.json'
import legacyGames from '../data/gamesData.json'
import meta from '../../data/games/gameMeta.json'
import entries from '../../data/benchmarks/entries.json'

// The gate. perfGames.json is generated by `npm run perf:games`, and this fails
// when the committed file no longer matches what the corpus would produce —
// which is what happens when somebody imports measurements and forgets to
// regenerate, exactly as sitemap.test.js guards `npm run sitemap`.
describe('perfGames.json is derived from the corpus', () => {
  const built = buildPerfGames({ meta, entries, legacy: legacyGames })

  it('builds without problems against the real corpus', () => {
    expect(built.problems).toEqual([])
  })

  it('matches the committed file exactly — run `npm run perf:games` if this fails', () => {
    expect(perfGames).toEqual(built.games)
  })

  it('lists no game the corpus does not measure', () => {
    const measured = new Set(entries.filter((e) => !e.supersededBy).map((e) => e.gameId))
    const listed = perfGames.map((g) => g.id)
    expect(listed.filter((id) => !measured.has(id))).toEqual([])
  })

  it('lists every game the corpus does measure', () => {
    const measured = [...new Set(entries.filter((e) => !e.supersededBy).map((e) => e.gameId))]
    const listed = new Set(perfGames.map((g) => g.id))
    expect(measured.filter((id) => !listed.has(id))).toEqual([])
  })

  it('lists no preset the corpus does not hold for that game', () => {
    const held = new Map()
    for (const e of entries.filter((x) => !x.supersededBy)) {
      if (!held.has(e.gameId)) held.set(e.gameId, new Set())
      held.get(e.gameId).add(e.presetId)
    }
    const stray = []
    for (const g of perfGames) {
      for (const p of g.presets) if (!held.get(g.id)?.has(p.id)) stray.push(`${g.id}|${p.id}`)
    }
    expect(stray).toEqual([])
  })

  it('has unique ids', () => {
    expect(new Set(perfGames.map((g) => g.id)).size).toBe(perfGames.length)
  })

  it('never contradicts the legacy list about a shared id', () => {
    // cs2, cyberpunk, bg3 and friends exist in both. Two different display names
    // for one id would show a reader two different games depending on which
    // screen they are on.
    const legacyById = new Map(legacyGames.map((g) => [g.id, g]))
    const clashes = perfGames
      .filter((g) => legacyById.has(g.id) && legacyById.get(g.id).name !== g.name)
      .map((g) => `${g.id}: "${g.name}" vs "${legacyById.get(g.id).name}"`)
    expect(clashes).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/tests/perfGames.test.js`
Expected: FAIL — the committed `perfGames.json` still holds the nine unmeasured games and lacks the seven measured ones.

- [ ] **Step 3: Write the generator**

Create `scripts/build-perf-games.mjs`:

```js
// Regenerates src/data/perfGames.json from the benchmark corpus.
//
//   npm run perf:games
//
// Run it after EVERY import, alongside npm run perf:fit. perfGames.test.js is
// the enforcement — it fails when the committed file drifts from what the
// corpus would produce, the same contract sitemap.test.js holds over
// npm run sitemap.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'
import { buildPerfGames } from '../src/lib/perfEngine/perfGamesList.js'

const path = (rel) => fileURLToPath(new URL(rel, import.meta.url))
const read = (rel) => JSON.parse(readFileSync(path(rel), 'utf8'))

const meta = read('../data/games/gameMeta.json')
const entries = read('../data/benchmarks/entries.json')
const legacy = read('../src/data/gamesData.json')

const { games, problems } = buildPerfGames({ meta, entries, legacy })

if (problems.length) {
  console.error('Refusing to write the game list:\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error('\nEvery measured game needs a row in data/games/gameMeta.json.')
  exit(1)
}

const before = read('../src/data/perfGames.json')
// Written LF, like every other script-generated artefact here (perfModel.json,
// entries.json, sources.json). The hand-edited file was CRLF, so the first run
// rewrites every line — that is a one-time change and the commit message says so.
writeFileSync(path('../src/data/perfGames.json'), `${JSON.stringify(games, null, 2)}\n`)

const beforeIds = new Set(before.map((g) => g.id))
const afterIds = new Set(games.map((g) => g.id))
const added = [...afterIds].filter((id) => !beforeIds.has(id))
const removed = [...beforeIds].filter((id) => !afterIds.has(id))

console.log(`Wrote ${games.length} games (was ${before.length}).`)
if (added.length) console.log(`  added:   ${added.join(', ')}`)
if (removed.length) console.log(`  removed: ${removed.join(', ')} — no measurements in the corpus`)
```

- [ ] **Step 4: Add the npm script**

In `package.json`, after the `"perf:fit"` line, add:

```json
    "perf:games": "node scripts/build-perf-games.mjs",
```

- [ ] **Step 5: Run the generator**

Run: `npm run perf:games`

Expected output — 22 games written, was 24:

```
Wrote 22 games (was 24).
  added:   alan-wake-2, bg3, cs2, cyberpunk, helldivers2, hogwarts, starfield
  removed: dragon-age-veilguard, empire-of-the-ants, frostpunk-2, lego-horizon-adventures, mechwarrior-5-clans, outcast-a-new-beginning, satisfactory, silent-hill-2, spider-man-2 — no measurements in the corpus
```

If the `added`/`removed` lists differ from this, stop: the corpus is not what this plan measured it to be.

- [ ] **Step 6: Run the drift test to verify it passes**

Run: `npx vitest run src/tests/perfGames.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/build-perf-games.mjs src/tests/perfGames.test.js src/data/perfGames.json
git commit -m "feat: generate the game list, listing the seven measured games it hid

The list was hand-maintained and had drifted both ways: cyberpunk, bg3,
starfield, hogwarts, alan-wake-2, helldivers2 and cs2 all had fitted cells
and none were listed, so their measurements could not reach a user; nine
listed titles had no measurement anywhere. Generated from the corpus now,
with a test that fails on drift. The file changes from CRLF to LF as a
one-time consequence of being written by a script."
```

---

### Task 4: Point the intake at the metadata, not the output

`import-bench-tsv.mjs` validates incoming game ids against `perfGames ∪ gamesData`. Now that `perfGames.json` is derived from what has been imported, a new title can never be imported: it is absent from the list until it is imported, and refused at import because it is absent from the list. The permitted set has to be the metadata.

**Files:**
- Modify: `scripts/import-bench-tsv.mjs:56-61`
- Modify: `scripts/add-bench-entry.mjs:23-25`
- Modify: `src/tests/perfModelIntegrity.test.js:4-11`

- [ ] **Step 1: Change the importer's union**

In `scripts/import-bench-tsv.mjs`, replace lines 56–61:

```js
// The engine's game list is driven by what has actually been MEASURED, not by
// the legacy catalogue — reviews benchmark what is new, and almost none of the
// 22 legacy rows appear in a modern GPU roundup. perfGames.json is the
// data-backed list; gamesData.json stays in the union so any legacy id that
// does turn up in a review is still importable.
const games = [...read('../src/data/perfGames.json'), ...read('../src/data/gamesData.json')]
```

with:

```js
// Validated against the PERMITTED set, not the LISTED one. perfGames.json is
// derived from what has been imported, so validating against it would make a
// new title unimportable: absent from the list until imported, refused at
// import because it is absent from the list. gameMeta.json is the editorial
// list of ids the corpus may hold; gamesData.json stays in the union so any
// legacy id that does turn up in a review is still importable.
const meta = read('../data/games/gameMeta.json')
const games = [
  ...Object.keys(meta.games).map((id) => ({ id })),
  ...read('../src/data/gamesData.json'),
]
```

- [ ] **Step 2: Change the interactive script's union**

In `scripts/add-bench-entry.mjs`, replace lines 23–25:

```js
// Measured games first (see perfGames.json), legacy catalogue games after, so
// the common case is at the top of the picker.
const games = [...read('../src/data/perfGames.json'), ...read('../src/data/gamesData.json')]
```

with:

```js
// Measured games first (perfGames.json is derived from the corpus, so these are
// the ones a review is most likely to be adding to), then every other permitted
// id from gameMeta.json, then the legacy catalogue — so the common case is at
// the top of the picker and nothing permitted is unreachable.
const measured = read('../src/data/perfGames.json')
const meta = read('../data/games/gameMeta.json')
const measuredIds = new Set(measured.map((g) => g.id))
const games = [
  ...measured,
  ...Object.entries(meta.games)
    .filter(([id]) => !measuredIds.has(id))
    .map(([id, g]) => ({ id, name: g.name })),
  ...read('../src/data/gamesData.json'),
]
```

- [ ] **Step 3: Change the integrity test's union**

In `src/tests/perfModelIntegrity.test.js`, replace lines 4–11:

```js
import perfGames from '../data/perfGames.json'
import legacyGames from '../data/gamesData.json'

// The corpus may cite either a measured game or a legacy catalogue one, so the
// audit resolves ids against the union — the same list the curation scripts
// build. Auditing against the legacy 22 alone would reject every real entry,
// because modern GPU roundups benchmark almost none of them.
const gamesData = [...perfGames, ...legacyGames]
```

with:

```js
import legacyGames from '../data/gamesData.json'
import gameMeta from '../../data/games/gameMeta.json'

// The corpus may cite any PERMITTED game id, so the audit resolves against
// gameMeta plus the legacy catalogue — the same union the curation scripts use.
// Not perfGames.json: that is derived from the corpus, so auditing the corpus
// against it would be circular, and auditing against the legacy 22 alone would
// reject every real entry, because modern GPU roundups benchmark almost none of
// them.
const gamesData = [
  ...Object.keys(gameMeta.games).map((id) => ({ id })),
  ...legacyGames,
]
```

- [ ] **Step 4: Fix the reader test, which has the same circularity**

`src/tests/notebookcheck.test.js:44-59` asserts every mapped id resolves against
`perfGames ∪ legacyGames`, with the titles listed by hand. Task 3 removed
`dragon-age-veilguard`, `silent-hill-2`, `satisfactory` and `frostpunk-2` from
`perfGames.json`, and none of the four is in the legacy list — so this test is
red right now. Resolving against `gameMeta` fixes it, and deriving the titles
from `GAME_IDS` means a mapping added later cannot skip the check.

First export the map. In `src/lib/perfEngine/notebookcheck.js`, change:

```js
const GAME_IDS = {
```

to:

```js
export const GAME_IDS = {
```

Then in `src/tests/notebookcheck.test.js`, replace lines 3–4:

```js
import perfGames from '../data/perfGames.json'
import legacyGames from '../data/gamesData.json'
```

with:

```js
import legacyGames from '../data/gamesData.json'
import gameMeta from '../../data/games/gameMeta.json'
```

and add `GAME_IDS` to the import on line 1. Then replace the whole
`describe('the game map resolves against the game lists', …)` block with:

```js
// A mapped id that exists in NEITHER list fails at import time with a whole file
// already written, so it is caught here instead. Resolved against gameMeta — the
// PERMITTED set — not perfGames, which is derived from what has been imported
// and so cannot vouch for a title that has not been imported yet.
//
// Derived from GAME_IDS rather than listed by hand: a hand-written list silently
// stops covering the mappings added after it.
describe('the game map resolves against the permitted ids', () => {
  it('every mapped id is a permitted game', () => {
    const ids = new Set([
      ...Object.keys(gameMeta.games),
      ...legacyGames.map((g) => g.id),
    ])
    const unknown = Object.entries(GAME_IDS)
      .filter(([, id]) => !ids.has(id))
      .map(([title, id]) => `"${title}" -> ${id}`)
    expect(unknown).toEqual([])
  })

  it('maps at least the titles the corpus already covers', () => {
    // A shared game is what connects a new source to the existing fit. Without
    // one the corpus splits into islands and the new parts get dropped.
    for (const title of ['Ghost of Tsushima', 'Black Myth: Wukong', 'Stalker 2']) {
      expect(gameIdFor(title), `"${title}" is not mapped`).toBeTruthy()
    }
  })

  it('maps no title to an id twice, which would merge two games into one', () => {
    const ids = Object.values(GAME_IDS)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dupes).toEqual([])
  })
})
```

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: all green. Test count rises by 16 from the two new files (9 from Task 2, 7 from Task 3), and `notebookcheck.test.js` gains 1 (its one hand-listed test becomes three). Note the exact count for later comparison.

- [ ] **Step 6: Prove a new id is now importable**

Run:

```bash
node -e "const{readFileSync}=require('fs');const m=JSON.parse(readFileSync('data/games/gameMeta.json','utf8'));const p=JSON.parse(readFileSync('src/data/perfGames.json','utf8'));console.log('permitted ids:',Object.keys(m.games).length,' listed:',p.length)"
```

Expected: `permitted ids: 31  listed: 22`. Permitted exceeding listed is the point
— that gap is what makes a new title importable. Task 8 and Task 10 grow the
first number; imports grow the second.

- [ ] **Step 7: Commit**

```bash
git add scripts/import-bench-tsv.mjs scripts/add-bench-entry.mjs src/tests/perfModelIntegrity.test.js src/tests/notebookcheck.test.js src/lib/perfEngine/notebookcheck.js
git commit -m "fix: validate imports against the permitted ids, not the derived list

perfGames.json is now derived from the corpus, so validating an import
against it made a new title unimportable: absent from the list until
imported, refused at import because it is absent from the list. The reader
test had the same circularity and is now derived from GAME_IDS, so a
mapping added later cannot skip the check."
```

---

### Task 5: Measure what Phase A did

**Files:**
- Modify: `scratch/coverage-sweep.mjs` (no change; re-run only)

- [ ] **Step 1: Re-run the sweep**

Run: `npx vite-node scratch/coverage-sweep.mjs > scratch/after-a.txt`

- [ ] **Step 2: Diff it against the baseline**

Run: `npx diff scratch/before.txt scratch/after-a.txt` (or `Compare-Object (Get-Content scratch\before.txt) (Get-Content scratch\after-a.txt)`)

Expected direction, to be replaced by the real figures in the completion note:
- `gamesTotal` falls 24 → 22 on every row.
- `gamesAnswered` rises materially for the covered builds — the seven newly listed games all have fitted cells.
- **The `presets[...]` column changes.** Most games now list a real `high` preset from Notebookcheck, so `resolvePreset(game, 'high')` finds an exact match where it previously fell back to the top tier. This is a genuine behaviour change and it is the correct one: `PerformanceScreen` hardcodes `presetId: 'high'` and its blurb says "At {resolution}, High preset" while the cards showed "Kino" and "Sehr hoch". The page now quotes the preset it claims to.

- [ ] **Step 3: Apply the coverage rule**

If `gamesAnswered` for `cpu-ryzen-7-9800x3d / gpu-rtx-4070 / 1440p` has **fallen** relative to the baseline, the preset switch has cost more coverage than the new games gained. In that case — and only in that case — stop and report to the user with both sweeps before proceeding; the fix would be a `presetId` change in `PerformanceScreen`, which is UI-phase work and outside this plan.

Otherwise record both numbers and continue.

---

## Phase B — declare three more Notebookcheck benches

### Task 6: Verify each bench's memory specification

This is research, and it gates the phase. **A bench whose memory specification cannot be read off a Notebookcheck review that states it is not declared.** The 13900K bench runs DDR5-6400 where the other three run DDR5-6000 — one shared default would have filed a wrong figure against 17 rows, which is exactly why this is looked up rather than assumed.

**Files:**
- None yet. This task produces findings for Task 7.

- [ ] **Step 1: Confirm which benches carry the volume**

Create `scratch/bench-census.mjs`:

```js
// Which test-system CPUs the cached Notebookcheck pages actually name, and how
// much each carries. Run before declaring a bench: the volume decides which are
// worth verifying, and the exact CPU string is what CPU_IDS has to match.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { extractRows, cpuIdFor } from '../src/lib/perfEngine/notebookcheck.js'

const dir = join(tmpdir(), 'custompc-nbc-cache')
const benches = new Map()

for (const f of readdirSync(dir)) {
  for (const r of extractRows(readFileSync(join(dir, f), 'utf8'))) {
    if (!r.cpu) continue
    const b = benches.get(r.cpu) ?? { rows: 0, games: new Set(), mapped: cpuIdFor(r.cpu) }
    b.rows += 1
    if (r.game) b.games.add(r.game)
    benches.set(r.cpu, b)
  }
}

for (const [cpu, b] of [...benches].sort((a, x) => x[1].rows - a[1].rows)) {
  console.log(`${b.mapped ? 'declared  ' : '--        '}${cpu.padEnd(40)} rows ${String(b.rows).padStart(5)}  games ${b.games.size}`)
}
```

Run: `npx vite-node scratch/bench-census.mjs`

The counts to reproduce, from the 13 cached pages in `%TEMP%\custompc-nbc-cache`:

| bench CPU string on the page | rows | games |
|---|---|---|
| `AMD Ryzen 9 5900X 3.7GHz` | 1496 | 66 |
| `AMD Ryzen 9 3900X 3.8GHz` | 1101 | 72 |
| `AMD Ryzen 7 2700X 3.7GHz` | 667 | 51 |

- [ ] **Step 2: Find a review stating each bench's memory**

For each of the three, find a Notebookcheck desktop GPU review published while that bench was current, and read off: memory type, speed, capacity, stick count, motherboard, OS. Fetch with `Invoke-WebRequest` and a browser User-Agent plus a `Referer` of `https://www.notebookcheck.net/` — plain WebFetch does not work on this host.

```powershell
$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
Invoke-WebRequest -Uri '<review url>' -UserAgent $UA -Headers @{ Referer = 'https://www.notebookcheck.net/' } |
  Select-Object -ExpandProperty Content |
  Out-File -Encoding utf8 scratch/nbc-review.html
```

Record for each bench: the review URL, the exact quoted memory string, and the motherboard.

- [ ] **Step 3: Apply the refusal rule**

Any bench without a stated memory specification is **dropped from this phase**. Write the reason into the task's completion note and into the commit message. Do not fold its rows into a neighbouring bench's source, and do not assume DDR4-3200 because the platform is AM4 — the platform's default is not a measurement of what was fitted.

- [ ] **Step 4: Report before implementing**

Post the findings — bench, review URL, quoted memory, motherboard, and any bench being dropped — before writing any code. Task 7 consumes this table.

---

### Task 7: Declare the verified benches

**Files:**
- Modify: `src/lib/perfEngine/notebookcheck.js:83-92` (`CPU_IDS`)
- Modify: `scripts/fetch-notebookcheck.mjs:37-67` (`BENCHES`)
- Test: `src/tests/notebookcheck.test.js`

- [ ] **Step 1: Confirm the catalogue holds the bench CPUs**

Run:

```bash
node -e "const p=require('./src/data/partsData.json');for(const id of ['cpu-ryzen-9-5900x','cpu-ryzen-9-3900x','cpu-ryzen-7-2700x'])console.log(id, p.some(x=>x.id===id)?'OK':'NOT IN CATALOGUE')"
```

A bench CPU that is not a catalogue part **cannot** be declared — `import-bench-tsv.mjs` requires the fixed side of a gpu-scaling review to resolve to a catalogue part id, and will refuse the whole file. If one is missing, drop that bench from this phase and say so; adding a CPU to the catalogue is a Supabase + JSON change and is out of scope here.

- [ ] **Step 2: Write the failing test**

Add to `src/tests/notebookcheck.test.js`:

```js
  it('recognises the older desktop benches by their model token', () => {
    expect(cpuIdFor('AMD Ryzen 9 5900X 3.7GHz')).toBe('cpu-ryzen-9-5900x')
    expect(cpuIdFor('AMD Ryzen 9 3900X 3.8GHz')).toBe('cpu-ryzen-9-3900x')
    expect(cpuIdFor('AMD Ryzen 7 2700X 3.7GHz')).toBe('cpu-ryzen-7-2700x')
  })

  it('does not confuse the 5900X with the 5950X or the 3900X', () => {
    expect(cpuIdFor('AMD Ryzen 9 5950X 3.4GHz')).not.toBe('cpu-ryzen-9-5900x')
    expect(cpuIdFor('AMD Ryzen 9 3900X 3.8GHz')).not.toBe('cpu-ryzen-9-5900x')
  })
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/tests/notebookcheck.test.js`
Expected: FAIL — `cpuIdFor` returns `null` for all three.

- [ ] **Step 4: Extend `CPU_IDS`**

In `src/lib/perfEngine/notebookcheck.js`, add to the `CPU_IDS` object (only the benches Task 6 verified):

```js
  '5900x': 'cpu-ryzen-9-5900x',
  '3900x': 'cpu-ryzen-9-3900x',
  '2700x': 'cpu-ryzen-7-2700x',
```

The lookup is already bounded by `\b` on both sides, which is what stops `13900k` matching `13900ks`; `5900x` and `5950x` differ before the boundary so they cannot collide.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/tests/notebookcheck.test.js`
Expected: PASS.

- [ ] **Step 6: Declare the benches**

In `scripts/fetch-notebookcheck.mjs`, add one entry to `BENCHES` per verified bench, filling every field from Task 6's findings. The shape, with the fields that must come from the review rather than from this plan marked:

```js
  'cpu-ryzen-9-5900x': {
    short: '5900X',
    ram: '<TYPE> <SPEED> <CAPACITY_GB> <STICKS>',   // from the review found in Task 6
    os: '<as stated in the review>',
    mainboard: '<as stated in the review>',
    verifiedFrom: '<review title> (<the memory string quoted verbatim>)',
  },
```

Repeat for `cpu-ryzen-9-3900x` (`short: '3900X'`) and `cpu-ryzen-7-2700x` (`short: '2700X'`).

`short` feeds the source title and therefore the source id, so it must be unique across benches — `5900X`, `3900X` and `2700X` are.

- [ ] **Step 7: Dry-run the fetch**

Run: `npm run perf:nbc -- --dry`

Expected: the per-page lines now show the new benches, e.g. `gpu-rx-6800   NNN kept of NNNN  7950X:41 14900K:38 5900X:57 3900X:44`, and the `bench has no verified memory spec` refusal count drops sharply. Nothing is written.

Record the total kept and the refusal tally.

- [ ] **Step 8: Commit**

```bash
git add src/lib/perfEngine/notebookcheck.js scripts/fetch-notebookcheck.mjs src/tests/notebookcheck.test.js
git commit -m "feat: declare three more Notebookcheck benches, specs verified per bench"
```

---

### Task 8: Map the two titles the catalogue already has ids for

**Files:**
- Modify: `src/lib/perfEngine/notebookcheck.js:41-76` (`GAME_IDS`)
- Modify: `data/games/gameMeta.json`
- Test: `src/tests/notebookcheck.test.js`

- [ ] **Step 1: Write the failing test**

Add to `src/tests/notebookcheck.test.js`:

```js
  it("maps the outlet's own spelling for titles the catalogue already has", () => {
    expect(gameIdFor('GTA V')).toBe('gta5')
    expect(gameIdFor('Dota 2 Reborn')).toBe('dota2')
  })

  it('does not map a title the catalogue has no id for', () => {
    expect(gameIdFor('Strange Brigade')).toBeNull()
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/tests/notebookcheck.test.js`
Expected: FAIL — both return `null`.

- [ ] **Step 3: Add the mappings**

In `src/lib/perfEngine/notebookcheck.js`, add to `GAME_IDS` under the first block:

```js
  // Notebookcheck's own spellings for two ids the catalogue has carried since
  // the legacy list was written. The reader was never told them, so 134 cached
  // rows were refused as "game not in the catalogue".
  'GTA V': 'gta5',
  'Dota 2 Reborn': 'dota2',
```

- [ ] **Step 4: Add their editorial metadata**

In `data/games/gameMeta.json`, add to `games` (keeping the object sorted by id):

```json
    "dota2": { "name": "Dota 2", "slug": "dota-2" },
    "gta5": { "name": "GTA V", "slug": "gta-v" },
```

Both names and slugs are copied verbatim from `gamesData.json` — Task 3's `never contradicts the legacy list about a shared id` test fails otherwise.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/tests/notebookcheck.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/perfEngine/notebookcheck.js data/games/gameMeta.json src/tests/notebookcheck.test.js
git commit -m "feat: map GTA V and Dota 2, whose ids the catalogue already had"
```

---

### Task 9: Fetch, import, fit

**Files:**
- Modify: `data/benchmarks/sources.json`, `data/benchmarks/entries.json` (by script)
- Modify: `src/data/perfModel.json`, `src/data/perfModel.report.json`, `src/data/perfGames.json` (by script)

- [ ] **Step 1: Fetch for real**

Run: `npm run perf:nbc`

Expected: one TSV per page per declared bench in `data/benchmarks/inbox/`, and the printed `npm run perf:import -- …` command list. The pages are cached in `%TEMP%\custompc-nbc-cache`, so nothing re-downloads unless the cache was cleared.

- [ ] **Step 2: Import each new file**

Run the printed commands one at a time. For each, record the reported accepted and rejected counts.

If any import fails on `"<id>" is not a catalogue part id` for the *fixed* side, that bench's CPU is not in the catalogue — Task 7 Step 1 should have caught it. Drop the bench and its files rather than adding a part.

- [ ] **Step 3: Re-derive the existing rows and demand they match**

This is the check that caught both ComputerBase extraction traps and it is the cheapest one available. Declaring a new bench must not move a figure that was already in the corpus.

```bash
git diff --unified=0 data/benchmarks/entries.json | findstr /R "^-" | findstr /V "^---"
```

Expected: **no output**. Any removed or modified line means an existing entry changed, which is a defect, not a data update — a new bench adds rows and touches none. Stop and investigate if anything prints.

- [ ] **Step 4: Regenerate the model and the game list**

Run: `npm run perf:fit`
Run: `npm run perf:games`

Record from `perf:fit`: entry count, source count, GPU indices, CPU indices, the `droppedDisconnected` length in `src/data/perfModel.report.json`, and every concentration warning.

**A long `droppedDisconnected` list means the corpus has split into islands** — a batch of entries sharing no game with anything already in it. The fix is data, not code: one review covering a game and a part both islands already have.

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: all green, including `perfGames.test.js`, `perfModelIntegrity.test.js` and `legacyEngineUntouched.test.js`.

- [ ] **Step 6: Sweep and compare**

Run: `npx vite-node scratch/coverage-sweep.mjs > scratch/after-b.txt`

Compare against `scratch/after-a.txt`. Fortnite, Apex Legends, Elden Ring, Red Dead Redemption 2, GTA V and Dota 2 should now appear in `perfGames.json`. Confirm with:

```bash
node -e "const g=require('./src/data/perfGames.json').map(x=>x.id);for(const id of ['fortnite','apex','elden-ring','rdr2','gta5','dota2'])console.log(id.padEnd(12), g.includes(id)?'listed':'ABSENT')"
```

Any `ABSENT` means that title's rows were all refused. Read the refusal tally from Step 1's output for the reason and report it — do not work around it.

- [ ] **Step 7: Commit**

```bash
git add data/benchmarks/sources.json data/benchmarks/entries.json data/benchmarks/inbox src/data/perfModel.json src/data/perfModel.report.json src/data/perfGames.json
git commit -m "feat: import the older Notebookcheck benches, adding Fortnite, Apex, Elden Ring and RDR2"
```

---

## Phase C — widen the mapped title list

### Task 10: Map the mainstream titles

**Files:**
- Modify: `src/lib/perfEngine/notebookcheck.js:41-76` (`GAME_IDS`)
- Modify: `data/games/gameMeta.json`
- Test: `src/tests/notebookcheck.test.js`

Selection criteria, applied in order: near-complete 1% low coverage in the cache; a title a visitor would recognise; and not a re-measure of an already-mapped title under a different patch — `Cyberpunk 2077 1.6` and `Cyberpunk 2077 1.0` are **excluded**, because folding a 2020 build's numbers into the current entry attributes one version's performance to another.

- [ ] **Step 1: Write the failing test**

Add to `src/tests/notebookcheck.test.js`:

```js
  it('maps the mainstream titles the cached benches measure well', () => {
    expect(gameIdFor('The Finals')).toBe('the-finals')
    expect(gameIdFor('Diablo 4')).toBe('diablo-4')
    expect(gameIdFor('The Last of Us')).toBe('the-last-of-us')
    expect(gameIdFor('God of War')).toBe('god-of-war')
    expect(gameIdFor('Resident Evil 4 Remake')).toBe('resident-evil-4-remake')
  })

  it('refuses a re-measure of an already-mapped title under an old patch', () => {
    // Folding a 2020 build's numbers into the current entry would attribute one
    // version's performance to another. They are different measurements.
    expect(gameIdFor('Cyberpunk 2077 1.6')).toBeNull()
    expect(gameIdFor('Cyberpunk 2077 1.0')).toBeNull()
  })

  it('keeps God of War and God of War Ragnarök apart', () => {
    expect(gameIdFor('God of War')).not.toBe(gameIdFor('God of War Ragnarök'))
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/tests/notebookcheck.test.js`
Expected: FAIL on the first case.

- [ ] **Step 3: Add the mappings**

In `src/lib/perfEngine/notebookcheck.js`, add a third block to `GAME_IDS`:

```js
  // Mainstream titles the cached benches measure with near-complete 1% lows.
  // A patch-suffixed re-measure ("Cyberpunk 2077 1.6") is deliberately absent:
  // it is a different measurement of a different build, and filing it under the
  // current entry attributes one version's performance to another.
  'Watch Dogs Legion': 'watch-dogs-legion',
  'Lies of P': 'lies-of-p',
  'Enshrouded': 'enshrouded',
  'Lords of the Fallen': 'lords-of-the-fallen',
  'Ghostwire Tokyo': 'ghostwire-tokyo',
  'The Finals': 'the-finals',
  'Diablo 4': 'diablo-4',
  'A Plague Tale Requiem': 'a-plague-tale-requiem',
  'Star Wars Jedi Survivor': 'star-wars-jedi-survivor',
  'Dead Island 2': 'dead-island-2',
  'Atomic Heart': 'atomic-heart',
  'The Witcher 3 v4': 'witcher-3',
  'God of War': 'god-of-war',
  'Spider-Man Miles Morales': 'spider-man-miles-morales',
  'The Last of Us': 'the-last-of-us',
  'Dead Space Remake': 'dead-space-remake',
  'Resident Evil 4 Remake': 'resident-evil-4-remake',
  'Palworld': 'palworld',
  'Ready or Not': 'ready-or-not',
  'Armored Core 6': 'armored-core-6',
  'Ratchet & Clank Rift Apart': 'ratchet-and-clank-rift-apart',
  'Doom Eternal': 'doom-eternal',
```

`'The Witcher 3 v4'` maps to `witcher-3` and the bare `'The Witcher 3'` does **not**: the v4 rows carry a 1% low on 46 of 46 and the older ones on 18 of 63, and the two are different builds of the game.

- [ ] **Step 4: Add their editorial metadata**

In `data/games/gameMeta.json`, add to `games`, keeping the object sorted by id:

```json
    "a-plague-tale-requiem": { "name": "A Plague Tale: Requiem", "slug": "a-plague-tale-requiem" },
    "armored-core-6": { "name": "Armored Core VI: Fires of Rubicon", "slug": "armored-core-6" },
    "atomic-heart": { "name": "Atomic Heart", "slug": "atomic-heart" },
    "dead-island-2": { "name": "Dead Island 2", "slug": "dead-island-2" },
    "dead-space-remake": { "name": "Dead Space (2023)", "slug": "dead-space-remake" },
    "diablo-4": { "name": "Diablo IV", "slug": "diablo-iv" },
    "doom-eternal": { "name": "Doom Eternal", "slug": "doom-eternal" },
    "enshrouded": { "name": "Enshrouded", "slug": "enshrouded" },
    "ghostwire-tokyo": { "name": "Ghostwire: Tokyo", "slug": "ghostwire-tokyo" },
    "god-of-war": { "name": "God of War (2018)", "slug": "god-of-war-2018" },
    "lies-of-p": { "name": "Lies of P", "slug": "lies-of-p" },
    "lords-of-the-fallen": { "name": "Lords of the Fallen", "slug": "lords-of-the-fallen" },
    "palworld": { "name": "Palworld", "slug": "palworld" },
    "ratchet-and-clank-rift-apart": { "name": "Ratchet & Clank: Rift Apart", "slug": "ratchet-and-clank-rift-apart" },
    "ready-or-not": { "name": "Ready or Not", "slug": "ready-or-not" },
    "resident-evil-4-remake": { "name": "Resident Evil 4 (2023)", "slug": "resident-evil-4-remake" },
    "spider-man-miles-morales": { "name": "Marvel's Spider-Man: Miles Morales", "slug": "marvels-spider-man-miles-morales" },
    "star-wars-jedi-survivor": { "name": "Star Wars Jedi: Survivor", "slug": "star-wars-jedi-survivor" },
    "the-finals": { "name": "The Finals", "slug": "the-finals" },
    "the-last-of-us": { "name": "The Last of Us Part I", "slug": "the-last-of-us-part-i" },
    "watch-dogs-legion": { "name": "Watch Dogs: Legion", "slug": "watch-dogs-legion" },
    "witcher-3": { "name": "The Witcher 3: Wild Hunt", "slug": "the-witcher-3-wild-hunt" },
```

`"god-of-war"` is named "God of War (2018)" and slugged `god-of-war-2018` so it can never be confused with `god-of-war-ragnarok` on a part page or in a URL.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/tests/notebookcheck.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/perfEngine/notebookcheck.js data/games/gameMeta.json src/tests/notebookcheck.test.js
git commit -m "feat: map 22 mainstream titles the Notebookcheck benches measure"
```

---

### Task 11: Import Phase C and prune what yielded nothing

**Files:**
- Modify: `data/benchmarks/*` and `src/data/perf*` (by script)
- Modify: `src/lib/perfEngine/notebookcheck.js`, `data/games/gameMeta.json` (pruning)

- [ ] **Step 1: Re-fetch and re-import**

Run: `npm run perf:nbc`

Then run each printed `npm run perf:import -- …` command. Files that produced no new rows are re-imported harmlessly — the importer dedupes on entry id.

- [ ] **Step 2: Check nothing existing moved**

```bash
git diff --unified=0 data/benchmarks/entries.json | findstr /R "^-" | findstr /V "^---"
```

Expected: no output.

- [ ] **Step 3: Regenerate**

Run: `npm run perf:fit`
Run: `npm run perf:games`

- [ ] **Step 4: Prune mappings that produced nothing**

Run:

```bash
node -e "const m=require('./data/games/gameMeta.json'),e=require('./data/benchmarks/entries.json');const live=new Set(e.filter(x=>!x.supersededBy).map(x=>x.gameId));const dead=Object.keys(m.games).filter(id=>!live.has(id));console.log(dead.length?'permitted but unmeasured: '+dead.join(', '):'every permitted id is measured')"
```

For each id reported: remove it from `data/games/gameMeta.json` **and** remove its title from `GAME_IDS` in `src/lib/perfEngine/notebookcheck.js`. A mapping with no output is the same problem the derived list exists to prevent, one layer down.

Then re-run `npm run perf:games` and confirm the command above prints `every permitted id is measured`.

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add data/benchmarks src/data/perfModel.json src/data/perfModel.report.json src/data/perfGames.json data/games/gameMeta.json src/lib/perfEngine/notebookcheck.js
git commit -m "feat: import the mainstream titles and prune mappings that yielded nothing"
```

---

## Verification

### Task 12: Prove it, in the browser and in numbers

**Files:**
- Delete: `scratch/` (throwaway, never committed)

- [ ] **Step 1: Final sweep**

Run: `npx vite-node scratch/coverage-sweep.mjs > scratch/after-c.txt`

Produce a table of `before` → `after-a` → `after-b` → `after-c` for all 18 rows. This is the evidence for every claim made to the user; a row count is not.

- [ ] **Step 2: Lint and build**

Run: `npm run lint`
Expected: clean.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Re-run the sitemap**

Run: `npm run sitemap`

`sitemap.test.js` enforces that the sitemap matches the catalogue. The catalogue is untouched here, so expect **no change** — but run it, because the contract is "after any catalogue change" and confirming no-change costs one command.

- [ ] **Step 4: Check it in the browser**

Start the dev server through the preview tooling (never `npm run dev` via a shell tool). Then, on the Performance tab:

- a covered build (Ryzen 7 9800X3D + RTX 4070) at 1080p, 1440p and 4K — confirm the newly listed games render with a `measured` or `modelled` badge, and that the preset shown on each card matches the "High preset" claim in the section blurb;
- an uncovered build (Ryzen 5 5600 + GTX 1660 Super) — confirm it still says "no benchmark data yet" rather than showing a number;
- confirm the nine removed titles no longer appear anywhere on the page.

Read the console in a **fresh tab**: the devtools buffer survives reloads and has caused false alarms in this repo before.

- [ ] **Step 5: Report the concentration warnings**

Read `src/data/perfModel.report.json` and quote `sourceConcentration` verbatim to the user. Notebookcheck was already 73.1% of the corpus and this work makes it substantially more. That is the accepted trade for now — the 2026-08-10 decision is to take any valid data while the corpus is being built and dilute once there is a complete set — but the number must be stated, not buried.

- [ ] **Step 6: Delete the scratch directory**

Run: `Remove-Item -Recurse -Force scratch`

Confirm `git status` shows no untracked `scratch/`.

- [ ] **Step 7: Final commit if anything is outstanding**

```bash
git status -sb
```

Expected: clean tree, N commits ahead of `origin/main`. **Do not push.** Pushing and deploying require an explicit instruction.

---

## Out of scope

- **Phase D — fitting 1080p.** `GPU_FIT_RESOLUTIONS` in `scripts/fit-perf-model.mjs:21` excludes 1080p, so all 1080p entries produce zero fitted cells and every 1080p index is copied from 1440p. Deferred by decision; ask after Phase C lands.
- **Phase E — CPU-scaling imports.** One game has a CPU-side constant and 12 of 80 CPUs have an index, which is why a mainstream CPU answers nothing. The largest remaining lever. Deferred by decision; ask after Phase C lands.
- The Performance tab UI redesign — its own spec, after this. Agreed direction: progressive disclosure, every figure kept, detail behind expanders.
- Any Supabase write, any `git push`, any deploy.
