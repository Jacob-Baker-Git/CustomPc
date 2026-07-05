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
  it('deletes a save', () => {
    useSavedStore.getState().saveBuild('Trash', 'ABC')
    render(<SavedBuilds />)
    fireEvent.click(screen.getByRole('button', { name: /delete trash/i }))
    expect(useSavedStore.getState().saved).toHaveLength(0)
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
