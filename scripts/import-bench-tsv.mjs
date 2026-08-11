// Bulk import for the benchmark corpus.
//
//   npm run perf:import -- data/benchmarks/inbox/my-review.tsv
//
// The interactive harness (`npm run perf:add`) asks one question at a time,
// which is right for a first entry and painful for the thirtieth. This takes a
// whole review in one file instead: fill the header once, paste a row per
// measurement, run it. Same validators, same refusal to accept a gap — the
// only thing that changes is how many keystrokes it costs.
//
// FORMAT — a small header block, a blank line, then one row per measurement.
// Columns separate on any whitespace or comma, so align them however you like.
// Lines starting with # are ignored.
//
//   outlet:    Hardware Unboxed
//   title:     GeForce RTX 5070 Review
//   url:       https://example.com/rtx-5070-review
//   published: 2026-02-19
//   kind:      gpu-scaling
//   cpu:       cpu-ryzen-7-9800x3d      <- the review's FIXED test-system part
//   ram:       DDR5 6000 32 2           <- type speed capacityGb sticks
//   os:        Windows 11 24H2
//   driver:    NVIDIA 572.16
//   scene:     built-in benchmark
//
//   game        res     preset  up       part             avg    low
//   cyberpunk   1440p   ultra   native   gpu-rtx-5070     78.0   61.0
//   cyberpunk   1440p   ultra   native   gpu-rtx-4070ti   71.2   55.4
//
// `part` is the one that VARIES across the review — a GPU for gpu-scaling, a
// CPU for cpu-scaling. The fixed side comes from the header. `low` is optional
// and must stay LAST; leave it off when the review publishes no 1% lows.
//
// `up` is the upsampling mode — native | ultra-quality | quality | balanced |
// performance — and it is per row because review parcours set it per GAME. It
// falls back to an `upscaling:` header line if every row shares one. There is
// no default: a row whose render scale nobody stated is rejected, not guessed.
// Ray tracing stays header-level (`raytracing: yes`), because outlets publish
// raster and RT as separate charts — import them as two files.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { argv, exit } from 'node:process'
import { validateSource, validateEntry, RESOLUTIONS, SOURCE_KINDS } from '../src/lib/benchSchema.js'

const path = (rel) => fileURLToPath(new URL(rel, import.meta.url))
const read = (rel) => JSON.parse(readFileSync(path(rel), 'utf8'))
const write = (rel, data) => writeFileSync(path(rel), `${JSON.stringify(data, null, 2)}\n`)

const file = argv[2]
if (!file) {
  console.error('usage: npm run perf:import -- <file.tsv>')
  exit(1)
}

const parts = read('../src/data/partsData.json')
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
const sources = read('../data/benchmarks/sources.json')
const entries = read('../data/benchmarks/entries.json')
const validation = read('../data/benchmarks/validation.json')

const partIds = new Set(parts.map((p) => p.id))
const gameIds = new Set(games.map((g) => g.id))
const today = new Date().toISOString().slice(0, 10)

