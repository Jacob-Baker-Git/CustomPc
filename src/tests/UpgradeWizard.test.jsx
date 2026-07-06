import { render, screen, fireEvent } from '@testing-library/react'
import UpgradeWizard from '../components/UpgradeWizard'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import useCatalogStore from '../store/useCatalogStore'
import { encodeBuild } from '../lib/buildCodec'

// Deterministic, controlled catalog: CPU-limited current rig with one CPU
// upgrade available in budget.
const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const cpuHi = { id: 'cpu-hi', category: 'cpu', name: 'CPU Hi', price: 300, perfScore: 250, tdp: 105, socket: 'AM5' }
const gpuLo = { id: 'gpu-lo', category: 'gpu', name: 'GPU Lo', price: 200, perfScore: 300, tdp: 200, length: 250 }
const game  = { id: 'fortnite', name: 'Fortnite', fpsFactor: 1, cpuFactor: 1 }

beforeEach(() => {
  window.location.hash = ''
  useCatalogStore.setState({ parts: [cpuLo, cpuHi, gpuLo], games: [game] })
  useBuilderStore.setState({ budget: 0, flow: 'upgrade', selectedParts: {}, resolution: '1440p' })
  const code = encodeBuild({ budget: 0, resolution: '1440p', parts: { cpu: cpuLo, gpu: gpuLo }, peripherals: {} })
  useSavedStore.setState({ saved: [{ id: 's1', name: 'My rig', savedAt: 1, code }] })
})

describe('UpgradeWizard flow', () => {
  it('requires a CPU and GPU before continuing', () => {
    render(<UpgradeWizard onBack={() => {}} />)
    expect(screen.getByRole('button', { name: /next: goal/i })).toBeDisabled()
  })

  it('loads a saved build as the current PC and enables continue', () => {
    render(<UpgradeWizard onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /select saved build/i }))
    fireEvent.click(screen.getByRole('button', { name: /my rig/i }))
    expect(screen.getByRole('button', { name: /next: goal/i })).not.toBeDisabled()
  })

  it('applies an upgrade: swaps the part, sets budget = current + upgrade, opens Build tab', () => {
    window.location.hash = 'summary'
    render(<UpgradeWizard onBack={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /select saved build/i }))
    fireEvent.click(screen.getByRole('button', { name: /my rig/i }))
    fireEvent.click(screen.getByRole('button', { name: /next: goal/i }))
    fireEvent.click(screen.getByRole('button', { name: /see upgrades/i }))

    // Default upgrade budget (400) covers the +200 CPU swap.
    fireEvent.click(screen.getAllByRole('button', { name: /^apply$/i })[0])

    const s = useBuilderStore.getState()
    expect(s.selectedParts.cpu.id).toBe('cpu-hi')
    expect(s.selectedParts.gpu.id).toBe('gpu-lo')
    expect(s.budget).toBe(700) // (100 + 200 current) + 400 upgrade
    expect(s.resolution).toBe('1440p')
    expect(window.location.hash).toBe('#build')
  })
})
