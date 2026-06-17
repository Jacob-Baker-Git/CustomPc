import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import AutoBuildButton from '../components/AutoBuildButton'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  useBuilderStore.setState({ budget: 1500, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('AutoBuildButton', () => {
  it('fills an empty build when clicked', () => {
    render(<AutoBuildButton />)
    fireEvent.click(screen.getByRole('button', { name: /auto-build/i }))
    const parts = useBuilderStore.getState().selectedParts
    expect(parts.cpu).toBeTruthy()
    expect(parts.gpu).toBeTruthy()
    expect(parts.psu).toBeTruthy()
  })

  it('is disabled when there is no budget', () => {
    useBuilderStore.setState({ budget: 0 })
    render(<AutoBuildButton />)
    expect(screen.getByRole('button', { name: /auto-build/i })).toBeDisabled()
  })
})
