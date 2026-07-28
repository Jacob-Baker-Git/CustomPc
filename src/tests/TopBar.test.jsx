import { render, screen, fireEvent } from '@testing-library/react'
import TopBar from '../components/TopBar'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  useBuilderStore.setState({ budget: 1500, flow: 'builder', selectedParts: {}, selectedPeripherals: {} })
})

describe('TopBar back button', () => {
  // Leaving the builder used to be setBudget(0), because routing keyed off the
  // budget. It is a plain flow change now, so the budget survives.
  it('returns to the hub without touching the build or the budget', () => {
    useBuilderStore.setState({ selectedParts: { cpu: { id: 'x', price: 200 } } })
    render(<TopBar view="build" onViewChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }))
    expect(useBuilderStore.getState().flow).toBe('hub')
    expect(useBuilderStore.getState().budget).toBe(1500)
    expect(useBuilderStore.getState().selectedParts.cpu).toBeDefined()
  })
})

describe('TopBar view tabs', () => {
  it('renders one tab per builder view and marks the current one', () => {
    render(<TopBar view="summary" onViewChange={() => {}} />)
    for (const label of ['build', 'peripherals', 'summary']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: /^summary$/i })).toHaveAttribute('aria-current', 'page')
  })

  it('reports the tab the user picked', () => {
    const onViewChange = vi.fn()
    render(<TopBar view="build" onViewChange={onViewChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^peripherals$/i }))
    expect(onViewChange).toHaveBeenCalledWith('peripherals')
  })

  it('has no saved tab — saved builds live on the hub', () => {
    render(<TopBar view="build" onViewChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /^saved$/i })).toBeNull()
  })
})
