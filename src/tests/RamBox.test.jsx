import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RamBox from '../components/RamBox'
import { BODY_LIP_END, CONTENT_TOP, CONTENT_TOP_DESIGNATOR } from '../lib/ramBoxGeometry'

const blades = (c) => c.querySelectorAll('[data-blade]')

// The Tailwind spacing scale, for the two steps this component uses. jsdom
// computes no layout and resolves no utility classes, so the only way a unit
// test can check "content starts below the lip" is to decode the class itself.
const PT_PX = { 'pt-5': 20, 'pt-8': 32 }

const contentPadding = (c) => {
  const el = [...c.querySelectorAll('div')].find((d) => /(^|\s)pt-\d/.test(d.className))
  const cls = el.className.split(/\s+/).find((x) => x.startsWith('pt-'))
  return { cls, px: PT_PX[cls] }
}

describe('RamBox', () => {
  it('renders its children', () => {
    render(<RamBox designator="DIMM_A2">Ryzen 7 9800X3D</RamBox>)
    expect(screen.getByText('Ryzen 7 9800X3D')).toBeInTheDocument()
  })

  it('shows the reference designator', () => {
    render(<RamBox designator="PCIEX16_1">x</RamBox>)
    expect(screen.getByText('PCIEX16_1')).toBeInTheDocument()
  })

  it('draws all five blades regardless of size', () => {
    const { container } = render(<RamBox designator="M2_1">x</RamBox>)
    expect(blades(container)).toHaveLength(5)
  })

  it('omits the designator label when none is supplied, but still draws as a RamBox', () => {
    const { container } = render(<RamBox>x</RamBox>)
    expect(container.querySelector('.font-mono')).toBeNull()
    expect(blades(container)).toHaveLength(5)
  })

  it('marks itself seated and lights the contacts', () => {
    const { container } = render(<RamBox designator="CPU_1" seated>x</RamBox>)
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-seated', 'true')
    expect(container.querySelector('[data-contacts]')).toHaveAttribute('data-contacts', 'live')
  })

  it('leaves the contacts cold when nothing is seated', () => {
    const { container } = render(<RamBox designator="CPU_1">x</RamBox>)
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-seated', 'false')
    expect(container.querySelector('[data-contacts]')).toHaveAttribute('data-contacts', 'cold')
  })

  it('shows no socket while closed', () => {
    const { container } = render(<RamBox designator="CPU_1" seated>x</RamBox>)
    expect(container.querySelector('[data-socket]')).toBeNull()
  })

  // The class-level half of tokenOpacity.test.js, asserted at the one
  // component most likely to reach for a translucent metal.
  it('carries no opacity modifier on a palette token', () => {
    const { container } = render(<RamBox designator="CPU_1" seated>x</RamBox>)
    const classes = [...container.querySelectorAll('*')]
      .flatMap((el) => (typeof el.className === 'string' ? el.className.split(/\s+/) : []))
    expect(classes.filter((c) => /-(gold|brass|surface|ground|line|ink|tech)(-\w+)?\/\d/.test(c))).toEqual([])
  })

  it('lifts clear of its socket when open', () => {
    const { container } = render(<RamBox designator="DIMM_A2" seated open>x</RamBox>)
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-open', 'true')
    expect(container.querySelector('[data-socket]')).not.toBeNull()
  })

  it('breaks the connection when it unseats', () => {
    // Gold does two jobs in this system: seated, and attended-to. Opening puts
    // them in conflict — the open box is at once the most active and the least
    // seated thing on screen. The split: the bar keeps ATTENTION, the contacts
    // lose CONNECTION.
    const { container } = render(<RamBox designator="DIMM_A2" seated open>x</RamBox>)
    expect(container.querySelector('[data-contacts]')).toHaveAttribute('data-contacts', 'cold')
    expect(container.querySelector('[data-bar]')).toHaveAttribute('data-bar', 'lit')
  })

  it('keeps the bar lit open or shut, so long as a part is seated', () => {
    const shut = render(<RamBox designator="DIMM_A2" seated>x</RamBox>)
    expect(shut.container.querySelector('[data-bar]')).toHaveAttribute('data-bar', 'lit')
  })

  it('leaves the bar dead on an empty slot even when open', () => {
    const { container } = render(<RamBox designator="DIMM_A2" open>x</RamBox>)
    expect(container.querySelector('[data-bar]')).toHaveAttribute('data-bar', 'dead')
  })

  it('rocks both retention clips outward when open', () => {
    const { container } = render(<RamBox designator="DIMM_A2" seated open>x</RamBox>)
    const left = container.querySelector('[data-clip="left"]')
    const right = container.querySelector('[data-clip="right"]')
    expect(left.style.transform).toContain('-26deg')
    expect(right.style.transform).toContain('26deg')
  })

  // ---- The solid face -----------------------------------------------------
  //
  // Two complaints, one cause. The face used to carry a brushed GRAIN — a
  // repeating-linear-gradient laying a hairline every 3px over the whole body —
  // which at real size made the box read as something drawn out of stripes
  // rather than a solid part. The gold contact fingers below are a separate
  // element and keep their lines, because there the lines are the subject.

  it('paints the face with no repeating line texture', () => {
    const { container } = render(<RamBox designator="DIMM_A2" seated>x</RamBox>)
    const faces = [...container.querySelectorAll('[style*="repeating-linear-gradient"]')]
      .filter((el) => !el.closest('[data-contacts]'))
    expect(faces).toEqual([])
  })

  it('keeps the fine line texture on the contact fingers', () => {
    const { container } = render(<RamBox designator="DIMM_A2" seated>x</RamBox>)
    const fingers = container.querySelectorAll('[data-contacts] [style*="repeating-linear-gradient"]')
    expect(fingers.length).toBeGreaterThan(0)
  })

  // Pins the class-to-pixel mapping the straddle guard in ramBoxGeometry.test.js
  // reasons about. That test compares BODY_LIP_END with CONTENT_TOP; this one
  // is what makes CONTENT_TOP a description of the markup rather than a wish.
  it('starts content below the heatspreader lip in both padding modes', () => {
    const plain = render(<RamBox>x</RamBox>)
    expect(contentPadding(plain.container)).toEqual({ cls: 'pt-5', px: CONTENT_TOP })

    const labelled = render(<RamBox designator="DIMM_A2">x</RamBox>)
    expect(contentPadding(labelled.container)).toEqual({ cls: 'pt-8', px: CONTENT_TOP_DESIGNATOR })

    expect(CONTENT_TOP).toBeGreaterThan(BODY_LIP_END)
  })

  it('holds both clips upright while shut', () => {
    const { container } = render(<RamBox designator="DIMM_A2" seated>x</RamBox>)
    for (const clip of container.querySelectorAll('[data-clip]')) {
      expect(clip.style.transform).toBe('rotate(0deg)')
    }
  })
})
