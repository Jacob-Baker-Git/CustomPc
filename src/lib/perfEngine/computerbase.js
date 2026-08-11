// Reader for ComputerBase benchmark charts.
//
// ComputerBase renders its charts as DOM TEXT rather than as images, and each
// bar carries its exact figure in a `data-value` attribute — so what comes out
// of here is transcribed, never estimated off a picture. That is what makes them
// one of only three outlets this corpus can use at all.
//
// They publish BOTH graphics-card reviews (many GPUs, one fixed CPU) and
// processor reviews (many CPUs, one fixed GPU) on a shared game parcours, which
// is the pairing an A+B cell needs — hence one reader for both.
//
// NO IMPORTS. scripts/ loads this under plain Node, which cannot resolve this
// project's extensionless relative imports.

// ⚠️ 21:9 IS DELIBERATELY ABSENT. `3.440 × 1.440` is 34% more pixels than 16:9
// at the same height, and RESOLUTIONS has no slot for it. Filing it under 1440p
// would assert a pixel count nobody measured.
export const CB_RESOLUTIONS = {
  '1.280 × 720': '720p',
  '1.920 × 1.080': '1080p',
  '2.560 × 1.440': '1440p',
  '3.840 × 2.160': '4k',
}

// The named upscaling modes, and nothing else. A chart headed "70 % TSR" states
// a raw render scale rather than a mode; calling it Quality (66.7%) would
// misstate the measurement, so such a chart is refused rather than mapped.
//
// "TAA Native" and "DLSS/FSR Native" both mean no upscaling — they name the
// anti-aliasing, which is not a render scale.
export const CB_UPSCALING = {
  'TAA Native': 'native',
  'DLSS/FSR Native': 'native',
  'FSR/DLSS Native': 'native',
  Native: 'native',
  'DLSS/FSR Quality': 'quality',
  'FSR/DLSS Quality': 'quality',
  'DLSS/FSR Balanced': 'balanced',
  'DLSS/FSR Performance': 'performance',
  'TSR Ultra Quality': 'ultra-quality',
}

// Part names are mapped BY HAND, never fuzzily.
//
// Fuzzy matching on the Notebookcheck reader put "RX 570" onto `gpu-rx-5700` and
// left "RTX 3060" choosing between the 8 GB, 12 GB and Ti parts. The catalogue's
// own id spellings are not even internally consistent — `gpu-rtx-4060ti` beside
// `gpu-rtx-3060-ti`, `gpu-rx-7700xt` beside `gpu-rx-6700-xt` — so any rule that
// derives an id from a name is wrong for some part. A test asserts every id here
// resolves against the catalogue.
export const CB_GPU_IDS = {
  'Arc A770 (16 GB)': 'gpu-intel-arc-a770',
  'Arc B580 (12 GB)': 'gpu-intel-arc-b580',
  'GeForce RTX 3060 Ti (8 GB)': 'gpu-rtx-3060-ti',
  'GeForce RTX 3080 (10 GB)': 'gpu-rtx-3080',
  'GeForce RTX 4060 (8 GB)': 'gpu-rtx-4060',
  'GeForce RTX 4060 Ti (8 GB)': 'gpu-rtx-4060ti',
  'GeForce RTX 4070 (12 GB)': 'gpu-rtx-4070',
  'GeForce RTX 4070 Super (12 GB)': 'gpu-rtx-4070-super',
  'GeForce RTX 4070 Ti Super (16 GB)': 'gpu-rtx-4070ti-super',
  'GeForce RTX 4080 Super (16 GB)': 'gpu-rtx-4080-super',
  'GeForce RTX 4090 (24 GB)': 'gpu-rtx-4090',
  'GeForce RTX 5070 (12 GB)': 'gpu-rtx-5070',
  'GeForce RTX 5070 Ti (16 GB)': 'gpu-rtx-5070ti',
  'GeForce RTX 5080 (16 GB)': 'gpu-rtx-5080',
  'GeForce RTX 5090 (32 GB)': 'gpu-rtx-5090',
  'Radeon RX 6700 XT (12 GB)': 'gpu-rx-6700-xt',
  'Radeon RX 6800 XT (16 GB)': 'gpu-rx-6800-xt',
  'Radeon RX 7600 (8 GB)': 'gpu-rx-7600',
  'Radeon RX 7700 XT (12 GB)': 'gpu-rx-7700xt',
  'Radeon RX 7800 XT (16 GB)': 'gpu-rx-7800xt',
  'Radeon RX 7900 GRE (16 GB)': 'gpu-rx-7900-gre',
  'Radeon RX 7900 XT (20 GB)': 'gpu-rx-7900xt',
  'Radeon RX 7900 XTX (24 GB)': 'gpu-rx-7900xtx',
  'Radeon RX 9070 (16 GB)': 'gpu-rx-9070',
  'Radeon RX 9070 XT (16 GB)': 'gpu-rx-9070xt',
  // Arc B570 is deliberately absent: no catalogue part, so its rows are refused.
}

