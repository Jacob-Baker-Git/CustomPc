import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ErrorBoundary from '../components/ErrorBoundary'
import { BUILDER_STORAGE_KEY } from '../lib/storageKey'

function Boom() {
  throw new Error('kaboom in a component')
}

// React logs caught errors to console.error; silence it so the run stays readable.
let spy
beforeEach(() => { spy = vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { spy.mockRestore(); localStorage.clear() })

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(<ErrorBoundary><p>all good</p></ErrorBoundary>)
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('shows the crash page when a child throws', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
  })

  it('offers reload, back to menu, and reset', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to the menu/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset the app/i })).toBeInTheDocument()
  })

  // Corrupt persisted state is the likeliest crash that survives a reload, so a
  // plain reload would loop. Reset is the escape hatch — behind a confirm,
  // because it destroys the user's build.
  it('reset asks for confirmation before clearing the saved build', () => {
    localStorage.setItem(BUILDER_STORAGE_KEY, '{"state":{"budget":1500},"version":2}')
    render(<ErrorBoundary><Boom /></ErrorBoundary>)

    fireEvent.click(screen.getByRole('button', { name: /reset the app/i }))
    expect(localStorage.getItem(BUILDER_STORAGE_KEY)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /yes, erase my build/i }))
    expect(localStorage.getItem(BUILDER_STORAGE_KEY)).toBeNull()
  })

  it('back to menu rewrites flow to hub and keeps the build', () => {
    localStorage.setItem(
      BUILDER_STORAGE_KEY,
      JSON.stringify({ state: { budget: 1500, flow: 'builder', selectedParts: { cpu: { id: 'x' } } }, version: 2 })
    )
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: /back to the menu/i }))

    const saved = JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY))
    expect(saved.state.flow).toBe('hub')
    expect(saved.state.selectedParts.cpu).toBeDefined()
    expect(saved.state.budget).toBe(1500)
  })

  it('surfaces the error message for a bug report', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: /technical detail/i }))
    expect(screen.getByText(/kaboom in a component/)).toBeInTheDocument()
  })
})
