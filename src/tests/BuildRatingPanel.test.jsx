import { render, screen, fireEvent } from '@testing-library/react'
import BuildRatingPanel from '../components/BuildRatingPanel'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'

const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const cpuHi = { id: 'cpu-hi', category: 'cpu', name: 'CPU Hi', price: 300, perfScore: 250, tdp: 105, socket: 'AM5' }
const gpuHi = { id: 'gpu-hi', category: 'gpu', name: 'GPU Hi', price: 600, perfScore: 300, tdp: 250, length: 300 }
const game  = { id: 'fortnite', name: 'Fortnite', fpsFactor: 1, cpuFactor: 1 }

beforeEach(() => {
  useCatalogStore.setState({ parts: [cpuLo, cpuHi, gpuHi], games: [game] })
  useBuilderStore.setState({ selectedParts: {}, useCase: 'gaming' })
})

describe('BuildRatingPanel', () => {
  it('prompts for a core pair when cpu/gpu are missing', () => {
    render(<BuildRatingPanel />)
    expect(screen.getByText(/add a cpu and gpu/i)).toBeInTheDocument()
  })

  it('shows the overall score and a row per part', () => {
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'gaming' })
    render(<BuildRatingPanel />)
    expect(screen.getByText('/100')).toBeInTheDocument()
    expect(screen.getByText('CPU Lo')).toBeInTheDocument()
    expect(screen.getByText('GPU Hi')).toBeInTheDocument()
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

  it('expands a held-back part to explain why', () => {
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'gaming' })
    render(<BuildRatingPanel />)
    const why = screen.getByRole('button', { name: /why is the cpu rated/i })
    expect(why).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(why)
    expect(why).toHaveAttribute('aria-expanded', 'true')
    // The detail is a real explanation, not a restatement of the headline.
    expect(screen.getByText(/frames|tier|works/i)).toBeInTheDocument()
  })

  it('picking an improvement swaps the live part', () => {
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'gaming' })
    render(<BuildRatingPanel />)
    fireEvent.change(screen.getByLabelText('Improve CPU'), { target: { value: 'cpu-hi' } })
    expect(useBuilderStore.getState().selectedParts.cpu.id).toBe('cpu-hi')
  })
})
