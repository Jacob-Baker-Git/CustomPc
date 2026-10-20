import { gbp } from '../lib/money'
import { render, screen } from '@testing-library/react'
import SpecStack from '../components/showroom/SpecStack'
import useBuilderStore from '../store/useBuilderStore'
import { estimatePower, estimateThermals } from '../lib/perfEngine/power'
import partsData from '../data/partsData.json'

const first = (cat) => partsData.find((p) => p.category === cat && !p.legacy && p.price > 0)
const build = Object.fromEntries(['cpu', 'gpu', 'motherboard', 'ram', 'psu', 'cooler'].map((c) => [c, first(c)]))

// The figure printed under a label.
const valueOf = (label) => screen.getByText(label).nextElementSibling.textContent

describe('SpecStack', () => {
  it('shows price vs budget, power, PSU, headroom and cooling for the build', () => {
    useBuilderStore.setState({ budget: 1500, selectedParts: build })
    render(<SpecStack layout="column" />)
    const power = estimatePower(build)
    const thermals = estimateThermals(build)
    const total = Object.values(build).reduce((s, p) => s + p.price, 0)
    const signed = (n) => `${n > 0 ? '+' : ''}${n}%`

    expect(valueOf('Price')).toBe(`${gbp(total)} / £1,500`)
    expect(valueOf('Peak power')).toBe(`${power.peakW} W`)
    expect(valueOf('PSU')).toBe(`${build.psu.wattage} W`)
    expect(valueOf('PSU headroom')).toBe(signed(power.psuHeadroomPct))
    expect(thermals.headroomPct).not.toBeNull()
    expect(valueOf('Cooling margin')).toBe(signed(thermals.headroomPct))
  })

  it('shows a dash for figures that need a part not yet picked', () => {
    const noPsu = { ...build }
    delete noPsu.psu
    delete noPsu.cooler
    useBuilderStore.setState({ budget: 0, selectedParts: noPsu })
    render(<SpecStack layout="grid" />)
    expect(valueOf('PSU')).toBe('—')
    expect(valueOf('PSU headroom')).toBe('—')
    expect(valueOf('Cooling margin')).toBe('—')
    // No budget set: just the total.
    expect(valueOf('Price')).not.toMatch('/')
  })
})
