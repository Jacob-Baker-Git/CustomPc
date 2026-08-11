import { extractRows, NBC_GPU_PAGES, GAME_IDS, gameIdFor, cpuIdFor, presetIdFor, upscalingFor, toRows } from '../lib/perfEngine/notebookcheck'
import parts from '../data/partsData.json'
import legacyGames from '../data/gamesData.json'
import gameMeta from '../../data/games/gameMeta.json'

const row = (over = {}) => ({
  game: 'Cyberpunk 2077', presetFull: 'Ultra Preset', preset: 'ultra',
  resolution: '1440p', avgFps: 78.3, cpu: 'AMD Ryzen 7 9800X3D 4.7GHz',
  gpu: 'GeForce RTX 4070', min: 55, p01: 58, p1: 61.2, max: 96, ...over,
})

describe('the GPU page map is explicit, never fuzzy', () => {
  // A fuzzy name match put "RX 570" onto gpu-rx-5700 and left "RTX 3060"
  // choosing between the 8 GB, 12 GB and Ti parts. Attributing one card's frame
  // rates to another is the worst thing this corpus could do, so every page
  // states its catalogue id by hand.
  it('names a catalogue id for every page it lists', () => {
    for (const page of NBC_GPU_PAGES) {
      expect(page.gpuId, page.url).toMatch(/^gpu-[a-z0-9-]+$/)
      expect(page.url).toMatch(/^https:\/\/www\.notebookcheck\.net\/.+\.html$/)
      expect(page.expectGpu, page.gpuId).toBeTruthy()
    }
  })

  it('lists no page twice, and no catalogue part twice', () => {
    expect(new Set(NBC_GPU_PAGES.map((p) => p.url)).size).toBe(NBC_GPU_PAGES.length)
    expect(new Set(NBC_GPU_PAGES.map((p) => p.gpuId)).size).toBe(NBC_GPU_PAGES.length)
  })

  // A hand-written id is only safe if something checks it resolves. An id that
  // matches no catalogue part would import a whole page of measurements against
  // a card that does not exist, and the importer would take them.
  it('every gpuId resolves to a real catalogue part', () => {
    const gpuIds = new Set(parts.filter((p) => p.category === 'gpu').map((p) => p.id))
    for (const page of NBC_GPU_PAGES) {
      expect(gpuIds.has(page.gpuId), `${page.gpuId} is not a catalogue GPU`).toBe(true)
    }
  })
})

// A mapped id that exists in NEITHER list fails at import time with a whole file
// already written, so it is caught here instead. Resolved against gameMeta — the
// PERMITTED set — not perfGames, which is derived from what has been imported
// and so cannot vouch for a title that has not been imported yet.
//
// Derived from GAME_IDS rather than listed by hand: a hand-written list silently
// stops covering the mappings added after it, and this one already had.
describe('the game map resolves against the permitted ids', () => {
  it('every mapped id is a permitted game', () => {
    const ids = new Set([
      ...Object.keys(gameMeta.games),
      ...legacyGames.map((g) => g.id),
    ])
    const unknown = Object.entries(GAME_IDS)
      .filter(([, id]) => !ids.has(id))
      .map(([title, id]) => `"${title}" -> ${id}`)
    expect(unknown).toEqual([])
  })

  it('maps at least the titles the corpus already covers', () => {
    // A shared game is what connects a new source to the existing fit. Without
    // one the corpus splits into islands and the new parts get dropped.
    for (const title of ['Ghost of Tsushima', 'Black Myth: Wukong', 'Stalker 2']) {
      expect(gameIdFor(title), `"${title}" is not mapped`).toBeTruthy()
    }
  })

  it('maps no title to an id twice, which would merge two games into one', () => {
    const ids = Object.values(GAME_IDS)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dupes).toEqual([])
  })
})

