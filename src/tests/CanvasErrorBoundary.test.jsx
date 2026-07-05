import { render, screen, fireEvent } from '@testing-library/react'
import CanvasErrorBoundary from '../components/CanvasErrorBoundary'

function Bomb({ defused }) {
  if (!defused) throw new Error('boom')
  return <div>scene alive</div>
}

describe('CanvasErrorBoundary', () => {
  let consoleError

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => consoleError.mockRestore())

  it('renders children when nothing throws', () => {
    render(
      <CanvasErrorBoundary>
        <Bomb defused />
      </CanvasErrorBoundary>
    )
    expect(screen.getByText('scene alive')).toBeInTheDocument()
  })

  it('shows a friendly fallback with retry instead of a dead canvas', () => {
    render(
      <CanvasErrorBoundary>
        <Bomb defused={false} />
      </CanvasErrorBoundary>
    )
    expect(screen.getByText(/3d view unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('retry re-mounts the children', () => {
    let defused = false
    const { rerender } = render(
      <CanvasErrorBoundary>
        <Bomb defused={defused} />
      </CanvasErrorBoundary>
    )
    defused = true
    rerender(
      <CanvasErrorBoundary>
        <Bomb defused={defused} />
      </CanvasErrorBoundary>
    )
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(screen.getByText('scene alive')).toBeInTheDocument()
  })
})
