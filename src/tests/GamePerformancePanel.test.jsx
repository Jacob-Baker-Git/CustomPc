import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import GamePerformancePanel from '../components/GamePerformancePanel'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')

beforeEach(() => {
  useBuilderStore.setState({ selectedParts: {}, resolution: '1440p' })
})

describe('GamePerformancePanel', () => {
  it('prompts for a CPU and GPU when either is missing', () => {
    render(<GamePerformancePanel />)
    expect(screen.getByText(/select a cpu \+ gpu/i)).toBeInTheDocument()
  })

  it('shows the header and game rows for a build', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<GamePerformancePanel />)
    expect(screen.getByText(/how it runs @/i)).toBeInTheDocument()
    expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument()
  })

  it('says which CPU + GPU the numbers are based on', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<GamePerformancePanel />)
    expect(screen.getByText(cpu.name)).toBeInTheDocument()
    expect(screen.getByText(gpu.name)).toBeInTheDocument()
  })

  it('explains the traffic-light dots and that numbers are estimates', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<GamePerformancePanel />)
    expect(screen.getByText(/60\+ smooth/i)).toBeInTheDocument()
    expect(screen.getByText(/playable/i)).toBeInTheDocument()
    expect(screen.getByText(/struggles/i)).toBeInTheDocument()
    expect(screen.getByText(/not a benchmark/i)).toBeInTheDocument()
  })
})
