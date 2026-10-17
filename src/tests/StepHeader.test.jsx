import { render, screen, fireEvent } from '@testing-library/react'
import StepHeader from '../components/StepHeader'

describe('StepHeader', () => {
  it('lists the four steps in order, numbered', () => {
    render(<StepHeader view="build" onChange={() => {}} />)
    const names = screen.getAllByRole('button').map((b) => b.textContent)
    expect(names).toEqual(['01Build', '02Performance', '03Peripherals', '04Summary'])
  })

  it('marks the current step', () => {
    render(<StepHeader view="performance" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /performance/i })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /build/i })).not.toHaveAttribute('aria-current')
  })

  // A game-target build starts at Peripherals: Build and Performance were
  // never visited, so they must not read as done (muted).
  it('marks only the steps a path walked as done', () => {
    const { rerender } = render(<StepHeader view="summary" onChange={() => {}} path="game" />)
    expect(screen.getByRole('button', { name: /build/i })).toHaveClass('text-faint')
    expect(screen.getByRole('button', { name: /performance/i })).toHaveClass('text-faint')
    expect(screen.getByRole('button', { name: /peripherals/i })).toHaveClass('text-muted')
    rerender(<StepHeader view="summary" onChange={() => {}} path="parts" />)
    expect(screen.getByRole('button', { name: /build/i })).toHaveClass('text-muted')
  })

  it('moves to the step clicked', () => {
    const onChange = vi.fn()
    render(<StepHeader view="build" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /summary/i }))
    expect(onChange).toHaveBeenCalledWith('summary')
  })
})
