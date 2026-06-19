import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import GamePanel from '../components/GamePanel'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')

beforeEach(() => {
  useBuilderStore.setState({ budget: 2000, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('GamePanel', () => {
  it('shows the empty state without a cpu and gpu', () => {
    render(<GamePanel />)
    expect(screen.getByText(/select a cpu and a gpu/i)).toBeInTheDocument()
  })

  it('shows an FPS estimate and a target verdict for a build', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<GamePanel />)
    expect(screen.getByText(/est\. FPS @/i)).toBeInTheDocument()
    // default game (League of Legends, fpsFactor 3.0) easily clears the default 60 target
    expect(screen.getByText(/clears 60/i)).toBeInTheDocument()
  })
})
