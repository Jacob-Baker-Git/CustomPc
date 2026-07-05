import { render, screen, fireEvent } from '@testing-library/react'
import BuildSummary from '../components/BuildSummary'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')

beforeEach(() => {
  localStorage.clear()
  useBuilderStore.setState({ budget: 1000, resolution: '1440p', selectedParts: { cpu }, selectedPeripherals: {} })
  useSavedStore.setState({ saved: [] })
})

describe('BuildSummary dialogs', () => {
  it('Save PC opens a themed dialog instead of window.prompt', () => {
    const promptSpy = vi.spyOn(window, 'prompt')
    render(<BuildSummary />)
    fireEvent.click(screen.getByRole('button', { name: /save pc/i }))
    expect(promptSpy).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    const input = screen.getByLabelText(/build name/i)
    fireEvent.change(input, { target: { value: 'My rig' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(useSavedStore.getState().saved[0].name).toBe('My rig')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(dialog).not.toBeInTheDocument()
    promptSpy.mockRestore()
  })

  it('Clear build asks for confirmation in a themed dialog', () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<BuildSummary />)
    fireEvent.click(screen.getByRole('button', { name: /clear build/i }))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /clear everything/i }))
    expect(useBuilderStore.getState().selectedParts).toEqual({})
    confirmSpy.mockRestore()
  })

  it('is honest that prices are estimates, not live data', () => {
    render(<BuildSummary />)
    expect(screen.getByText(/curated estimates/i)).toBeInTheDocument()
  })

  it('cancelling the clear dialog keeps the build', () => {
    render(<BuildSummary />)
    fireEvent.click(screen.getByRole('button', { name: /clear build/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(useBuilderStore.getState().selectedParts.cpu).toBeDefined()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
