import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import PeripheralsPanel from '../components/PeripheralsPanel'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import peripheralsData from '../data/peripheralsData.json'

const monitor = peripheralsData.find((p) => p.id === 'mon-dell-s2721dgf')

beforeEach(() => {
  useBuilderStore.setState({ selectedPeripherals: {} })
})

afterEach(() => {
  useCatalogStore.setState({ peripherals: peripheralsData })
})

// Each category shows its first four until asked (spec 2026-10-16). These tests
// are about the full list, so they open every category first.
function renderAll() {
  const utils = render(<PeripheralsPanel />)
  for (const b of screen.queryAllByRole('button', { name: /^Show all/ })) fireEvent.click(b)
  return utils
}

describe('PeripheralsPanel', () => {
  it('lists peripherals grouped by category', () => {
    renderAll()
    expect(screen.getByRole('heading', { name: /monitor/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /keyboard/i })).toBeInTheDocument()
    expect(screen.getByText(monitor.name)).toBeInTheDocument()
  })

  it('selects on click and deselects on a second click', () => {
    renderAll()
    // Anchored so it can't also match the "More info about …" button.
    const card = screen.getByRole('button', { name: new RegExp(`^${monitor.name}`) })
    fireEvent.click(card)
    expect(useBuilderStore.getState().selectedPeripherals.monitor?.id).toBe(monitor.id)
    fireEvent.click(card)
    expect(useBuilderStore.getState().selectedPeripherals.monitor).toBeUndefined()
  })

  it('hides the spec sheet until the Info button is pressed', () => {
    renderAll()
    expect(screen.queryByText(/refresh rate/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `More info about ${monitor.name}` }))
    expect(screen.getByText(/refresh rate/i)).toBeInTheDocument()
    expect(screen.getByText(/resolution/i)).toBeInTheDocument()
  })

  it('opening info does not select the peripheral', () => {
    renderAll()
    fireEvent.click(screen.getByRole('button', { name: `More info about ${monitor.name}` }))
    expect(useBuilderStore.getState().selectedPeripherals.monitor).toBeUndefined()
  })

  // Filters moved out of four stacked inline chip rows and into one panel that
  // only takes effect on Apply.
  describe('filter panel', () => {
    const cheapest = (cat) =>
      peripheralsData.filter((p) => p.category === cat).sort((a, b) => a.price - b.price)[0]
    const dearest = (cat) =>
      peripheralsData.filter((p) => p.category === cat).sort((a, b) => b.price - a.price)[0]

    const openPanel = () => {
      fireEvent.click(screen.getByRole('button', { name: /^filters/i }))
      return screen.getByRole('dialog', { name: /filter peripherals/i })
    }

    it('shows every option before anything is filtered', () => {
      renderAll()
      expect(screen.getByText(cheapest('monitor').name)).toBeInTheDocument()
      expect(screen.getByText(dearest('monitor').name)).toBeInTheDocument()
    })

    it('opens from the Filters button and closes on Cancel', () => {
      renderAll()
      openPanel()
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('offers a brand filter, which the tab never had before', () => {
      renderAll()
      const panel = openPanel()
      expect(within(panel).getByRole('button', { name: 'Dell' })).toBeInTheDocument()
    })

    // The whole point of a panel over live chips: nothing moves until Apply.
    it('does not filter until Apply is pressed', () => {
      renderAll()
      openPanel()
      fireEvent.change(screen.getByLabelText(/maximum price/i), { target: { value: '100' } })
      expect(screen.getByText(dearest('monitor').name)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
      expect(screen.queryByText(dearest('monitor').name)).toBeNull()
      expect(screen.getByText(cheapest('monitor').name)).toBeInTheDocument()
    })

    it('throws away the draft when cancelled', () => {
      renderAll()
      openPanel()
      fireEvent.change(screen.getByLabelText(/maximum price/i), { target: { value: '100' } })
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(screen.getByText(dearest('monitor').name)).toBeInTheDocument()
    })

    it('filters by brand across every category at once', () => {
      renderAll()
      const panel = openPanel()
      fireEvent.click(within(panel).getByRole('button', { name: 'Dell' }))
      fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))

      // Dell make monitors here and nothing else, so the other categories empty
      // out rather than keeping their unfiltered lists.
      expect(screen.queryByText(dearest('mouse').name)).toBeNull()
      const dell = peripheralsData.find((p) => p.brand === 'Dell')
      expect(screen.getByText(dell.name)).toBeInTheDocument()
    })

    it('badges how many filters are active', () => {
      renderAll()
      const panel = openPanel()
      fireEvent.click(within(panel).getByRole('button', { name: 'Dell' }))
      fireEvent.change(screen.getByLabelText(/minimum price/i), { target: { value: '50' } })
      fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))

      expect(screen.getByRole('button', { name: /^filters/i })).toHaveTextContent('2')
    })

    it('multi-select keeps both chosen resolutions', () => {
      renderAll()
      const panel = openPanel()
      fireEvent.click(within(panel).getByRole('button', { name: '1080p' }))
      fireEvent.click(within(panel).getByRole('button', { name: '4k' }))
      fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))

      const monitors = peripheralsData.filter((p) => p.category === 'monitor')
      expect(screen.getByText(monitors.find((p) => p.resolution === '1080p').name)).toBeInTheDocument()
      expect(screen.getByText(monitors.find((p) => p.resolution === '4k').name)).toBeInTheDocument()
      expect(screen.queryByText(monitors.find((p) => p.resolution === '1440p').name)).toBeNull()
    })

    it('Clear filters resets the badge and the list', () => {
      renderAll()
      const panel = openPanel()
      fireEvent.click(within(panel).getByRole('button', { name: 'Dell' }))
      fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
      expect(screen.queryByText(dearest('mouse').name)).toBeNull()

      // The emptied category sections each offer their own "Clear filters"
      // link, so this deliberately takes the toolbar's — the first in the DOM.
      fireEvent.click(screen.getAllByRole('button', { name: /clear filters/i })[0])
      expect(screen.getByText(dearest('mouse').name)).toBeInTheDocument()
    })
  })

  it('reports how many are chosen and what they cost', () => {
    renderAll()
    const tag = () => screen.getByText(/of 4 chosen/).closest('span')
    expect(tag()).toHaveTextContent('[ 0 of 4 chosen · £0 ]')
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${monitor.name}`) }))
    expect(tag()).toHaveTextContent(`[ 1 of 4 chosen · £${monitor.price.toFixed(0)} ]`)
  })
})

// Configurator redesign (spec 2026-10-16): four per category, the rest one tap
// away, and never a cap on a search.
describe('PeripheralsPanel — first four per category', () => {
  const monitors = peripheralsData.filter((p) => p.category === 'monitor')
  const monitorSection = () => screen.getByRole('heading', { name: /^monitor$/i }).closest('section')

  it('shows four monitors and offers the rest', () => {
    render(<PeripheralsPanel />)
    const section = monitorSection()
    expect(within(section).getAllByRole('button', { name: /^More info about/ })).toHaveLength(4)
    fireEvent.click(within(section).getByRole('button', { name: `Show all ${monitors.length} monitors` }))
    expect(within(section).getAllByRole('button', { name: /^More info about/ })).toHaveLength(monitors.length)
  })

  it('lifts the cap while searching', () => {
    render(<PeripheralsPanel />)
    fireEvent.change(screen.getByRole('searchbox', { name: /search peripherals/i }), { target: { value: 'a' } })
    const section = monitorSection()
    const matches = monitors.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes('a')).length
    expect(matches).toBeGreaterThan(4)
    expect(within(section).getAllByRole('button', { name: /^More info about/ })).toHaveLength(matches)
    expect(within(section).queryByRole('button', { name: /^Show all/ })).toBeNull()
  })
})
