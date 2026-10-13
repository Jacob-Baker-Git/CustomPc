import { render, screen, fireEvent } from '@testing-library/react'
import App from '../App'
import useBuilderStore from '../store/useBuilderStore'

// Keep three.js out of the routing test — only the branch choice matters.
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

describe('App routing', () => {
  // An unknown path used to render the hub, so a typo or a dead link looked
  // like the home page with no sign anything was wrong.
  it('says a page was not found instead of showing the hub', () => {
    window.history.replaceState(null, '', '/no-such-page')
    render(<App />)
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /build for a game/i })).toBeNull()
    expect(document.title).toMatch(/not found/i)
    window.history.replaceState(null, '', '/')
  })

  it('shows the hub by default', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /build for a game/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /saved builds/i })).toBeInTheDocument()
  })

  it('routes to Build for a game', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /build for a game/i }))
    expect(await screen.findByRole('heading', { name: /build for a game/i })).toBeInTheDocument()
  })

  it('routes "What will my build get?" to the Build tab on the parts path', () => {
    // A budget left by Build-for-a-game (or the old wizard) would hide and lock
    // parts on a path that has no budget at all — final review, Important #3.
    useBuilderStore.setState({ path: 'game', budget: 1000 })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /what will my build get/i }))
    expect(useBuilderStore.getState().flow).toBe('builder')
    expect(useBuilderStore.getState().path).toBe('parts')
    expect(useBuilderStore.getState().budget).toBe(0)
    expect(window.location.hash).toBe('#build')
  })

  it('routes to saved builds', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /saved builds/i }))
    expect(screen.getByRole('heading', { name: /saved builds/i })).toBeInTheDocument()
  })

  // Routing is driven by `flow` alone now. It used to be `budget > 0`, which
  // meant a returning visitor with a persisted budget could never reach the hub.
  it('shows the builder when flow says so, whatever the budget', () => {
    useBuilderStore.setState({ flow: 'builder', budget: 0 })
    render(<App />)
    // Two sets of tabs render: the header row and the mobile bottom bar. Only
    // one is visible at a time, but jsdom applies no CSS so both are present.
    expect(screen.getAllByRole('button', { name: /^peripherals$/i })).toHaveLength(2)
  })

  it('stays on the hub when a budget is set but flow is hub', () => {
    useBuilderStore.setState({ flow: 'hub', budget: 1500 })
    render(<App />)
    expect(screen.getByRole('button', { name: /build for a game/i })).toBeInTheDocument()
  })
})
