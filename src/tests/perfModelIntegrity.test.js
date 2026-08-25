import { describe, it, expect } from 'vitest'
import { auditCorpus, validateSource, validateEntry, RESOLUTIONS, UPSCALING } from '../lib/benchSchema'
import partsData from '../data/partsData.json'
import legacyGames from '../data/gamesData.json'
import gameMeta from '../../data/games/gameMeta.json'
import perfModel from '../data/perfModel.json'

// The corpus may cite any PERMITTED game id, so the audit resolves against
// gameMeta plus the legacy catalogue — the same union the curation scripts use.
// Not perfGames.json: that is derived from the corpus, so auditing the corpus
// against it would be circular, and auditing against the legacy 22 alone would
// reject every real entry, because modern GPU roundups benchmark almost none of
// them.
const gamesData = [
  ...Object.keys(gameMeta.games).map((id) => ({ id })),
  ...legacyGames,
]
import sources from '../../data/benchmarks/sources.json'
import entries from '../../data/benchmarks/entries.json'
import validation from '../../data/benchmarks/validation.json'

// The corpus audit, in the spirit of catalogueCompatibility.test.js: it asks
// "is anything unusable?" rather than only checking rows in isolation. An
// entry naming a part that is not in the catalogue does not error anywhere —
// it silently contributes nothing to the fit and disappears.
describe('benchmark corpus integrity', () => {
  it('passes on the real corpus', () => {
    expect(auditCorpus({ sources, entries, parts: partsData, games: gamesData })).toEqual([])
  })

  it('passes on the held-out validation set too', () => {
    expect(auditCorpus({ sources, entries: validation, parts: partsData, games: gamesData }))
      .toEqual([])
  })

  it('an empty corpus is valid — the engine must ship before the data does', () => {
    expect(auditCorpus({ sources: [], entries: [], parts: partsData, games: gamesData }))
      .toEqual([])
  })

  it('rejects a source with no url or date', () => {
    expect(validateSource({ id: 's1', outlet: 'X', kind: 'gpu-scaling' }))
      .toEqual(expect.arrayContaining([
        expect.stringContaining('url'), expect.stringContaining('published'),
      ]))
  })

  it('rejects an entry naming a part that is not in the catalogue', () => {
    const problems = validateEntry(
      { id: 'e1', sourceId: 's1', gameId: 'cs2', resolution: '1440p', presetId: 'high',
        gpuId: 'gpu-does-not-exist', cpuId: 'cpu-ryzen-5-7600x', avgFps: 200 },
      { sourceIds: new Set(['s1']), partIds: new Set(partsData.map((p) => p.id)),
        gameIds: new Set(gamesData.map((g) => g.id)) },
    )
    expect(problems.join(' ')).toMatch(/gpu-does-not-exist/)
  })

  it('rejects an unknown resolution', () => {
    const problems = validateEntry(
      { id: 'e2', sourceId: 's1', gameId: 'cs2', resolution: '8k', presetId: 'high',
        gpuId: 'gpu-rtx-5070', cpuId: 'cpu-ryzen-5-7600x', avgFps: 200 },
      { sourceIds: new Set(['s1']), partIds: new Set(partsData.map((p) => p.id)),
        gameIds: new Set(gamesData.map((g) => g.id)) },
    )
    expect(problems.join(' ')).toMatch(/resolution/)
    // 720p is legal in the CORPUS because that is where CPU-scaling reviews
    // measure. It is not a resolution the engine ever quotes.
    expect(RESOLUTIONS).toEqual(['720p', '1080p', '1440p', '4k'])
  })

  it('rejects a non-positive or absurd frame rate', () => {
    const ctx = { sourceIds: new Set(['s1']), partIds: new Set(partsData.map((p) => p.id)),
                  gameIds: new Set(gamesData.map((g) => g.id)) }
    const base = { id: 'e3', sourceId: 's1', gameId: 'cs2', resolution: '1440p',
                   presetId: 'high', gpuId: 'gpu-rtx-5070', cpuId: 'cpu-ryzen-5-7600x' }
    expect(validateEntry({ ...base, avgFps: 0 }, ctx).join(' ')).toMatch(/avgFps/)
    expect(validateEntry({ ...base, avgFps: 5000 }, ctx).join(' ')).toMatch(/avgFps/)
  })

  it('rejects a 1% low above the average', () => {
    const problems = validateEntry(
      { id: 'e4', sourceId: 's1', gameId: 'cs2', resolution: '1440p', presetId: 'high',
        gpuId: 'gpu-rtx-5070', cpuId: 'cpu-ryzen-5-7600x',
        avgFps: 120, lowFps: 140, lowKind: '1%' },
      { sourceIds: new Set(['s1']), partIds: new Set(partsData.map((p) => p.id)),
        gameIds: new Set(gamesData.map((g) => g.id)) },
    )
    expect(problems.join(' ')).toMatch(/lowFps/)
  })

  it('rejects a numeric field typed as a string', () => {
    // `"200" >= 1` is true in JavaScript, so a bare range check waves this
    // through. Hand-typed JSON is exactly where it happens.
    const ctx = { sourceIds: new Set(['s1']), partIds: new Set(partsData.map((p) => p.id)),
                  gameIds: new Set(gamesData.map((g) => g.id)) }
    const base = { id: 'e5', sourceId: 's1', gameId: 'cs2', resolution: '1440p',
                   presetId: 'high', gpuId: 'gpu-rtx-5070', cpuId: 'cpu-ryzen-5-7600x' }
    expect(validateEntry({ ...base, avgFps: '200' }, ctx).join(' ')).toMatch(/avgFps/)
    expect(validateEntry({ ...base, avgFps: 200, lowFps: '150', lowKind: '1%' }, ctx).join(' '))
      .toMatch(/lowFps/)
    expect(validateEntry({ ...base, avgFps: 200, weight: '1' }, ctx).join(' ')).toMatch(/weight/)
    // and the valid forms still pass, so this is not rejecting everything
    expect(validateEntry({ ...base, avgFps: 200, weight: 1, upscaling: 'native' }, ctx))
      .toEqual([])
  })

  it('requires an upscaling mode, because a DLSS number is not a native one', () => {
    // ComputerBase — the one outlet whose figures are machine-readable — runs
    // upsampling by DEFAULT and varies it per game: Ghost of Tsushima native,
    // Black Myth: Wukong at DLSS/FSR Quality. Two rows that differ only by that
    // are not the same measurement, and nothing downstream could tell them
    // apart afterwards. So the intake refuses the row rather than the fit
    // silently averaging a native figure against an upscaled one.
    const ctx = { sourceIds: new Set(['s1']), partIds: new Set(partsData.map((p) => p.id)),
                  gameIds: new Set(gamesData.map((g) => g.id)) }
    const base = { id: 'e6', sourceId: 's1', gameId: 'cs2', resolution: '1440p',
                   presetId: 'high', gpuId: 'gpu-rtx-5070', cpuId: 'cpu-ryzen-5-7600x',
                   avgFps: 200 }
    expect(validateEntry(base, ctx).join(' ')).toMatch(/upscaling/)
    expect(validateEntry({ ...base, upscaling: 'dlss-ultra' }, ctx).join(' ')).toMatch(/upscaling/)
    for (const mode of UPSCALING) {
      expect(validateEntry({ ...base, upscaling: mode }, ctx), mode).toEqual([])
    }
    expect(UPSCALING).toContain('native')
  })

  it('rejects duplicate entry ids', () => {
    const dupe = { id: 'same', sourceId: 's1', gameId: 'cs2', resolution: '1440p',
                   presetId: 'high', gpuId: 'gpu-rtx-5070', cpuId: 'cpu-ryzen-5-7600x',
                   avgFps: 200 }
    const problems = auditCorpus({
      sources: [{ id: 's1', outlet: 'X', title: 'T', url: 'https://e.test/a',
                  published: '2026-01-01', accessed: '2026-01-02', kind: 'gpu-scaling',
                  testSystem: { cpu: 'X', ram: { type: 'DDR5', speed: 6000, capacityGb: 32, sticks: 2 } } }],
      entries: [dupe, { ...dupe }], parts: partsData, games: gamesData,
    })
    expect(problems.join(' ')).toMatch(/duplicate/i)
  })
})

