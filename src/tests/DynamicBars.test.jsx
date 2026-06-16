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
})
