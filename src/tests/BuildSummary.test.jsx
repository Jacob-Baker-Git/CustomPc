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
})
