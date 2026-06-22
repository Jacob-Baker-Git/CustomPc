import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import SavedBuilds from '../components/SavedBuilds'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import { encodeBuild } from '../lib/buildCodec'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')

beforeEach(() => {
  useSavedStore.setState({ saved: [] })
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('SavedBuilds', () => {
  it('shows an empty state with no saves', () => {
    render(<SavedBuilds />)
    expect(screen.getByText(/no saved builds yet/i)).toBeInTheDocument()
  })
  it('lists a save and loads it into the workspace', () => {
    const code = encodeBuild({ budget: 1200, resolution: '1440p', parts: { cpu }, peripherals: {} })
    useSavedStore.getState().saveBuild('My Rig', code)
    render(<SavedBuilds />)
    expect(screen.getByText('My Rig')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^load$/i }))
    expect(useBuilderStore.getState().selectedParts.cpu?.id).toBe('cpu-ryzen-7-7700x')
    expect(useBuilderStore.getState().budget).toBe(1200)
  })
  it('deletes a save', () => {
    useSavedStore.getState().saveBuild('Trash', 'ABC')
    render(<SavedBuilds />)
    fireEvent.click(screen.getByRole('button', { name: /delete trash/i }))
    expect(useSavedStore.getState().saved).toHaveLength(0)
  })
})
