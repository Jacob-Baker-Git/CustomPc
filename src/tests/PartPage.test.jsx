import { render, screen, fireEvent } from '@testing-library/react'
import PartPage from '../components/PartPage'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { partPath, pagedParts } from '../lib/partPages'
import parts from '../data/partsData.json'

const find = (id) => parts.find((p) => p.id === id)

beforeEach(() => {
  useCatalogStore.setState({ parts })
  // useBuilderStore is a persisted singleton — an earlier test's state leaks in
  // unless it is set explicitly. See BuildSummary.test.jsx for the same trap.
  useBuilderStore.setState({ selectedParts: {}, flow: 'hub' })
})

const show = (id) => render(<PartPage partId={id} />)

describe('a part page carries more than a spec table', () => {
  it('leads with the part, not the site', () => {
    show('gpu-rtx-4090')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(find('gpu-rtx-4090').name)
  })

  // The reason this page exists rather than a row in the browser. A generated
  // page with nothing but a name and a price is doorway content.
  it('says what the part works with, in real numbers', () => {
    show('cpu-ryzen-7-7700x')
    const section = screen.getByRole('heading', { name: /what it works with/i }).parentElement
    expect(section).toHaveTextContent(/AM5/)
    expect(section.textContent).toMatch(/\d+ boards/)
  })

  it('prints the specifications', () => {
    show('gpu-rtx-4090')
    expect(screen.getByRole('heading', { name: /specifications/i })).toBeInTheDocument()
  })

  it('links to parts that go with it, as crawlable anchors', () => {
    show('gpu-rtx-4090')
    const section = screen.getByRole('heading', { name: /good alongside it/i }).parentElement
    const links = section.querySelectorAll('a[href^="/parts/"]')
    expect(links.length).toBeGreaterThan(0)
    // A real href, not a click handler on a div — the internal linking is half of
    // what makes these pages worth having rather than orphans.
    for (const a of links) expect(a.getAttribute('href')).toMatch(/^\/parts\/[a-z0-9-]+$/)
  })

  it('leads back to the browser it belongs under', () => {
    show('gpu-rtx-4090')
    expect(screen.getByRole('link', { name: /parts browser/i })).toHaveAttribute('href', '/parts')
  })
})

describe('what a part page promises about price and performance', () => {
  it('calls the figure an estimate, with its date', () => {
    show('gpu-rtx-4090')
    expect(screen.getByText(/curated estimate/i)).toHaveTextContent(/July 2026/)
  })

  // FPS_CAVEAT is the legacy estimate's caveat and belongs with the legacy
  // estimate. PERF_CAVEAT is the engine's. Do not reunify them — see the
  // perf-engine notes on rendering an unmeasured number as measured.
  it('caveats the frame rates it quotes', () => {
    show('gpu-rtx-4090')
    expect(screen.getByRole('heading', { name: /frame rates/i })).toBeInTheDocument()
    expect(screen.getByText(/not measured benchmarks/i)).toBeInTheDocument()
  })

  it('quotes no frame rates for a part that has none', () => {
    show('psu-corsair-rm1000x')
    expect(screen.queryByRole('heading', { name: /frame rates/i })).toBeNull()
  })

  it('marks a discontinued part as discontinued', () => {
    const legacy = parts.find((p) => p.legacy && p.category === 'gpu')
    show(legacy.id)
    expect(screen.getAllByText(/discontinued/i).length).toBeGreaterThan(0)
  })
})

describe('building from a part page', () => {
  it('selects the part and opens the builder', () => {
    const onNavigate = vi.fn()
    render(<PartPage partId="gpu-rtx-4090" onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /build a pc with this/i }))
    expect(useBuilderStore.getState().selectedParts.gpu.id).toBe('gpu-rtx-4090')
    expect(useBuilderStore.getState().flow).toBe('builder')
    expect(onNavigate).toHaveBeenCalledWith(null)
  })
})

describe('an id that resolves to nothing', () => {
  it('says so and keeps a route out, rather than crashing', () => {
    show('gpu-does-not-exist')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/not found/i)
    expect(screen.getByRole('link', { name: /browse every part/i })).toHaveAttribute('href', '/parts')
  })

  // Thermal paste is in the catalogue but has no page — nothing to put on one.
  it('treats a part with no page as not found', () => {
    show(parts.find((p) => p.category === 'paste').id)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/not found/i)
  })
})

// A sweep rather than a handful of examples: 540 generated pages is exactly where
// one category quietly renders empty and nobody notices.
describe('every part in the catalogue renders a usable page', () => {
  // Rendering 540 React trees takes longer than the default 5s. Worth it: this is
  // the only assertion that every category actually produces a page.
  it('gives each one a heading, a price and at least one derived note', () => {
    for (const part of pagedParts(parts)) {
      const { unmount } = show(part.id)
      expect(screen.getByRole('heading', { level: 1 }), part.id).toHaveTextContent(part.name)
      // getAllByText, not getByText: a suggested partner can legitimately cost
      // exactly the same as the part itself, and two identical prices on the page
      // is not a defect.
      expect(screen.getAllByText(`£${part.price.toFixed(2)}`).length, part.id).toBeGreaterThan(0)
      expect(screen.queryByRole('heading', { name: /what it works with/i }), part.id).not.toBeNull()
      unmount()
    }
  }, 60000)

  it('never links to itself', () => {
    for (const part of pagedParts(parts)) {
      const { container, unmount } = show(part.id)
      expect(container.querySelector(`a[href="${partPath(part)}"]`), part.id).toBeNull()
      unmount()
    }
  }, 60000)
})
