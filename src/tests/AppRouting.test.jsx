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
    budget: 0, flow: 'menu', selectedParts: {}, selectedPeripherals: {}, resolution: '1440p',
  })
})

describe('App routing', () => {
  it('shows the main menu when there is no build in progress', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /build a new pc/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade your pc/i })).toBeInTheDocument()
  })
  it('routes to the new-build wizard', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /build a new pc/i }))
    expect(screen.getByText(/what's your budget/i)).toBeInTheDocument()
  })
  it('routes to the upgrade wizard', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /upgrade your pc/i }))
    expect(screen.getByRole('heading', { name: /upgrade your pc/i })).toBeInTheDocument()
  })
  it('shows the builder once a budget is set', () => {
    useBuilderStore.setState({ budget: 1500 })
    render(<App />)
    expect(screen.getByRole('button', { name: /^peripherals$/i })).toBeInTheDocument()
  })
})
