import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fold from '../components/ui/Fold'
import Dock from '../components/Dock'
import BuildSummary from '../components/BuildSummary'
import PeripheralsPanel from '../components/PeripheralsPanel'
import { useChromeHeight } from '../hooks/useChromeHeight'
import { refreshFit } from '../lib/refreshFit'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import partsData from '../data/partsData.json'
import { useRef } from 'react'

// Fixes from the final review of the configurator redesign (2026-10-16).

const cpu = partsData.find((p) => p.category === 'cpu')
const gpu = partsData.find((p) => p.category === 'gpu')

beforeEach(() => {
  useBuilderStore.setState({ path: 'parts', budget: 1600, selectedParts: {}, selectedPeripherals: {} })
  useSavedStore.setState({ saved: [] })
})

describe('a pinned fold header sits below the sticky page header', () => {
  it('pins under --chrome-h by default, not at the very top', () => {
    const { container } = render(<Fold title="T" summary="s">x</Fold>)
    expect(container.querySelector('summary').className).toContain('top-[var(--chrome-h,0px)]')
  })

  describe('useChromeHeight', () => {
    const original = globalThis.ResizeObserver
    afterEach(() => { globalThis.ResizeObserver = original })

    it('publishes the chrome height on the scroll container', () => {
      globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb } observe() { this.cb() } disconnect() {} }
      function Harness() {
        const scroller = useRef(null)
        const chrome = useRef(null)
        useChromeHeight(chrome, scroller)
        return <div ref={scroller} data-testid="scroller"><header ref={chrome} /></div>
      }
      render(<Harness />)
      expect(screen.getByTestId('scroller').style.getPropertyValue('--chrome-h')).toMatch(/^\d+px$/)
    })
  })
})

describe('Save and Share are not duplicated, and Save does not pile up copies', () => {
  it('renders no inline actions on Summary, which has its own', () => {
    useBuilderStore.setState({ selectedParts: { cpu } })
    const { container } = render(<Dock view="summary" onChange={() => {}} inline />)
    expect(container).toBeEmptyDOMElement()
  })

  it('saves the same build once however often Save is pressed', () => {
    useBuilderStore.setState({ selectedParts: { cpu } })
    render(<Dock view="summary" onChange={() => {}} />)
    const save = screen.getByRole('button', { name: /save build/i })
    fireEvent.click(save)
    fireEvent.click(save)
    fireEvent.click(save)
    expect(useSavedStore.getState().saved).toHaveLength(1)
  })
})

describe('fold titles are headings', () => {
  it('exposes the title as a heading, level 3 by default', () => {
    render(<Fold title="Power and cooling" summary="132 W">x</Fold>)
    expect(screen.getByRole('heading', { level: 3, name: 'Power and cooling' })).toBeInTheDocument()
  })

  it('takes another level when asked', () => {
    render(<Fold title="Question" level={2}>x</Fold>)
    expect(screen.getByRole('heading', { level: 2, name: 'Question' })).toBeInTheDocument()
  })
})

describe('peripheral categories pluralise properly', () => {
  it('says mice, not mouses', () => {
    render(<PeripheralsPanel />)
    expect(screen.getByRole('button', { name: /^Show all \d+ mice$/ })).toBeInTheDocument()
    expect(screen.queryByText(/mouses/)).toBeNull()
  })
})

describe('refresh-rate scale labels never collide', () => {
  it('drops a tick that would sit on top of the next one', () => {
    const fit = refreshFit(130, 100)
    expect(fit.scaleMax).toBe(144)
    expect(fit.ticks).toEqual([30, 60, 144])
    expect(fit.tickLabels).toEqual(['30 fps', '60 Hz', '144 Hz'])
  })
})

describe('dialogs escape the transformed Summary column', () => {
  it('portals the save dialog to the document body', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<div style={{ transform: 'translateZ(0)' }}><BuildSummary /></div>)
    fireEvent.click(screen.getByRole('button', { name: /^save pc$/i }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.closest('[style*="translateZ"]')).toBeNull()
  })
})

vi.mock('../components/BuildCanvas', () => ({ default: () => null }))
