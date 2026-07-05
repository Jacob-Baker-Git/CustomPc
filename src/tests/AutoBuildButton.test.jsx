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

  it('explains itself in a dialog when it cannot change anything', () => {
    // Build a full rig, then shrink the budget to exactly what's spent —
    // auto-build has nothing to add and nothing affordable to upgrade.
    render(<AutoBuildButton />)
    fireEvent.click(screen.getByRole('button', { name: /auto-build/i }))
    const parts = useBuilderStore.getState().selectedParts
    const spent = Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)
    useBuilderStore.setState({ budget: spent })

    fireEvent.click(screen.getByRole('button', { name: /auto-build/i }))
    expect(screen.getByRole('dialog', { name: /auto-build/i })).toBeInTheDocument()
    expect(screen.getByText(/nothing left|couldn't find/i)).toBeInTheDocument()
    // The build itself is untouched.
    expect(useBuilderStore.getState().selectedParts).toEqual(parts)

    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
