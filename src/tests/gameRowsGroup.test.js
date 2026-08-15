import { describe, it, expect } from 'vitest'
import {
  GENRE_LABEL, GENRE_ORDER, groupByGenre, sortGameRows, SORT_KEYS,
} from '../lib/perfEngine/gameRows'

const cell = (avgFps) => ({
  avgFps, lowFps: avgFps - 20, basis: 'ceiling', bound: 'upper',
  cpuShare: null, limitedBy: null, caveats: [], errorPct: null,
  presetId: 'ultra', upscaling: 'native',
})

const g = (over = {}) => ({
  gameId: 'a', name: 'Alpha', genre: 'shooter', preset: 'Ultra', presetId: 'ultra',
  presetTier: 4, upscaling: 'native',
  cells: { '1080p': cell(300), '1440p': cell(200), '4k': cell(100) },
  basis: 'ceiling', errorPct: null, caveats: [], otherPresets: [], bestFps: 300,
  ...over,
})

describe('groupByGenre', () => {
  it('puts each game under its own genre', () => {
    const out = groupByGenre([
      g({ gameId: 'a', genre: 'shooter' }),
      g({ gameId: 'b', genre: 'rpg' }),
      g({ gameId: 'c', genre: 'shooter' }),
    ])
    expect(out.map((x) => x.genre)).toEqual(['shooter', 'rpg'])
    expect(out[0].games.map((x) => x.gameId)).toEqual(['a', 'c'])
    expect(out[1].games.map((x) => x.gameId)).toEqual(['b'])
  })

  it('orders genres by GENRE_ORDER, not by how many games each has', () => {
    // Otherwise the headings reshuffle every time the corpus grows, and a
    // reader who learned where "Racing" sits has to find it again.
    //
    // ⚠️ The BIG genre is the one GENRE_ORDER puts LAST. Written the other way
    // round — three shooters and one racer — both implementations return
    // ['shooter', 'racing'] and this assertion proves nothing. It passed
    // against a size-ordered mutant before the fixture was inverted.
    const out = groupByGenre([
      g({ gameId: 'a', genre: 'racing' }),
      g({ gameId: 'b', genre: 'racing' }),
      g({ gameId: 'c', genre: 'racing' }),
      g({ gameId: 'd', genre: 'shooter' }),
    ])
    expect(out.map((x) => x.genre)).toEqual(['shooter', 'racing'])
    expect(out[0].count).toBe(1)
    expect(out[1].count).toBe(3)
  })

  it('omits a genre no game is in, rather than showing an empty bar', () => {
    const out = groupByGenre([g({ genre: 'racing' })])
    expect(out).toHaveLength(1)
    expect(out[0].genre).toBe('racing')
  })

  it('carries a label and a count for the collapsed bar to show', () => {
    // The bars are shut on arrival, so the bar itself has to say what is
    // inside it or there is no reason to open one.
    const out = groupByGenre([g({ gameId: 'a' }), g({ gameId: 'b' })])
    expect(out[0].label).toBe(GENRE_LABEL.shooter)
    expect(out[0].count).toBe(2)
  })

  it('reports the fps range of the target column, fastest first', () => {
    const out = groupByGenre([
      g({ gameId: 'a', cells: { '1080p': cell(300), '1440p': cell(200), '4k': cell(100) } }),
      g({ gameId: 'b', cells: { '1080p': cell(90), '1440p': cell(60), '4k': cell(30) } }),
    ], { target: '1440p' })
    expect(out[0].fastest).toBe(200)
    expect(out[0].slowest).toBe(60)
  })

  it('ignores cells the target column has no answer for', () => {
    // A null cell must not read as 0 fps in the bar's range, which would put
    // "0–200" on a genre whose slowest measured game runs at 60.
    const out = groupByGenre([
      g({ gameId: 'a', cells: { '1080p': cell(300), '1440p': cell(200), '4k': null } }),
      g({ gameId: 'b', cells: { '1080p': cell(90), '1440p': null, '4k': null } }),
    ], { target: '1440p' })
    expect(out[0].fastest).toBe(200)
    expect(out[0].slowest).toBe(200)
  })

  it('leaves the range null when the target column is empty for every game', () => {
    const out = groupByGenre([g({ cells: { '1080p': cell(300), '1440p': null, '4k': null } })],
      { target: '1440p' })
    expect(out[0].fastest).toBeNull()
    expect(out[0].slowest).toBeNull()
  })

  it('collects an unrecognised genre under Other, at the end', () => {
    // Cannot happen through gameMeta — buildPerfGames refuses a game with no
    // genre. It can happen if a genre is added to the data and not to this
    // file, and dropping those games silently is the worse failure.
    const out = groupByGenre([g({ gameId: 'a', genre: 'shooter' }), g({ gameId: 'b', genre: 'yodelling' })])
    expect(out.map((x) => x.genre)).toEqual(['shooter', 'other'])
    expect(out[1].games.map((x) => x.gameId)).toEqual(['b'])
  })

  it('names every genre it orders', () => {
    for (const key of GENRE_ORDER) expect(GENRE_LABEL[key], key).toBeTruthy()
  })
})

