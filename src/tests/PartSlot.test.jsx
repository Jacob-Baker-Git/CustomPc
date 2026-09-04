import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

  it('keeps a phone from crushing the part name: pad hidden, name wraps', () => {
    // At 375px the row is a full-width list item, and the flex button's fixed
    // children (thumbnail, socket pad, price) left the flex-1 name just 55px —
    // "Intel Core i7-14700KF" (needs 137) rendered as "Inte…". The pad is
    // aria-hidden decoration whose meaning the rail already carries, so it is
    // hidden below `sm` (freeing ~60px) and the name wraps to two lines there
    // instead of truncating; from `sm` up both revert. jsdom computes no
    // layout, so this pins the responsive classes that produce that behaviour —
    // the widths themselves were verified in a browser.
    const { container } = render(
      <PartSlot category="ram" label="RAM" part={{ name: 'TeamGroup T-Force Vulcan DDR4-3600 32GB' }} />,
    )
    const pad = container.querySelector('span[aria-hidden="true"].w-12')
    expect(pad).not.toBeNull()
    expect(pad.className).toMatch(/(?:^|\s)hidden(?:\s|$)/)
    expect(pad.className).toMatch(/sm:block/)

    const name = within(container).getByText('TeamGroup T-Force Vulcan DDR4-3600 32GB')
    expect(name.className).toMatch(/line-clamp-2/) // wraps on a phone
    expect(name.className).toMatch(/sm:truncate/) // one line on desktop
  })

  it('falls back to the category when a connector is unknown', () => {
    // Not every category plugs into a named connector — a case does not.
    render(<PartSlot category="case" />)
    expect(screen.queryByText('undefined')).toBeNull()
  })
})
