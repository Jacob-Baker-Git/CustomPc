// Reports drift between the catalogue committed here and the one the live site
// serves from Supabase. Read-only: uses the same publishable key the browser
// already ships, which Row Level Security limits to SELECT.
//
//   npm run catalog:check
//
// Exits 1 when they disagree, so it can gate a release the way the sitemap and
// pre-render drift checks do. It is NOT part of `vitest run` — that suite must
// stay offline and fast; this one needs the network.
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { diffTable, summarise } from './catalog-diff-core.mjs'

const URL_ = process.env.VITE_SUPABASE_URL ?? 'https://igeggndtnmdpauxovnwv.supabase.co'
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_Iu7O2Gu9K693IjISZb7GMw_CHtE5tvs'

const TABLES = [
  ['parts', 'src/data/partsData.json'],
  ['peripherals', 'src/data/peripheralsData.json'],
  ['games', 'src/data/gamesData.json'],
]

const local = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))

async function fetchTable(table) {
  const res = await fetch(`${URL_}/rest/v1/${table}?select=data&order=id`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`)
  return (await res.json()).map((r) => r.data)
}

let drifted = false
for (const [table, path] of TABLES) {
  const [repo, live] = [local(path), await fetchTable(table)]
  const diff = diffTable(repo, live)
  const { drifted: d, count } = summarise(diff)
  drifted ||= d

  console.log(`\n${table}: ${repo.length} in repo, ${live.length} live — ${d ? `${count} DIFFERENCE(S)` : 'in step'}`)
  for (const id of diff.missing) console.log(`  + ${id} — in the repo, not live (push needed)`)
  for (const id of diff.extra) console.log(`  - ${id} — live, but no longer in the repo`)
  for (const c of diff.changed) {
    console.log(`  ~ ${c.id} — ${c.fields.join(', ')}`)
    for (const f of c.fields) {
      console.log(`      repo: ${JSON.stringify(c.local[f])}`)
      console.log(`      live: ${JSON.stringify(c.remote[f])}`)
    }
  }
}

if (drifted) {
  console.log('\nThe live catalogue does not match this repo. `npm run catalog:push` shows what would change.')
  process.exit(1)
}
console.log('\nLive catalogue matches this repo.')
