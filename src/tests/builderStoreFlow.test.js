import useBuilderStore from '../store/useBuilderStore'
import { initFlowHistory } from '../lib/flowHistory'

describe('builder store flow field', () => {
  it('defaults to the hub', () => {
    expect(useBuilderStore.getState().flow).toBe('hub')
  })

  it('setFlow updates the flow', () => {
    useBuilderStore.getState().setFlow('target')
    expect(useBuilderStore.getState().flow).toBe('target')
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
    expect(migrate(state, 3)).toBe(state)
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
    useBuilderStore.getState().setFlow('target')
    expect(window.history.length).toBe(before + 1)
    expect(window.history.state).toEqual({ flow: 'target' })
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
    window.dispatchEvent(new PopStateEvent('popstate', { state: { flow: 'target' } }))
    expect(useBuilderStore.getState().flow).toBe('target')
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

describe('setFlow into the builder', () => {
  beforeEach(() => {
    useBuilderStore.setState({ flow: 'hub' })
    window.history.replaceState({ flow: 'hub' }, '', '/')
  })

  it('opens the Build tab by default', () => {
    useBuilderStore.getState().setFlow('builder')
    expect(window.location.hash).toBe('#build')
  })

  it('opens the tab it is asked for', () => {
    useBuilderStore.getState().setFlow('builder', 'summary')
    expect(window.location.hash).toBe('#summary')
  })
})

describe('path and target', () => {
  it('defaults to the parts path and no game', () => {
    const s = useBuilderStore.getState()
    expect(s.path).toBe('parts')
    expect(s.target).toEqual({ gameId: null, presetKey: null, fps: 60 })
  })

  it('setTarget merges rather than replaces', () => {
    useBuilderStore.getState().setTarget({ gameId: 'fortnite' })
    useBuilderStore.getState().setTarget({ fps: 144 })
    expect(useBuilderStore.getState().target).toEqual({ gameId: 'fortnite', presetKey: null, fps: 144 })
    useBuilderStore.setState({ target: { gameId: null, presetKey: null, fps: 60 } })
  })

  it('persists path and target', () => {
    const saved = useBuilderStore.persist.getOptions().partialize(useBuilderStore.getState())
    expect(saved).toHaveProperty('path')
    expect(saved).toHaveProperty('target')
  })
})

describe('persist migration -> v3', () => {
  const migrate = useBuilderStore.persist.getOptions().migrate

  it('is version 3', () => {
    expect(useBuilderStore.persist.getOptions().version).toBe(3)
  })

  it('sends a stored setup screen to the hub', () => {
    expect(migrate({ budget: 900, flow: 'setup' }, 2).flow).toBe('hub')
  })

  it('leaves other v2 flows alone', () => {
    expect(migrate({ budget: 900, flow: 'builder' }, 2).flow).toBe('builder')
  })

  it('still migrates v1 all the way', () => {
    expect(migrate({ budget: 1500, selectedParts: {} }, 1).flow).toBe('builder')
  })
})
