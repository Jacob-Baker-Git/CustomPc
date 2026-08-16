import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import BuildWarnings from '../components/BuildWarnings'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')

beforeEach(() => {
  useBuilderStore.setState({ budget: 1000, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('BuildWarnings', () => {
  it('renders nothing when there are no warnings', () => {
    const { container } = render(<BuildWarnings />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a PSU warning when the build draws power but has no PSU', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<BuildWarnings />)
    expect(screen.getByText(/PSU/i)).toBeInTheDocument()
  })

  it('renders as a RamBox rather than a plain panel', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    const { container } = render(<BuildWarnings />)
    expect(container.querySelector('[data-ram-box]')).not.toBeNull()
    expect(container.querySelectorAll('[data-blade]')).toHaveLength(5)
  })
})
