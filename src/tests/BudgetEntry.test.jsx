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

  it('starts with an empty budget field and a placeholder, not a preset value', () => {
    render(<BudgetEntry onSubmit={() => {}} />)
    const input = screen.getByRole('spinbutton')
    expect(input.value).toBe('')
    expect(input.placeholder).toMatch(/budget/i)
  })

  it('shows the three wizard steps so the flow is clear up front', () => {
    render(<BudgetEntry onSubmit={() => {}} />)
    expect(screen.getByText(/^budget$/i)).toBeInTheDocument()
    expect(screen.getByText(/^resolution$/i)).toBeInTheDocument()
    expect(screen.getByText(/fps target/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next: resolution/i })).toBeInTheDocument()
  })

  it('submitting a budget advances to the resolution step, not straight in', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1200' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/what resolution/i)).toBeInTheDocument()
  })

  it('does not advance with a zero budget', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByText(/what resolution/i)).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('highlights the picked resolution and only advances on continue', () => {
    render(<BudgetEntry onSubmit={() => {}} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /next: resolution/i }))

    // Continue is disabled until a resolution is chosen.
    const cont = screen.getByRole('button', { name: /next: fps target/i })
    expect(cont).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /1440p/i }))
    // Still on the resolution step — clicking a card selects, it doesn't advance.
    expect(screen.getByText(/what resolution/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /1440p/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /1080p/i })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(cont)
    expect(screen.getByText(/pick an fps target/i)).toBeInTheDocument()
  })

  it('walks budget → resolution → FPS target and generates a build', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /next: resolution/i }))

    fireEvent.click(screen.getByRole('button', { name: /1440p/i }))
    fireEvent.click(screen.getByRole('button', { name: /next: fps target/i }))

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
    fireEvent.click(screen.getByRole('button', { name: /next: resolution/i }))
    fireEvent.click(screen.getByRole('button', { name: /1080p/i }))
    fireEvent.click(screen.getByRole('button', { name: /next: fps target/i }))
    fireEvent.click(screen.getByRole('button', { name: /start empty/i }))

    expect(onSubmit).toHaveBeenCalledWith(900)
    expect(useBuilderStore.getState().selectedParts).toEqual({})
  })

  it('Start empty wipes a build persisted from a previous visit', () => {
    // Simulate localStorage restoring last session's build + peripherals.
    useBuilderStore.setState({
      selectedParts: { cpu: { id: 'cpu-old', category: 'cpu', name: 'Old CPU', price: 100, tdp: 65 } },
      selectedPeripherals: { mouse: { id: 'mouse-old', category: 'mouse', name: 'Old Mouse', price: 20 } },
    })
    render(<BudgetEntry onSubmit={() => {}} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: /next: resolution/i }))
    fireEvent.click(screen.getByRole('button', { name: /1080p/i }))
    fireEvent.click(screen.getByRole('button', { name: /next: fps target/i }))
    fireEvent.click(screen.getByRole('button', { name: /start empty/i }))

    expect(useBuilderStore.getState().selectedParts).toEqual({})
    expect(useBuilderStore.getState().selectedPeripherals).toEqual({})
  })

  it('accepts a custom FPS target (e.g. a 360Hz monitor)', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /next: resolution/i }))
    fireEvent.click(screen.getByRole('button', { name: /1080p/i }))
    fireEvent.click(screen.getByRole('button', { name: /next: fps target/i }))

    fireEvent.change(screen.getByLabelText(/custom fps target/i), { target: { value: '360' } })
    // Presets unhighlight once the custom box takes over.
    expect(screen.getByRole('button', { name: /^120/ })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.change(screen.getByLabelText(/game/i), { target: { value: 'valorant' } })
    fireEvent.click(screen.getByRole('button', { name: /generate/i }))

    expect(onSubmit).toHaveBeenCalledWith(3000)
    expect(useBuilderStore.getState().lastGenerated?.targetFps).toBe(360)
  })

  it('accepts a custom resolution next to the presets (e.g. ultrawide)', () => {
    render(<BudgetEntry onSubmit={() => {}} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: /next: resolution/i }))

    fireEvent.change(screen.getByLabelText(/custom resolution/i), { target: { value: '3440x1440' } })
    fireEvent.click(screen.getByRole('button', { name: /next: fps target/i }))
    fireEvent.click(screen.getByRole('button', { name: /start empty/i }))

    expect(useBuilderStore.getState().resolution).toBe('3440x1440')
  })

  it('a valid custom resolution overrides a previously picked preset', () => {
    render(<BudgetEntry onSubmit={() => {}} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: /next: resolution/i }))

    fireEvent.click(screen.getByRole('button', { name: /1440p/i }))
    fireEvent.change(screen.getByLabelText(/custom resolution/i), { target: { value: '2560 X 1080' } })
    expect(screen.getByRole('button', { name: /1440p/i })).toHaveAttribute('aria-pressed', 'false')

    // Picking a preset again clears the custom box.
    fireEvent.click(screen.getByRole('button', { name: /4k/i }))
    expect(screen.getByLabelText(/custom resolution/i).value).toBe('')
    expect(screen.getByRole('button', { name: /4k/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('rejects nonsense in the custom resolution box', () => {
    render(<BudgetEntry onSubmit={() => {}} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: /next: resolution/i }))

    fireEvent.change(screen.getByLabelText(/custom resolution/i), { target: { value: 'potato' } })
    expect(screen.getByText(/width x height/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next: fps target/i })).toBeDisabled()
  })

  it('rejects an out-of-range custom FPS and falls back to the preset', () => {
    render(<BudgetEntry onSubmit={() => {}} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /next: resolution/i }))
    fireEvent.click(screen.getByRole('button', { name: /1440p/i }))
    fireEvent.click(screen.getByRole('button', { name: /next: fps target/i }))

    fireEvent.change(screen.getByLabelText(/custom fps target/i), { target: { value: '9999' } })
    expect(screen.getByText(/between 30 and 600/i)).toBeInTheDocument()
    // The 120 preset stays active for generation.
    expect(screen.getByRole('button', { name: /^120/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('warns when the target is unreachable and offers the closest build', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '800' } })
    fireEvent.click(screen.getByRole('button', { name: /next: resolution/i }))
    fireEvent.click(screen.getByRole('button', { name: /4k/i }))
    fireEvent.click(screen.getByRole('button', { name: /next: fps target/i }))
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
