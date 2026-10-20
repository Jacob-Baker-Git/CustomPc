import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ShowroomStill from '../components/showroom/ShowroomStill.jsx'

const parts = {
  cpu: { name: 'Core i5', price: 150 },
  gpu: { name: 'RX 9070', price: 500 },
  psu: { name: 'CV550', price: 50 },
}

describe('ShowroomStill', () => {
  it('shows the still lazily, labelled when not zoomed', () => {
    const { container } = render(<ShowroomStill parts={parts} hot={null} setHot={() => {}} />)
    const img = container.querySelector('img')
    expect(img.getAttribute('src')).toBe('/img/showroom-pc.webp')
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('alt')).toBeTruthy()
    expect(container.querySelectorAll('[data-label]')).toHaveLength(3)
  })

  it('zoomed: scales the picture and shows only the focus dot and its callout', () => {
    const { container, getByText } = render(
      <ShowroomStill parts={parts} hot={null} setHot={() => {}} zoom={{ id: 'gpu', scale: 2.2 }} frame="4 / 3">
        GPU callout
      </ShowroomStill>,
    )
    expect(container.querySelector('[data-still-box]').style.transform).toContain('scale(2.2)')
    expect(container.querySelectorAll('[data-label]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-focus-dot]')).toHaveLength(1)
    expect(getByText('GPU callout')).toBeTruthy()
  })

  it('zoomed: the dot lands where the anchor ends up, inside the frame', () => {
    // Cooler anchor (55.9%, 9.5%) at 2.2x in a 4:3 frame: centred across, and
    // pushed down to 2.2 x 9.5 = 20.9% so the picture still covers the top.
    const { container } = render(
      <ShowroomStill parts={{ cooler: { name: 'AIO', price: 90 } }} zoom={{ id: 'cooler', scale: 2.2 }} frame="4 / 3" />,
    )
    const dot = container.querySelector('[data-focus-dot]')
    const left = parseFloat(dot.style.left)
    const top = parseFloat(dot.style.top)
    expect(left).toBeCloseTo(50, 5)
    expect(top).toBeCloseTo(20.9, 5)
    for (const v of [left, top]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100) }
  })

  it('unzoomed card frame fits the whole case, centred', () => {
    const { container } = render(<ShowroomStill parts={parts} ids={[]} frame="4 / 3">Base</ShowroomStill>)
    const box = container.querySelector('[data-still-box]')
    expect(box.style.transform).toBe('')
    expect(box.style.height).toBe('100%')
    // 1700x2007 in a 4:3 frame: 63.5% of the width, centred.
    expect(parseFloat(box.style.width)).toBeCloseTo(63.5, 0)
    expect(parseFloat(box.style.left)).toBeCloseTo(18.2, 0)
  })
})
