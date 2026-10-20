import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import PartSlot from '../components/PartSlot'

describe('PartSlot', () => {
  it('says what to choose rather than leaving an empty slot blank', () => {
    render(<PartSlot category="ram" />)
    expect(screen.getByText(/choose a ram/i)).toBeInTheDocument()
  })

  it('names the seated part and drops the empty state', () => {
    render(<PartSlot category="ram" part={{ name: 'Vengeance 32GB' }} />)
    expect(screen.getByText('Vengeance 32GB')).toBeInTheDocument()
    expect(screen.queryByText(/choose a ram/i)).toBeNull()
  })

  it('draws a flagged slot differently from a merely optional one', () => {
    // These two were a single grey row once, and the missing part read as
    // "unavailable" rather than as "you still need this".
    const { container: bad } = render(<PartSlot category="gpu" tone="flagged" />)
    const { container: opt } = render(<PartSlot category="cooler" tone="optional" />)
    expect(bad.querySelector('button').className).toMatch(/border-bad/)
    expect(opt.querySelector('button').className).not.toMatch(/border-bad/)
  })

  it('shows a remove control only on a seated slot, and only when asked', () => {
    // A remove button on an empty slot has nothing to remove; one on a seated
    // slot must name what it removes, since "×" alone tells a screen reader
    // nothing.
    // Scoped with `within`, not the bound queries: render() binds to
    // document.body, so a second render in the same test still sees the first
    // one's button and the negative assertion passes for the wrong reason.
    const { container: seated } = render(
      <PartSlot category="ram" label="RAM" part={{ name: 'X' }} onRemove={() => {}} />,
    )
    expect(within(seated).getByRole('button', { name: /remove ram/i })).toBeInTheDocument()

    const { container: empty } = render(<PartSlot category="ram" label="RAM" onRemove={() => {}} />)
    expect(within(empty).queryByRole('button', { name: /remove ram/i })).toBeNull()
  })

  it('never cuts the part name short: it wraps at every width', () => {
    // A truncated name loses its meaningful tail ("i7-14700KF" → "Inte…").
    // The showroom list is one column, so the name wraps instead (spec
    // 2026-10-20). jsdom computes no layout, so this pins the classes.
    const { container } = render(
      <PartSlot category="ram" label="RAM" part={{ name: 'TeamGroup T-Force Vulcan DDR4-3600 32GB' }} />,
    )
    const name = within(container).getByText('TeamGroup T-Force Vulcan DDR4-3600 32GB')
    expect(name.className).not.toMatch(/truncate|line-clamp/)
  })

  it('on a phone the price moves under the type, beside the label', () => {
    const { container } = render(<PartSlot category="ram" label="RAM" part={{ name: 'X', price: 89.99 }} />)
    const prices = within(container).getAllByText('£90')
    const [phone, wide] = prices.map((p) => p.className.split(/\s+/))
    expect(phone).toContain('sm:hidden') // beside the type label below sm
    expect(wide).toEqual(expect.arrayContaining(['hidden', 'sm:inline'])) // its own column from sm
  })

  it('a seated row reports hover and focus so its label can light', () => {
    const onHot = vi.fn()
    const { container } = render(<PartSlot category="gpu" label="GPU" part={{ name: 'X' }} hot="gpu" onHot={onHot} />)
    const row = container.querySelector('[data-part-row="gpu"]')
    expect(row.className).toMatch(/bg-surface-2/)
    fireEvent.mouseEnter(row); expect(onHot).toHaveBeenLastCalledWith('gpu')
    fireEvent.mouseLeave(row); expect(onHot).toHaveBeenLastCalledWith(null)
    fireEvent.focus(row.querySelector('button')); expect(onHot).toHaveBeenLastCalledWith('gpu')
  })

  it('falls back to the category when a connector is unknown', () => {
    // Not every category plugs into a named connector — a case does not.
    render(<PartSlot category="case" />)
    expect(screen.queryByText('undefined')).toBeNull()
  })
})
