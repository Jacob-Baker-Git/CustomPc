import { render, screen, fireEvent } from '@testing-library/react'
import MainMenu from '../components/MainMenu'

describe('MainMenu', () => {
  it('shows both entry options', () => {
    render(<MainMenu onNew={() => {}} onUpgrade={() => {}} />)
    expect(screen.getByRole('button', { name: /build a new pc/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade your pc/i })).toBeInTheDocument()
  })
  it('calls the right handler for each option', () => {
    const onNew = vi.fn()
    const onUpgrade = vi.fn()
    render(<MainMenu onNew={onNew} onUpgrade={onUpgrade} />)
    fireEvent.click(screen.getByRole('button', { name: /build a new pc/i }))
    fireEvent.click(screen.getByRole('button', { name: /upgrade your pc/i }))
    expect(onNew).toHaveBeenCalledTimes(1)
    expect(onUpgrade).toHaveBeenCalledTimes(1)
  })
})
