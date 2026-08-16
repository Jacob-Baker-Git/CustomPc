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
})
