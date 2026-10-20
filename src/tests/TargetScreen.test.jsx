import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import TargetScreen from '../screens/TargetScreen'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import partsData from '../data/partsData.json'
import { buildForGame } from '../lib/gameTargetBuilder'

// Pass-through, so a test can hand the screen a fixed answer.
vi.mock('../lib/gameTargetBuilder', async (orig) => {
  const real = await orig()
  return { ...real, buildForGame: vi.fn(real.buildForGame) }
})

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

describe('TargetScreen — cards show what changed', () => {
  const p = (id, name, price) => ({ id, name, price })
  // The callout's whole line; the delta sits in its own nowrap span.
  const line = (text) => (_, el) => el?.classList.contains('font-semibold') && el.textContent === text
  const opt = (parts, total, fps) => ({ parts, total, fps })
  const shared = { motherboard: p('mb', 'Board X', 80), ram: p('ram', 'Ram X', 40) }
  const cheapest = opt({ ...shared, cpu: p('c1', 'CPU One', 100), gpu: p('g1', 'GPU One', 400), case: p('k1', 'Case One', 50) }, 670, 70)
  const middle = opt({ ...cheapest.parts, cpu: p('c2', 'CPU Two', 110), gpu: p('g2', 'GPU Two', 494.99) }, 775, 90)
  const best = opt({ ...middle.parts, case: p('k2', 'Case Two', 60) }, 785, 90)

  it('recommends the middle card, zooms on the biggest change and names the rest', async () => {
    buildForGame.mockReturnValueOnce({ cheapest, middle, best })
    render(<TargetScreen />)
    await userEvent.click(find())
    const sections = [...document.querySelectorAll('section')]
    expect(sections).toHaveLength(3)
    const [one, two, three] = sections
    expect(within(two).getByText('Recommended')).toBeInTheDocument()
    expect(within(one).queryByText('Recommended')).toBeNull()
    expect(within(three).queryByText('Recommended')).toBeNull()
    const btn = (s) => within(s).getByRole('button', { name: /use this build/i })
    expect(btn(two).className).toContain('bg-brass')
    expect(btn(one).className).not.toContain('bg-brass')
    expect(btn(three).className).not.toContain('bg-brass')

    expect(within(one).getByText('Base build')).toBeInTheDocument()
    expect(within(one).getByText('CPU One + GPU One')).toBeInTheDocument()

    expect(within(two).getByText(line('GPU · GPU Two · +£95'))).toBeInTheDocument()
    expect(within(two).getByText('CPU also changed')).toBeInTheDocument()
    expect(two.querySelector('[data-still-box]').style.transform).toContain('scale(2.2)')

    // The case has no anchor: the whole still, and the label names the case.
    expect(within(three).getByText(line('Case · Case Two · +£10'))).toBeInTheDocument()
    expect(three.querySelector('[data-still-box]').style.transform).toBe('')
  })

  it('recommends nothing when there is no middle card', async () => {
    buildForGame.mockReturnValueOnce({ cheapest, best, noValueStep: true })
    render(<TargetScreen />)
    await userEvent.click(find())
    expect(screen.queryByText('Recommended')).toBeNull()
    expect(screen.getByText('Nothing above the cheapest build is worth the extra money.')).toBeInTheDocument()
  })

  it('still says when there is no benchmark data', async () => {
    buildForGame.mockReturnValueOnce({ noData: true })
    render(<TargetScreen />)
    await userEvent.click(find())
    expect(screen.getByText(/no benchmark data for fortnite/i)).toBeInTheDocument()
  })
})