// Same rule as CB_GPU_IDS: hand-written, never derived from the name.
export const CB_CPU_IDS = {
  'AMD Ryzen 5 9600X': 'cpu-ryzen-5-9600x',
  'AMD Ryzen 7 9700X': 'cpu-ryzen-7-9700x',
  'AMD Ryzen 7 9800X3D': 'cpu-ryzen-7-9800x3d',
  'AMD Ryzen 9 9900X': 'cpu-ryzen-9-9900x',
  'AMD Ryzen 9 9950X': 'cpu-ryzen-9-9950x',
  'Intel Core i5-14600K': 'cpu-i5-14600k',
  'Intel Core i7-14700K': 'cpu-i7-14700k',
  'Intel Core i9-14900K': 'cpu-i9-14900k',
  'Intel Core i9-14900KS': 'cpu-i9-14900ks',
  'Intel Core Ultra 5 245K': 'cpu-intel-ultra-5-245k',
  'Intel Core Ultra 7 265K': 'cpu-intel-ultra-7-265k',
  'Intel Core Ultra 9 285K': 'cpu-intel-ultra-9-285k',
  // Deliberately absent, so their rows are refused rather than filed against the
  // review's recorded test system:
  //   AMD Ryzen 7 7800X3D — ran DDR5-5200CL30, not the DDR5-5600CL32 standard
  //   AMD Ryzen 7 5800X3D — AM4 on DDR4-3200CL14, a different platform entirely
}

// Every row this review reports ran the same memory. A row that did not is not
// the recorded test system, whatever chip is on it.
export const CB_9800X3D_MEMORY = 'DDR5-5600CL32'

// Aggregate charts. They are a rating across the whole parcours, not a game.
const RATING = /rating|percentil-rating|frametimes$/i

// A chart is qualified as rasteriser or ray-traced when the review measured
// both. Ray tracing is a materially different setting from the same preset with
// it off — a bigger difference than a preset step — and the cell key has no slot
// for it, so filing an RT run beside its rasteriser twin would rebuild exactly
// the mixing the upscaling key exists to prevent.
//
// A game measured ONLY with ray tracing (Indiana Jones) therefore yields
// nothing. That is a refusal and it is counted, not an omission.
const RASTER = /^rasterizer$/i
const RAYTRACED = /^raytracing$/i

