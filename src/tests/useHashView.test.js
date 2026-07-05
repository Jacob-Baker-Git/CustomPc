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
