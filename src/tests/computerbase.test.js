import { describe, it, expect } from 'vitest'
import { parseChartTitle, extractCharts, extractCpuCharts, CB_RESOLUTIONS, CB_UPSCALING,
  CB_GPU_IDS, CB_CPU_IDS } from '../lib/perfEngine/computerbase'
import parts from '../data/partsData.json'

// Markup copied verbatim from the RX 9070 review, including the two class
// strings that have silently dropped rows here before.
const CHART = `
<div class="chart__title nojs-block">Black Myth: Wukong, 2.560 × 1.440, DLSS/FSR Quality</div>
<ul class="chart__groups">
<li class="chart__group">
<div class="chart__group-header">FPS, Durchschnitt:</div>
<ul class="chart__group-body">
<li class="chart__row">
<div class="chart__item">
      GeForce RTX 5090 (32 GB)
</div>
<div class="chart__value">
<div class="chart__bar chart-color-4" style="width:100%">
<div class="chart__label" data-value="71.6">71,6</div>
</div></div></li>
<li class="chart__row">
<div class="chart__item"><strong><u>Radeon RX 9070 XT (16 GB)</u></strong></div>
<div class="chart__value">
<div class="chart__bar chart-color-3" style="width:63.3%">
<div class="chart__label" data-value="45.3">45,3</div>
</div></div></li>
<li class="chart__row chart__row--hidden nojs-tr" hidden>
<div class="chart__item">
      GeForce RTX 4060 (8 GB)
</div>
<div class="chart__value">
<div class="chart__bar chart-color-8" style="width:20.1%">
<div class="chart__label chart__label--outside" data-value="14.4">14,4</div>
</div></div></li>
</ul></li>
<li class="chart__group">
<div class="chart__group-header">FPS, 1% Perzentil:</div>
<ul class="chart__group-body">
<li class="chart__row">
<div class="chart__item">
      GeForce RTX 5090 (32 GB)
</div>
<div class="chart__value">
<div class="chart__bar chart-color-4" style="width:100%">
<div class="chart__label" data-value="58.2">58,2</div>
</div></div></li>
<li class="chart__row chart__row--hidden nojs-tr" hidden>
<div class="chart__item">
      GeForce RTX 4060 (8 GB)
</div>
<div class="chart__value">
<div class="chart__bar chart-color-8" style="width:19%">
<div class="chart__label chart__label--outside" data-value="11.1">11,1</div>
</div></div></li>
</ul></li>
</ul>
`

describe('parseChartTitle', () => {
  it('splits a title into game, resolution and render scale', () => {
    expect(parseChartTitle('Black Myth: Wukong, 2.560 × 1.440, DLSS/FSR Quality')).toEqual({
      game: 'Black Myth: Wukong', resolution: '1440p', upscaling: 'quality',
    })
  })

  it('reads 4K, and a title with no scale suffix as native', () => {
    expect(parseChartTitle('F1 24, 3.840 × 2.160')).toEqual({
      game: 'F1 24', resolution: '4k', upscaling: 'native',
    })
  })

  it('treats every spelling of native as native', () => {
    for (const s of ['TAA Native', 'DLSS/FSR Native']) {
      expect(parseChartTitle(`Stalker 2, 2.560 × 1.440, ${s}`).upscaling).toBe('native')
    }
  })

  it('refuses 21:9 ultrawide, which RESOLUTIONS has no slot for', () => {
    // 34% more pixels than 16:9 at the same height. Filing it as 1440p would
    // assert a pixel count nobody measured.
    expect(parseChartTitle('Ghost of Tsushima, 3.440 × 1.440, DLSS/FSR Native')).toBeNull()
  })

  it('refuses a render scale that is not a named mode', () => {
    // "70 % TSR" is a raw render scale, not one of the named upscaling modes.
    // Calling it Quality (66.7%) would misstate it.
    expect(parseChartTitle('Lego: Horizon Adventures, 2.560 × 1.440, 70 % TSR')).toBeNull()
  })

  it('reads a rasteriser chart whatever position the qualifier sits in', () => {
    // Three orderings appear in one review. The qualifier is en-dash separated
    // and lands before the scale, after it, or after the resolution.
    expect(parseChartTitle("Dragon's Dogma 2, 2.560 × 1.440, TAA Native – Rasterizer"))
      .toEqual({ game: "Dragon's Dogma 2", resolution: '1440p', upscaling: 'native' })
    expect(parseChartTitle('F1 24, 2.560 × 1.440 – Rasterizer, TAA Native'))
      .toEqual({ game: 'F1 24', resolution: '1440p', upscaling: 'native' })
    expect(parseChartTitle('Spider-Man 2, 3.840 × 2.160 – DLSS/FSR Native, Rasterizer'))
      .toEqual({ game: 'Spider-Man 2', resolution: '4k', upscaling: 'native' })
  })

  it('refuses a ray-tracing chart', () => {
    // Ray tracing is a materially different setting from the same preset with it
    // off — a bigger difference than a preset step — and the cell key has no slot
    // for it. Filing it beside the rasteriser run would rebuild exactly the
    // mixing the upscaling key exists to prevent.
    expect(parseChartTitle('Silent Hill 2, 2.560 × 1.440, DLSS/FSR Quality – Raytracing'))
      .toBeNull()
    expect(parseChartTitle('Star Wars Outlaws, 3.840 × 2.160, DLSS/FSR Quality – Raytracing'))
      .toBeNull()
    // Indiana Jones is ray-traced always, so it has no rasteriser chart at all
    // and the review yields nothing for it. That is a refusal, not an omission.
    expect(parseChartTitle('Indiana Jones und der große Kreis, 2.560 × 1.440, TAA Native – Raytracing'))
      .toBeNull()
  })

  it('refuses a rating chart, which is not a game', () => {
    expect(parseChartTitle('Leistungsrating – Durchschnitts-FPS')).toBeNull()
    expect(parseChartTitle('Performancerating, 2.560 × 1.440')).toBeNull()
  })

  it('exposes its vocabularies so a caller can assert on them', () => {
    expect(CB_RESOLUTIONS['2.560 × 1.440']).toBe('1440p')
    expect(CB_UPSCALING['DLSS/FSR Quality']).toBe('quality')
  })
})

