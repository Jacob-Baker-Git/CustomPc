import { render, screen, fireEvent } from '@testing-library/react'
import SetupFlow from '../components/SetupFlow'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import useCatalogStore from '../store/useCatalogStore'
import { encodeBuild } from '../lib/buildCodec'
import realParts from '../data/partsData.json'

// SetupFlow replaces the old BudgetEntry and UpgradeWizard screens. These
// cover both of the paths they used to own, plus the fork that joins them.

const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const gpuHi = { id: 'gpu-hi', category: 'gpu', name: 'GPU Hi', price: 600, perfScore: 300, tdp: 250, length: 300 }
const game  = { id: 'fortnite', name: 'Fortnite', fpsFactor: 1, cpuFactor: 1 }

const reset = () => {
  window.location.hash = ''
  useBuilderStore.setState({
    budget: 0, flow: 'setup', selectedParts: {}, selectedPeripherals: {},
    resolution: '1440p', lastGenerated: null, useCase: 'gaming',
  })
}

const startAt = (name) => fireEvent.click(screen.getByRole('button', { name }))
const enterBudget = (v) => {
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: v } })
  fireEvent.click(screen.getByRole('button', { name: /next: use case/i }))
}

describe('SetupFlow — choosing a starting point', () => {
  beforeEach(() => { reset(); useCatalogStore.setState({ parts: realParts, games: [game] }) })

  it('opens on the three starting points', () => {
    render(<SetupFlow onBack={() => {}} />)
    expect(screen.getByText(/where are you starting from/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pick parts for me/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /i already have a pc/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /empty build/i })).toBeInTheDocument()
  })

  it('back from the first step leaves setup entirely', () => {
    const onBack = vi.fn()
    render(<SetupFlow onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('back from a later step returns to the previous step, not the menu', () => {
    const onBack = vi.fn()
    render(<SetupFlow onBack={onBack} />)
    startAt(/pick parts for me/i)
    fireEvent.click(screen.getByRole('button', { name: /^← back$/i }))
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.getByText(/where are you starting from/i)).toBeInTheDocument()
  })
})

describe('SetupFlow — generate a build', () => {
  beforeEach(() => { reset(); useCatalogStore.setState({ parts: realParts, games: [game] }) })

  it('does not advance on a zero budget', () => {
    render(<SetupFlow onBack={() => {}} />)
    startAt(/pick parts for me/i)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(screen.queryByText(/what will you use/i)).not.toBeInTheDocument()
  })

  it('budget then use case generates a build and enters the builder', () => {
    render(<SetupFlow onBack={() => {}} />)
    startAt(/pick parts for me/i)
    enterBudget('1500')
    expect(screen.getByText(/what will you use/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /gaming/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))

    const s = useBuilderStore.getState()
    expect(s.selectedParts.cpu).toBeDefined()
    expect(s.selectedParts.gpu).toBeDefined()
    expect(s.budget).toBe(1500)
    expect(s.flow).toBe('builder')
  })

  it('a preset prefills the budget and jumps to the use-case step', () => {
    render(<SetupFlow onBack={() => {}} />)
    startAt(/pick parts for me/i)
    fireEvent.click(screen.getByRole('button', { name: /entry · £900/i }))
    expect(screen.getByText(/what will you use/i)).toBeInTheDocument()
  })

  it('content creation defaults the stored resolution to 4k', () => {
    render(<SetupFlow onBack={() => {}} />)
    startAt(/pick parts for me/i)
    enterBudget('3000')
    fireEvent.click(screen.getByRole('button', { name: /content creation/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    expect(useBuilderStore.getState().resolution).toBe('4k')
  })

  it('stores the picked use case for the build-page rating', () => {
    render(<SetupFlow onBack={() => {}} />)
    startAt(/pick parts for me/i)
    enterBudget('1500')
    fireEvent.click(screen.getByRole('button', { name: /programming/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    expect(useBuilderStore.getState().useCase).toBe('programming')
  })

  it('same budget, different use case yields different builds', () => {
    const { unmount } = render(<SetupFlow onBack={() => {}} />)
    startAt(/pick parts for me/i)
    fireEvent.click(screen.getByRole('button', { name: /entry · £900/i }))
    fireEvent.click(screen.getByRole('button', { name: /gaming/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    const gamingGpu = useBuilderStore.getState().selectedParts.gpu?.id
    unmount()

    reset()
    render(<SetupFlow onBack={() => {}} />)
    startAt(/pick parts for me/i)
    fireEvent.click(screen.getByRole('button', { name: /entry · £900/i }))
    fireEvent.click(screen.getByRole('button', { name: /everyday & office/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    expect(useBuilderStore.getState().selectedParts.gpu?.id).not.toBe(gamingGpu)
  })
})

describe('SetupFlow — empty build', () => {
  beforeEach(() => { reset(); useCatalogStore.setState({ parts: realParts, games: [game] }) })

  it('wipes a persisted build instead of inheriting it', () => {
    useBuilderStore.setState({
      selectedParts: { cpu: { id: 'old', category: 'cpu', name: 'Old', price: 100, tdp: 65 } },
      selectedPeripherals: { mouse: { id: 'm', category: 'mouse', name: 'M', price: 10 } },
    })
    render(<SetupFlow onBack={() => {}} />)
    startAt(/empty build/i)
    enterBudget('900')
    fireEvent.click(screen.getByRole('button', { name: /start building/i }))

    const s = useBuilderStore.getState()
    expect(s.selectedParts).toEqual({})
    expect(s.selectedPeripherals).toEqual({})
    expect(s.budget).toBe(900)
    expect(s.flow).toBe('builder')
  })

  it('lands on the Build tab even if the hash was left on summary', () => {
    window.location.hash = 'summary'
    render(<SetupFlow onBack={() => {}} />)
    startAt(/empty build/i)
    enterBudget('900')
    fireEvent.click(screen.getByRole('button', { name: /start building/i }))
    expect(window.location.hash).toBe('#build')
  })
})

describe('SetupFlow — I already have a PC', () => {
  beforeEach(() => {
    reset()
    useCatalogStore.setState({ parts: [cpuLo, gpuHi], games: [game] })
    const code = encodeBuild({ budget: 0, resolution: '1440p', parts: { cpu: cpuLo, gpu: gpuHi }, peripherals: {} })
    useSavedStore.setState({ saved: [{ id: 's1', name: 'My rig', savedAt: 1, code }] })
  })

  it('requires a CPU and GPU before continuing', () => {
    render(<SetupFlow onBack={() => {}} />)
    startAt(/i already have a pc/i)
    expect(screen.getByRole('button', { name: /next: use case/i })).toBeDisabled()
  })

  it('renders the "your PC" step as a seated RamBox rather than a plain panel', () => {
    const { container } = render(<SetupFlow onBack={() => {}} />)
    startAt(/i already have a pc/i)
    expect(container.querySelector('[data-ram-box]')).toHaveAttribute('data-seated', 'true')
  })

  it('highlights a saved build when selected and unblocks the step', () => {
    render(<SetupFlow onBack={() => {}} />)
    startAt(/i already have a pc/i)
    fireEvent.click(screen.getByRole('button', { name: /use a saved build/i }))
    const card = screen.getByRole('button', { name: /my rig/i })
    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /next: use case/i })).not.toBeDisabled()
  })

  it('prefills the budget from what the entered parts cost', () => {
    render(<SetupFlow onBack={() => {}} />)
    startAt(/i already have a pc/i)
    fireEvent.click(screen.getByRole('button', { name: /use a saved build/i }))
    fireEvent.click(screen.getByRole('button', { name: /my rig/i }))
    expect(screen.getByLabelText(/your budget/i)).toHaveValue(700) // 100 + 600
  })

  it('opens the entered rig in the Build tab for the chosen use case', () => {
    window.location.hash = 'summary'
    render(<SetupFlow onBack={() => {}} />)
    startAt(/i already have a pc/i)
    fireEvent.click(screen.getByRole('button', { name: /use a saved build/i }))
    fireEvent.click(screen.getByRole('button', { name: /my rig/i }))
    fireEvent.click(screen.getByRole('button', { name: /next: use case/i }))
    fireEvent.click(screen.getByRole('button', { name: /^gaming/i }))
    fireEvent.click(screen.getByRole('button', { name: /open my build/i }))

    const s = useBuilderStore.getState()
    expect(s.selectedParts.cpu.id).toBe('cpu-lo')
    expect(s.selectedParts.gpu.id).toBe('gpu-hi')
    expect(s.useCase).toBe('gaming')
    expect(s.budget).toBe(700)
    expect(s.resolution).toBe('1440p')
    expect(s.flow).toBe('builder')
    expect(window.location.hash).toBe('#build')
  })

  it('a raised budget leaves headroom above what the parts cost', () => {
    render(<SetupFlow onBack={() => {}} />)
    startAt(/i already have a pc/i)
    fireEvent.click(screen.getByRole('button', { name: /use a saved build/i }))
    fireEvent.click(screen.getByRole('button', { name: /my rig/i }))
    fireEvent.change(screen.getByLabelText(/your budget/i), { target: { value: '1200' } })
    fireEvent.click(screen.getByRole('button', { name: /next: use case/i }))
    fireEvent.click(screen.getByRole('button', { name: /^gaming/i }))
    fireEvent.click(screen.getByRole('button', { name: /open my build/i }))
    expect(useBuilderStore.getState().budget).toBe(1200)
  })
})
