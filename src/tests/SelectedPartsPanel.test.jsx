import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import SelectedPartsPanel from '../components/SelectedPartsPanel'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.category === 'gpu')

const noop = () => {}

describe('SelectedPartsPanel', () => {
  it('says what the list is', () => {
    render(<SelectedPartsPanel selectedParts={{}} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByRole('heading', { name: /your parts/i })).toBeInTheDocument()
  })

  // Paste is optional, so a finished build must read 9 of 9, never 9 of 10.
  it('counts essentials only', () => {
    render(<SelectedPartsPanel selectedParts={{ cpu, gpu }} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByText('2 of 9 essentials chosen')).toBeInTheDocument()
  })

  it('calls out how many are still missing', () => {
    render(<SelectedPartsPanel selectedParts={{ cpu, gpu }} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByText(/7 missing/i)).toBeInTheDocument()
  })

  it('says so plainly when the build is complete', () => {
    const full = {}
    for (const c of ['motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case', 'fans']) {
      full[c] = partsData.find((p) => p.category === c)
    }
    render(<SelectedPartsPanel selectedParts={full} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByText('9 of 9 essentials chosen')).toBeInTheDocument()
    expect(screen.getByText(/all essentials covered/i)).toBeInTheDocument()
  })

  it('shows the running spend', () => {
    render(<SelectedPartsPanel selectedParts={{ cpu, gpu }} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByText(`£${(cpu.price + gpu.price).toFixed(0)}`)).toBeInTheDocument()
  })

  it('turns the loud missing treatment on for its list', () => {
    render(<SelectedPartsPanel selectedParts={{ cpu }} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0)
  })

  it('renders as an unseated RamBox when nothing is selected', () => {
    useBuilderStore.setState({ selectedPeripherals: {} })
    const { container } = render(<SelectedPartsPanel selectedParts={{}} onSelectCategory={noop} onDeselect={noop} />)
    expect(container.querySelector('[data-ram-box]')).not.toBeNull()
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-seated', 'false')
  })

  it('seats the RamBox once parts are selected', () => {
    useBuilderStore.setState({ selectedPeripherals: {} })
    const { container } = render(<SelectedPartsPanel selectedParts={{ cpu, gpu }} onSelectCategory={noop} onDeselect={noop} />)
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-seated', 'true')
  })

  it('stays unseated when only a peripheral is picked', () => {
    // The fork that made this worth pinning: `isEmpty` counts peripherals too,
    // because Clear build empties both. Wiring `seated` to it lit the parts
    // panel gold for a monitor chosen on another tab, while every slot this
    // panel actually draws was still an empty placeholder. Seated is about
    // THIS box's contents.
    useBuilderStore.setState({ selectedPeripherals: { monitor: { id: 'm1', name: 'Monitor', price: 200 } } })
    const { container } = render(<SelectedPartsPanel selectedParts={{}} onSelectCategory={noop} onDeselect={noop} />)
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-seated', 'false')
  })
})

// Clearing is duplicated from the Summary tab on purpose — this is where people
// are looking when they decide to start over.
describe('SelectedPartsPanel clear all', () => {
  beforeEach(() => {
    localStorage.clear()
    useBuilderStore.setState({ selectedParts: { cpu }, selectedPeripherals: {} })
  })

  it('disables Clear all when there is nothing to clear', () => {
    useBuilderStore.setState({ selectedParts: {}, selectedPeripherals: {} })
    render(<SelectedPartsPanel selectedParts={{}} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByRole('button', { name: /clear all/i })).toBeDisabled()
  })

  // A monitor-only selection still has something to clear, so the button must
  // not key off parts alone.
  it('stays enabled when only peripherals are chosen', () => {
    useBuilderStore.setState({ selectedParts: {}, selectedPeripherals: { monitor: { id: 'mon', price: 100 } } })
    render(<SelectedPartsPanel selectedParts={{}} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByRole('button', { name: /clear all/i })).toBeEnabled()
  })

  it('asks first, then empties the build on confirm', () => {
    render(<SelectedPartsPanel selectedParts={{ cpu }} onSelectCategory={noop} onDeselect={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /clear everything/i }))
    expect(useBuilderStore.getState().selectedParts).toEqual({})
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the build when the dialog is cancelled', () => {
    render(<SelectedPartsPanel selectedParts={{ cpu }} onSelectCategory={noop} onDeselect={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useBuilderStore.getState().selectedParts.cpu).toBeDefined()
  })
})