// Verbatim from the 9800X3D review, keeping one of each row shape that has to
// be told apart: stock, Turbo Mode, memory-overclocked, a non-standard memory
// kit, and Intel's stock "(Perf.)" profile.
const CPU_CHART = `
<div class="chart__title nojs-block">Ghost of Tsushima – FPS, Durchschnitt</div>
<ul class="chart__groups"><li class="chart__group"><ul class="chart__group-body">
<li class="chart__row"><div class="chart__item">
  AMD Ryzen 7 9800X3D (Turbo Mode)<br>
  <span class="chart__item-title-addtl">120/162 W, DDR5-5600CL32</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="202.7">202,7</div></div></div></li>
<li class="chart__row"><div class="chart__item">
  AMD Ryzen 7 9800X3D (DDR5-OC)<br>
  <span class="chart__item-title-addtl">120/162 W, DDR5-7800CL38</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="200.4">200,4</div></div></div></li>
<li class="chart__row"><div class="chart__item"><strong><u>AMD Ryzen 7 9800X3D</u></strong><br>
  <span class="chart__item-title-addtl">120/162 W, DDR5-5600CL32</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="199.2">199,2</div></div></div></li>
<li class="chart__row"><div class="chart__item">
  AMD Ryzen 7 7800X3D<br>
  <span class="chart__item-title-addtl">120/162 W, DDR5-5200CL30</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="191.3">191,3</div></div></div></li>
<li class="chart__row"><div class="chart__item">
  Intel Core i9-14900KS (Perf.)<br>
  <span class="chart__item-title-addtl">253/253 W, DDR5-5600CL32</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="178.7">178,7</div></div></div></li>
</ul></li></ul>
<div class="chart__title nojs-block">Ghost of Tsushima – FPS, 1% Perzentil</div>
<ul class="chart__groups"><li class="chart__group"><ul class="chart__group-body">
<li class="chart__row"><div class="chart__item"><strong><u>AMD Ryzen 7 9800X3D</u></strong><br>
  <span class="chart__item-title-addtl">120/162 W, DDR5-5600CL32</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="158.8">158,8</div></div></div></li>
</ul></li></ul>
<div class="chart__title nojs-block">Ghost of Tsushima – CPU Package Power</div>
<ul class="chart__groups"><li class="chart__group"><ul class="chart__group-body">
<li class="chart__row"><div class="chart__item"><strong><u>AMD Ryzen 7 9800X3D</u></strong><br>
  <span class="chart__item-title-addtl">120/162 W, DDR5-5600CL32</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="67">67</div></div></div></li>
</ul></li></ul>
`

