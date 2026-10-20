import { render, screen, fireEvent, act } from '@testing-library/react'
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

  // Spec 2026-10-20: score | 3D | spec stack, with the build table full width
  // below — so the table is no longer inside the score column.
  it('lays Summary out as three columns over a full-width build table', () => {
    const { container } = openOn('summary')
    expect(screen.getByRole('region', { name: 'Spec' })).toBeInTheDocument()
    expect(screen.getByText('Peak power')).toBeInTheDocument()
    const grid = container.querySelector('.build-grid')
    for (const area of ['area-left', 'area-viz', 'area-spec', 'area-parts', 'area-banner', 'area-warnings']) {
      expect(grid.querySelector(`:scope > .${area}`), area).not.toBeNull()
    }
    expect(grid.querySelector('.area-left .area-parts')).toBeNull()
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

describe('number keys switch the step tabs', () => {
  const press = (key, init = {}) => act(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init }) })

  it('on the parts path, 1-4 are Build, Performance, Peripherals, Summary', () => {
    openOn('build')
    press('2'); expect(window.location.hash).toBe('#performance')
    press('4'); expect(window.location.hash).toBe('#summary')
    press('1'); expect(window.location.hash).toBe('#build')
  })

  it('on the game path, the keys number the two steps shown', () => {
    useBuilderStore.setState({ path: 'game' })
    openOn('summary')
    press('1'); expect(window.location.hash).toBe('#peripherals')
    press('3'); expect(window.location.hash).toBe('#peripherals')
  })

  it('typing a number into a field does not switch tabs', () => {
    openOn('build')
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    press('2')
    expect(window.location.hash).toBe('#build')
    input.remove()
  })

  it('a key with a modifier held does nothing', () => {
    openOn('build')
    press('2', { ctrlKey: true })
    expect(window.location.hash).toBe('#build')
  })
})

describe('number keys and text composition', () => {
  it('a key pressed while composing text (IME) does not switch tabs', () => {
    openOn('build')
    act(() => { fireEvent.keyDown(document.body, { key: '2', isComposing: true }) })
    expect(window.location.hash).toBe('#build')
  })
})
