import { renderHook, act } from '@testing-library/react'
import { usePageRoute, PAGES } from '../hooks/usePageRoute'

// jsdom starts at http://localhost/, and history.pushState works there, so the
// whole router is exercisable without a server.
const at = (url) => window.history.replaceState(null, '', url)

beforeEach(() => at('/'))

describe('usePageRoute', () => {
  it('is null at the root and for builder view hashes', () => {
    at('/#build')
    const { result } = renderHook(() => usePageRoute())
    // The builder's view hashes are app state on one page and must never be
    // mistaken for a content route.
    expect(result.current.page).toBeNull()
  })

  it('reads a content page from the path', () => {
    at('/help')
    expect(renderHook(() => usePageRoute()).result.current.page).toBe('help')
  })

  it('ignores a path that is not a page', () => {
    at('/not-a-page')
    expect(renderHook(() => usePageRoute()).result.current.page).toBeNull()
  })

  it('navigate pushes a real URL and clears back to the root', () => {
    const { result } = renderHook(() => usePageRoute())
    act(() => result.current.navigate('parts'))
    expect(window.location.pathname).toBe('/parts')
    expect(window.location.hash).toBe('')
    expect(result.current.page).toBe('parts')

    act(() => result.current.navigate(null))
    expect(window.location.pathname).toBe('/')
    expect(result.current.page).toBeNull()
  })

  it('rewrites a legacy #/page link to its path, without a history entry', () => {
    // Old links exist in bookmarks and in Search Console. They have to keep
    // working, and they have to stop being a second URL for the same page.
    at('/#/glossary')
    const before = window.history.length
    const { result } = renderHook(() => usePageRoute())
    expect(result.current.page).toBe('glossary')
    expect(window.location.pathname).toBe('/glossary')
    expect(window.location.hash).toBe('')
    expect(window.history.length).toBe(before)
  })

  it('responds to Back', () => {
    const { result } = renderHook(() => usePageRoute())
    act(() => result.current.navigate('terms'))
    expect(result.current.page).toBe('terms')

    act(() => {
      at('/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.page).toBeNull()
  })

  it('every page in PAGES resolves from its own path', () => {
    // Guards the case where a page is added to the router's list but the
    // sitemap, the footer or the redirect rule never hears about it.
    for (const p of PAGES) {
      at(`/${p}`)
      expect(renderHook(() => usePageRoute()).result.current.page).toBe(p)
    }
  })
})
