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

  it('changing the use case re-rates live', () => {
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'gaming' })
    render(<BuildRatingPanel />)
    fireEvent.change(screen.getByLabelText('Use case'), { target: { value: 'office' } })
    expect(useBuilderStore.getState().useCase).toBe('office')
    expect(screen.getByText(/(struggles with|okay for|strong for|excellent for) everyday & office/i)).toBeInTheDocument()
  })

  it('picking an improvement swaps the live part', () => {
    useBuilderStore.setState({ selectedParts: { cpu: cpuLo, gpu: gpuHi }, useCase: 'gaming' })
    render(<BuildRatingPanel />)
    fireEvent.change(screen.getByLabelText('Improve CPU'), { target: { value: 'cpu-hi' } })
    expect(useBuilderStore.getState().selectedParts.cpu.id).toBe('cpu-hi')
  })
})
