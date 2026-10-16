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
    expect(screen.getByRole('button', { name: /performance/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: /build/i })).not.toHaveAttribute('aria-current')
  })

  it('moves to the step clicked', () => {
    const onChange = vi.fn()
    render(<StepHeader view="build" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /summary/i }))
    expect(onChange).toHaveBeenCalledWith('summary')
  })
})
