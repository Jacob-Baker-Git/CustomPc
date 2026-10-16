import { render, screen } from '@testing-library/react'
import BuilderScreen from '../screens/BuilderScreen'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

// Keep three.js out: only WHERE the 3D view mounts matters here.
vi.mock('../components/BuildCanvas', () => ({ default: () => <div data-testid="canvas" /> }))

const part = (id) => partsData.find((p) => p.id === id)

const openOn = (view) => {
  window.history.replaceState({ flow: 'builder' }, '', `/#${view}`)
  return render(<BuilderScreen />)
}

beforeEach(() => {
  useBuilderStore.setState({
    flow: 'builder', path: 'parts', budget: 1500, useCase: 'gaming', resolution: '1440p',
    selectedParts: { cpu: part('cpu-ryzen-5-7600x'), gpu: part('gpu-rtx-5070') }, selectedPeripherals: {},
  })
})

describe('the 3D view lives on Summary only (spec 2026-10-13)', () => {
  it('mounts on Summary, with the score beside it', async () => {
    openOn('summary')
    expect(await screen.findByTestId('canvas')).toBeInTheDocument()
    expect(screen.getAllByText('/100').length).toBeGreaterThan(0)
  })

  it.each(['build', 'peripherals'])('does not mount on %s', (view) => {
    openOn(view)
    expect(screen.queryByTestId('canvas')).toBeNull()
  })

  it('leaves the Build tab to the parts and their checks, with no auto-build', () => {
    openOn('build')
    expect(screen.getByRole('heading', { name: /your parts/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /auto-build/i })).toBeNull()
    expect(screen.queryByText('/100')).toBeNull()
  })

  it('shows the score once on Summary', () => {
    openOn('summary')
    expect(screen.getAllByText('/100')).toHaveLength(1)
  })

  it('offers the next step of the path', () => {
    openOn('build')
    // The phone dock and the desktop inline button both render; CSS shows one.
    expect(screen.getAllByRole('button', { name: /next: performance/i }).length).toBeGreaterThan(0)
  })
})
