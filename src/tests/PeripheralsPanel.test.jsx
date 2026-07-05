import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import PeripheralsPanel from '../components/PeripheralsPanel'
import useBuilderStore from '../store/useBuilderStore'
import peripheralsData from '../data/peripheralsData.json'

const monitor = peripheralsData.find((p) => p.id === 'mon-dell-s2721dgf')

beforeEach(() => {
  useBuilderStore.setState({ selectedPeripherals: {} })
})

describe('PeripheralsPanel', () => {
  it('lists peripherals grouped by category', () => {
    render(<PeripheralsPanel />)
    expect(screen.getByRole('heading', { name: /monitor/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /keyboard/i })).toBeInTheDocument()
    expect(screen.getByText(monitor.name)).toBeInTheDocument()
  })

  it('selects on click and deselects on a second click', () => {
    render(<PeripheralsPanel />)
    // Anchored so it can't also match the "More info about …" button.
    const card = screen.getByRole('button', { name: new RegExp(`^${monitor.name}`) })
    fireEvent.click(card)
    expect(useBuilderStore.getState().selectedPeripherals.monitor?.id).toBe(monitor.id)
    fireEvent.click(card)
    expect(useBuilderStore.getState().selectedPeripherals.monitor).toBeUndefined()
  })

  it('hides the spec sheet until the Info button is pressed', () => {
    render(<PeripheralsPanel />)
    expect(screen.queryByText(/refresh rate/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `More info about ${monitor.name}` }))
    expect(screen.getByText(/refresh rate/i)).toBeInTheDocument()
    expect(screen.getByText(/resolution/i)).toBeInTheDocument()
  })

  it('opening info does not select the peripheral', () => {
    render(<PeripheralsPanel />)
    fireEvent.click(screen.getByRole('button', { name: `More info about ${monitor.name}` }))
    expect(useBuilderStore.getState().selectedPeripherals.monitor).toBeUndefined()
  })
})
