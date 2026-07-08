import { render, screen, fireEvent } from '@testing-library/react'
import UpgradeWizard from '../components/UpgradeWizard'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import useCatalogStore from '../store/useCatalogStore'
import { encodeBuild } from '../lib/buildCodec'

const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const gpuHi = { id: 'gpu-hi', category: 'gpu', name: 'GPU Hi', price: 600, perfScore: 300, tdp: 250, length: 300 }
const game  = { id: 'fortnite', name: 'Fortnite', fpsFactor: 1, cpuFactor: 1 }

function loadSavedRig() {
  fireEvent.click(screen.getByRole('button', { name: /select saved build/i }))
  fireEvent.click(screen.getByRole('button', { name: /my rig/i }))
}

beforeEach(() => {
  window.location.hash = ''
  useCatalogStore.setState({ parts: [cpuLo, gpuHi], games: [game] })
  useBuilderStore.setState({ budget: 0, flow: 'upgrade', selectedParts: {}, resolution: '1440p', useCase: 'gaming' })
  const code = encodeBuild({ budget: 0, resolution: '1440p', parts: { cpu: cpuLo, gpu: gpuHi }, peripherals: {} })
  useSavedStore.setState({ saved: [{ id: 's1', name: 'My rig', savedAt: 1, code }] })
})

describe('UpgradeWizard flow', () => {
  it('requires CPU and GPU before continuing to the use case', () => {
    render(<UpgradeWizard onBack={() => {}} />)
    expect(screen.getByRole('button', { name: /next: use case/i })).toBeDisabled()
  })

  it('highlights a saved build when selected', () => {
    render(<UpgradeWizard onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /select saved build/i }))
    const card = screen.getByRole('button', { name: /my rig/i })
    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /next: use case/i })).not.toBeDisabled()
  })

  it('opens the current rig in the Build tab for the chosen use case', () => {
    window.location.hash = 'summary'
    render(<UpgradeWizard onBack={() => {}} />)
    loadSavedRig()
    fireEvent.click(screen.getByRole('button', { name: /next: use case/i }))
    fireEvent.click(screen.getByRole('button', { name: /^gaming/i }))
    fireEvent.click(screen.getByRole('button', { name: /open in build/i }))

    const s = useBuilderStore.getState()
    expect(s.selectedParts.cpu.id).toBe('cpu-lo')
    expect(s.selectedParts.gpu.id).toBe('gpu-hi')
    expect(s.useCase).toBe('gaming')
    expect(s.budget).toBe(700) // 100 (cpu-lo) + 600 (gpu-hi)
    expect(s.resolution).toBe('1440p')
    expect(window.location.hash).toBe('#build')
  })
})
