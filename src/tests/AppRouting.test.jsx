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
  it('shows the hub by default', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /start a build/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /saved builds/i })).toBeInTheDocument()
  })

  it('routes to setup', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start a build/i }))
    expect(screen.getByText(/where are you starting from/i)).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /start a build/i })).toBeInTheDocument()
  })

  it('offers to carry on when a build is already in progress', () => {
    useBuilderStore.setState({ selectedParts: { cpu: { id: 'c', price: 200 } }, budget: 900 })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /carry on building/i }))
    expect(useBuilderStore.getState().flow).toBe('builder')
  })
})