// "data as of" is a claim about the DATA, and it was a claim about the clock.
//
// `datasetVersion` was `new Date()` at fit time, so re-running `npm run perf:fit`
// for any reason at all — a warning reworded, a coefficient retuned — advanced
// the date the Performance tab shows the reader by however long it had been.
// It moved 2026-08-14 -> 2026-08-25 on a run that added no measurements. The
// whole point of the basis machinery is that the page never claims more
// currency than it has.
describe('datasetVersion describes the corpus, not the clock', () => {
  it('is the newest recordedAt in the corpus', () => {
    const newest = entries
      .map((e) => e.recordedAt)
      .filter(Boolean)
      .sort()
      .at(-1)
      .slice(0, 10)
    expect(perfModel.datasetVersion).toBe(newest)
  })

  it('never claims data newer than the newest review it cites', () => {
    const published = sources.map((s) => s.published).filter(Boolean).sort().at(-1)
    expect(perfModel.datasetVersion >= published).toBe(true)
  })

  it('is not simply today', () => {
    // Not a style rule — this is the assertion that fails the moment somebody
    // reinstates `new Date()`. It only bites when the corpus is not being
    // updated on the same day, which is every day the corpus is not touched.
    const today = new Date().toISOString().slice(0, 10)
    const newest = entries.map((e) => e.recordedAt).filter(Boolean).sort().at(-1).slice(0, 10)
    if (newest !== today) expect(perfModel.datasetVersion).not.toBe(today)
  })
})
