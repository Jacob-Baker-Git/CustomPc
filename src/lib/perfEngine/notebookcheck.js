// Reads Notebookcheck's per-GPU benchmark pages into corpus rows.
//
// Why this outlet: its rows state the TEST SYSTEM CPU and publish a true P1 (1%
// low) alongside the average, and its game list reaches the mainstream titles the
// German GPU roundups never touch — Cyberpunk, Baldur's Gate 3, Starfield, Alan
// Wake 2 — which the corpus had no coverage of at all. Its desktop rows also run
// the same 9800X3D bench as the two ComputerBase sources, so they are directly
// comparable rather than merely adjacent.
//
// Zero imports: scripts/ runs this under plain Node, which cannot resolve this
// project's extensionless relative imports.

const RESOLUTIONS = { '1920x1080': '1080p', '2560x1440': '1440p', '3840x2160': '4k' }

// EXPLICIT, page by page. Fuzzy name matching put "RX 570" onto gpu-rx-5700 and
// left "RTX 3060" choosing between the 8 GB, 12 GB and Ti parts — attributing one
// card's frame rates to another is the worst thing this corpus could do, so every
// page names its catalogue id by hand. `expectGpu` is asserted against each row's
// own GPU field, which is what catches a parser that has slid a field.
//
// URLs are discoverable from any one of these pages: they cross-link.
export const NBC_GPU_PAGES = [
  { gpuId: 'gpu-rtx-4070', expectGpu: 'RTX 4070', url: 'https://www.notebookcheck.net/NVIDIA-GeForce-RTX-4070-Desktop-GPU-Benchmarks-and-Specs.742254.0.html' },
  { gpuId: 'gpu-rtx-4070-super', expectGpu: 'RTX 4070 SUPER', url: 'https://www.notebookcheck.net/NVIDIA-GeForce-RTX-4070-SUPER-Desktop-GPU-Benchmarks-and-Specs.793708.0.html' },
  { gpuId: 'gpu-rx-6800', expectGpu: 'RX 6800', url: 'https://www.notebookcheck.net/AMD-Radeon-RX-6800-Desktop-GPU-Benchmarks-and-Specs.516398.0.html' },
  { gpuId: 'gpu-rx-6800-xt', expectGpu: 'RX 6800 XT', url: 'https://www.notebookcheck.net/AMD-Radeon-RX-6800-XT-Desktop-GPU-Benchmarks-and-Specs.516399.0.html' },
  { gpuId: 'gpu-rx-5600-xt', expectGpu: 'RX 5600 XT', url: 'https://www.notebookcheck.net/AMD-Radeon-RX-5600-XT-Desktop-GPU-Benchmarks-and-Specs.459227.0.html' },
  { gpuId: 'gpu-rx-5500-xt', expectGpu: 'RX 5500 XT', url: 'https://www.notebookcheck.net/AMD-Radeon-RX-5500-XT-Desktop-GPU-Benchmarks-and-Specs.539160.0.html' },
  { gpuId: 'gpu-rtx-2070', expectGpu: 'RTX 2070', url: 'https://www.notebookcheck.net/NVIDIA-GeForce-RTX-2070-Desktop-GPU-Benchmarks-and-Specs.399491.0.html' },
  { gpuId: 'gpu-rtx-2060-super', expectGpu: 'RTX 2060 Super', url: 'https://www.notebookcheck.net/NVIDIA-GeForce-RTX-2060-Super-Desktop-GPU-Benchmarks-and-Specs.426823.0.html' },
  { gpuId: 'gpu-gtx-1660', expectGpu: 'GTX 1660', url: 'https://www.notebookcheck.net/NVIDIA-GeForce-GTX-1660-Desktop-GPU-Benchmarks-and-Specs.448672.0.html' },
  { gpuId: 'gpu-gtx-1660s', expectGpu: 'GTX 1660 Super', url: 'https://www.notebookcheck.net/NVIDIA-GeForce-GTX-1660-Super-Desktop-GPU-Benchmarks-and-Specs.448675.0.html' },
  { gpuId: 'gpu-gtx-1650', expectGpu: 'GTX 1650', url: 'https://www.notebookcheck.net/NVIDIA-GeForce-GTX-1650-Desktop-GPU-Benchmarks-and-Specs.421420.0.html' },
  { gpuId: 'gpu-gtx-1070-ti', expectGpu: 'GTX 1070 Ti', url: 'https://www.notebookcheck.net/NVIDIA-GeForce-GTX-1070-Ti-Desktop-GPU-Benchmarks-and-Specs.262056.0.html' },
  { gpuId: 'gpu-arc-a380', expectGpu: 'Arc A380', url: 'https://www.notebookcheck.net/Intel-Arc-A380-Desktop-GPU-Benchmarks-and-Specs.937585.0.html' },
]

