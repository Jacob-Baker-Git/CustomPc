import { render, screen, fireEvent } from '@testing-library/react'
import BudgetEntry from '../components/BudgetEntry'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('BudgetEntry wizard', () => {
  it('renders the budget heading', () => {
    render(<BudgetEntry onSubmit={() => {}} />)
    expect(screen.getByText(/what's your budget/i)).toBeInTheDocument()
  })

  it('submitting a budget advances to the resolution step, not straight in', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1200' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/resolution/i)).toBeInTheDocument()
  })

  it('does not advance with a zero budget', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByText(/resolution/i)).not.toBeInTheDocument()
  })

  it('walks budget → resolution → FPS target and generates a build', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    fireEvent.click(screen.getByRole('button', { name: /1440p/i }))

    fireEvent.click(screen.getByRole('button', { name: /^120/ }))
    fireEvent.change(screen.getByLabelText(/game/i), { target: { value: 'fortnite' } })
    fireEvent.click(screen.getByRole('button', { name: /generate/i }))

    expect(onSubmit).toHaveBeenCalledWith(1500)
    expect(useBuilderStore.getState().selectedParts.cpu).toBeDefined()
    expect(useBuilderStore.getState().selectedParts.gpu).toBeDefined()
    expect(useBuilderStore.getState().resolution).toBe('1440p')
  })

  it('can skip generation and start with an empty build', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /1080p/i }))
    fireEvent.click(screen.getByRole('button', { name: /start empty/i }))

    expect(onSubmit).toHaveBeenCalledWith(900)
    expect(useBuilderStore.getState().selectedParts).toEqual({})
  })

  it('warns when the target is unreachable and offers the closest build', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '800' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /4k/i }))
    fireEvent.click(screen.getByRole('button', { name: /^240/ }))
    fireEvent.change(screen.getByLabelText(/game/i), { target: { value: 'alan-wake-2' } })
    fireEvent.click(screen.getByRole('button', { name: /generate/i }))

    // Not applied yet — user is told the target can't be hit.
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/closest build manages/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /use closest/i }))
    expect(onSubmit).toHaveBeenCalledWith(800)
    expect(useBuilderStore.getState().selectedParts.gpu).toBeDefined()
  })
})
