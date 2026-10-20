import { useEffect } from 'react'
import { render, screen, act } from '@testing-library/react'
import BuilderScreen from '../screens/BuilderScreen'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

// The labelled 3D overlay must only show once the canvas has really rendered,
// and go away again if the canvas fails. BuildCanvas is swapped per test.
const ctl = vi.hoisted(() => ({ mode: 'ready' }))
vi.mock('../components/BuildCanvas', () => {
  const Pending = () => { throw new Promise(() => {}) }
  const Broken = () => { throw new Error('webgl gone') }
  const Ready = ({ onReady }) => {
    useEffect(() => { onReady?.(true); return () => onReady?.(false) }, [onReady])
    return <div data-testid="canvas" />
  }
  return { default: (props) => ({ pending: Pending, error: Broken, ready: Ready })[ctl.mode](props) }
})

const part = (id) => partsData.find((p) => p.id === id)
const desktop = (on) => {
  window.matchMedia = on ? (q) => ({ matches: q.includes('min-width'), addEventListener() {}, removeEventListener() {} }) : undefined
}

const openSummary = async () => {
  window.history.replaceState({ flow: 'builder' }, '', '/#summary')
  render(<BuilderScreen />)
  await act(async () => {})
}

beforeEach(() => {
  useBuilderStore.setState({
    flow: 'builder', path: 'parts', budget: 1500, useCase: 'gaming', resolution: '1440p',
    selectedParts: { cpu: part('cpu-ryzen-5-7600x'), gpu: part('gpu-rtx-5070') }, selectedPeripherals: {},
  })
})
afterEach(() => desktop(false))

describe('Summary overlay waits for the canvas', () => {
  it('desktop: no labels while the canvas is still suspended', async () => {
    desktop(true); ctl.mode = 'pending'
    await openSummary()
    expect(document.querySelector('[data-label]')).toBeNull()
    expect(document.querySelector('[data-dot]')).toBeNull()
  })

  it('phone: no dots or tap strip while suspended', async () => {
    ctl.mode = 'pending'
    await openSummary()
    expect(document.querySelector('[data-dot]')).toBeNull()
    expect(document.querySelector('[data-tap-strip]')).toBeNull()
  })

  it('desktop: labels show once the canvas reports it rendered', async () => {
    desktop(true); ctl.mode = 'ready'
    await openSummary()
    expect(await screen.findByTestId('canvas')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-label]').length).toBe(2)
  })

  it('phone: tap strip shows once ready', async () => {
    ctl.mode = 'ready'
    await openSummary()
    expect(document.querySelector('[data-tap-strip]')).not.toBeNull()
  })

  it('canvas error: no overlay, no tap strip', async () => {
    ctl.mode = 'error'
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await openSummary()
    spy.mockRestore()
    expect(screen.getByText(/3D view unavailable/i)).toBeInTheDocument()
    expect(document.querySelector('[data-dot], [data-label], [data-tap-strip]')).toBeNull()
  })
})