describe('extractCpuCharts', () => {
  const [chart] = extractCpuCharts(CPU_CHART)

  it('pairs the average and percentile charts of one game', () => {
    expect(chart.game).toBe('Ghost of Tsushima')
    const stock = chart.rows.find((r) => r.part === 'AMD Ryzen 7 9800X3D')
    expect(stock).toMatchObject({ avg: 199.2, low: 158.8, memory: '120/162 W, DDR5-5600CL32' })
  })

  it('refuses non-stock configurations of a chip already in the chart', () => {
    // Turbo Mode and DDR5-OC are different machines from the stock row and
    // collide with it on entry id, where the importer's dedupe silently keeps
    // whichever landed first.
    expect(chart.rows.map((r) => r.part)).not.toContain('AMD Ryzen 7 9800X3D (Turbo Mode)')
    expect(chart.rows.map((r) => r.part)).not.toContain('AMD Ryzen 7 9800X3D (DDR5-OC)')
    expect(chart.rows.filter((r) => r.part === 'AMD Ryzen 7 9800X3D')).toHaveLength(1)
  })

  it("keeps Intel's stock (Perf.) profile, stripping the suffix from the name", () => {
    // (Perf.) is the stock power profile, not an overclock — the rows already in
    // the corpus are the (Perf.) ones.
    const ks = chart.rows.find((r) => r.part === 'Intel Core i9-14900KS')
    expect(ks.avg).toBe(178.7)
  })

  it('carries the memory configuration, so a non-standard kit can be refused', () => {
    // The 7800X3D ran DDR5-5200CL30 — not the review's recorded test system.
    const odd = chart.rows.find((r) => r.part === 'AMD Ryzen 7 7800X3D')
    expect(odd.memory).toBe('120/162 W, DDR5-5200CL30')
  })

  it('ignores the CPU Package Power chart, which is a wattage not a frame rate', () => {
    const stock = chart.rows.find((r) => r.part === 'AMD Ryzen 7 9800X3D')
    expect(stock.avg).toBe(199.2)
    expect(stock.avg).not.toBe(67)
  })
})

// Verbatim row shapes from the "Sieben CPUs unter 200 Euro" review, which
// charts four non-stock variants the 9800X3D review never used. Each is a
// different machine from the stock row and would collide with it on entry id.
const BUDGET_CHART = `
<div class="chart__title nojs-block">Anno 1800 – FPS, Durchschnitt</div>
<ul class="chart__groups"><li class="chart__group"><ul class="chart__group-body">
<li class="chart__row"><div class="chart__item">
  AMD Ryzen 5 „9600X3D“ (sim.)<br>
  <span class="chart__item-title-addtl">65/88 W, DDR5-5600CL26</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="188.1">188,1</div></div></div></li>
<li class="chart__row"><div class="chart__item">
  AMD Ryzen 7 9700X (cTDP)<br>
  <span class="chart__item-title-addtl">105/142 W, DDR5-5600CL26</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="171.4">171,4</div></div></div></li>
<li class="chart__row"><div class="chart__item">
  AMD Ryzen 9 9950X3D (Turbo GM)<br>
  <span class="chart__item-title-addtl">170/200 W, DDR5-5600CL26</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="196.3">196,3</div></div></div></li>
<li class="chart__row"><div class="chart__item">
  Intel Core Ultra 9 285K (CU)<br>
  <span class="chart__item-title-addtl">250/250 W, CU-DDR5-6400CL36</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="160.2">160,2</div></div></div></li>
<li class="chart__row"><div class="chart__item"><strong><u>Intel Core Ultra 9 285K</u></strong><br>
  <span class="chart__item-title-addtl">250/250 W, DDR5-5600CL26</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="151.8">151,8</div></div></div></li>
<li class="chart__row"><div class="chart__item">
  AMD Ryzen 7 5800X3D<br>
  <span class="chart__item-title-addtl">105/142 W, DDR4-3200CL14</span></div>
<div class="chart__value"><div class="chart__bar"><div class="chart__label" data-value="112.4">112,4</div></div></div></li>
</ul></li></ul>
`

