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
// Measured games first (perfGames.json is derived from the corpus, so these are
// the ones a review is most likely to be adding to), then every other permitted
// id from gameMeta.json, then the legacy catalogue — so the common case is at
// the top of the picker and nothing permitted is unreachable. Kept in step with
// import-bench-tsv.mjs, which validates against the same permitted set.
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