describe('the older desktop benches', () => {
  it('recognises them by their model token', () => {
    expect(cpuIdFor('AMD Ryzen 9 5900X 3.7GHz')).toBe('cpu-ryzen-9-5900x')
    expect(cpuIdFor('AMD Ryzen 9 3900X 3.8GHz')).toBe('cpu-ryzen-9-3900x')
    expect(cpuIdFor('AMD Ryzen 9 5950X 3.4GHz')).toBe('cpu-ryzen-9-5950x')
  })

  it('keeps the three AM4 twelve/sixteen-core parts apart', () => {
    // 5900X, 5950X and 3900X differ only in digits that a loose match would
    // happily confuse, and attributing one machine's frame rates to another is
    // the worst thing this corpus could do.
    expect(cpuIdFor('AMD Ryzen 9 5950X 3.4GHz')).not.toBe('cpu-ryzen-9-5900x')
    expect(cpuIdFor('AMD Ryzen 9 3900X 3.8GHz')).not.toBe('cpu-ryzen-9-5900x')
    expect(cpuIdFor('AMD Ryzen 9 5900X 3.7GHz')).not.toBe('cpu-ryzen-9-5950x')
  })

  it('still refuses the benches whose CPU is not a catalogue part', () => {
    // 667 rows on the 2700X and 174 on the 9900K, knowingly left behind:
    // import-bench-tsv refuses a whole file whose fixed side cannot resolve to
    // a catalogue part, so mapping these would fail the import, not widen it.
    expect(cpuIdFor('AMD Ryzen 7 2700X 3.7GHz')).toBeNull()
    expect(cpuIdFor('Intel Core i9-9900K 3.6GHz')).toBeNull()
  })
})

describe('game names map to catalogue ids', () => {
  it('maps the titles the corpus has no coverage of', () => {
    expect(gameIdFor('Cyberpunk 2077')).toBe('cyberpunk')
    expect(gameIdFor("Baldur's Gate 3")).toBe('bg3')
    expect(gameIdFor('Starfield')).toBe('starfield')
    expect(gameIdFor('Alan Wake 2')).toBe('alan-wake-2')
  })

  it('maps titles the corpus already covers, so the two outlets meet on a cell', () => {
    // A shared game is what connects a new source to the existing fit. Without
    // one the corpus splits into islands and the new parts get dropped.
    expect(gameIdFor('Ghost of Tsushima')).toBe('ghost-of-tsushima')
    expect(gameIdFor('Black Myth: Wukong')).toBe('black-myth-wukong')
    expect(gameIdFor('Stalker 2')).toBe('stalker-2')
  })

  it("maps the outlet's own spelling for titles the catalogue already has", () => {
    // Both ids predate the performance engine and live in gamesData.json. The
    // reader knew neither spelling, so their rows were refused as "game not in
    // the catalogue" while the id sat in the list all along.
    expect(gameIdFor('GTA V')).toBe('gta5')
    expect(gameIdFor('Dota 2 Reborn')).toBe('dota2')
  })

  it('maps the mainstream titles the cached benches measure well', () => {
    expect(gameIdFor('The Finals')).toBe('the-finals')
    expect(gameIdFor('Diablo 4')).toBe('diablo-4')
    expect(gameIdFor('The Last of Us')).toBe('the-last-of-us')
    expect(gameIdFor('God of War')).toBe('god-of-war')
    expect(gameIdFor('Resident Evil 4 Remake')).toBe('resident-evil-4-remake')
  })

  it('refuses a re-measure of an already-mapped title under an old patch', () => {
    // 99 rows between them, and taking either would attribute a 2020 build's
    // performance to the current entry. They are measurements of a different
    // build of the game, not extra samples of the same one.
    expect(gameIdFor('Cyberpunk 2077 1.6')).toBeNull()
    expect(gameIdFor('Cyberpunk 2077 1.0')).toBeNull()
    // Same rule, opposite side: the v4 rows are mapped, the pre-v4 ones are not.
    expect(gameIdFor('The Witcher 3 v4')).toBe('witcher-3')
    expect(gameIdFor('The Witcher 3')).toBeNull()
  })

  it('keeps God of War and God of War Ragnarök apart', () => {
    expect(gameIdFor('God of War')).not.toBe(gameIdFor('God of War Ragnarök'))
  })

  it('returns null for a title with no catalogue game, rather than inventing one', () => {
    expect(gameIdFor('Company of Heroes 3')).toBeNull()
    expect(gameIdFor('')).toBeNull()
    expect(gameIdFor(undefined)).toBeNull()
  })
})

describe('CPU strings map to catalogue ids', () => {
  it('strips the clock speed Notebookcheck appends', () => {
    expect(cpuIdFor('AMD Ryzen 7 9800X3D 4.7GHz')).toBe('cpu-ryzen-7-9800x3d')
    expect(cpuIdFor('Intel Core i9-13900K 3GHz')).toBe('cpu-i9-13900k')
    expect(cpuIdFor('AMD Ryzen 9 7950X 4.5GHz')).toBe('cpu-ryzen-9-7950x')
  })

  it('returns null for an unrecognised CPU rather than guessing', () => {
    expect(cpuIdFor('Some Unknown CPU 3GHz')).toBeNull()
    expect(cpuIdFor(null)).toBeNull()
  })
})

