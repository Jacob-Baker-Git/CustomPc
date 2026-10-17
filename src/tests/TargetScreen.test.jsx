import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import TargetScreen from '../screens/TargetScreen'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import partsData from '../data/partsData.json'

beforeEach(() => {
  useBuilderStore.setState({
    flow: 'target', path: 'parts', budget: 1600, resolution: '1440p', selectedParts: {},
    target: { gameId: 'fortnite', presetKey: null, fps: 60 },
  })
})

const find = () => screen.getByRole('button', { name: /find builds/i })

describe('TargetScreen', () => {
  it('is disabled without a game', () => {
    useBuilderStore.setState({ target: { gameId: null, presetKey: null, fps: 60 } })
    render(<TargetScreen />)
    expect(find()).toBeDisabled()
  })

  it.each([['', '1600'], ['0', '1600'], ['60', ''], ['60', '-5']])(
    'is disabled for target %j and budget %j', async (fps, budget) => {
      render(<TargetScreen />)
      const fpsBox = screen.getByRole('spinbutton', { name: /target fps/i })
      const budgetBox = screen.getByRole('spinbutton', { name: /budget/i })
      await userEvent.clear(fpsBox); if (fps) await userEvent.type(fpsBox, fps)
      await userEvent.clear(budgetBox); if (budget) await userEvent.type(budgetBox, budget)
      expect(find()).toBeDisabled()
    })

  it('finds a build and hands it to the builder at Peripherals', async () => {
    render(<TargetScreen />)
    await userEvent.click(find())
    expect(screen.getByText(/^best within £1,600$/i)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: /use this build/i })[0])
    const s = useBuilderStore.getState()
    expect(s.flow).toBe('builder')
    expect(s.path).toBe('game')
    expect(s.selectedParts.cpu && s.selectedParts.gpu).toBeTruthy()
    expect(window.location.hash).toBe('#peripherals')
  })

  // Final review, Important #4: results belong to the inputs they answered.
  it('drops results once an input changes', async () => {
    render(<TargetScreen />)
    await userEvent.click(find())
    expect(screen.getByText(/^best within £1,600$/i)).toBeInTheDocument()
    act(() => useBuilderStore.setState({ resolution: '4k' }))
    expect(screen.queryByText(/best within/i)).toBeNull()
  })

  it('names the settings the results are for', async () => {
    render(<TargetScreen />)
    await userEvent.click(find())
    expect(screen.getByText(/fortnite · 1440p · epic/i)).toBeInTheDocument()
  })

  it('says plainly when no build can reach the target', async () => {
    useBuilderStore.setState({ target: { gameId: 'fortnite', presetKey: null, fps: 100000 } })
    render(<TargetScreen />)
    await userEvent.click(find())
    expect(screen.getByText(/no build in the catalogue reaches/i)).toBeInTheDocument()
  })

  it('says when the budget buys no complete build', async () => {
    useBuilderStore.setState({ budget: 100 })
    render(<TargetScreen />)
    await userEvent.click(find())
    expect(screen.getByText(/no complete build fits £100/i)).toBeInTheDocument()
  })
})

describe('TargetScreen — each option leads with its answer', () => {
  it('puts fps, price and the button before the parts list', async () => {
    render(<TargetScreen />)
    await userEvent.click(find())
    const option = screen.getByText(/^best within/i).closest('section')
    const button = within(option).getByRole('button', { name: /use this build/i })
    const parts = option.querySelector('details')
    expect(parts).not.toBeNull()
    expect(button.compareDocumentPosition(parts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('TargetScreen — three answers', () => {
  const original = window.matchMedia
  afterEach(() => { window.matchMedia = original })

  it('shows the cheapest build that hits as well as the best', async () => {
    render(<TargetScreen />)
    await userEvent.click(find())
    expect(screen.getByText(/^cheapest that hits 60 fps$/i)).toBeInTheDocument()
    expect(screen.getByText(/^best within £1,600$/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /use this build/i }).length).toBeGreaterThanOrEqual(2)
  })

  it('on desktop the parts lists start open and changed parts are marked', async () => {
    window.matchMedia = () => ({ matches: true })
    render(<TargetScreen />)
    await userEvent.click(find())
    for (const d of document.querySelectorAll('details')) expect(d.open).toBe(true)
    expect(document.querySelectorAll('[data-changed="true"]').length).toBeGreaterThan(0)
  })

  it('marks a build that costs more than the budget', async () => {
    useBuilderStore.setState({ budget: 400 })
    render(<TargetScreen />)
    await userEvent.click(find())
    expect(screen.getByText(/^over budget$/i)).toBeInTheDocument()
  })

  it('says when nothing above the cheapest is worth it', async () => {
    // Fortnite 1440p Epic, 250 fps, £1,600: the cheapest hit is £994 at 277 fps
    // and nothing between it and the best (£1,599, 318 fps) clears VALUE_BAR.
    useBuilderStore.setState({ target: { gameId: 'fortnite', presetKey: null, fps: 250 } })
    render(<TargetScreen />)
    await userEvent.click(find())
    expect(screen.getByText('Nothing above the cheapest build is worth the extra money.')).toBeInTheDocument()
    expect(screen.queryByText(/^best value$/i)).toBeNull()
  })
})

describe('TargetScreen — nothing can be completed', () => {
  afterEach(() => { useCatalogStore.setState({ parts: partsData }) })

  it('says no build reaches the target without naming a fastest build that does not exist', async () => {
    // Frame rates exist for every CPU + GPU pair, but with no boards, memory or
    // cases no pair becomes a whole PC, so there is no fastest build either.
    useCatalogStore.setState({ parts: partsData.filter((p) => p.category === 'cpu' || p.category === 'gpu') })
    useBuilderStore.setState({ target: { gameId: 'fortnite', presetKey: null, fps: 100000 } })
    render(<TargetScreen />)
    await userEvent.click(find())
    expect(screen.getByText(/no build in the catalogue reaches/i)).toBeInTheDocument()
    expect(screen.queryByText(/the fastest manages/i)).toBeNull()
  })
})
