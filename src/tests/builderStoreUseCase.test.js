import { describe, it, expect } from 'vitest'
import useBuilderStore from '../store/useBuilderStore'

describe('builder store useCase field', () => {
  it('defaults to gaming', () => {
    expect(useBuilderStore.getState().useCase).toBe('gaming')
  })
  it('setUseCase updates the use case', () => {
    useBuilderStore.getState().setUseCase('programming')
    expect(useBuilderStore.getState().useCase).toBe('programming')
    useBuilderStore.getState().setUseCase('gaming')
  })
  it('persists useCase via partialize', () => {
    const persisted = useBuilderStore.persist.getOptions().partialize(useBuilderStore.getState())
    expect(persisted).toHaveProperty('useCase')
  })
})