// Notebookcheck's title -> catalogue game id. Only titles the catalogue actually
// has; anything else returns null and its rows are refused rather than mapped to
// something approximate.
export const GAME_IDS = {
  // Titles the corpus had NO coverage of before this outlet.
  'Cyberpunk 2077': 'cyberpunk',
  "Baldur's Gate 3": 'bg3',
  'Starfield': 'starfield',
  'Alan Wake 2': 'alan-wake-2',
  'Hogwarts Legacy': 'hogwarts',
  'Elden Ring': 'elden-ring',
  'Red Dead Redemption 2': 'rdr2',
  'Helldivers 2': 'helldivers2',
  'Counter-Strike 2': 'cs2',
  'Fortnite': 'fortnite',
  'Apex Legends': 'apex',
  'Marvel Rivals': 'marvel-rivals',
  // Titles the existing sources also cover. At least one shared game is what
  // connects a new source to the fit — without one the corpus splits into
  // islands and the new parts get dropped as unrelatable to the anchor.
  'Ghost of Tsushima': 'ghost-of-tsushima',
  'Black Myth: Wukong': 'black-myth-wukong',
  'Stalker 2': 'stalker-2',
  'Space Marine 2': 'space-marine-2',
  'F1 24': 'f1-24',
  'God of War Ragnarök': 'god-of-war-ragnarok',
  'Final Fantasy XVI': 'final-fantasy-16',
  'Horizon Forbidden West': 'horizon-forbidden-west',
  'Kingdom Come Deliverance 2': 'kingdom-come-deliverance-2',
  'Indiana Jones and the Great Circle': 'indiana-jones-great-circle',
  'Call of Duty Black Ops 6': 'cod-black-ops-6',
  "Senua's Saga Hellblade 2": 'hellblade-2',
  'Dragon Age: The Veilguard': 'dragon-age-veilguard',
  "Dragon's Dogma 2": 'dragons-dogma-2',
  'Silent Hill 2': 'silent-hill-2',
  'Star Wars Outlaws': 'star-wars-outlaws',
  'Satisfactory': 'satisfactory',
  'Frostpunk 2': 'frostpunk-2',
}

export const gameIdFor = (name) => GAME_IDS[String(name ?? '').trim()] ?? null

// Notebookcheck appends a clock to the CPU name ("AMD Ryzen 7 9800X3D 4.7GHz").
// Matched on the model token rather than the whole string, and explicitly — an
// unrecognised CPU returns null so its rows are refused.
const CPU_IDS = {
  '9800x3d': 'cpu-ryzen-7-9800x3d',
  '7950x': 'cpu-ryzen-9-7950x',
  '7800x3d': 'cpu-ryzen-7-7800x3d',
  '13900k': 'cpu-i9-13900k',
  '14900k': 'cpu-i9-14900k',
  '12900k': 'cpu-i9-12900k',
  '5800x3d': 'cpu-ryzen-7-5800x3d',
  '9950x': 'cpu-ryzen-9-9950x',
  // The older desktop benches. Notebookcheck re-bases periodically and each page
  // pools rows from every generation of its bench, so these three carry most of
  // the coverage for the cards the current bench never tested.
  //
  // The Ryzen 7 2700X and Core i9-9900K benches are deliberately ABSENT: neither
  // is a catalogue part, and import-bench-tsv refuses a whole file whose fixed
  // side does not resolve. 841 rows are left on the table by that, knowingly.
  '5900x': 'cpu-ryzen-9-5900x',
  '3900x': 'cpu-ryzen-9-3900x',
  '5950x': 'cpu-ryzen-9-5950x',
}

