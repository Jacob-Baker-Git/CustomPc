import useBuilderStore from '../store/useBuilderStore'

describe('builder store flow field', () => {
  it('defaults to the menu', () => {
    expect(useBuilderStore.getState().flow).toBe('menu')
  })
  it('setFlow updates the flow', () => {
    useBuilderStore.getState().setFlow('upgrade')
    expect(useBuilderStore.getState().flow).toBe('upgrade')
    useBuilderStore.getState().setFlow('menu')
  })
})
