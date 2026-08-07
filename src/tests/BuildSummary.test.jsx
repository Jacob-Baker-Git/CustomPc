import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import BuildSummary from '../components/BuildSummary'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4060ti')

beforeEach(() => {
  useBuilderStore.setState({ budget: 1000, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
  useSavedStore.setState({ saved: [] })
})

describe('BuildSummary', () => {
  it('shows an empty prompt when nothing is selected', () => {
    render(<BuildSummary />)
    expect(screen.getByText(/no parts selected yet/i)).toBeInTheDocument()
  })

  it('lists selected parts with prices and buy links', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<BuildSummary />)
    expect(screen.getByText(cpu.name)).toBeInTheDocument()
    expect(screen.getByText(gpu.name)).toBeInTheDocument()
    const buyLinks = screen.getAllByRole('link', { name: /find best price/i })
    expect(buyLinks.length).toBe(2)
    expect(buyLinks[0].getAttribute('href')).toContain('amazon.co.uk')
    expect(buyLinks[0].getAttribute('href')).toContain(encodeURIComponent(cpu.name))
  })

  // This tab used to open with a 22-row frame-rate table whatever the PC was
  // for, which disagreed with the score shown everywhere else.
  describe('CustomPC score block', () => {
    it('leads with the score and the use case it was rated for', () => {
      useBuilderStore.setState({ selectedParts: { cpu, gpu }, useCase: 'programming' })
      render(<BuildSummary />)
      expect(screen.getByText(/custompc score/i)).toBeInTheDocument()
      expect(screen.getByText(/rated for/i)).toHaveTextContent('Programming')
      expect(screen.getByText(/for programming$/i)).toBeInTheDocument()
    })

    it('names the weakest links', () => {
      useBuilderStore.setState({ selectedParts: { cpu, gpu }, useCase: 'gaming' })
      render(<BuildSummary />)
      expect(screen.getByText(/weakest links/i)).toBeInTheDocument()
    })

    it('keeps frame rates behind a toggle instead of dumping the table', () => {
      useBuilderStore.setState({ selectedParts: { cpu, gpu }, useCase: 'gaming' })
      render(<BuildSummary />)
      const toggle = screen.getByRole('button', { name: /frame rates/i })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })

    it('offers no frame rates at all for a use case nobody measures in fps', () => {
      useBuilderStore.setState({ selectedParts: { cpu, gpu }, useCase: 'office' })
      render(<BuildSummary />)
      expect(screen.queryByRole('button', { name: /frame rates/i })).toBeNull()
    })
  })

  it('flags unpicked core categories as visibly missing', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<BuildSummary />)
    // 10 core categories, 2 picked → 8 flagged.
    expect(screen.getAllByText(/not selected/i)).toHaveLength(8)
    expect(screen.getByText(/8 parts missing/i)).toBeInTheDocument()
    expect(screen.getByText('Thermal Paste')).toBeInTheDocument()
  })

  it('shows no missing banner once every core part is picked', () => {
    const full = {}
    for (const cat of ['motherboard', 'cpu', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans', 'paste']) {
      full[cat] = { ...cpu, category: cat, name: `Part ${cat}` }
    }
    useBuilderStore.setState({ selectedParts: full })
    render(<BuildSummary />)
    expect(screen.queryByText(/not selected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/missing/i)).not.toBeInTheDocument()
  })

  it('offers a Copy as Markdown action', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<BuildSummary />)
    expect(screen.getByRole('button', { name: /copy as markdown/i })).toBeInTheDocument()
  })

  it('Clear build empties the store after the dialog confirm', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<BuildSummary />)
    fireEvent.click(screen.getByRole('button', { name: /clear build/i }))
    fireEvent.click(screen.getByRole('button', { name: /clear everything/i }))
    expect(useBuilderStore.getState().selectedParts).toEqual({})
  })

  it('Save PC stores a named build via the dialog', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<BuildSummary />)
    fireEvent.click(screen.getByRole('button', { name: /save pc/i }))
    fireEvent.change(screen.getByLabelText(/build name/i), { target: { value: 'Test Rig' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(useSavedStore.getState().saved.some((b) => b.name === 'Test Rig')).toBe(true)
  })

  it('offers a performance test alongside the existing frame-rate list', () => {
    // useCase is set explicitly (not left to the store default) because the
    // frame-rate block only renders for paced use cases, and this store is a
    // persisted singleton — an earlier test in this file leaves it on 'office'.
    useBuilderStore.setState({ selectedParts: { cpu, gpu }, useCase: 'gaming' })
    render(<BuildSummary />)
    expect(screen.getByRole('button', { name: /run performance test/i })).toBeInTheDocument()
    // The old list stays. It quotes the old model, which still drives the
    // CustomPC score — the two coexist until Phase 6 migrates it.
    expect(screen.getByRole('button', { name: /frame rates @/i })).toBeInTheDocument()
  })

  it('disables the performance test until a CPU and a GPU are picked', () => {
    useBuilderStore.setState({ selectedParts: { cpu } })
    render(<BuildSummary />)
    expect(screen.getByRole('button', { name: /run performance test/i })).toBeDisabled()
  })
})
