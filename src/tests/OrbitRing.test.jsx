import { render, fireEvent } from '@testing-library/react'
import OrbitRing from '../components/OrbitRing'

const parts = {
  gpu: { id: 'gpu-x', category: 'gpu', name: 'Test GPU', price: 500 },
  cpu: { id: 'cpu-x', category: 'cpu', name: 'Test CPU', price: 300 },
}

const noop = () => {}

describe('OrbitRing connector lines', () => {
  it('hides every connector line by default', () => {
    const { container } = render(
      <OrbitRing selectedParts={parts} onSelectCategory={noop} onDeselect={noop} />
    )
    const lines = container.querySelectorAll('line[data-cat]')
    expect(lines.length).toBeGreaterThan(0)
    lines.forEach((ln) => {
      expect(ln.getAttribute('class') || '').toContain('opacity-0')
    })
  })

  it('reveals only the hovered pill\'s line on mouse enter', () => {
    const { container } = render(
      <OrbitRing selectedParts={parts} onSelectCategory={noop} onDeselect={noop} />
    )
    fireEvent.mouseEnter(container.querySelector('[data-pill="gpu"]'))
    expect(container.querySelector('line[data-cat="gpu"]').getAttribute('class')).toContain('opacity-100')
    expect(container.querySelector('line[data-cat="cpu"]').getAttribute('class')).toContain('opacity-0')
  })
})
