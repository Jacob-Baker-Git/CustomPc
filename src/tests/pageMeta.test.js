import { describe, it, expect } from 'vitest'
import { PAGE_META, SITE, canonicalFor } from '../lib/pageMeta'
import { PAGES } from '../hooks/usePageRoute'

describe('pageMeta', () => {
  it('has a title and a description for every content route', () => {
    // A route with no entry silently falls back to the root's copy, which is the
    // six-addresses-for-one-document problem real paths were meant to fix.
    const missing = PAGES.filter((p) => !PAGE_META[p]?.title || !PAGE_META[p]?.description)
    expect(missing).toEqual([])
  })

  it('describes no route that does not exist', () => {
    const extra = Object.keys(PAGE_META).filter((p) => !PAGES.includes(p))
    expect(extra).toEqual([])
  })

  it('deliberately holds no entry for the root', () => {
    // index.html is the source of truth for the root's copy. A second definition
    // here would drift, and generating the root's head from it would drop the
    // google-site-verification tag.
    expect(PAGE_META['']).toBeUndefined()
    expect(PAGE_META.index).toBeUndefined()
  })

  it('builds a canonical with no double slash and no trailing slash on a page', () => {
    expect(canonicalFor('help')).toBe(`${SITE}/help`)
    expect(canonicalFor(null)).toBe(`${SITE}/`)
    expect(canonicalFor('')).toBe(`${SITE}/`)
  })
})
