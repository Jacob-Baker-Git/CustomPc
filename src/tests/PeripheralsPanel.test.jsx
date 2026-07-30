import { render, screen, fireEvent, within } from '@testing-library/react'
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

  // Bands are per category and stated in money: one global Value/Mid/High-end
  // chip meant ~£30 for a mouse and ~£300 for a monitor simultaneously.
  describe('price filters', () => {
    const cheapest = (cat) =>
      peripheralsData.filter((p) => p.category === cat).sort((a, b) => a.price - b.price)[0]
    const dearest = (cat) =>
      peripheralsData.filter((p) => p.category === cat).sort((a, b) => b.price - a.price)[0]

    it('shows every option under All', () => {
      render(<PeripheralsPanel />)
      expect(screen.getByText(cheapest('monitor').name)).toBeInTheDocument()
      expect(screen.getByText(dearest('monitor').name)).toBeInTheDocument()
    })

    it('gives each category its own filter group', () => {
      render(<PeripheralsPanel />)
      for (const cat of ['Monitor', 'Keyboard', 'Mouse', 'Headset']) {
        expect(screen.getByRole('radiogroup', { name: new RegExp(`${cat} price`, 'i') })).toBeInTheDocument()
      }
    })

    it('labels every chip in money, never as an abstract tier', () => {
      render(<PeripheralsPanel />)
      const group = screen.getByRole('radiogroup', { name: /mouse price/i })
      for (const chip of within(group).getAllByRole('radio')) {
        expect(chip.textContent).not.toMatch(/value|mid|high-end/i)
      }
    })

    it('the cheapest band keeps the cheapest option and drops the dearest', () => {
      render(<PeripheralsPanel />)
      const group = screen.getByRole('radiogroup', { name: /monitor price/i })
      fireEvent.click(within(group).getAllByRole('radio')[1]) // first band after All

      expect(screen.getByText(cheapest('monitor').name)).toBeInTheDocument()
      expect(screen.queryByText(dearest('monitor').name)).toBeNull()
    })

    // The old filter was global, which is most of why it made no sense.
    it('filtering one category leaves the others alone', () => {
      render(<PeripheralsPanel />)
      const group = screen.getByRole('radiogroup', { name: /monitor price/i })
      fireEvent.click(within(group).getAllByRole('radio')[1])

      expect(screen.getByText(dearest('mouse').name)).toBeInTheDocument()
      expect(screen.getByText(dearest('keyboard').name)).toBeInTheDocument()
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
