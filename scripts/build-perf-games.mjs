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
// entries.json, sources.json). core.autocrlf is true in this repo, so the
// committed blob is LF either way and the worktree keeps its CRLF — no
// line-ending churn appears in the diff.
writeFileSync(path('../src/data/perfGames.json'), `${JSON.stringify(games, null, 2)}\n`)

const beforeIds = new Set(before.map((g) => g.id))
const afterIds = new Set(games.map((g) => g.id))
const added = [...afterIds].filter((id) => !beforeIds.has(id))
const removed = [...beforeIds].filter((id) => !afterIds.has(id))

console.log(`Wrote ${games.length} games (was ${before.length}).`)
if (added.length) console.log(`  added:   ${added.join(', ')}`)
if (removed.length) console.log(`  removed: ${removed.join(', ')} — no measurements in the corpus`)
