import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RunPerformanceTest from '../components/RunPerformanceTest'

const cpu = { id: 'cpu-ryzen-5-7600x', name: 'AMD Ryzen 5 7600X', socket: 'AM5' }
const gpu = { id: 'gpu-rtx-5070', name: 'NVIDIA GeForce RTX 5070', specs: { vram: 12 } }
const games = [
  { id: 'cyberpunk', name: 'Cyberpunk 2077', fpsFactor: 0.5, cpuFactor: 0.75 },
  { id: 'starfield', name: 'Starfield', fpsFactor: 0.65, cpuFactor: 0.7 },
]
const model = {
  modelVersion: '1.0.0', datasetVersion: '2026-08-07', blendK: 5.1,
  resCpuScale: { '1440p': 1.012 },
  gpuIndex: { 'gpu-rtx-5070': { '1440p': 62.0, basis: 'measured', anchors: 11 } },
  cpuIndex: { 'cpu-ryzen-5-7600x': { value: 71.2, basis: 'measured', anchors: 9 } },
  gameConst: { cyberpunk: { '1440p': { high: { A: 399.0, B: 402.0, sources: 3 } } } },
}

const setup = (over = {}) => render(
  <RunPerformanceTest parts={{ cpu, gpu }} resolution="1440p" model={model} games={games} {...over} />,
)

describe('RunPerformanceTest', () => {
  it('is disabled with a reason until a CPU and a GPU are picked', () => {
    setup({ parts: { cpu } })
    const button = screen.getByRole('button', { name: /performance test/i })
    expect(button).toBeDisabled()
    expect(screen.getByText(/pick a cpu and a graphics card/i)).toBeInTheDocument()
  })

  it('shows no report until the button is clicked', () => {
    setup()
    expect(screen.queryByText('Cyberpunk 2077')).not.toBeInTheDocument()
  })

  it('renders the FPS cards on click', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /run performance test/i }))
    expect(screen.getByText('Cyberpunk 2077')).toBeInTheDocument()
    expect(screen.getByText('143')).toBeInTheDocument()
  })

  it('says so plainly for a game with no data, instead of showing a number', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /run performance test/i }))
    expect(screen.getByText('Starfield')).toBeInTheDocument()
    expect(screen.getByText(/no benchmark data yet/i)).toBeInTheDocument()
  })

  it('marks a measured row, so it is not identical to a modelled one', async () => {
    const withExact = {
      ...model,
      exact: { 'cpu-ryzen-5-7600x|gpu-rtx-5070|cyberpunk|1440p|high':
                 { frameTimeMs: 7.4074, sources: 2, entries: 2 } },
    }
    setup({ model: withExact })
    await userEvent.click(screen.getByRole('button', { name: /run performance test/i }))
    expect(screen.getByText('measured')).toBeInTheDocument()
  })

  it('says the split is unmodelled rather than drawing a bar it cannot justify', async () => {
    // A measured frame time with no fitted cell: the duration is known, the
    // division of it is not. `1 - null` is 1, so an unguarded bar would render
    // 100% GPU and label it "Balanced" at the same time.
    const measuredOnly = {
      ...model,
      gameConst: {},
      exact: { 'cpu-ryzen-5-7600x|gpu-rtx-5070|cyberpunk|1440p|high':
                 { frameTimeMs: 8.0, sources: 1, entries: 1 } },
    }
    setup({ model: measuredOnly })
    await userEvent.click(screen.getByRole('button', { name: /run performance test/i }))
    expect(screen.getByText('125')).toBeInTheDocument()
    expect(screen.getByText(/split not modelled/i)).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /of the frame is GPU work/i })).not.toBeInTheDocument()
  })

  it('carries its own caveat, not the legacy one that contradicts it', async () => {
    // FPS_CAVEAT says nothing on the site is measured. True of the old
    // heuristic; false here, where the footer counts how many figures came
    // from a real measurement. Rendering it put "3 measured directly"
    // immediately above "not measured benchmarks".
    const { FPS_CAVEAT, PERF_CAVEAT } = await import('../lib/siteContent')
    setup()
    await userEvent.click(screen.getByRole('button', { name: /run performance test/i }))
    expect(screen.getByText(PERF_CAVEAT)).toBeInTheDocument()
    expect(screen.queryByText(FPS_CAVEAT)).not.toBeInTheDocument()
  })

  it('toggles closed again', async () => {
    setup()
    const button = screen.getByRole('button', { name: /run performance test/i })
    await userEvent.click(button)
    await userEvent.click(screen.getByRole('button', { name: /hide performance test/i }))
    expect(screen.queryByText('Cyberpunk 2077')).not.toBeInTheDocument()
  })

  it('shows the coverage count and model version in the footer', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /run performance test/i }))
    expect(screen.getByText(/1 of 2 games estimated/i)).toBeInTheDocument()
    expect(screen.getByText(/model 1\.0\.0/i)).toBeInTheDocument()
  })

  it('explains itself when the corpus covers nothing at all', async () => {
    const empty = { ...model, gpuIndex: {}, cpuIndex: {}, gameConst: {} }
    setup({ model: empty })
    await userEvent.click(screen.getByRole('button', { name: /run performance test/i }))
    expect(screen.getByText(/no benchmark data for these parts yet/i)).toBeInTheDocument()
  })
})
