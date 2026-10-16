import { render, fireEvent } from '@testing-library/react'
import { afterEach } from 'vitest'
import Fold from '../components/ui/Fold'

const original = window.matchMedia
afterEach(() => { window.matchMedia = original })

const mount = () => render(
  <Fold title="Power and cooling" summary="132 W gaming · supply has 58% spare">body</Fold>,
)

describe('Fold', () => {
  it('starts closed on a phone', () => {
    window.matchMedia = undefined
    const { container } = mount()
    expect(container.querySelector('details')).not.toHaveAttribute('open')
  })

  it('starts open on desktop', () => {
    window.matchMedia = () => ({ matches: true })
    const { container } = mount()
    expect(container.querySelector('details')).toHaveAttribute('open')
  })

  it('shows the key numbers while closed', () => {
    window.matchMedia = undefined
    const { container } = mount()
    expect(container.querySelector('summary').textContent).toContain('132 W gaming')
  })

  it("keeps the user's choice across re-renders", () => {
    window.matchMedia = undefined
    const { container, rerender } = mount()
    const details = container.querySelector('details')
    details.open = true
    fireEvent(details, new Event('toggle'))
    rerender(<Fold title="Power and cooling" summary="132 W gaming · supply has 58% spare">body</Fold>)
    expect(container.querySelector('details')).toHaveAttribute('open')
  })

  it('pins its header while open', () => {
    const { container } = mount()
    expect(container.querySelector('summary').className).toMatch(/\bsticky\b/)
    expect(container.querySelector('summary').className).toMatch(/\btop-0\b/)
  })
})