export function cpuIdFor(name) {
  const s = String(name ?? '').toLowerCase()
  if (!s) return null
  for (const [token, id] of Object.entries(CPU_IDS)) {
    // Bounded so "13900k" cannot also match "13900ks".
    if (new RegExp(`\\b${token}\\b`).test(s)) return id
  }
  return null
}

// The visible preset token is the RESOLUTION on the QHD and 4K rows ("<b>4K</b>
// 3840x2160"), so the preset itself has to come from the tooltip.
const PRESET_WORDS = [
  ['ultra', 'ultra'], ['maximum', 'ultra'], ['epic', 'epic'],
  ['very high', 'very-high'], ['high', 'high'], ['medium', 'medium'], ['low', 'low'],
]

export function presetIdFor({ presetFull, preset } = {}) {
  const text = String(presetFull || preset || '').toLowerCase()
  if (!text) return null
  for (const [word, id] of PRESET_WORDS) if (text.includes(word)) return id
  return null
}

// An upscaled frame rate is not a native one and the two are indistinguishable in
// a table. TAA and "FSR off" are native — the first is anti-aliasing, the second
// says so. A row that names DLSS/FSR/XeSS without a quality has no honest value
// to record, so it returns null and the row is refused rather than defaulted.
export function upscalingFor({ presetFull } = {}) {
  const text = String(presetFull ?? '')
  if (/\b(fsr|dlss|xess)\s*(off|disabled)\b/i.test(text)) return 'native'
  if (/\b(fsr|dlss|xess)\b/i.test(text)) return null
  return 'native'
}

// The system line is `<br>` separated and NOT fixed width: some rows carry a
// numeric benchmark id first. Identify the fields by shape, never by position.
function systemLine(detail) {
  const head = detail.split(/<br\s*\/?>\s*<br/)[0] ?? ''
  const fields = head
    .split(/<br\s*\/?>/)
    .map((f) => f.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
    .filter(Boolean)
    .filter((f) => !/^\d+$/.test(f))
  return { cpu: fields.at(-2) ?? null, gpu: fields.at(-1) ?? null }
}

// Parsed BLOCK-WISE, one row per row marker. A single big pattern silently
// dropped 8 of 499 rows and shifted the CPU and GPU fields on 52 more — the same
// mistake that lost the slower half of every ComputerBase chart twice, and it
// biases the corpus upward every time. A row this cannot understand comes back
// with missing fields, never absent and never wearing a neighbour's numbers.
export function extractRows(html, { expectGpu } = {}) {
  const marks = []
  for (const m of String(html).matchAll(/<h3[^>]*class="gpugame_header"[^>]*>([\s\S]*?)<\/h3>/g)) {
    marks.push({ at: m.index, game: m[1].replace(/<[^>]+>/g, '').trim() })
  }
  const gameAt = (idx) => {
    let g = null
    for (const mk of marks) { if (mk.at < idx) g = mk.game; else break }
    return g
  }

  const MARKER = /<div class="gpugame_details"[^>]*>\s*<abbr class="tooltip"/g
  const starts = [...String(html).matchAll(MARKER)].map((m) => m.index)
  const rows = []

  for (let i = 0; i < starts.length; i++) {
    const block = String(html).slice(starts[i], starts[i + 1] ?? Math.min(starts[i] + 4000, html.length))
    const head = /<abbr class="tooltip" title="([^"]*)">\s*<b>([^<]*)<\/b>\s*([0-9]+x[0-9]+)/.exec(block)
    const avg = /class="gpugame_resulta"[^>]*>([\d.]+)</.exec(block)

    // Bounded to THIS row's own detail element. The slice runs to the next row
    // marker, so for the last row of a game section it spills into the following
    // section — which slid a game title into the GPU field and a fast game's 1%
    // low onto a slow game's average.
    const bStart = block.indexOf('class="gpugame_benchdiv"')
    const detail = bStart === -1 ? '' : block.slice(bStart, block.indexOf('</div>', bStart))
    const sys = systemLine(detail)

    const nums = {}
    for (const n of detail.matchAll(/(min|P0\.1|P1|max):\s*<span[^>]*>([\d.]+)<\/span>/g)) {
      nums[n[1]] = Number(n[2])
    }

    rows.push({
      game: gameAt(starts[i]),
      presetFull: head?.[1] ?? null,
      preset: head?.[2] ?? null,
      resolution: RESOLUTIONS[head?.[3]] ?? null,
      avgFps: avg ? Number(avg[1]) : null,
      cpu: sys.cpu,
      gpu: sys.gpu,
      min: nums.min ?? null,
      p01: nums['P0.1'] ?? null,
      p1: nums.P1 ?? null,
      max: nums.max ?? null,
      gpuMismatch: expectGpu ? !new RegExp(expectGpu.replace(/\s+/g, '\\s+'), 'i').test(sys.gpu ?? '') : false,
    })
  }
  return rows
}

