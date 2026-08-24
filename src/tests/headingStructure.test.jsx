import { render, screen } from '@testing-library/react'
import App from '../App'
import useBuilderStore from '../store/useBuilderStore'

// A screen reader's outline of a page IS its headings, so a screen whose first
// heading is an h2 has no top level — the reader lands inside a subsection of
// nothing. Every screen here had an h1 except the builder, which is the one
// people spend all their time on: the hub, the setup flow, saved builds and all
// six content pages were fine, and the app's main view was not.
//
// Cheap to check and easy to lose, because an h1 that is `sr-only` looks like
// dead markup to anyone tidying up.
vi.mock('../components/BuildCanvas', () => ({ default: () => <div data-testid="canvas" /> }))
vi.mock('../store/useCatalogStore', async () => {
  const actual = await vi.importActual('../store/useCatalogStore')
  return { ...actual, loadCatalog: vi.fn() }
})

beforeEach(() => {
  window.location.hash = ''
  useBuilderStore.setState({
    budget: 0, flow: 'hub', selectedParts: {}, selectedPeripherals: {}, resolution: '1440p',
  })
})

const FLOWS = ['hub', 'setup', 'saved', 'builder']

describe('heading structure', () => {
  for (const flow of FLOWS) {
    it(`gives the ${flow} screen exactly one h1, above its h2s`, () => {
      useBuilderStore.setState({ flow })
      render(<App />)

      const h1s = screen.queryAllByRole('heading', { level: 1 })
      expect(h1s.map((h) => h.textContent), `${flow} should have exactly one h1`).toHaveLength(1)

      // Document order, not just presence: an h1 after the h2s it is meant to
      // parent gives the same broken outline as no h1 at all.
      const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      const levels = headings.map((h) => Number(h.tagName[1]))
      expect(levels[0], `${flow}'s first heading is h${levels[0]}`).toBe(1)
    })
  }
})