function decode(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// "Black Myth: Wukong, 2.560 × 1.440, DLSS/FSR Quality"
//   -> { game, resolution, upscaling }
//
// Returns null for anything this corpus cannot file honestly — an aggregate
// rating, an unlisted resolution, an unlisted render scale. Null is a REFUSAL,
// and every caller counts them rather than skipping quietly.
export function parseChartTitle(title) {
  const clean = decode(title)
  if (RATING.test(clean)) return null

  // The qualifiers after the game are comma OR en-dash separated, and their
  // ORDER VARIES within a single review:
  //
  //   Dragon's Dogma 2, 2.560 × 1.440, TAA Native – Rasterizer
  //   F1 24, 2.560 × 1.440 – Rasterizer, TAA Native
  //   Spider-Man 2, 3.840 × 2.160 – DLSS/FSR Native, Rasterizer
  //
  // So both separators are normalised to one and the fields are identified by
  // WHAT THEY ARE rather than by position. Reading position 2 as the resolution
  // silently dropped seven games here, two of which the CPU review also measures.
  const tokens = clean.split(/\s+[–—-]\s+|,/).map((p) => p.trim()).filter(Boolean)

  const resIndex = tokens.findIndex((t) => t in CB_RESOLUTIONS)
  if (resIndex < 1) return null
  const resolution = CB_RESOLUTIONS[tokens[resIndex]]

  const game = tokens.slice(0, resIndex).join(', ').trim()
  if (!game) return null

  // A title carrying no scale at all names no upscaler, which is native.
  let upscaling = 'native'
  for (const token of tokens.slice(resIndex + 1)) {
    if (RASTER.test(token)) continue
    if (RAYTRACED.test(token)) return null
    const named = CB_UPSCALING[token]
    // A trailing field that is neither a qualifier nor a named mode is a render
    // scale nobody named — "70 % TSR" is the live case. Refuse it rather than
    // defaulting to native: that is the difference between "we know it was
    // native" and "nobody said".
    if (!named) return null
    upscaling = named
  }

  return { game, resolution, upscaling }
}

// Parsed BLOCK-WISE, one row per marker, never with a single mega-regex.
//
// On the Notebookcheck reader a single combined pattern silently dropped 8 of
// 499 rows AND shifted the part/value fields on 52 more — a game title landed in
// the GPU slot. Splitting on the row marker first and reading each row's own
// fields makes a malformed row fail alone instead of corrupting its neighbours.
function rowsIn(groupHtml) {
  const out = []
  // Split on the row marker rather than matching a closing tag: `chart__row` is
  // followed by `chart__row--hidden nojs-tr` on the slower half of every chart,
  // so anchoring on class="chart__row" exactly loses everything below roughly an
  // RTX 4070 — and those are the SLOWEST cards, so the loss biases upward.
  const chunks = groupHtml.split(/<li class="chart__row/).slice(1)
  for (const chunk of chunks) {
    const item = /<div class="chart__item"[^>]*>([\s\S]*?)<\/div>/.exec(chunk)
    // Same trap one level down: a bar too short to hold its label is given
    // chart__label--outside, so an exact class match drops whole AVERAGE rows.
    // `data-value` is authoritative — the visible text is German ("71,6"), and
    // parseFloat on that returns 71.
    const value = /<div class="chart__label[^"]*"[^>]*data-value="([\d.]+)"/.exec(chunk)
    if (!item || !value) continue
    const part = decode(item[1])
    if (!part) continue
    out.push({ part, value: Number(value[1]) })
  }
  return out
}

// Processor reviews use a DIFFERENT chart shape from graphics-card reviews:
// the title carries the metric rather than the resolution ("Anno 1800 – FPS,
// Durchschnitt"), there is one chart per metric instead of two groups in one,
// and each row's power/memory configuration rides in a span inside chart__item.
//
// That span is what makes the non-stock rows separable mechanically rather than
// by position. ComputerBase charts several configurations of one chip, and they
// are NOT interchangeable: a Turbo-Mode or memory-overclocked row is a different
// machine from the stock one and would collide with it on entry id, where the
// importer's dedupe silently keeps whichever landed first.
const CPU_ROW_QUALIFIER = /\((Turbo Mode|DDR5-OC|DDR4-OC)\)/i

// "(Perf.)" is ComputerBase's stock Intel power profile, not an overclock, and
// the rows already in the corpus are the (Perf.) ones. It is stripped from the
// name rather than refused.
const CPU_STOCK_PROFILE = /\s*\((Perf\.|Performance)\)\s*$/i

// [{ game, rows: [{ part, memory, avg, low }] }] — one entry per game, with the
// average and percentile charts already paired.
export function extractCpuCharts(html) {
  const byGame = new Map()
  const blocks = html.split(/<div class="chart__title[^"]*">/).slice(1)

  for (const block of blocks) {
    const titleEnd = block.indexOf('</div>')
    if (titleEnd < 0) continue
    const title = decode(block.slice(0, titleEnd))
    if (RATING.test(title)) continue

    // "Game – FPS, Durchschnitt". Split on the en dash; the tail names the
    // metric. "CPU Package Power" shares the chart shape and is a wattage, not
    // a frame rate — importing it as one would be a category error.
    const dash = title.search(/\s+[–—]\s+/)
    if (dash < 0) continue
    const game = title.slice(0, dash).trim()
    const metric = title.slice(dash).trim()
    const isAvg = /Durchschnitt/i.test(metric)
    const isLow = /Perzentil/i.test(metric)
    if (!isAvg && !isLow) continue

    if (!byGame.has(game)) byGame.set(game, new Map())
    const rows = byGame.get(game)

    for (const chunk of block.split(/<li class="chart__row/).slice(1)) {
      const item = /<div class="chart__item"[^>]*>([\s\S]*?)<\/div>/.exec(chunk)
      const value = /<div class="chart__label[^"]*"[^>]*data-value="([\d.]+)"/.exec(chunk)
      if (!item || !value) continue

      const addtl = /<span class="chart__item-title-addtl">([\s\S]*?)<\/span>/.exec(item[1])
      const memory = addtl ? decode(addtl[1]) : ''
      const raw = decode(item[1].replace(
        /<span class="chart__item-title-addtl">[\s\S]*?<\/span>/, ''))
      if (!raw || CPU_ROW_QUALIFIER.test(raw)) continue

      const part = raw.replace(CPU_STOCK_PROFILE, '').trim()
      if (!rows.has(part)) rows.set(part, { part, memory, avg: null, low: null })
      rows.get(part)[isAvg ? 'avg' : 'low'] = Number(value[1])
    }
  }

  return [...byGame]
    .map(([game, rows]) => ({ game, rows: [...rows.values()].filter((r) => r.avg != null) }))
    .filter((g) => g.rows.length)
}

// [{ game, resolution, upscaling, rows: [{ part, avg, low }] }]
//
// `low` is null where the chart published no 1% percentile for that part. A
// missing low is recorded as missing, never inferred from the average.
export function extractCharts(html) {
  const charts = []
  const blocks = html.split(/<div class="chart__title[^"]*">/).slice(1)

  for (const block of blocks) {
    const titleEnd = block.indexOf('</div>')
    if (titleEnd < 0) continue
    const parsed = parseChartTitle(block.slice(0, titleEnd))
    if (!parsed) continue

    const groups = block.split(/<div class="chart__group-header">/).slice(1)
    const byPart = new Map()

    for (const group of groups) {
      const headerEnd = group.indexOf('</div>')
      const header = decode(group.slice(0, headerEnd))
      const isAvg = /Durchschnitt/i.test(header)
      const isLow = /Perzentil/i.test(header)
      // CPU package power shares the chart shape and is not a frame rate.
      // Importing it as one would be a category error.
      if (!isAvg && !isLow) continue

      for (const { part, value } of rowsIn(group)) {
        if (!byPart.has(part)) byPart.set(part, { part, avg: null, low: null })
        byPart.get(part)[isAvg ? 'avg' : 'low'] = value
      }
    }

    const rows = [...byPart.values()].filter((r) => r.avg != null)
    if (rows.length) charts.push({ ...parsed, rows })
  }

  return charts
}
