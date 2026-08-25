import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import SavedBuilds from '../components/SavedBuilds'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import { encodeBuild } from '../lib/buildCodec'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const cpu2 = partsData.find((p) => p.id === 'cpu-ryzen-7-9800x3d')
const gpu = partsData.find((p) => p.category === 'gpu' && p.name.includes('RTX 4060') && !p.name.includes('Ti'))
const gpu2 = partsData.find((p) => p.category === 'gpu' && p.name.includes('RTX 5080'))

beforeEach(() => {
  useSavedStore.setState({ saved: [] })
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('SavedBuilds', () => {
  it('shows an empty state with no saves', () => {
    render(<SavedBuilds />)
    expect(screen.getByText(/no saved builds yet/i)).toBeInTheDocument()
  })
  it('lists a save and loads it into the workspace', () => {
    const code = encodeBuild({ budget: 1200, resolution: '1440p', parts: { cpu }, peripherals: {} })
    useSavedStore.getState().saveBuild('My Rig', code)
    render(<SavedBuilds />)
    expect(screen.getByText('My Rig')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^load$/i }))
    expect(useBuilderStore.getState().selectedParts.cpu?.id).toBe('cpu-ryzen-7-7700x')
    expect(useBuilderStore.getState().budget).toBe(1200)
  })
  it('asks for confirmation before deleting, then deletes on confirm', () => {
    useSavedStore.getState().saveBuild('Trash', 'ABC')
    render(<SavedBuilds />)
    fireEvent.click(screen.getByRole('button', { name: /delete trash/i }))

    // Nothing is deleted yet — a confirmation dialog appears first.
    expect(useSavedStore.getState().saved).toHaveLength(1)
    const dialog = screen.getByRole('dialog', { name: /delete saved build/i })
    expect(dialog).toHaveTextContent('Trash')

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(useSavedStore.getState().saved).toHaveLength(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the build when deletion is cancelled', () => {
    useSavedStore.getState().saveBuild('Keeper', 'ABC')
    render(<SavedBuilds />)
    fireEvent.click(screen.getByRole('button', { name: /delete keeper/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(useSavedStore.getState().saved).toHaveLength(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('compares two ticked builds side by side', () => {
    const codeA = encodeBuild({ budget: 1000, resolution: '1440p', parts: { cpu, gpu }, peripherals: {} })
    const codeB = encodeBuild({ budget: 2500, resolution: '4k', parts: { cpu: cpu2, gpu: gpu2 }, peripherals: {} })
    useSavedStore.getState().saveBuild('Budget rig', codeA)
    useSavedStore.getState().saveBuild('Dream rig', codeB)
    render(<SavedBuilds />)

    fireEvent.click(screen.getByRole('checkbox', { name: /compare budget rig/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /compare dream rig/i }))

    const table = screen.getByRole('table')
    expect(table).toHaveTextContent('Budget rig')
    expect(table).toHaveTextContent('Dream rig')
    expect(table).toHaveTextContent(cpu.name)
    expect(table).toHaveTextContent(cpu2.name)
    expect(table).toHaveTextContent(/est\. fps/i)
  })

  it('limits comparison to two builds', () => {
    const code = encodeBuild({ budget: 1000, resolution: '1440p', parts: { cpu, gpu }, peripherals: {} })
    useSavedStore.getState().saveBuild('One', code)
    useSavedStore.getState().saveBuild('Two', code)
    useSavedStore.getState().saveBuild('Three', code)
    render(<SavedBuilds />)
    fireEvent.click(screen.getByRole('checkbox', { name: /compare one/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /compare two/i }))
    expect(screen.getByRole('checkbox', { name: /compare three/i })).toBeDisabled()
  })
})

// Task 5 of the RAM-box plan. The comparison table is this screen's expansion,
// so it is what lifts the stick out of its socket.
describe('as a RAM stick', () => {
  it('reads empty with nothing saved', () => {
    const { container } = render(<SavedBuilds />)
    const box = container.querySelector('[data-ram-box]')
    expect(box).not.toBeNull()
    expect(box).toHaveAttribute('data-seated', 'false')
    expect(container.querySelector('[data-designator]')).toBeNull()
  })

  it('seats once a build is saved', () => {
    useSavedStore.setState({ saved: [{ id: 'a', name: 'One', code: encodeBuild({ parts: { cpu } }), savedAt: 1 }] })
    const { container } = render(<SavedBuilds />)
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-seated', 'true')
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-open', 'false')
  })

  it('unseats while two builds are being compared', () => {
    useSavedStore.setState({ saved: [
      { id: 'a', name: 'One', code: encodeBuild({ parts: { cpu, gpu } }), savedAt: 1 },
      { id: 'b', name: 'Two', code: encodeBuild({ parts: { cpu: cpu2, gpu: gpu2 } }), savedAt: 2 },
    ] })
    const { container } = render(<SavedBuilds />)
    const ticks = screen.getAllByRole('checkbox')
    fireEvent.click(ticks[0])
    fireEvent.click(ticks[1])

    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-open', 'true')
    expect(container.querySelector('[data-socket]')).not.toBeNull()
    expect(container.querySelector('[data-contacts]')).toHaveAttribute('data-contacts', 'cold')
  })
})
