import { render, screen, within, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

  // "What will my build get?" sets no budget, and 0 means none — the same
  // reading filterParts gives it. Locking on it greyed out every part in the
  // catalogue, so that path could not pick anything at all.
  it('locks nothing for budget when there is no budget', () => {
    useBuilderStore.setState({ budget: 0, selectedParts: {} })
    const onSelect = vi.fn()
    const gpus = useCatalogStore.getState().parts.filter((p) => p.category === 'gpu' && !p.legacy)
    const priciest = gpus.reduce((m, p) => (p.price > m.price ? p : m), gpus[0])
    render(<PartSelector category="gpu" onSelect={onSelect} onClose={() => {}} />)
    expect(screen.queryByTitle('Over remaining budget')).toBeNull()
    fireEvent.click(screen.getByText(priciest.name))
    expect(onSelect).toHaveBeenCalled()
  })
})

describe('PartSelector on desktop', () => {
  const original = window.matchMedia
  beforeEach(() => { window.matchMedia = () => ({ matches: true }) })
  afterEach(() => { window.matchMedia = original })
  const gpus = () => partsData.filter((p) => p.category === 'gpu')
  const firstRowName = () => within(screen.getByRole('table')).getAllByRole('row')[1].querySelector('[data-name]').textContent

  it('shows a table, not the sort dropdown', () => {
    render(<PartSelector category="gpu" onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByLabelText(/sort parts/i)).toBeNull()
  })

  it('sorts by a column header, then reverses', () => {
    render(<PartSelector category="gpu" onSelect={() => {}} onClose={() => {}} />)
    const header = screen.getByRole('button', { name: /^price/i })
    fireEvent.click(header)
    const prices = gpus().map((p) => p.price)
    expect(firstRowName()).toBe(gpus().find((p) => p.price === Math.min(...prices)).name)
    fireEvent.click(header)
    expect(firstRowName()).toBe(gpus().find((p) => p.price === Math.max(...prices)).name)
  })

  it('keeps a part that does not fit, dimmed, with the reason', () => {
    useBuilderStore.setState({ selectedParts: { motherboard: partsData.find((p) => p.category === 'motherboard' && p.socket === 'AM5') } })
    render(<PartSelector category="cpu" onSelect={() => {}} onClose={() => {}} />)
    const intel = partsData.find((p) => p.category === 'cpu' && p.socket !== 'AM5' && !p.legacy)
    const row = screen.getByText(intel.name).closest('tr')
    expect(row.getAttribute('aria-disabled')).toBe('true')
    expect(within(row).getByText(/socket/i)).toBeInTheDocument()
  })

  it('Enter on a row selects it', () => {
    const onSelect = vi.fn()
    render(<PartSelector category="gpu" onSelect={onSelect} onClose={() => {}} />)
    const row = screen.getAllByRole('row').find((r) => r.getAttribute('aria-disabled') !== 'true' && r.tabIndex === 0)
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
