import { render, screen, fireEvent } from '@testing-library/react'
import BudgetEntry from '../components/BudgetEntry'

describe('BudgetEntry', () => {
  it('renders the budget heading', () => {
    render(<BudgetEntry onSubmit={() => {}} />)
    expect(screen.getByText(/budget/i)).toBeInTheDocument()
  })

  it('calls onSubmit with numeric value', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1200' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(onSubmit).toHaveBeenCalledWith(1200)
  })

  it('does not call onSubmit with zero', () => {
    const onSubmit = vi.fn()
    render(<BudgetEntry onSubmit={onSubmit} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
