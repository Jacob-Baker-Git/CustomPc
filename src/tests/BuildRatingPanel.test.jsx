import { render, screen, fireEvent } from '@testing-library/react'
import BuildRatingPanel from '../components/BuildRatingPanel'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'

const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const cpuHi = { id: 'cpu-hi', category: 'cpu', name: 'CPU Hi', price: 300, perfScore: 250, tdp: 105, socket: 'AM5' }
const gpuHi = { id: 'gpu-hi', category: 'gpu', name: 'GPU Hi', price: 600, perfScore: 300, tdp: 250, length: 300 }

beforeEach(() => {
  useCatalogStore.setState({ parts: [cpuLo, cpuHi, gpuHi] })
  useBuilderStore.setState({ selectedParts: {}, useCase: 'gaming' })
})

describe('BuildRatingPanel', () => {
  it('prompts for a core pair when cpu/gpu are missing', () => {
    render(<BuildRatingPanel />)
    expect(screen.getByText(/add a cpu and gpu/i)).toBeInTheDocument()
  })

  it('shows the overall score without a per-part list (the build list replaces it)', () => {
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'gaming' })
    render(<BuildRatingPanel />)
    expect(screen.getByText('/100')).toBeInTheDocument()
    expect(screen.queryByText(/score by part/i)).toBeNull()
    expect(screen.queryByLabelText('Improve CPU')).toBeNull()
  })

  it('rates against the use case the chips set, which live outside this panel', () => {
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'office' })
    render(<BuildRatingPanel />)
    expect(screen.getByText(/(entry-level|gets by|solid|great|excellent) for everyday & office/i)).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('recommends the worst part, not the flashiest, and applies it', () => {
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'gaming', budget: 2000 })
    render(<BuildRatingPanel />)
    const tip = screen.getByText(/your weakest part is the/i)
    expect(tip).toHaveTextContent(/CPU/)
    expect(tip).toHaveTextContent('CPU Hi')
    fireEvent.click(screen.getByRole('button', { name: /apply this upgrade/i }))
    expect(useBuilderStore.getState().selectedParts.cpu.id).toBe('cpu-hi')
  })

  it('recommends nothing it cannot afford', () => {
    // CPU Hi is a £200 step up; £50 of headroom must not conjure it.
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'gaming', budget: 750 })
    render(<BuildRatingPanel />)
    expect(screen.queryByText(/your weakest part is the/i)).toBeNull()
  })

  it('calls it the CustomPC score', () => {
    render(<BuildRatingPanel />)
    expect(screen.getByText(/your custompc score/i)).toBeInTheDocument()
  })
})

describe('BuildRatingPanel reasons', () => {
  it('names what holds the score back for the chosen use case', () => {
    const ram16 = { id: 'r16', category: 'ram', name: 'RAM 16', price: 40, capacityGb: 16, speed: 6000 }
    useCatalogStore.setState({ parts: [cpuLo, cpuHi, gpuHi, ram16] })
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi, ram: ram16 }, useCase: 'streaming' })
    render(<BuildRatingPanel />)
    expect(screen.getByText(/holding the score back/i)).toBeInTheDocument()
    expect(screen.getByText(/16GB, and Streaming is happier with 32GB\+/)).toBeInTheDocument()
  })
})
