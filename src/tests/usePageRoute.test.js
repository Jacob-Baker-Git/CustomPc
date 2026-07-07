import { renderHook, act } from '@testing-library/react'
import { usePageRoute } from '../hooks/usePageRoute'

beforeEach(() => { window.location.hash = '' })

describe('usePageRoute', () => {
  it('is null with no hash and for builder view hashes', () => {
    window.location.hash = '#build'
    const { result } = renderHook(() => usePageRoute())
    expect(result.current.page).toBeNull()
  })
  it('reads a content page from #/help', () => {
    window.location.hash = '#/help'
    const { result } = renderHook(() => usePageRoute())
    expect(result.current.page).toBe('help')
  })
  it('navigate sets and clears the hash', () => {
    const { result } = renderHook(() => usePageRoute())
    act(() => result.current.navigate('parts'))
    expect(window.location.hash).toBe('#/parts')
    expect(result.current.page).toBe('parts')
    act(() => result.current.navigate(null))
    expect(result.current.page).toBeNull()
  })
})
