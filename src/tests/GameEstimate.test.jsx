import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import GameEstimate from '../components/performance/GameEstimate'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const part = (id) => partsData.find((p) => p.id === id)
const core = { cpu: part('cpu-ryzen-5-7600x'), gpu: part('gpu-rtx-5070') }

beforeEach(() => {
  useBuilderStore.setState({
    selectedParts: core, resolution: '1440p',
    target: { gameId: null, presetKey: null, fps: 60 },
  })
})

describe('GameEstimate', () => {
  it('asks for a CPU and GPU first', () => {
    useBuilderStore.setState({ selectedParts: {} })
    render(<GameEstimate />)
    expect(screen.getByText(/pick a cpu and a graphics card/i)).toBeInTheDocument()
  })

  it('asks for a game when none is chosen', () => {
    render(<GameEstimate />)
    expect(screen.getByText(/search for a game/i)).toBeInTheDocument()
  })

  it('selects a game only on an exact name, so partial text is not a game', async () => {
    render(<GameEstimate />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Game' }), 'fortn')
    expect(useBuilderStore.getState().target.gameId).toBeNull()
    expect(screen.getByText(/search for a game/i)).toBeInTheDocument()
  })

  it('treats a stored game id that no longer exists as no game', () => {
    useBuilderStore.setState({ target: { gameId: 'gone-game', presetKey: null, fps: 60 } })
    render(<GameEstimate />)
    expect(screen.getByText(/search for a game/i)).toBeInTheDocument()
  })

  it('shows one big estimate for a covered game', async () => {
    render(<GameEstimate />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Game' }), 'Fortnite')
    expect(useBuilderStore.getState().target.gameId).toBe('fortnite')
    expect(screen.getByTestId('estimate-fps')).toHaveTextContent(/\d+ fps/)
    expect(screen.getByRole('combobox', { name: 'Graphics setting' })).toBeInTheDocument()
  })

  it('says so when the cell has no data, never a number', () => {
    // Measured 2026-10-13: for this CPU/GPU at 1440p Fortnite answers "epic"
    // (a ceiling) and has nothing at all for "high". If perfModel.json gains a
    // high-preset cell, pick another `avgFps == null` cell for this pair.
    useBuilderStore.setState({ target: { gameId: 'fortnite', presetKey: 'high|native', fps: 60 } })
    render(<GameEstimate />)
    expect(screen.getByText(/no benchmark data/i)).toBeInTheDocument()
    expect(screen.queryByTestId('estimate-fps')).toBeNull()
  })
})
