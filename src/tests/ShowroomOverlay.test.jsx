import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { createRef } from 'react'
import ShowroomOverlay from '../components/showroom/ShowroomOverlay.jsx'
import ShowroomTapStrip from '../components/showroom/ShowroomTapStrip.jsx'

const parts = {
  cpu: { name: 'Ryzen 5 7600', price: 199 },
  gpu: { name: 'RTX 4060 Ti 8GB Gaming OC Edition', price: 379 },
}
const base = { parts, hot: null, setHot: () => {}, compact: false }

describe('ShowroomOverlay', () => {
  it('renders only picked parts', () => {
    const { container } = render(<ShowroomOverlay {...base} />)
    expect([...container.querySelectorAll('[data-label]')].map((e) => e.dataset.label).sort()).toEqual(['cpu', 'gpu'])
  })

  it('renders nothing when empty', () => {
    const { container } = render(<ShowroomOverlay {...base} parts={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('hover sets hot; name wraps', () => {
    const setHot = vi.fn()
    const { container } = render(<ShowroomOverlay {...base} setHot={setHot} />)
    fireEvent.mouseEnter(container.querySelector('[data-label=cpu]'))
    expect(setHot).toHaveBeenCalledWith('cpu')
    fireEvent.mouseLeave(container.querySelector('[data-label=cpu]'))
    expect(setHot).toHaveBeenLastCalledWith(null)
    expect(container.querySelector('[data-label=gpu] [data-name]').className).not.toMatch(/truncate/)
  })

  it('place moves and hides the dot and line', () => {
    const ref = createRef()
    const { container } = render(<ShowroomOverlay ref={ref} {...base} />)
    const dot = container.querySelector('[data-dot=cpu]')
    act(() => ref.current.place('cpu', 40, 60, true))
    expect(dot.style.left).toBe('40%')
    expect(dot.style.top).toBe('60%')
    expect(container.querySelector('[data-line=cpu]').getAttribute('points')).toContain('40,60')
    act(() => ref.current.place('cpu', 40, 60, false))
    expect(dot.style.display).toBe('none')
    expect(container.querySelector('[data-line=cpu]').style.display).toBe('none')
  })

  it('static anchors place on mount', () => {
    const { container } = render(<ShowroomOverlay {...base} anchors={{ gpu: { x: 20, y: 30 } }} />)
    expect(container.querySelector('[data-dot=gpu]').style.left).toBe('20%')
  })

  it('compact: numbered buttons and tap strip', () => {
    const setHot = vi.fn()
    render(<ShowroomOverlay {...base} compact setHot={setHot} anchors={{ cpu: { x: 1, y: 2 }, gpu: { x: 3, y: 4 } }} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getAllByRole('button')[0].className).toMatch(/h-11 w-11/)
    fireEvent.click(screen.getByRole('button', { name: 'CPU' }))
    expect(setHot).toHaveBeenCalledWith('cpu')
  })
})

describe('ShowroomTapStrip', () => {
  it('prompts, then shows the hot compact part', () => {
    const { rerender } = render(<ShowroomTapStrip parts={parts} hot={null} />)
    expect(screen.getByText('Tap a number to see the part')).toBeTruthy()
    rerender(<ShowroomTapStrip parts={parts} hot="cpu" />)
    expect(screen.getByText('Ryzen 5 7600')).toBeTruthy()
    rerender(<ShowroomTapStrip parts={{ ...parts, ram: { name: 'DDR5', price: 90 } }} hot="ram" />)
    expect(screen.getByText('Tap a number to see the part')).toBeTruthy()
  })
})
