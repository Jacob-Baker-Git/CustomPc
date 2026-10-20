import { gbp } from '../lib/money'
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
    expect(screen.getByText(gbp(cpu.price + gpu.price))).toBeInTheDocument()
  })

  it('turns the loud missing treatment on for its list', () => {
    render(<SelectedPartsPanel selectedParts={{ cpu }} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0)
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

// Showroom (spec 2026-10-20): the rows light their label on the still.
describe('SelectedPartsPanel showroom rows', () => {
  it('hovering a picked row lights its part; leaving clears it', () => {
    const onHot = vi.fn()
    render(<SelectedPartsPanel selectedParts={{ cpu, gpu }} onSelectCategory={noop} onDeselect={noop} onHot={onHot} />)
    const row = document.querySelector('[data-part-row="gpu"]')
    fireEvent.mouseEnter(row)
    expect(onHot).toHaveBeenLastCalledWith('gpu')
    fireEvent.mouseLeave(row)
    expect(onHot).toHaveBeenLastCalledWith(null)
  })

  it('is one column, and names never truncate', () => {
    const { container } = render(<SelectedPartsPanel selectedParts={{ cpu, gpu }} onSelectCategory={noop} onDeselect={noop} />)
    expect(container.querySelector('[class*="lg:grid-cols-2"]')).toBeNull()
    const name = screen.getByText(gpu.name)
    expect(name.className).not.toMatch(/truncate|line-clamp/)
  })

  it('still picks and removes through the existing callbacks', () => {
    const pick = vi.fn()
    const remove = vi.fn()
    render(<SelectedPartsPanel selectedParts={{ cpu, gpu }} onSelectCategory={pick} onDeselect={remove} />)
    fireEvent.click(screen.getByText(gpu.name))
    expect(pick).toHaveBeenCalledWith('gpu')
    fireEvent.click(screen.getByRole('button', { name: /remove gpu/i }))
    expect(remove).toHaveBeenCalledWith('gpu')
  })
})
