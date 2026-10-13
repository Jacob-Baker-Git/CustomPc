import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import TargetScreen from '../screens/TargetScreen'
import useBuilderStore from '../store/useBuilderStore'

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
    expect(screen.getByText(/best build within £1600/i)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: /use this build/i })[0])
    const s = useBuilderStore.getState()
    expect(s.flow).toBe('builder')
    expect(s.path).toBe('game')
    expect(s.selectedParts.cpu && s.selectedParts.gpu).toBeTruthy()
    expect(window.location.hash).toBe('#peripherals')
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
