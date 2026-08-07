import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import PerformanceScreen from '../components/performance/PerformanceScreen'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'
import { PERF_CAVEAT } from '../lib/siteContent'

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
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
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
