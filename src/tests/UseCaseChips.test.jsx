import { render, screen, fireEvent } from '@testing-library/react'
import UseCaseChips from '../components/UseCaseChips'
import useBuilderStore from '../store/useBuilderStore'
import { USE_CASES } from '../lib/buildProfiles'

beforeEach(() => {
  useBuilderStore.setState({ useCase: 'gaming' })
})

describe('UseCaseChips', () => {
  it('offers every use case and marks the current one', () => {
    render(<UseCaseChips />)
    expect(screen.getAllByRole('radio')).toHaveLength(USE_CASES.length)
    expect(screen.getByRole('radio', { name: 'Gaming' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Programming' })).toHaveAttribute('aria-checked', 'false')
  })

  it('picking one sets the use case the score and Auto-build both read', () => {
    render(<UseCaseChips />)
    fireEvent.click(screen.getByRole('radio', { name: 'Everyday & Office' }))
    expect(useBuilderStore.getState().useCase).toBe('office')
    expect(screen.getByRole('radio', { name: 'Everyday & Office' })).toHaveAttribute('aria-checked', 'true')
  })

  it('animates only the selected chip, so the beat fires on change', () => {
    render(<UseCaseChips />)
    const on = screen.getByRole('radio', { name: 'Gaming' })
    const off = screen.getByRole('radio', { name: 'Streaming' })
    expect(on.className).toContain('chip-pick')
    expect(off.className).not.toContain('chip-pick')
  })
})
