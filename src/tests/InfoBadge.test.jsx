import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import InfoBadge from '../components/InfoBadge'
import ScoreInfo from '../components/ScoreInfo'
import InfoDisclaimer from '../components/InfoDisclaimer'

const badge = (c) => c.querySelector('button')
const classesOf = (c) => badge(c).className.split(/\s+/)

describe('InfoBadge', () => {
  it('stays shut until asked', () => {
    render(<InfoBadge label="Why">explanation</InfoBadge>)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('opens and shuts on repeated presses', () => {
    render(<InfoBadge label="Why">explanation</InfoBadge>)
    const btn = screen.getByRole('button', { name: 'Why' })
    fireEvent.click(btn)
    expect(screen.getByRole('note')).toHaveTextContent('explanation')
    fireEvent.click(btn)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('gives the floating variant its own opaque chip and a bigger target', () => {
    const inline = render(<InfoBadge label="a">x</InfoBadge>)
    const over = render(<InfoBadge label="b" floating>x</InfoBadge>)
    expect(classesOf(inline.container)).not.toContain('bg-surface')
    expect(classesOf(over.container)).toContain('bg-surface')
    expect(classesOf(over.container)).toContain('w-7')
    expect(classesOf(inline.container)).toContain('w-5')
  })
})

// The drift guard, and the reason this component exists at all.
//
// The score badge was grey at rest; the 3D viewport badge was brass at rest.
// Two ⓘ badges on one page, the same gesture behind both, disagreeing about
// what an ⓘ looks like — which reads as one of them being more important
// rather than as an oversight. Sharing a component is what fixes it; this is
// what stops someone re-styling one caller and reopening the gap.
describe('the two ⓘ badges on the build page', () => {
  const rest = (ui) => classesOf(render(ui).container)

  it('are both quiet at rest and both light on hover', () => {
    for (const ui of [<ScoreInfo key="s" />, <InfoDisclaimer key="d" />]) {
      const c = rest(ui)
      expect(c).toContain('text-muted')
      expect(c).toContain('hover:text-brass')
      expect(c).not.toContain('text-brass')
    }
  })

  it('agree on their rest colour', () => {
    const colour = (c) => c.filter((x) => /^(text|border)-/.test(x)).sort().join(' ')
    expect(colour(rest(<ScoreInfo />))).toBe(colour(rest(<InfoDisclaimer />)))
  })
})
