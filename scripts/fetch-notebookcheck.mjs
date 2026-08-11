// Turns Notebookcheck's per-GPU benchmark pages into importable TSV files.
//
//   npm run perf:nbc              # fetch (cached) and write one TSV per page
//   npm run perf:nbc -- --dry     # report what would be kept, write nothing
//
// Then, per file: npm run perf:import -- data/benchmarks/inbox/<file>.tsv
//
// ONE SOURCE PER PAGE, each carrying that page's own URL, so every imported
// figure has an address a reader can check. They are all the same outlet, which
// is exactly why the concentration report aggregates by OUTLET as well as by
// review — 13 sources from one outlet must not read as 13 independent outlets.
//
// The test system is Notebookcheck's stated desktop GPU bench, verified against
// two independent 2025 reviews (RTX 5090 FE and PNY RTX 5060 Ti) rather than
// assumed: Ryzen 7 9800X3D, 32 GB DDR5-6000, X870E, Windows 11 Pro. Rows measured
// on any OTHER bench are refused, not folded in — their older i9-14900K and
// Ryzen 9 7950X systems are different machines and the corpus records one test
// system per source.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { argv } from 'node:process'
import { NBC_GPU_PAGES, extractRows, toRows } from '../src/lib/perfEngine/notebookcheck.js'

// Notebookcheck has re-based its desktop GPU bench several times, and its pages
// pool rows from all of them. Each bench is a DIFFERENT MACHINE, so each becomes
// its own source declaring its own test system — folding them together would
// attribute one machine's numbers to another.
//
// Every figure below is read off a review that states it. The 13900K bench runs
// DDR5-6400 where the other three run 6000, which is exactly why these are looked
// up rather than assumed: one shared default would have recorded a wrong memory
// speed against 17 rows.
//
// A row measured on any bench NOT listed here is refused, not guessed at.
const BENCHES = {
  'cpu-ryzen-7-9800x3d': {
    short: '9800X3D',
    ram: 'DDR5 6000 32 2',
    os: 'Windows 11 Pro',
    mainboard: 'ASRock X870E Taichi',
    verifiedFrom: 'RTX 5090 FE and PNY RTX 5060 Ti reviews (32 GB DDR5-6000, X870E)',
  },
  'cpu-i9-14900k': {
    short: '14900K',
    ram: 'DDR5 6000 32 2',
    os: 'Windows 11 Pro',
    mainboard: 'Intel Z690',
    verifiedFrom: 'RTX 4080 Super review (32 GB DDR5-6000 CL30, Z690)',
  },
  'cpu-ryzen-9-7950x': {
    short: '7950X',
    ram: 'DDR5 6000 32 2',
    os: 'Windows 11 Pro',
    mainboard: 'Gigabyte X670E Aorus Master',
    verifiedFrom: 'KFA2 RTX 4070 EX Gamer review (32 GB DDR5-6000 EXPO, X670E)',
  },
  'cpu-i9-13900k': {
    short: '13900K',
    // Not 6000. Kingston Fury Renegade DDR5-6400, timings 32-39-39-80.
    ram: 'DDR5 6400 32 2',
    os: 'Windows 11 Pro',
    mainboard: 'Gigabyte Z790 Aorus Master',
    verifiedFrom: 'RTX 4070 Super FE review (2x16 GB Kingston Fury Renegade DDR5-6400)',
  },

  // --- the older AM4 benches ------------------------------------------------
  // These three carry most of the coverage for cards the current bench never
  // tested, and they are the reason Fortnite, Apex Legends, Elden Ring and Red
  // Dead Redemption 2 can enter the corpus at all.
  //
  // Their memory differs three ways — DDR4-4000/32 GB, DDR4-3600/16 GB and
  // DDR4-3600/32 GB — which is the whole argument for looking each one up. A
  // single "AM4 means DDR4-3200" default would have been wrong for all three.
  //
  // Neither review states an operating system, so neither claims one. 'not
  // stated' is what the importer records for an absent field, and writing a
  // plausible Windows build instead would be inventing a fact about somebody
  // else's machine.
  'cpu-ryzen-9-5900x': {
    short: '5900X',
    ram: 'DDR4 4000 32 2',
    os: 'not stated',
    mainboard: 'Asus X570 ROG Crosshair VIII Hero WiFi',
    verifiedFrom: 'KFA2 RTX 3080 SG 12GB review (G.Skill Trident Z Neo RGB DDR4-4000 '
      + 'memory kit 2 x 16 GB; BIOS 2402, default settings, XMP 1 for DDR4-4000)',
  },
  'cpu-ryzen-9-3900x': {
    short: '3900X',
    // Sixteen gigabytes, not thirty-two: two 8 GB sticks.
    ram: 'DDR4 3600 16 2',
    os: 'not stated',
    mainboard: 'MSI MEG X570 Godlike',
    verifiedFrom: 'Radeon RX 5600 XT review (G-Skill Trident Z Royal Gold DDR4-3600 '
      + 'memory kit 2 x 8 GB, runs as DDR4-3600 CL16-16-16-36; BIOS 1.20, XMP 1)',
  },
  'cpu-ryzen-9-5950x': {
    short: '5950X',
    ram: 'DDR4 3600 32 2',
    os: 'Windows 10 20H2',
    mainboard: 'MSI Prestige X570 Creation',
    verifiedFrom: 'Radeon RX 6900 XT review (32 GB, 2 x 16 GB G.SKILL Trident Z Neo '
      + 'DDR4-3600, timings 16-19-19-39; Windows 10 20H2)',
  },
}

