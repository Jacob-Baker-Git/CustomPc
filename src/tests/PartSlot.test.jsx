import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PartSlot from '../components/PartSlot'

describe('PartSlot', () => {
  it('names the connector a part plugs into, not the category', () => {
    // The designator is what teaches a beginner WHERE the part goes. It is
    // structure that encodes something true, not decoration.
    render(<PartSlot category="gpu" />)
    expect(screen.getByText('PCIEX16_1')).toBeInTheDocument()
  })

  it('says a slot is empty rather than leaving it blank', () => {
    render(<PartSlot category="ram" />)
    expect(screen.getByText(/empty/i)).toBeInTheDocument()
  })

  it('names the seated part and drops the empty state', () => {
    render(<PartSlot category="ram" part={{ name: 'Vengeance 32GB' }} />)
    expect(screen.getByText('Vengeance 32GB')).toBeInTheDocument()
    expect(screen.queryByText(/empty/i)).toBeNull()
  })

  it('rails a seated slot in gold and leaves an empty one unrailed', () => {
    const { container: seated } = render(<PartSlot category="ram" part={{ name: 'X' }} />)
    expect(seated.firstChild.className).toMatch(/shadow-\[inset/)
    const { container: empty } = render(<PartSlot category="ram" />)
    expect(empty.firstChild.className).not.toMatch(/shadow-\[inset/)
  })

  it('falls back to the category when a connector is unknown', () => {
    // Not every category plugs into a named connector — a case does not.
    render(<PartSlot category="case" />)
    expect(screen.queryByText('undefined')).toBeNull()
  })
})
