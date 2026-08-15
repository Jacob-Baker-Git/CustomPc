import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import PerformanceScreen from '../components/performance/PerformanceScreen'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'
import perfModel from '../data/perfModel.json'
import { PERF_CAVEAT } from '../lib/siteContent'
import { estimateBuildPerformance } from '../lib/perfEngine'

// A spy that calls through to the real engine by default, so the tests above
// keep exercising the live corpus untouched. Only the two tests below override
// its return value for one call — see the comment on mixedReport for why a
// hand-built report is necessary there.
vi.mock('../lib/perfEngine', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, estimateBuildPerformance: vi.fn(actual.estimateBuildPerformance) }
})

const part = (id) => partsData.find((p) => p.id === id)
const cpu = part('cpu-ryzen-5-7600x')      // AM5, 105 W
const gpu = part('gpu-rtx-5070')           // 250 W, 12 GB
const psu = part('psu-corsair-rm750e')     // 750 W
const cooler = part('cooler-noctua-d15')   // 165 mm air

beforeEach(() => {
  useBuilderStore.setState({
    budget: 1500, selectedParts: {}, selectedPeripherals: {},
    resolution: '1440p', useCase: 'gaming',
  })
})

describe('PerformanceScreen', () => {
  it('shows power figures with no benchmark data at all', () => {
    // The whole point of the split: the corpus is empty, and these panels are
    // computed from part specs, so they must still be full of real numbers.
    useBuilderStore.setState({ selectedParts: { cpu, gpu, psu } })
    render(<PerformanceScreen />)
    expect(screen.getByText('Power')).toBeInTheDocument()
    expect(screen.getByText('Gaming')).toBeInTheDocument()
    // 250 W card + 105 W chip at a neutral split, so a few hundred watts.
    const gamingRow = screen.getByText('Gaming').closest('div')
    expect(gamingRow.textContent).toMatch(/\d{3}/)
  })

  it('flags a single-stick kit as single-channel', () => {
    const singleStick = partsData.find(
      (p) => p.category === 'ram' && p.specs?.sticks === 1,
    )
    expect(singleStick, 'catalogue should still contain a 1-stick kit').toBeTruthy()
    useBuilderStore.setState({ selectedParts: { cpu, gpu, ram: singleStick } })
    render(<PerformanceScreen />)
    expect(screen.getByText('single')).toBeInTheDocument()
    expect(screen.getByText(/single-channel mode/i)).toBeInTheDocument()
  })

  it('calls a dual-channel kit dual, and says nothing alarming', () => {
    const dual = partsData.find((p) => p.category === 'ram' && p.specs?.sticks === 2)
    useBuilderStore.setState({ selectedParts: { cpu, gpu, ram: dual } })
    render(<PerformanceScreen />)
    expect(screen.getByText('dual')).toBeInTheDocument()
    expect(screen.queryByText(/single-channel mode/i)).not.toBeInTheDocument()
  })

  it('reports cooling headroom from the cooler and the CPU', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu, cooler } })
    render(<PerformanceScreen />)
    expect(screen.getByText('Cooling')).toBeInTheDocument()
    expect(screen.getByText('CPU heat output')).toBeInTheDocument()
    expect(screen.getByText('comfortable')).toBeInTheDocument()
  })

  it('answers for an unindexed processor, as an estimate, and still shows the stats panels', () => {
    // This test used to assert the OPPOSITE — "no benchmark data for these
    // parts yet" — and it was pinning the defect this work exists to remove: 54
    // of 80 catalogue chips rendered a blank Frame rates section at every
    // resolution. A chip nobody has benchmarked is now priced by the published
    // spec-derived prior, so it answers.
    //
    // What must NOT change is that the answer says what it is. The assertions
    // below are a pair: rows appear AND they are labelled an estimate. Dropping
    // the second would let this pass against an engine that had started
    // reporting a guess as a measurement.
    //
    // The uncovered processor is CHOSEN FROM THE MODEL rather than hardcoded.
    // This test once pinned cpu-ryzen-5-7600x, which then got indexed — so it
    // failed for the best possible reason and looked like a bug. Picking a
    // genuinely unindexed chip keeps the premise true as the corpus grows, and
    // the guard says so out loud if the corpus ever covers everything.
    const uncovered = partsData.find(
      (p) => p.category === 'cpu' && !perfModel.cpuIndex[p.id] && p.perfScore > 0,
    )
    expect(uncovered, 'catalogue should still hold a CPU the corpus has not indexed').toBeTruthy()
    useBuilderStore.setState({ selectedParts: { cpu: uncovered, gpu } })
    render(<PerformanceScreen />)

    expect(screen.queryByText(/no benchmark data for these parts yet/i)).toBeNull()
    expect(screen.getAllByText(/estimate/i).length).toBeGreaterThan(0)
    // BasisBar's mix line, which counts the UNFILTERED rows. Nothing here was
    // benchmarked, and it must say zero rather than omit the tier.
    expect(screen.getByText(/^0 benchmarked$/)).toBeInTheDocument()

    // and the spec-derived half is unaffected by any of it
    expect(screen.getByText('Power')).toBeInTheDocument()
    expect(screen.getByText('Cooling')).toBeInTheDocument()
  })

  it('asks for a CPU and a GPU before estimating frame rates', () => {
    useBuilderStore.setState({ selectedParts: { cpu } })
    render(<PerformanceScreen />)
    expect(screen.getByText(/pick a cpu and a graphics card/i)).toBeInTheDocument()
    // Power still works off the one part that is present.
    expect(screen.getByText('Power')).toBeInTheDocument()
  })

  it('renders nothing misleading with an entirely empty build', () => {
    render(<PerformanceScreen />)
    expect(screen.getByText('Performance')).toBeInTheDocument()
    expect(screen.getByText(/pick a cpu and a graphics card/i)).toBeInTheDocument()
  })

  it('carries the engine caveat, not the legacy one', async () => {
    const { FPS_CAVEAT } = await import('../lib/siteContent')
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    expect(screen.getByText(PERF_CAVEAT)).toBeInTheDocument()
    expect(screen.queryByText(FPS_CAVEAT)).not.toBeInTheDocument()
  })

  it('calls the engine once per resolution, not once', () => {
    // Three columns need three reports. Getting this wrong either shows one
    // resolution three times or re-runs the engine on every render.
    estimateBuildPerformance.mockClear()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    const resolutions = estimateBuildPerformance.mock.calls.map((c) => c[0].resolution)
    expect(new Set(resolutions)).toEqual(new Set(['1080p', '1440p', '4k']))
    // ⚠️ Assert the COUNT too. Without this the test passes just as happily
    // when the memo is keyed wrongly and fires three calls per render — which
    // is the more likely defect, and the expensive one.
    expect(estimateBuildPerformance).toHaveBeenCalledTimes(3)
  })

  it('does not re-run the engine when only the filter changes', async () => {
    // The memo must be keyed on parts, not on filter state. Three engine calls
    // per checkbox tick is the regression this catches.
    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    estimateBuildPerformance.mockClear()
    await user.click(screen.getByRole('checkbox', { name: /only show real data/i }))
    expect(estimateBuildPerformance).not.toHaveBeenCalled()
  })

  it('shows one row per game rather than one per preset', async () => {
    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    // Genre bars ship shut, so open every one before counting rows.
    for (const bar of screen.getAllByRole('button', { name: /\d+ games?/ })) {
      await user.click(bar)
    }
    const table = screen.getByRole('table')
    // The old grid produced 60 cards for this build at 1440p; the games behind
    // them number far fewer.
    //
    // `tr[data-game]` counts SUMMARY rows only. Plain `tbody tr` would also
    // count expansion rows, so the assertion would drift the moment a row
    // opened — and would pass for the wrong reason if grouping broke but
    // something else added rows.
    const bodyRows = table.querySelectorAll('tbody tr[data-game]')
    expect(bodyRows.length).toBeGreaterThan(10)
    expect(bodyRows.length).toBeLessThan(60)
    // One row per DISTINCT game — the actual claim. Without this the bounds
    // above pass for any row count in range, including duplicated games.
    const ids = [...bodyRows].map((r) => r.dataset.game)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('changes the build’s resolution from the picker beside the heading', async () => {
    // The complaint that started this: "you can't select that res is shown".
    // setResolution had exactly one caller, in SetupFlow, with no UI after.
    //
    // The control moved off the column headers when they took up sorting — two
    // jobs on one hit area meant neither could be discovered from the other.
    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu }, resolution: '1440p' })
    render(<PerformanceScreen />)
    expect(useBuilderStore.getState().resolution).toBe('1440p')
    await user.click(screen.getByRole('radio', { name: /^4K$/i }))
    expect(useBuilderStore.getState().resolution).toBe('4k')
  })

  it('marks the picker with the resolution the build is actually for', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu }, resolution: '1080p' })
    render(<PerformanceScreen />)
    expect(screen.getByRole('radio', { name: /1080p/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /1440p/i })).not.toBeChecked()
  })
})

