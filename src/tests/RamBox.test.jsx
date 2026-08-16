import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RamBox from '../components/RamBox'

const blades = (c) => c.querySelectorAll('[data-blade]')

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
    expect(classes.filter((c) => /-(gold|copper|surface|ground|line|ink|tech)(-\w+)?\/\d/.test(c))).toEqual([])
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

  it('holds both clips upright while shut', () => {
    const { container } = render(<RamBox designator="DIMM_A2" seated>x</RamBox>)
    for (const clip of container.querySelectorAll('[data-clip]')) {
      expect(clip.style.transform).toBe('rotate(0deg)')
    }
  })
})
