import { renderHook, act } from '@testing-library/react'
import { useHashView } from '../hooks/useHashView'

beforeEach(() => {
  window.location.hash = ''
})

describe('useHashView', () => {
  it('defaults to build when the hash is empty or unknown', () => {
    window.location.hash = '#nonsense'
    const { result } = renderHook(() => useHashView('build'))
    expect(result.current[0]).toBe('build')
  })

  it('reads the initial view from the hash so tabs are deep-linkable', () => {
    window.location.hash = '#summary'
    const { result } = renderHook(() => useHashView('build'))
    expect(result.current[0]).toBe('summary')
  })

  it('setting a view updates the hash', () => {
    const { result } = renderHook(() => useHashView('build'))
    act(() => result.current[1]('saved'))
    expect(result.current[0]).toBe('saved')
    expect(window.location.hash).toBe('#saved')
  })

  it('reacts to browser back/forward via hashchange', () => {
    const { result } = renderHook(() => useHashView('build'))
    act(() => {
      window.location.hash = '#peripherals'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current[0]).toBe('peripherals')
  })
})

it('records the builder flow on each tab entry, so Back into a tab reopens the builder', () => {
  const { result } = renderHook(() => useHashView('build'))
  act(() => result.current[1]('summary'))
  expect(window.history.state).toEqual({ flow: 'builder' })
})

describe('useHashView setter', () => {
  it('is the same function on every render, so listeners need not re-subscribe', () => {
    const { result, rerender } = renderHook(() => useHashView('build'))
    const first = result.current[1]
    rerender()
    expect(result.current[1]).toBe(first)
  })
})
