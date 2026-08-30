// Pushes the committed catalogue to Supabase, so a correction made here reaches
// the people using the site.
//
//   npm run catalog:push            # dry run — prints what WOULD change
//   npm run catalog:push -- --apply # actually writes
//
// ⚠️ DRY RUN BY DEFAULT, deliberately. This writes to the production database
// behind a live site; it should never be something that happens as a side effect
// of running something else.
//
// ⚠️ Needs a key that can write. The publishable key the browser ships is
// SELECT-only under RLS, which is the correct setting and is not changed here.
// Supply a service role key in the environment:
//
//   SUPABASE_SERVICE_KEY=... npm run catalog:push -- --apply
//
// The key is read from the environment and never stored, logged, or committed.
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { diffTable, summarise } from './catalog-diff-core.mjs'
import { upsertPayload } from './catalog-columns.mjs'

const URL_ = process.env.VITE_SUPABASE_URL ?? 'https://igeggndtnmdpauxovnwv.supabase.co'
const READ_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_Iu7O2Gu9K693IjISZb7GMw_CHtE5tvs'
const WRITE_KEY = process.env.SUPABASE_SERVICE_KEY
const APPLY = process.argv.includes('--apply')

const TABLES = [
  ['parts', 'src/data/partsData.json'],
  ['peripherals', 'src/data/peripheralsData.json'],
  ['games', 'src/data/gamesData.json'],
]

const local = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))

async function fetchTable(table) {
  const res = await fetch(`${URL_}/rest/v1/${table}?select=data&order=id`, {
    headers: { apikey: READ_KEY, Authorization: `Bearer ${READ_KEY}` },
  })
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`)
  return (await res.json()).map((r) => r.data)
}

async function upsert(table, rows) {
  const res = await fetch(`${URL_}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: WRITE_KEY,
      Authorization: `Bearer ${WRITE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    // ⚠️ NOT { id, data }. The mirrored NOT NULL columns have to be here or the
    // whole batch is rejected with 23502 — see catalog-columns.mjs.
    body: JSON.stringify(upsertPayload(table, rows)),
  })
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status} — ${await res.text()}`)
}

if (APPLY && !WRITE_KEY) {
  console.error('Refusing to write: SUPABASE_SERVICE_KEY is not set.')
  console.error('The publishable key is SELECT-only, which is correct — supply a service role key in the environment.')
  process.exit(1)
}

let total = 0
const plan = []
for (const [table, path] of TABLES) {
  const repo = local(path)
  const diff = diffTable(repo, await fetchTable(table))
  const { count } = summarise(diff)
  total += count

  console.log(`\n${table}: ${count} row(s) differ`)
  for (const id of diff.missing) console.log(`  + insert ${id}`)
  for (const c of diff.changed) console.log(`  ~ update ${c.id} (${c.fields.join(', ')})`)
  // ⚠️ Rows that are live but gone from the repo are REPORTED, never deleted.
  // Deleting production data is not something a sync script should decide.
  for (const id of diff.extra) console.log(`  ! ${id} is live but not in the repo — left alone, delete by hand if intended`)

  if (diff.missing.length + diff.changed.length > 0) {
    const ids = new Set([...diff.missing, ...diff.changed.map((c) => c.id)])
    plan.push([table, repo.filter((r) => ids.has(r.id))])
  }
}

if (total === 0) {
  console.log('\nNothing to push — the live catalogue already matches this repo.')
  process.exit(0)
}

if (!APPLY) {
  console.log(`\nDRY RUN. Nothing was written. Re-run with --apply (and SUPABASE_SERVICE_KEY set) to push.`)
  process.exit(0)
}

for (const [table, rows] of plan) {
  await upsert(table, rows)
  console.log(`pushed ${rows.length} row(s) to ${table}`)
}
console.log('\nDone. Run `npm run catalog:check` to confirm.')
