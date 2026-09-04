import { render, screen } from '@testing-library/react'
import App from '../App'
import useBuilderStore from '../store/useBuilderStore'

// A <main> landmark gives assistive tech a skip-to-content target and an entry
// in the region rotor. The content pages have had one via SiteChrome; the hub
// (MainMenu) and the builder (BuilderScreen) did not, so a screen-reader user
// arriving on either had no landmark to jump to.
//
// The fix has one edge that is easy to undo by accident: SiteFooter renders a
// <footer>, and a <footer> nested inside <main> is NOT the page's contentinfo
// landmark — it degrades to a section footer. So each screen's footer must stay
// a SIBLING of main, not a child. These tests pin both facts.

// Keep three.js out — only the landmark structure matters here.
vi.mock('../components/BuildCanvas', () => ({ default: () => <div data-testid="canvas" /> }))
// Avoid the Supabase fetch in App's mount effect.
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

describe('page landmarks', () => {
  it('the hub exposes exactly one main, with the footer outside it', () => {
    render(<App />)
    const mains = screen.getAllByRole('main')
    expect(mains).toHaveLength(1)
    const footer = document.querySelector('footer')
    expect(footer).toBeTruthy()
    // The footer's contentinfo must not be swallowed by main.
    expect(mains[0].contains(footer)).toBe(false)
  })

  it('the builder exposes exactly one main, with the footer outside it', () => {
    useBuilderStore.setState({ flow: 'builder', budget: 900 })
    render(<App />)
    const mains = screen.getAllByRole('main')
    expect(mains).toHaveLength(1)
    const footer = document.querySelector('footer')
    expect(footer).toBeTruthy()
    expect(mains[0].contains(footer)).toBe(false)
  })
})
