import { describe, it, expect } from 'vitest'
import { parseChartTitle, extractCharts, CB_RESOLUTIONS, CB_UPSCALING, CB_GPU_IDS }
  from '../lib/perfEngine/computerbase'
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