// Extracted rows -> importable rows, with a stated reason for every refusal.
// Nothing is repaired or defaulted: a row that cannot be attributed, or whose own
// figures contradict each other, is dropped and counted.
// The schema will not hold a low outside this range. A 0.8 fps 1% low under a
// 6.5 fps average is a real measurement of something unplayable, so the low is
// dropped and the average kept rather than losing the row or nudging the figure.
const LOW_MIN_FPS = 1
const LOW_MAX_FPS = 2000

export function toRows(extracted, { gpuId, onlyCpuId } = {}) {
  const rows = []
  const rejected = []
  const drop = (row, reason) => rejected.push({ row, reason })

  for (const r of extracted) {
    if (r.gpuMismatch) { drop(r, 'row names a different GPU than the page it came from'); continue }
    if (!r.resolution) { drop(r, 'resolution not one the corpus records'); continue }
    if (!Number.isFinite(r.avgFps)) { drop(r, 'no average frame rate'); continue }

    const gameId = gameIdFor(r.game)
    if (!gameId) { drop(r, `game not in the catalogue: ${r.game}`); continue }

    const cpuId = cpuIdFor(r.cpu)
    if (!cpuId) { drop(r, `cpu not recognised: ${r.cpu}`); continue }
    if (onlyCpuId && cpuId !== onlyCpuId) { drop(r, `measured on a different test system (${cpuId})`); continue }

    const presetId = presetIdFor(r)
    if (!presetId) { drop(r, `preset not readable: ${r.presetFull}`); continue }

    const upscaling = upscalingFor(r)
    if (!upscaling) { drop(r, 'upscaling named without a quality, so the render scale is unstated'); continue }

    // Notebookcheck's own data carries rows where these contradict. Whatever
    // those figures are, they are not the statistics they are labelled as, so
    // neither the low nor the average can be trusted for that row.
    if (r.p1 != null && r.min != null && r.p1 < r.min) {
      drop(r, `1% low ${r.p1} is below the stated minimum ${r.min}`); continue
    }
    if (r.p1 != null && r.avgFps < r.p1) {
      drop(r, `average below the 1% low (${r.avgFps} < ${r.p1})`); continue
    }

    const low = r.p1 != null && r.p1 >= LOW_MIN_FPS && r.p1 <= LOW_MAX_FPS ? r.p1 : null

    rows.push({
      gameId, resolution: r.resolution, presetId, upscaling,
      partId: gpuId, cpuId, avg: r.avgFps, low,
    })
  }

  // One configuration measured twice with DIFFERENT results cannot be resolved
  // from the page, and the two rows collide on entry id — where the importer
  // keeps whichever lands first, silently, which is how a re-test's numbers get
  // filed as the original. So the whole conflicting set is refused and counted.
  // Identical repeats are not a conflict and collapse to one.
  const keyOf = (r) => `${r.gameId}|${r.resolution}|${r.presetId}|${r.upscaling}|${r.partId}|${r.cpuId}`
  const groups = new Map()
  for (const r of rows) {
    if (!groups.has(keyOf(r))) groups.set(keyOf(r), [])
    groups.get(keyOf(r)).push(r)
  }

  const kept = []
  for (const [, group] of groups) {
    const distinct = new Set(group.map((r) => `${r.avg}|${r.low}`))
    if (distinct.size === 1) { kept.push(group[0]); continue }
    for (const r of group) {
      drop(r, `configuration measured more than once with different results ` +
              `(${group.map((g) => g.avg).join(' vs ')})`)
    }
  }

  return { rows: kept, rejected }
}