// Their in-house sequence per game. Named because two outlets benchmarking
// different scenes are measuring different things, and the importer insists.
const SCENE = 'Notebookcheck in-house benchmark sequence (per game; exact scene not stated per title)'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const dry = argv.includes('--dry')
const path = (rel) => fileURLToPath(new URL(rel, import.meta.url))
const cacheDir = join(tmpdir(), 'custompc-nbc-cache')
const today = new Date().toISOString().slice(0, 10)

// Cached outside the repo. These pages are ~6 MB each and re-running the mapping
// is the part worth iterating on, not the download.
async function pageHtml(url) {
  mkdirSync(cacheDir, { recursive: true })
  const file = join(cacheDir, `${url.replace(/[^a-z0-9]+/gi, '-').slice(-80)}.html`)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.notebookcheck.net/' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const html = await res.text()
  writeFileSync(file, html)
  // One request at a time with a pause between: robots.txt permits these pages,
  // which is not a licence to hammer them.
  await new Promise((r) => setTimeout(r, 1500))
  return html
}

const tsvFor = (page, cpuId, rows) => {
  const bench = BENCHES[cpuId]
  const header = [
    `outlet:    Notebookcheck`,
    // The bench sits right after the card because the importer builds the source
    // id from the first 24 characters of the slugged title — without it, the same
    // card measured on two benches would collide on one id.
    `title:     ${page.expectGpu} (${bench.short}) benchmarks`,
    `url:       ${page.url}`,
    // A living database page carries no single publication date, so the date it
    // was read is the only honest one — recorded rather than invented.
    `published: ${today}`,
    `kind:      gpu-scaling`,
    `cpu:       ${cpuId}`,
    `ram:       ${bench.ram}`,
    `os:        ${bench.os}`,
    `scene:     ${SCENE}`,
    `notes:     Aggregate benchmark page read on ${today}; rows restricted to the ` +
      `${bench.mainboard} / ${bench.short} bench, whose memory spec is verified from the ` +
      `${bench.verifiedFrom}. Rows whose 1% low sits below their own stated minimum are ` +
      `excluded as internally inconsistent.`,
    '',
    `# game  res  preset  up  part  avg  low`,
  ]
  const body = rows.map((r) => [
    r.gameId, r.resolution, r.presetId, r.upscaling, r.partId,
    r.avg.toFixed(1), r.low == null ? '' : r.low.toFixed(1),
  ].join('\t').trimEnd())
  return `${[...header, ...body].join('\n')}\n`
}

const inbox = path('../data/benchmarks/inbox')
mkdirSync(inbox, { recursive: true })

let totalKept = 0
const reasonTally = new Map()
const written = []

for (const page of NBC_GPU_PAGES) {
  let html
  try {
    html = await pageHtml(page.url)
  } catch (err) {
    console.error(`  ${page.gpuId}: FETCH FAILED — ${err.message}`)
    continue
  }

  const extracted = extractRows(html, { expectGpu: page.expectGpu })

  // A page that parsed no rows at all means the markup moved — say so loudly
  // rather than writing an empty file and reporting success.
  if (extracted.length === 0) {
    console.error(`  ${page.gpuId}: NO ROWS PARSED — the page markup has changed`)
    continue
  }

  const { rows, rejected } = toRows(extracted, { gpuId: page.gpuId })

  for (const r of rejected) {
    const key = r.reason.replace(/:.*$/, '').replace(/\(.*\)/, '').trim()
    reasonTally.set(key, (reasonTally.get(key) ?? 0) + 1)
  }

  // One source per BENCH. Each is a different machine, so each declares its own
  // test system; a row on a bench with no verified memory spec is dropped rather
  // than filed under someone else's.
  const byBench = new Map()
  let offBench = 0
  for (const r of rows) {
    if (!BENCHES[r.cpuId]) { offBench += 1; continue }
    if (!byBench.has(r.cpuId)) byBench.set(r.cpuId, [])
    byBench.get(r.cpuId).push(r)
  }
  if (offBench) reasonTally.set('bench has no verified memory spec', (reasonTally.get('bench has no verified memory spec') ?? 0) + offBench)

  const kept = [...byBench.values()].reduce((s, g) => s + g.length, 0)
  const benchNote = [...byBench].map(([id, g]) => `${BENCHES[id].short}:${g.length}`).join(' ')
  console.log(`  ${page.gpuId.padEnd(20)} ${String(kept).padStart(4)} kept ` +
              `of ${String(extracted.length).padStart(4)}  ${benchNote || '<-- nothing usable'}`)

  totalKept += kept
  for (const [cpuId, group] of byBench) {
    const out = join(inbox, `notebookcheck-${page.gpuId}-${BENCHES[cpuId].short.toLowerCase()}.tsv`)
    if (!dry) writeFileSync(out, tsvFor(page, cpuId, group))
    written.push(out)
  }
}

console.log(`\n${totalKept} rows kept across ${written.length} pages` + (dry ? ' (dry run — nothing written)' : ''))
console.log('\nwhy rows were refused:')
for (const [reason, n] of [...reasonTally].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${reason}`)
}
if (!dry && written.length) {
  console.log('\nimport with:')
  for (const f of written) console.log(`  npm run perf:import -- ${f.replace(/\\/g, '/').replace(/^.*CustomPc\//, '')}`)
}
