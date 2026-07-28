import { render, screen, fireEvent } from '@testing-library/react'
import GeneratedBanner from '../components/GeneratedBanner'
import useBuilderStore from '../store/useBuilderStore'
import { autoBuild } from '../lib/autoBuilder'
import partsData from '../data/partsData.json'

beforeEach(() => {
  localStorage.clear()
  // A non-maximised build deliberately leaves money on the table, which is what
  // the "spend the leftover" path needs to act on.
  const parts = autoBuild({}, 1600, partsData, '1440p')
  useBuilderStore.setState({
    budget: 1600,
    resolution: '1440p',
    useCase: 'gaming',
    selectedParts: parts,
    selectedPeripherals: {},
    lastGenerated: { useCase: 'gaming', spend: 0, budget: 1600 },
  })
})

describe('GeneratedBanner', () => {
  it('renders nothing when no build was generated', () => {
    useBuilderStore.setState({ lastGenerated: null })
    const { container } = render(<GeneratedBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('summarises what the generated build cost', () => {
    render(<GeneratedBanner />)
    expect(screen.getByText(/gaming build/i)).toBeInTheDocument()
    expect(screen.getByText(/under budget/i)).toBeInTheDocument()
  })

  it('spend-the-leftover upgrades the build and dismisses the banner', () => {
    render(<GeneratedBanner />)
    const total = (p) => Object.values(p).reduce((s, x) => s + (x?.price ?? 0), 0)
    const before = total(useBuilderStore.getState().selectedParts)
    fireEvent.click(screen.getByRole('button', { name: /spend the leftover/i }))
    const after = total(useBuilderStore.getState().selectedParts)
    expect(after).toBeGreaterThan(before)
    expect(after).toBeLessThanOrEqual(1600)
    expect(useBuilderStore.getState().lastGenerated).toBeNull()
  })

  it('can be dismissed', () => {
    render(<GeneratedBanner />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(useBuilderStore.getState().lastGenerated).toBeNull()
  })

  it('shows a generic line for an FPS-less upgrade (no "undefined fps")', () => {
    useBuilderStore.setState({
      lastGenerated: { upgrade: true },
      budget: 1000, resolution: '1440p',
      selectedParts: { cpu: { price: 300 }, gpu: { price: 400 } },
    })
    render(<GeneratedBanner />)
    expect(screen.getByRole('status').textContent).not.toMatch(/undefined/)
    expect(screen.getByText(/upgrade applied/i)).toBeInTheDocument()
  })

  it('summarises a use-case build without an FPS claim', () => {
    useBuilderStore.setState({
      lastGenerated: { useCase: 'programming', spend: 1450, budget: 1600 },
      budget: 1600, resolution: '1440p',
      selectedParts: { cpu: { price: 300 }, gpu: { price: 400 } },
    })
    render(<GeneratedBanner />)
    expect(screen.getByText(/programming build/i)).toBeInTheDocument()
    expect(screen.getByRole('status').textContent).not.toMatch(/fps/i)
  })
})
