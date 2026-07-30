import { render, screen } from '@testing-library/react'
import DynamicBars from '../components/DynamicBars'

describe('DynamicBars', () => {
  it('shows value over max when a max is set', () => {
    render(<DynamicBars value={620} max={750} label="Power" unit="W" />)
    expect(screen.getByText('620W / 750W')).toBeInTheDocument()
  })

  it('shows consumption only when there is no max yet (e.g. no PSU)', () => {
    render(<DynamicBars value={0} max={null} label="Power" unit="W" />)
    expect(screen.getByText('0W')).toBeInTheDocument()
    expect(screen.queryByText(/\//)).toBeNull()
  })

  it('renders the full-size meter as a bordered chip', () => {
    const { container } = render(<DynamicBars value={620} max={750} label="Power" unit="W" />)
    expect(container.firstChild).toHaveClass('border')
    expect(container.firstChild).toHaveClass('bg-surface-2')
  })

  // The phone row fits two of these at 375px only because compact drops the
  // chrome — keep it frameless.
  it('keeps the compact meter frameless', () => {
    const { container } = render(<DynamicBars value={620} max={750} label="Power" unit="W" compact />)
    expect(container.firstChild).not.toHaveClass('border')
  })

  it('colours the fill by how close to the limit it is', () => {
    const { container: warn } = render(<DynamicBars value={700} max={750} label="Power" unit="W" />)
    expect(warn.querySelector('.bg-ok')).toBeTruthy()
    const { container: over } = render(<DynamicBars value={800} max={750} label="Power" unit="W" />)
    expect(over.querySelector('.bg-bad')).toBeTruthy()
  })
})
