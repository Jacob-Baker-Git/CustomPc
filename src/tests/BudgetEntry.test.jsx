import { render, screen, fireEvent } from '@testing-library/react'
import BudgetEntry from '../components/BudgetEntry'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  window.location.hash = ''
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p', lastGenerated: null })
})

const enterBudget = (v) => {
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: v } })
  fireEvent.click(screen.getByRole('button', { name: /next: use case/i }))
}

describe('BudgetEntry wizard', () => {
  it('renders the budget heading and the two steps', () => {
    render(<BudgetEntry onSubmit={() => {}} onBack={() => {}} />)
    expect(screen.getByText(/what's your budget/i)).toBeInTheDocument()
    expect(screen.getByText(/^budget$/i)).toBeInTheDocument()
    expect(screen.getByText(/^use case$/i)).toBeInTheDocument()
  })

  it('back to menu calls onBack', () => {
    const onBack = vi.fn()
    render(<BudgetEntry onSubmit={() => {}} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('does not advance with a zero budget', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} onBack={() => {}} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByText(/what will you use/i)).not.toBeInTheDocument()
  })

  it('budget -> use case -> generate builds a PC and enters the builder', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} onBack={() => {}} />)
    enterBudget('1500')
    expect(screen.getByText(/what will you use/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /gaming/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    expect(onSubmit).toHaveBeenCalledWith(1500)
    expect(useBuilderStore.getState().selectedParts.cpu).toBeDefined()
    expect(useBuilderStore.getState().selectedParts.gpu).toBeDefined()
  })

  it('content creation use case defaults the stored resolution to 4k', () => {
    render(<BudgetEntry onSubmit={() => {}} onBack={() => {}} />)
    enterBudget('3000')
    fireEvent.click(screen.getByRole('button', { name: /content creation/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    expect(useBuilderStore.getState().resolution).toBe('4k')
  })

  it('start empty skips generation and wipes a persisted build', () => {
    const onSubmit = vi.fn()
    useBuilderStore.setState({
      selectedParts: { cpu: { id: 'old', category: 'cpu', name: 'Old', price: 100, tdp: 65 } },
      selectedPeripherals: { mouse: { id: 'm', category: 'mouse', name: 'M', price: 10 } },
    })
    render(<BudgetEntry onSubmit={onSubmit} onBack={() => {}} />)
    enterBudget('900')
    fireEvent.click(screen.getByRole('button', { name: /start empty/i }))
    expect(onSubmit).toHaveBeenCalledWith(900)
    expect(useBuilderStore.getState().selectedParts).toEqual({})
    expect(useBuilderStore.getState().selectedPeripherals).toEqual({})
  })

  it('always lands on the Build tab even if the hash was left on summary', () => {
    window.location.hash = 'summary'
    render(<BudgetEntry onSubmit={() => {}} onBack={() => {}} />)
    enterBudget('900')
    fireEvent.click(screen.getByRole('button', { name: /start empty/i }))
    expect(window.location.hash).toBe('#build')
  })

  it('a quick-start tier applies a generated build and its budget', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /budget · £900/i }))
    expect(onSubmit).toHaveBeenCalledWith(900)
    expect(useBuilderStore.getState().selectedParts.cpu).toBeDefined()
  })
})
