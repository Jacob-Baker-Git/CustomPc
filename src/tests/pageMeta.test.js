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

  it('gives every content page a trailing-slash canonical, matching the sitemap', () => {
    // The slashed form is the one that returns 200 (dist/<page>/index.html); the
    // bare form 301s to it, so a bare canonical points away from itself. The
    // sitemap lists the slashed form too — the two must not disagree.
    for (const p of PAGES) {
      expect(canonicalFor(p)).toBe(`${SITE}/${p}/`)
    }
  })

  it('leaves part pages unslashed and the root bare, with no double slash', () => {
    // Part detail pages resolve through the SPA fallback either way and are listed
    // unslashed; a trailing slash there would invent a second, un-listed URL.
    expect(canonicalFor('parts/gpu-rtx-3080')).toBe(`${SITE}/parts/gpu-rtx-3080`)
    expect(canonicalFor(null)).toBe(`${SITE}/`)
    expect(canonicalFor('')).toBe(`${SITE}/`)
  })
})