describe('presets', () => {
  // The preset token is the RESOLUTION on the QHD and 4K rows, so the real
  // preset has to come from the tooltip text instead.
  it('reads the preset from the tooltip, not the visible token', () => {
    expect(presetIdFor({ presetFull: 'Ultra High', preset: '4K' })).toBe('ultra')
    expect(presetIdFor({ presetFull: 'Ultra Preset TAA', preset: 'QHD' })).toBe('ultra')
  })

  it('normalises the ladder', () => {
    expect(presetIdFor({ presetFull: 'Low Preset 16xAF TAA', preset: 'low' })).toBe('low')
    expect(presetIdFor({ presetFull: 'Medium Preset', preset: 'med.' })).toBe('medium')
    expect(presetIdFor({ presetFull: 'High', preset: 'high' })).toBe('high')
  })

  it('returns null when the preset cannot be read', () => {
    expect(presetIdFor({ presetFull: '', preset: '' })).toBeNull()
  })
})

describe('upscaling is never guessed', () => {
  it('reads anti-aliasing and "FSR off" as native, because they are', () => {
    expect(upscalingFor({ presetFull: 'Ultra Preset TAA' })).toBe('native')
    expect(upscalingFor({ presetFull: '1920x1080 Ultra Preset (FSR off)' })).toBe('native')
    expect(upscalingFor({ presetFull: 'Ultra High' })).toBe('native')
  })

  // An upscaled frame rate is not a native one, and the two are indistinguishable
  // in a table. Where a row says DLSS but not which quality, there is no honest
  // value to record — so the row is refused, not defaulted.
  it('refuses a row that upscales without saying at what quality', () => {
    expect(upscalingFor({ presetFull: '4K DLSS' })).toBeNull()
    expect(upscalingFor({ presetFull: 'Ultra FSR' })).toBeNull()
    expect(upscalingFor({ presetFull: 'High XeSS' })).toBeNull()
  })
})

describe('toRows keeps only what is valid and says why it dropped the rest', () => {
  const opts = { gpuId: 'gpu-rtx-4070' }

  it('accepts a clean row', () => {
    const { rows, rejected } = toRows([row()], opts)
    expect(rejected).toEqual([])
    expect(rows[0]).toMatchObject({
      gameId: 'cyberpunk', resolution: '1440p', presetId: 'ultra',
      upscaling: 'native', partId: 'gpu-rtx-4070', avg: 78.3, low: 61.2,
    })
  })

  // These survived a corrected parser, so they are in Notebookcheck's own data:
  // a "1% low" cannot sit below the run's absolute minimum, and an average
  // cannot sit below the 1% low. Whatever those two figures are, they are not
  // the statistics they are labelled as.
  it('refuses a row whose own statistics contradict each other', () => {
    const a = toRows([row({ min: 328, p1: 271, avgFps: 453 })], opts)
    expect(a.rows).toEqual([])
    expect(a.rejected[0].reason).toMatch(/below the stated minimum/i)

    const b = toRows([row({ min: 10, p1: 90, avgFps: 50 })], opts)
    expect(b.rows).toEqual([])
    expect(b.rejected[0].reason).toMatch(/average below/i)
  })

  it('refuses a row it cannot attribute', () => {
    expect(toRows([row({ game: 'Company of Heroes 3' })], opts).rejected[0].reason).toMatch(/game/i)
    expect(toRows([row({ cpu: 'Mystery CPU' })], opts).rejected[0].reason).toMatch(/cpu/i)
    expect(toRows([row({ resolution: null })], opts).rejected[0].reason).toMatch(/resolution/i)
    expect(toRows([row({ avgFps: null })], opts).rejected[0].reason).toMatch(/average/i)
  })

  it('keeps a row with no 1% low, because an average alone is still a measurement', () => {
    const { rows } = toRows([row({ p1: null, min: null, p01: null })], opts)
    expect(rows).toHaveLength(1)
    expect(rows[0].low).toBeNull()
  })

  // A 6.5 fps average with a 0.8 fps 1% low is a real measurement of something
  // unplayable, but the schema's low floor is 1 fps and it rejects the whole file
  // over it. Drop the LOW and keep the average — the average is measured and
  // there is no reason to lose it — rather than discarding the row or nudging the
  // figure up to fit.
  it('drops a 1% low the schema cannot hold, and keeps the average', () => {
    const { rows, rejected } = toRows([row({ avgFps: 6.5, min: 0.5, p01: 0.6, p1: 0.8 })], opts)
    expect(rows).toHaveLength(1)
    expect(rows[0].avg).toBe(6.5)
    expect(rows[0].low).toBeNull()
    expect(rejected).toEqual([])
  })

  // Two DIFFERENT measurements of one configuration collide on entry id, and the
  // importer keeps whichever lands first — silently, which is how a re-test's
  // numbers end up filed as the original. Neither can be preferred from the page,
  // so both go and the pair is counted.
  it('refuses a configuration measured twice with different results', () => {
    const dupes = [
      row({ game: 'Hogwarts Legacy', presetFull: 'High', avgFps: 18.0, p1: 12.7, min: 10 }),
      row({ game: 'Hogwarts Legacy', presetFull: 'High', avgFps: 13.2, p1: 11.7, min: 10 }),
    ]
    const { rows, rejected } = toRows(dupes, opts)
    expect(rows).toEqual([])
    expect(rejected).toHaveLength(2)
    for (const r of rejected) expect(r.reason).toMatch(/measured more than once/i)
  })

  it('keeps a configuration measured twice with the SAME result, which is not a conflict', () => {
    const same = [row({ avgFps: 78.3, p1: 61.2 }), row({ avgFps: 78.3, p1: 61.2 })]
    const { rows } = toRows(same, opts)
    expect(rows).toHaveLength(1)
  })

  // The corpus records one CPU per source, so a page's rows have to be filtered
  // to the bench being imported. Silently mixing three test systems under one
  // source would attribute one machine's numbers to another.
  it('keeps only the CPU it was asked for', () => {
    const rows = [row(), row({ cpu: 'Intel Core i9-13900K 3GHz' })]
    const out = toRows(rows, { ...opts, onlyCpuId: 'cpu-ryzen-7-9800x3d' })
    expect(out.rows).toHaveLength(1)
    expect(out.rejected[0].reason).toMatch(/different test system/i)
  })
})

