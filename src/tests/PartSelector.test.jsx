import { render, screen, within, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import PartSelector from '../components/PartSelector'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import partsData from '../data/partsData.json'

const byName = (name) => partsData.find((p) => p.name === name)

beforeEach(() => {
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {} })
})

describe('PartSelector sorting', () => {
  it('renders a sort control with the four options', () => {
    render(<PartSelector category="gpu" onSelect={() => {}} onClose={() => {}} />)
    const select = screen.getByLabelText(/sort parts/i)
    expect(within(select).getByText('Price: High to Low')).toBeInTheDocument()
    expect(within(select).getByText('Power Draw (TDP)')).toBeInTheDocument()
  })
})

describe('PartSelector swapping within budget', () => {
  // budget 700, cpu £229.99 + gpu £419.99 selected → £50.02 raw remaining.
  // Swapping the CPU should credit its £229.99 back (≈£280 to spend).
  beforeEach(() => {
    useBuilderStore.setState({
      budget: 700,
      selectedParts: {
        cpu: byName('AMD Ryzen 5 9600X'),
        gpu: byName('AMD Radeon RX 7700 XT'),
      },
    })
  })

  it('allows swapping to a cheaper part even when raw remaining budget is lower', () => {
    const onSelect = vi.fn()
    render(<PartSelector category="cpu" onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('AMD Ryzen 5 8500G')) // £149.99
    expect(onSelect).toHaveBeenCalledWith(byName('AMD Ryzen 5 8500G'))
  })

  it('still locks parts that exceed remaining budget plus the credited current part', () => {
    const onSelect = vi.fn()
    render(<PartSelector category="cpu" onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('AMD Ryzen 7 7700X')) // £299.99 > £280.01
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('PartSelector modal behaviour', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<PartSelector category="gpu" onSelect={() => {}} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('is announced as a dialog', () => {
    render(<PartSelector category="gpu" onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('highlights the part currently in the build', () => {
    useBuilderStore.setState({ budget: 700, selectedParts: { cpu: byName('AMD Ryzen 5 9600X') } })
    render(<PartSelector category="cpu" onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText(/^selected$/i)).toBeInTheDocument()
  })

  it('reveals pricier hidden parts via the show-all toggle', () => {
    useBuilderStore.setState({ budget: 700, selectedParts: {} })
    render(<PartSelector category="cpu" onSelect={() => {}} onClose={() => {}} />)
    // £549.99 is above the default 60%-of-budget cap (£420) → hidden
    expect(screen.queryByText('AMD Ryzen 9 9950X')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /pricier part/i }))
    expect(screen.getByText('AMD Ryzen 9 9950X')).toBeInTheDocument()
  })

  it('with ignoreBudget shows all parts and never locks for budget', () => {
    useBuilderStore.setState({ budget: 1, selectedParts: {} }) // tiny budget would normally hide most parts
    const onSelect = vi.fn()
    const gpus = useCatalogStore.getState().parts.filter((p) => p.category === 'gpu')
    const priciest = gpus.reduce((m, p) => (p.price > m.price ? p : m), gpus[0])

    render(
      <PartSelector category="gpu" contextParts={{}} ignoreBudget onSelect={onSelect} onClose={() => {}} />
    )
    const card = screen.getByText(priciest.name)
    expect(card).toBeInTheDocument()
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalled()
  })
})
