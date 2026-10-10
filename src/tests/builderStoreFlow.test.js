import useBuilderStore from '../store/useBuilderStore'
import { initFlowHistory } from '../lib/flowHistory'

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

// `flow` used to live only in the store, so the browser's Back button could not
// move between the hub, setup and the builder: from the builder it walked back
// through the tab hashes and then left the site.
describe('flow and browser history', () => {
  beforeEach(() => {
    useBuilderStore.setState({ flow: 'hub' })
    window.history.replaceState({ flow: 'hub' }, '', '/')
  })

  it('setFlow adds a history entry carrying the flow', () => {
    const before = window.history.length
    useBuilderStore.getState().setFlow('setup')
    expect(window.history.length).toBe(before + 1)
    expect(window.history.state).toEqual({ flow: 'setup' })
  })

  it('entering the builder always opens the Build tab', () => {
    window.history.replaceState({ flow: 'hub' }, '', '/#summary')
    useBuilderStore.getState().setFlow('builder')
    expect(window.location.hash).toBe('#build')
  })

  it('re-entering the same flow replaces the entry instead of adding one', () => {
    useBuilderStore.setState({ flow: 'builder' })
    const before = window.history.length
    useBuilderStore.getState().setFlow('builder')
    expect(window.history.length).toBe(before)
    expect(window.location.hash).toBe('#build')
  })

  it('Back restores the flow recorded on the entry', () => {
    initFlowHistory()
    useBuilderStore.setState({ flow: 'builder' })
    window.dispatchEvent(new PopStateEvent('popstate', { state: { flow: 'setup' } }))
    expect(useBuilderStore.getState().flow).toBe('setup')
  })

  it('an entry with no recorded flow leaves the flow alone', () => {
    initFlowHistory()
    useBuilderStore.setState({ flow: 'builder' })
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    expect(useBuilderStore.getState().flow).toBe('builder')
  })

  it('stamps the entry the app opened on with the current flow', () => {
    window.history.replaceState(null, '', '/')
    useBuilderStore.setState({ flow: 'saved' })
    initFlowHistory()
    expect(window.history.state).toEqual({ flow: 'saved' })
  })
})