describe('extractRows', () => {
  // The parser is regex over HTML, so the guard is that a row it cannot
  // understand appears as a row with missing fields — never as a missing row,
  // and never with a neighbour's numbers. Dropping the slow rows silently is the
  // mistake this corpus has already made twice, and it always biases upward.
  const html = `
    <h3 class="gpugame_header">Cyberpunk 2077</h3>
    <div class="gpugame_details"><abbr class="tooltip" title="Ultra Preset"><b>ultra</b> 2560x1440</abbr></div>
    <div class="gpugame_results"> <a class="gpugame_resulta">78.3</a>
      <div id="g1" class="gpugame_benchdiv"><a>[X]</a>
        <br>1234 <br>AMD Ryzen 7 9800X3D 4.7GHz <br >GeForce RTX 4070<br>
        <br>min: <span>55</span> fps, P1: <span>61.2</span> fps, max: <span>96</span> fps</div>
    </div>
    <h3 class="gpugame_header">Starfield</h3>
    <div class="gpugame_details"><abbr class="tooltip" title="Ultra Preset"><b>ultra</b> 3840x2160</abbr></div>
    <div class="gpugame_results"> <a class="gpugame_resulta">41.0</a>
      <div id="g2" class="gpugame_benchdiv"><a>[X]</a>
        <br>AMD Ryzen 7 9800X3D 4.7GHz <br >GeForce RTX 4070<br>
        <br>min: <span>30</span> fps, P1: <span>33</span> fps, max: <span>52</span> fps</div>
    </div>`

  it('parses one row per row marker', () => {
    expect(extractRows(html, { expectGpu: 'RTX 4070' })).toHaveLength(2)
  })

  it('attributes each row to the game heading above it', () => {
    const rows = extractRows(html, { expectGpu: 'RTX 4070' })
    expect(rows.map((r) => r.game)).toEqual(['Cyberpunk 2077', 'Starfield'])
  })

  it('reads the system line whether or not it carries a leading id', () => {
    const rows = extractRows(html, { expectGpu: 'RTX 4070' })
    for (const r of rows) {
      expect(r.cpu).toBe('AMD Ryzen 7 9800X3D 4.7GHz')
      expect(r.gpu).toBe('GeForce RTX 4070')
      expect(r.gpuMismatch).toBe(false)
    }
  })

  it('resolves the pixel counts to the corpus resolutions', () => {
    expect(extractRows(html).map((r) => r.resolution)).toEqual(['1440p', '4k'])
  })

  it('flags a row whose GPU field is not the page it came from', () => {
    const rows = extractRows(html, { expectGpu: 'RTX 5090' })
    expect(rows.every((r) => r.gpuMismatch)).toBe(true)
  })
})
