import { render, screen, fireEvent } from '@testing-library/react'
import CaseToggle from '../components/CaseToggle'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const pcCase = partsData.find((p) => p.category === 'case')

beforeEach(() => {
  useBuilderStore.setState({
    selectedParts: { case: pcCase },
    caseTransparent: false,
  })
})

describe('CaseToggle', () => {
  it('labels the button with the action, not the current state', () => {
    render(<CaseToggle />)
    // Case is solid → the button offers to make it see-through.
    expect(screen.getByRole('button', { name: /see-through case/i })).toBeInTheDocument()
  })

  it('switches to see-through on click and offers to go back', () => {
    render(<CaseToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(useBuilderStore.getState().caseTransparent).toBe(true)
    expect(screen.getByRole('button', { name: /solid case/i })).toBeInTheDocument()
  })
})