const raw = readFileSync(file, 'utf8')
const lines = raw.split(/\r?\n/).filter((l) => !/^\s*#/.test(l))

// --- header ---------------------------------------------------------------
const head = {}
let i = 0
// Skip leading blanks. Stripping the comment block leaves them behind, and
// treating the first one as the end of the header parses an empty header and
// then blames the user for every missing field.
while (i < lines.length && !lines[i].trim()) i += 1
for (; i < lines.length; i++) {
  const line = lines[i]
  if (!line.trim()) { i++; break }
  const m = /^\s*(\w+)\s*:\s*(.+?)\s*$/.exec(line)
  if (m) head[m[1].toLowerCase()] = m[2]
}

const slug = (s) => String(s).toLowerCase().replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const [ramType, ramSpeed, ramCapacity, ramSticks] = String(head.ram ?? '').split(/\s+/)

// Which side is held fixed flips with the review's kind: a gpu-scaling review
// pins one CPU and varies the cards, a cpu-scaling review pins one card and
// varies the chips. `testSystem.cpu` is required either way, so for a
// cpu-scaling review it records that the CPU is the variable rather than being
// left undefined — which is true, and is what a reader needs to know.
const varyingSide = head.kind === 'cpu-scaling' ? 'cpu' : 'gpu'
const testCpu = head.cpu ?? (varyingSide === 'cpu' ? 'varies — one per entry' : undefined)

const source = {
  id: `src-${slug(head.outlet)}-${head.published}-${slug(head.title).slice(0, 24)}`,
  outlet: head.outlet, title: head.title, url: head.url,
  published: head.published, accessed: today, kind: head.kind,
  testSystem: {
    cpu: testCpu,
    cpuId: partIds.has(head.cpu) ? head.cpu : undefined,
    gpu: head.gpu ?? (varyingSide === 'gpu' ? 'varies — one per entry' : undefined),
    gpuId: partIds.has(head.gpu) ? head.gpu : undefined,
    ram: {
      type: ramType, speed: Number(ramSpeed),
      capacityGb: Number(ramCapacity), sticks: Number(ramSticks),
    },
    os: head.os ?? 'not stated', gpuDriver: head.driver ?? 'not stated',
  },
  notes: head.notes ?? '',
}

const problems = validateSource(source)
if (!SOURCE_KINDS.includes(source.kind)) problems.push(`kind must be one of ${SOURCE_KINDS.join(', ')}`)
if (!head.scene) problems.push('scene: is required — two outlets benchmarking different scenes are measuring different things')

// The fixed side of the review has to resolve, or every row is unattributable.
const fixedIsGpu = source.kind === 'cpu-scaling'
const fixedId = fixedIsGpu ? head.gpu : head.cpu
if (!partIds.has(fixedId)) {
  problems.push(`${fixedIsGpu ? 'gpu' : 'cpu'}: "${fixedId ?? '(missing)'}" is not a catalogue part id`
    + ` — a ${source.kind} review pins the ${fixedIsGpu ? 'graphics card' : 'processor'}`
    + ` and varies the other side, so that is the header field it needs`)
}

if (problems.length) {
  console.error(`\n${file} — header rejected:`)
  for (const p of problems) console.error(`  - ${p}`)
  exit(1)
}

// --- rows -----------------------------------------------------------------
const rows = []
const rowProblems = []
for (; i < lines.length; i++) {
  const line = lines[i]
  if (!line.trim()) continue
  // Any run of whitespace or a comma. No field here contains a space — game
  // ids, part ids, presets and numbers are all single tokens — so this accepts
  // a file however it was pasted or hand-aligned, rather than demanding real
  // tab characters that most editors silently convert.
  const cols = line.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean)
  if (cols.length < 6) {
    rowProblems.push(`line ${i + 1}: expected at least 6 columns ` +
                     `(game res preset up part avg [low])`)
    continue
  }
  if (cols[0] === 'game') continue                       // the header row, if pasted

  // `up` sits BEFORE the optional trailing `low`. Appending it after would
  // misparse every row that omits the 1% low, silently reading the upscaling
  // token as a frame rate.
  const [gameId, resolution, presetId, up, partId, avg, low] = cols
  const varying = partId
  const gpuId = fixedIsGpu ? fixedId : varying
  const cpuId = fixedIsGpu ? varying : fixedId

  // Upsampling is per-ROW with a header fallback, not header-only: a modern
  // parcours sets it per GAME — ComputerBase runs Ghost of Tsushima native and
  // Black Myth: Wukong at Quality in the same review — so one value for the
  // whole file would mislabel most of it.
  //
  // No default. The old `?? 'off'` quietly asserted a render scale about every
  // row whose review never stated one, which is the exact move this corpus
  // exists to refuse: validateEntry rejects the row instead.
  const upscaling = up ?? head.upscaling
  const rayTracing = /^(y|yes|true|on)$/i.test(head.raytracing ?? '')

  const entry = {
    id: `be-${slug(head.outlet)}-${gameId}-${resolution}-${presetId}-${gpuId}-${cpuId}`
      + `-${upscaling ?? 'unspecified'}${rayTracing ? '-rt' : ''}`,
    sourceId: source.id, gameId, resolution, presetId, gpuId, cpuId,
    avgFps: Number(avg),
    ...(low ? { lowFps: Number(low), lowKind: '1%' } : {}),
    upscaling,
    rayTracing,
    frameGen: /^(y|yes|true|on)$/i.test(head.framegen ?? ''),
    sceneNote: head.scene,
    weight: Number(head.weight ?? 1),
    supersededBy: null,
    recordedAt: today,
  }

  const p = validateEntry(entry, { sourceIds: new Set([source.id]), partIds, gameIds })
  if (!RESOLUTIONS.includes(resolution)) p.push(`line ${i + 1}: bad resolution`)
  if (p.length) { rowProblems.push(...p.map((x) => `line ${i + 1}: ${x}`)); continue }
  rows.push(entry)
}

if (rowProblems.length) {
  console.error(`\n${file} — ${rowProblems.length} row(s) rejected, nothing written:`)
  for (const p of rowProblems) console.error(`  - ${p}`)
  exit(1)
}
if (rows.length === 0) {
  console.error(`\n${file} — no data rows found.`)
  exit(1)
}

// --- write ----------------------------------------------------------------
// `pair` sources are held-out validation. Scoring the model on data it was
// fitted to measures nothing, so the split is enforced here rather than trusted.
const target = source.kind === 'pair' ? validation : entries
const targetName = source.kind === 'pair' ? 'validation.json' : 'entries.json'

if (!sources.some((s) => s.id === source.id)) sources.push(source)
let added = 0
let skipped = 0
for (const entry of rows) {
  if (target.some((e) => e.id === entry.id)) { skipped += 1; continue }
  target.push(entry)
  added += 1
}

write('../data/benchmarks/sources.json', sources)
write('../data/benchmarks/entries.json', entries)
write('../data/benchmarks/validation.json', validation)

console.log(`${source.outlet} — ${source.title}`)
console.log(`  ${added} entries added to ${targetName}${skipped ? `, ${skipped} already present (skipped)` : ''}`)
console.log(`  Now run: npm run perf:fit`)
