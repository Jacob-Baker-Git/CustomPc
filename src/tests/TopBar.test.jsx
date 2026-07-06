import { render, screen, fireEvent } from '@testing-library/react'
import TopBar from '../components/TopBar'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  useBuilderStore.setState({ budget: 1500, selectedParts: {}, selectedPeripherals: {} })
})

describe('TopBar back button', () => {
  it('returns to the budget screen without touching the build', () => {
    useBuilderStore.setState({ selectedParts: { cpu: { id: 'x', price: 200 } } })
    render(<TopBar />)
    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }))
    expect(useBuilderStore.getState().budget).toBe(0)
    expect(useBuilderStore.getState().selectedParts.cpu).toBeDefined()
  })
})
