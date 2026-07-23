import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import AutoBuildButton from '../components/AutoBuildButton'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  useBuilderStore.setState({ budget: 1500, useCase: 'gaming', selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('AutoBuildButton', () => {
  it('regenerates a complete build for the budget and use case when clicked', () => {
    render(<AutoBuildButton />)
    fireEvent.click(screen.getByRole('button', { name: /auto-build/i }))
    const parts = useBuilderStore.getState().selectedParts
    expect(parts.cpu).toBeTruthy()
    expect(parts.gpu).toBeTruthy()
    expect(parts.psu).toBeTruthy()
  })

  it('replaces existing parts with a fresh build', () => {
    useBuilderStore.setState({ selectedParts: { cpu: { id: 'stale', category: 'cpu', name: 'Stale', price: 50, tdp: 65 } } })
    render(<AutoBuildButton />)
    fireEvent.click(screen.getByRole('button', { name: /auto-build/i }))
    expect(useBuilderStore.getState().selectedParts.cpu.id).not.toBe('stale')
  })

  it('is disabled when there is no budget', () => {
    useBuilderStore.setState({ budget: 0 })
    render(<AutoBuildButton />)
    expect(screen.getByRole('button', { name: /auto-build/i })).toBeDisabled()
  })

  it('explains itself when the budget is too low to complete a build', () => {
    useBuilderStore.setState({ budget: 50, useCase: 'gaming', selectedParts: {} })
    render(<AutoBuildButton />)
    fireEvent.click(screen.getByRole('button', { name: /auto-build/i }))
    expect(screen.getByRole('dialog', { name: /auto-build/i })).toBeInTheDocument()
    expect(useBuilderStore.getState().selectedParts).toEqual({})
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
