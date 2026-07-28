import useBuilderStore from '../store/useBuilderStore'

describe('builder store flow field', () => {
  it('defaults to the hub', () => {
    expect(useBuilderStore.getState().flow).toBe('hub')
  })

  it('setFlow updates the flow', () => {
    useBuilderStore.getState().setFlow('setup')
    expect(useBuilderStore.getState().flow).toBe('setup')
    useBuilderStore.getState().setFlow('hub')
  })

  it('persists flow, so a refresh returns you where you were', () => {
    expect(useBuilderStore.persist.getOptions().partialize(useBuilderStore.getState()))
      .toHaveProperty('flow')
  })
})

// v1 stored no `flow` and inferred "in the builder" from a non-zero budget.
describe('persist migration v1 -> v2', () => {
  const migrate = useBuilderStore.persist.getOptions().migrate

  it('sends a v1 user with a budget back into the builder', () => {
    expect(migrate({ budget: 1500, selectedParts: {} }, 1).flow).toBe('builder')
  })

  it('sends a v1 user without a budget to the hub', () => {
    expect(migrate({ budget: 0, selectedParts: {} }, 1).flow).toBe('hub')
    expect(migrate({ selectedParts: {} }, 1).flow).toBe('hub')
  })

  it('leaves already-migrated state alone', () => {
    const state = { budget: 1500, flow: 'hub' }
    expect(migrate(state, 2)).toBe(state)
  })

  it('keeps the rest of the persisted state intact', () => {
    const out = migrate({ budget: 900, useCase: 'creation', resolution: '4k' }, 1)
    expect(out.useCase).toBe('creation')
    expect(out.resolution).toBe('4k')
    expect(out.budget).toBe(900)
  })
})
