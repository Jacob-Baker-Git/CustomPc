import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SelectedPartsPanel from '../components/SelectedPartsPanel'
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
})
