import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import PartSelector from '../components/PartSelector'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {} })
})

describe('PartSelector sorting', () => {
  it('renders a sort control with the four options', () => {
    render(<PartSelector category="gpu" onSelect={() => {}} onClose={() => {}} />)
    const select = screen.getByLabelText(/sort parts/i)
    expect(within(select).getByText('Price: High to Low')).toBeInTheDocument()
    expect(within(select).getByText('Power Draw (TDP)')).toBeInTheDocument()
  })
})
