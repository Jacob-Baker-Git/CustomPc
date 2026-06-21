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
})
