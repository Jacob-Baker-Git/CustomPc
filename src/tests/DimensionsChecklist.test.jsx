import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import DimensionsChecklist from '../components/DimensionsChecklist'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => { useBuilderStore.setState({ selectedParts: {} }) })

describe('DimensionsChecklist', () => {
  it('renders both dimension checks', () => {
    render(<DimensionsChecklist />)
    expect(screen.getByText(/GPU length vs case clearance/i)).toBeInTheDocument()
    expect(screen.getByText(/CPU cooler height vs case/i)).toBeInTheDocument()
  })
})
