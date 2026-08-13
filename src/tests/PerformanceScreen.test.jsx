import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
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

  it('says frame rates need data, while still showing the stats panels', () => {
    // The uncovered processor is CHOSEN FROM THE MODEL rather than hardcoded.
    // This test used to pin cpu-ryzen-5-7600x, which then got indexed — so the
    // test failed for the best possible reason and looked like a bug. Picking a
    // genuinely unindexed chip keeps the premise true as the corpus grows, and
    // the guard says so out loud if the corpus ever covers everything.
    const uncovered = partsData.find(
      (p) => p.category === 'cpu' && !perfModel.cpuIndex[p.id],
    )
    expect(uncovered, 'catalogue should still hold a CPU the corpus has not indexed').toBeTruthy()
    useBuilderStore.setState({ selectedParts: { cpu: uncovered, gpu } })
    render(<PerformanceScreen />)
    expect(screen.getByText(/no benchmark data for these parts yet/i)).toBeInTheDocument()
    // and the spec-derived half is unaffected by that
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
})

describe('PerformanceScreen — the real-data filter wiring', () => {
  const measuredRow = {
    rowId: 'm1|high|native', gameId: 'm1', name: 'Real Data Racer', preset: 'High',
    presetId: 'high', presetTier: 3, upscaling: 'native', presetExact: true,
    avgFps: 120, lowFps: 95, frameTimeMs: 8.3, lowFrameTimeMs: 10.5,
    lowBasis: 'modelled', cpuShare: 0.4, limitedBy: 'gpu', atEngineCap: false,
    basis: 'measured', sources: 3, bound: 'point', caveats: [], errorPct: null,
  }
  const estimatedRow = {
    rowId: 'e1|high|native', gameId: 'e1', name: 'Guesswork Grand Prix', preset: 'High',
    presetId: 'high', presetTier: 3, upscaling: 'native', presetExact: true,
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

  it('the "Only show real data" checkbox actually filters the grid', async () => {
    estimateBuildPerformance.mockReturnValueOnce(mixedReport([measuredRow, estimatedRow]))
    const user = userEvent.setup()
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)

    // Both visible before the filter is touched.
    expect(screen.getByText('Real Data Racer')).toBeInTheDocument()
    expect(screen.getByText('Guesswork Grand Prix')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /only show real data/i }))

    // The measured row survives; the spec-derived one is gone from the grid —
    // though BasisBar's own mix line still counts it, per the sibling tests.
    expect(screen.getByText('Real Data Racer')).toBeInTheDocument()
    expect(screen.queryByText('Guesswork Grand Prix')).not.toBeInTheDocument()
  })

  it('leaves the checkbox unchecked on first mount', () => {
    estimateBuildPerformance.mockReturnValueOnce(mixedReport([measuredRow, estimatedRow]))
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<PerformanceScreen />)
    expect(screen.getByRole('checkbox', { name: /only show real data/i })).not.toBeChecked()
  })
})
