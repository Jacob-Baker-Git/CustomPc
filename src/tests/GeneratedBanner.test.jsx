import { render, screen, fireEvent } from '@testing-library/react'
import GeneratedBanner from '../components/GeneratedBanner'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  localStorage.clear()
  useBuilderStore.setState({ lastGenerated: { shared: true, savedPrevious: true } })
})

describe('GeneratedBanner', () => {
  it('renders nothing when no build was generated', () => {
    useBuilderStore.setState({ lastGenerated: null })
    const { container } = render(<GeneratedBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  // The setup wizard that set the other kinds is gone (spec 2026-10-13); a
  // stale one must not render a half-filled sentence.
  it('renders nothing for anything but a shared link', () => {
    useBuilderStore.setState({ lastGenerated: { useCase: 'gaming', spend: 0, budget: 1600 } })
    const { container } = render(<GeneratedBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says a shared build was opened and where the previous one went', () => {
    render(<GeneratedBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/opened a shared build/i)
    expect(screen.getByRole('status')).toHaveTextContent(/previous build is in saved builds/i)
  })

  it('can be dismissed', () => {
    render(<GeneratedBanner />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(useBuilderStore.getState().lastGenerated).toBeNull()
  })
})