describe('extractCpuCharts — non-stock variants of the budget review', () => {
  const [chart] = extractCpuCharts(BUDGET_CHART)
  const names = chart.rows.map((r) => r.part)

  it('refuses a SIMULATED part, which is not a product at all', () => {
    // ComputerBase simulates a "9600X3D" by disabling cores on a larger chip.
    // No such processor exists to buy, so filing it against a catalogue id would
    // be inventing a measurement of a part that cannot be bought.
    expect(names.some((n) => n.includes('9600X3D'))).toBe(false)
  })

  it('refuses cTDP and Turbo Game Mode rows', () => {
    // Both are non-stock power configurations of a chip charted stock elsewhere.
    expect(names).not.toContain('AMD Ryzen 7 9700X (cTDP)')
    expect(names).not.toContain('AMD Ryzen 9 9950X3D (Turbo GM)')
  })

  it('refuses the CUDIMM row while keeping its stock twin', () => {
    // The 285K is charted twice — DDR5-5600 and CUDIMM-6400 — precisely to show
    // the memory difference. Keeping both collides on entry id, and the CUDIMM
    // run is a memory upgrade, not the platform's stock configuration.
    expect(names).not.toContain('Intel Core Ultra 9 285K (CU)')
    const stock = chart.rows.filter((r) => r.part === 'Intel Core Ultra 9 285K')
    expect(stock).toHaveLength(1)
    expect(stock[0].avg).toBe(151.8)
  })

  it('KEEPS a chip on its own platform stock memory', () => {
    // The 5800X3D is AM4 and physically cannot run DDR5. DDR4-3200CL14 is not a
    // deviation from a standard — it is the only memory that chip takes, so it
    // is a separate bench rather than a refused row.
    const am4 = chart.rows.find((r) => r.part === 'AMD Ryzen 7 5800X3D')
    expect(am4).toMatchObject({ avg: 112.4, memory: '105/142 W, DDR4-3200CL14' })
  })
})

describe('CB_CPU_IDS', () => {
  it('resolves every mapped name to a real catalogue part', () => {
    const byId = new Set(parts.filter((p) => p.category === 'cpu').map((p) => p.id))
    const unresolved = Object.entries(CB_CPU_IDS)
      .filter(([, id]) => !byId.has(id))
      .map(([name, id]) => `${name} -> ${id}`)
    expect(unresolved).toEqual([])
  })
})

describe('CB_GPU_IDS', () => {
  it('resolves every mapped name to a real catalogue part', () => {
    // The whole reason the map is hand-written. Fuzzy matching put "RX 570" onto
    // gpu-rx-5700 on the Notebookcheck reader, and the catalogue's own id
    // spellings are not internally consistent — gpu-rtx-4060ti beside
    // gpu-rtx-3060-ti — so no derivation rule is right for every part.
    const byId = new Set(parts.filter((p) => p.category === 'gpu').map((p) => p.id))
    const unresolved = Object.entries(CB_GPU_IDS)
      .filter(([, id]) => !byId.has(id))
      .map(([name, id]) => `${name} -> ${id}`)
    expect(unresolved).toEqual([])
  })

  it('maps each catalogue part only once', () => {
    const ids = Object.values(CB_GPU_IDS)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('extractCharts', () => {
  const [chart] = extractCharts(CHART)

  it('finds the chart and its parsed title', () => {
    expect(chart.game).toBe('Black Myth: Wukong')
    expect(chart.resolution).toBe('1440p')
    expect(chart.upscaling).toBe('quality')
  })

  it('includes rows the page hides — they are the SLOWEST cards', () => {
    // The slower half of every chart carries chart__row--hidden. Anchoring on
    // class="chart__row" exactly loses everything below an RTX 4070, and the
    // loss biases the corpus upward.
    expect(chart.rows.map((r) => r.part)).toEqual([
      'GeForce RTX 5090 (32 GB)',
      'Radeon RX 9070 XT (16 GB)',
      'GeForce RTX 4060 (8 GB)',
    ])
  })

  it('includes labels rendered outside their bar — also the slowest cards', () => {
    // A bar too short to hold its label gets chart__label--outside. Anchoring on
    // class="chart__label" exactly drops whole AVERAGE rows, not just lows.
    expect(chart.rows.find((r) => r.part.includes('4060')).avg).toBe(14.4)
  })

  it('reads data-value, not the comma-decimal text', () => {
    // The visible text is German ("71,6"). parseFloat on it returns 71.
    expect(chart.rows[0].avg).toBe(71.6)
  })

  it('unwraps the highlighted part name', () => {
    // The reviewed card is wrapped in <strong><u>.
    expect(chart.rows[1].part).toBe('Radeon RX 9070 XT (16 GB)')
  })

  it('pairs each part average with its own 1% low', () => {
    expect(chart.rows[0].low).toBe(58.2)
    expect(chart.rows.find((r) => r.part.includes('4060')).low).toBe(11.1)
  })

  it('leaves the low null when the chart measured no low for that part', () => {
    // The 9070 XT appears in the average group and not the percentile group.
    // A missing low lands as null, never as an invented number.
    expect(chart.rows[1].low).toBeNull()
  })
})
