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

  // The catalogue now runs from a £10 mouse to a £1000 monitor, so the flat grid
  // it used to be needed a way in.
  describe('price band filter', () => {
    const cheapest = (cat) =>
      peripheralsData.filter((p) => p.category === cat).sort((a, b) => a.price - b.price)[0]
    const dearest = (cat) =>
      peripheralsData.filter((p) => p.category === cat).sort((a, b) => b.price - a.price)[0]

    it('shows every option under All', () => {
      render(<PeripheralsPanel />)
      expect(screen.getByText(cheapest('monitor').name)).toBeInTheDocument()
      expect(screen.getByText(dearest('monitor').name)).toBeInTheDocument()
    })

    it('Value keeps the cheapest and drops the dearest', () => {
      render(<PeripheralsPanel />)
      fireEvent.click(screen.getByRole('radio', { name: 'Value' }))
      expect(screen.getByText(cheapest('monitor').name)).toBeInTheDocument()
      expect(screen.queryByText(dearest('monitor').name)).toBeNull()
    })

    it('High-end is the mirror of that, across every category', () => {
      render(<PeripheralsPanel />)
      fireEvent.click(screen.getByRole('radio', { name: 'High-end' }))
      for (const cat of ['monitor', 'keyboard', 'mouse', 'headset']) {
        expect(screen.getByText(dearest(cat).name), cat).toBeInTheDocument()
        expect(screen.queryByText(cheapest(cat).name), cat).toBeNull()
      }
    })
  })

  it('reports how many are chosen and what they cost', () => {
    render(<PeripheralsPanel />)
    expect(screen.getByText('0 / 4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${monitor.name}`) }))
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
    // Scoped to the header block: the card shows the same figure.
    const subtotal = screen.getByText('Subtotal').parentElement
    expect(subtotal).toHaveTextContent(`£${monitor.price.toFixed(2)}`)
  })
})
