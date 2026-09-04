import { render } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import PartsBrowser from '../components/PartsBrowser'
import useCatalogStore from '../store/useCatalogStore'

// The parts browser lists the whole catalogue — ~560 rows, each with an inline
// SVG thumbnail, ~15,600 DOM nodes and roughly 10x Lighthouse's node threshold.
// That is a scroll-cost problem on a low-end phone. content-visibility lets the
// browser skip layout and paint for off-screen rows while leaving them in the
// DOM, so the crawlable markup and the prerendered fragment are unchanged (a
// virtualiser would have removed them). jsdom computes no layout and cannot see
// the skip itself, so this pins the classes that switch it on — the behaviour
// was verified in a headless browser (a measurable reflow saving, larger on a
// device that cannot pre-render off-screen rows during idle).
beforeEach(() => {
  useCatalogStore.setState({
    parts: [
      { id: 'gpu-x', category: 'gpu', name: 'Big GPU', brand: 'NVIDIA', price: 900, perfScore: 100 },
      { id: 'cpu-y', category: 'cpu', name: 'Zen Chip', brand: 'AMD', price: 300, perfScore: 90 },
    ],
  })
})

describe('PartsBrowser render cost', () => {
  it('marks every row content-visibility:auto with a reserved intrinsic size', () => {
    const { container } = render(<PartsBrowser />)
    const rows = container.querySelectorAll('ul li')
    expect(rows.length).toBeGreaterThan(0)
    for (const li of rows) {
      expect(li.className).toMatch(/\[content-visibility:auto\]/)
      // contain-intrinsic-size reserves the skipped row's height so the
      // scrollbar does not jump; without it the page collapses off-screen.
      expect(li.className).toMatch(/\[contain-intrinsic-size:/)
    }
  })
})