describe('PerformanceScreen — the real-data filter wiring', () => {
  const measuredRow = {
    rowId: 'm1|high|native', gameId: 'm1', name: 'Real Data Racer', preset: 'High',
    presetId: 'high', presetTier: 3, upscaling: 'native', presetExact: true, genre: 'shooter',
    avgFps: 120, lowFps: 95, frameTimeMs: 8.3, lowFrameTimeMs: 10.5,
    lowBasis: 'modelled', cpuShare: 0.4, limitedBy: 'gpu', atEngineCap: false,
    basis: 'measured', sources: 3, bound: 'point', caveats: [], errorPct: null,
  }
  const estimatedRow = {
    rowId: 'e1|high|native', gameId: 'e1', name: 'Guesswork Grand Prix', preset: 'High',
    presetId: 'high', presetTier: 3, upscaling: 'native', presetExact: true, genre: 'shooter',
    avgFps: 80, lowFps: 55, frameTimeMs: 12.5, lowFrameTimeMs: 18.2,
    lowBasis: 'modelled', cpuShare: 0.5, limitedBy: 'balanced', atEngineCap: false,
    basis: 'spec-derived', sources: 1, bound: 'point', caveats: ['gpu-index-prior'], errorPct: 35,
  }

  // A hand-built report, not the live corpus: the prior/ceiling fit (Perf
  // T4-T9) hasn't landed yet, so no selectable catalogue pair produces a
  // spec-derived or ceiling row today — today's real data is only ever
  // measured, modelled or none. Asserting against perfModel.json would test
  // nothing the day that changes, in either direction. See perfEngineBasis
  // .test.js for the same reasoning one layer down.
  const mixedReport = (rows) => ({
    modelVersion: 'test', datasetVersion: 'test',
    resolution: '1440p', presetId: 'high',
    bottleneck: null, meanCpuShare: null,
    build: { cpu: { id: cpu.id, name: cpu.name }, gpu: { id: gpu.id, name: gpu.name, vramGb: null } },
    games: rows,
    coverage: {
      gamesAnswered: new Set(rows.filter((r) => r.basis !== 'none').map((r) => r.gameId)).size,
      gamesExact: new Set(rows.filter((r) => r.basis === 'measured').map((r) => r.gameId)).size,
      gamesTotal: rows.length,
      rowsAnswered: rows.filter((r) => r.basis !== 'none').length,
      rowsExact: rows.filter((r) => r.basis === 'measured').length,
      rowsTotal: rows.length,
      gpuBasis: 'measured', cpuBasis: 'measured', gpuResolutionCopied: false,
    },
  })

  // ⚠️ mockImplementation, not mockReturnValueOnce. The screen now calls the
  // engine THREE times, once per resolution column, so a `…Once` chain would
  // cover the first call and hand the real engine's output back for the other
  // two — the fixture would silently stop being the thing under test. Reset
  // after each so the implementation cannot leak into the next test.
  const alwaysReport = (rows) => estimateBuildPerformance.mockImplementation(
    () => mixedReport(rows))

  afterEach(() => { estimateBuildPerformance.mockReset() })

  // Genre bars ship SHUT — the tab opens as bars, not rows — so anything
  // asserting on a game has to open its genre first.
  const openGenres = async (user) => {
    for (const bar of screen.getAllByRole('button', { name: /\d+ games?/ })) {
      await user.click(bar)
    }
  }

  it('the "Only show real data" checkbox actually filters the grid', async () => {
    alwaysReport([measuredRow, estimatedRow])
    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    await openGenres(user)

    // Both visible before the filter is touched.
    expect(screen.getByText('Real Data Racer')).toBeInTheDocument()
    expect(screen.getByText('Guesswork Grand Prix')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /only show real data/i }))

    // The measured row survives; the spec-derived one is gone from the grid —
    // though BasisBar's own mix line still counts it, per the sibling tests.
    expect(screen.getByText('Real Data Racer')).toBeInTheDocument()
    expect(screen.queryByText('Guesswork Grand Prix')).not.toBeInTheDocument()
  })

  it('counts the games it is SHOWING, not the ones it has', async () => {
    // The footer says "N games shown". BasisBar's mix line deliberately does
    // NOT follow the filter — its totals must not be shrinkable by hiding rows.
    // This line makes the opposite claim, about the display itself, so it must
    // follow it: with the filter on it read "2 shown" above a table holding one.
    //
    // The unit changed from RESULTS to GAMES with the grouping. It used to be
    // counted in rows because the grid drew one card per game AND preset; the
    // table draws one row per game, so a row count would now contradict the
    // table directly above it.
    alwaysReport([measuredRow, estimatedRow])
    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    await openGenres(user)

    expect(screen.getByText(/2 games shown/)).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /only show real data/i }))
    expect(screen.getByText(/1 game shown/)).toBeInTheDocument()
    expect(screen.queryByText(/2 games shown/)).toBeNull()
  })

  it('applies the real-data filter BEFORE grouping, not after', async () => {
    // ⚠️ This fixture is built so the two implementations disagree. `ultra`
    // answers at three resolutions and would win preset selection on coverage,
    // but it is a ceiling row the filter removes. `high` answers at one and is
    // measured.
    //
    //   filter-then-group  -> `ultra` is gone before selection runs, `high` is
    //                         chosen, and the game shows one row reading High.
    //   group-then-filter  -> `ultra` was already chosen, the filter then drops
    //                         the whole game, and the table is empty.
    //
    // A test that only asserted "some rows are shown" would pass against both.
    // A row does NOT carry its own resolution — the report it sits in supplies
    // that — so the mock is keyed on the ARGUMENT rather than on call order.
    const wide = (avgFps) => ({
      rowId: 'g|ultra|native', gameId: 'g', name: 'Split Test', preset: 'Ultra',
      presetId: 'ultra', presetTier: 4, upscaling: 'native', avgFps, lowFps: avgFps - 10,
      frameTimeMs: 5, basis: 'ceiling', bound: 'upper', caveats: [], errorPct: null,
      cpuShare: null, limitedBy: null,
    })
    const narrow = {
      rowId: 'g|high|native', gameId: 'g', name: 'Split Test', preset: 'High',
      presetId: 'high', presetTier: 3, upscaling: 'native', avgFps: 111, lowFps: 90,
      frameTimeMs: 9, basis: 'measured', bound: 'point', caveats: [], errorPct: null,
      cpuShare: null, limitedBy: null,
    }
    const byRes = {
      '1080p': [wide(300), narrow],   // `ultra` wide + `high` narrow
      '1440p': [wide(200)],
      '4k': [wide(100)],
    }
    estimateBuildPerformance.mockImplementation(
      ({ resolution }) => mixedReport(byRes[resolution] ?? []))

    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    await openGenres(user)

    // Unfiltered: coverage wins, so Ultra is the shown preset.
    expect(screen.getByText('Ultra')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /only show real data/i }))

    // Filtered: Ultra is gone, High survives, and the game is STILL LISTED.
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.queryByText('Ultra')).toBeNull()
    expect(screen.getByText('Split Test')).toBeInTheDocument()
  })

  it('describes the game that was opened, not the whole build', async () => {
    // The build-wide verdict averages over the handful of games that have a
    // split at all. Opening a row asks a narrower question, and the section
    // below the table answers that one instead.
    const split = {
      rowId: 's1|high|native', gameId: 's1', name: 'Attributed Racer', preset: 'High',
      presetId: 'high', presetTier: 3, upscaling: 'native', avgFps: 90, lowFps: 70,
      frameTimeMs: 11, basis: 'measured', bound: 'point', caveats: [], errorPct: null,
      cpuShare: 0.3, limitedBy: 'gpu', gpuOnlyFps: 96, cpuOnlyFps: 210,
    }
    alwaysReport([split, measuredRow])
    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    await openGenres(user)

    expect(screen.getByText(/what's holding it back/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Attributed Racer/ }))

    expect(screen.getByText(/what's holding back attributed racer/i)).toBeInTheDocument()
    // The two figures the attribution is made of, which the build-wide panel
    // only ever showed for its single worst case.
    expect(screen.getByText('96')).toBeInTheDocument()
    expect(screen.getByText('210')).toBeInTheDocument()
  })

  it('says a game has no split rather than falling back to the build figure', async () => {
    // ⚠️ The normal case: only 2 of 56 rows carry an attribution. Quietly
    // showing the build-wide verdict under a game's name would attribute
    // somebody else's measurement to the game the reader just opened.
    //
    // A purpose-built row, because BOTH shared fixtures carry a cpuShare —
    // using measuredRow here made the test fail for the right reason and look
    // like a bug in the component.
    const unattributed = {
      ...measuredRow,
      rowId: 'u1|high|native', gameId: 'u1', name: 'Unattributed United',
      cpuShare: null, limitedBy: null,
    }
    alwaysReport([unattributed])
    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    await openGenres(user)

    await user.click(screen.getByRole('button', { name: /Unattributed United/ }))
    expect(screen.getByText(/split not modelled for this game/i)).toBeInTheDocument()
    // and NOT the build-wide panel it would have fallen through to
    expect(screen.queryByText(/upgrade next/i)).toBeNull()
  })

  it('explains an empty grid rather than just emptying it', async () => {
    // A build with nothing measured — the common case for the 54 catalogue CPUs
    // no review has charted. Ticking the box removes every card, and a list that
    // silently vanishes reads as a broken page rather than an answered question.
    alwaysReport([estimatedRow])
    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    await openGenres(user)

    expect(screen.getByText('Guesswork Grand Prix')).toBeInTheDocument()
    expect(screen.queryByText(/nothing here was measured/i)).toBeNull()

    await user.click(screen.getByRole('checkbox', { name: /only show real data/i }))

    expect(screen.queryByText('Guesswork Grand Prix')).toBeNull()
    expect(screen.getByText(/nothing here was measured/i)).toBeInTheDocument()
    // and the mix line still reports what the build actually has
    expect(screen.getByText(/1 estimated/)).toBeInTheDocument()
  })

  it('leaves the checkbox unchecked on first mount', () => {
    alwaysReport([measuredRow, estimatedRow])
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    expect(screen.getByRole('checkbox', { name: /only show real data/i })).not.toBeChecked()
  })
})