describe('sortGameRows', () => {
  const rows = [
    g({ gameId: 'b', name: 'Bravo', presetTier: 2, basis: 'measured',
        cells: { '1080p': cell(100), '1440p': cell(500), '4k': cell(10) }, bestFps: 500 }),
    g({ gameId: 'a', name: 'Alpha', presetTier: 4, basis: 'ceiling',
        cells: { '1080p': cell(300), '1440p': cell(200), '4k': cell(100) }, bestFps: 300 }),
  ]

  it('sorts a resolution column by that column, largest first', () => {
    // ⚠️ By the CLICKED column, not by bestFps. Bravo is slower overall but
    // faster at 1440p, so a sort that fell back to bestFps would put Alpha
    // first and look almost right.
    expect(sortGameRows(rows, { key: '1440p', dir: 'desc' }).map((x) => x.gameId))
      .toEqual(['b', 'a'])
    expect(sortGameRows(rows, { key: '4k', dir: 'desc' }).map((x) => x.gameId))
      .toEqual(['a', 'b'])
  })

  it('reverses to smallest first', () => {
    expect(sortGameRows(rows, { key: '1440p', dir: 'asc' }).map((x) => x.gameId))
      .toEqual(['a', 'b'])
  })

  it('sorts the game column alphabetically', () => {
    expect(sortGameRows(rows, { key: 'name', dir: 'asc' }).map((x) => x.name))
      .toEqual(['Alpha', 'Bravo'])
    expect(sortGameRows(rows, { key: 'name', dir: 'desc' }).map((x) => x.name))
      .toEqual(['Bravo', 'Alpha'])
  })

  it('sorts the preset column by tier, heaviest first', () => {
    expect(sortGameRows(rows, { key: 'preset', dir: 'desc' }).map((x) => x.gameId))
      .toEqual(['a', 'b'])
  })

  it('sorts the basis column by how well evidenced it is', () => {
    expect(sortGameRows(rows, { key: 'basis', dir: 'desc' }).map((x) => x.gameId))
      .toEqual(['b', 'a'])
  })

  it('sinks a game with no answer in the sorted column to the bottom, both ways', () => {
    // ⚠️ Both directions. A dash is absence, not a very small number: sorting
    // ascending must not promote every empty cell to the top of the table.
    const withGap = [
      g({ gameId: 'gap', cells: { '1080p': cell(300), '1440p': null, '4k': null } }),
      g({ gameId: 'has', cells: { '1080p': cell(50), '1440p': cell(40), '4k': cell(30) } }),
    ]
    expect(sortGameRows(withGap, { key: '1440p', dir: 'desc' }).map((x) => x.gameId))
      .toEqual(['has', 'gap'])
    expect(sortGameRows(withGap, { key: '1440p', dir: 'asc' }).map((x) => x.gameId))
      .toEqual(['has', 'gap'])
  })

  it('breaks a tie on gameId so the order cannot depend on array order', () => {
    const tied = [
      g({ gameId: 'zulu', name: 'Zulu', cells: { '1440p': cell(100) } }),
      g({ gameId: 'alpha', name: 'Alpha', cells: { '1440p': cell(100) } }),
    ]
    expect(sortGameRows(tied, { key: '1440p', dir: 'desc' }).map((x) => x.gameId))
      .toEqual(['alpha', 'zulu'])
  })

  it('returns the default fps order when nothing is sorted', () => {
    expect(sortGameRows(rows, null).map((x) => x.gameId)).toEqual(['b', 'a'])
  })

  it('does not mutate the array it was given', () => {
    const before = rows.map((x) => x.gameId)
    sortGameRows(rows, { key: 'name', dir: 'asc' })
    expect(rows.map((x) => x.gameId)).toEqual(before)
  })

  it('offers a sort key for every column the table renders', () => {
    expect(SORT_KEYS).toEqual(['name', 'preset', '1080p', '1440p', '4k', 'basis'])
  })
})
