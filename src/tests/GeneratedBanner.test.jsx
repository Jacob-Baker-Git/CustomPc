import { render, screen, fireEvent } from '@testing-library/react'
import GeneratedBanner from '../components/GeneratedBanner'
import useBuilderStore from '../store/useBuilderStore'
import { targetBuild } from '../lib/targetBuilder'
import partsData from '../data/partsData.json'
import gamesData from '../data/gamesData.json'

const fortnite = gamesData.find((g) => g.id === 'fortnite')

beforeEach(() => {
  localStorage.clear()
  const { parts, estFps } = targetBuild(1600, '1440p', 60, fortnite, partsData)
  useBuilderStore.setState({
    budget: 1600,
    resolution: '1440p',
    selectedParts: parts,
    selectedPeripherals: {},
    lastGenerated: { met: true, estFps, targetFps: 60, gameName: 'Fortnite' },
  })
})

describe('GeneratedBanner', () => {
  it('renders nothing when no build was generated', () => {
    useBuilderStore.setState({ lastGenerated: null })
    const { container } = render(<GeneratedBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('summarises what the generated build achieves', () => {
    render(<GeneratedBanner />)
    expect(screen.getByText(/fortnite/i)).toBeInTheDocument()
    expect(screen.getByText(/under budget/i)).toBeInTheDocument()
  })

  it('spend-the-leftover upgrades the build and dismisses the banner', () => {
    render(<GeneratedBanner />)
    const before = useBuilderStore.getState().selectedParts.gpu.perfScore
    fireEvent.click(screen.getByRole('button', { name: /spend the leftover/i }))
    expect(useBuilderStore.getState().selectedParts.gpu.perfScore).toBeGreaterThan(before)
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
})
