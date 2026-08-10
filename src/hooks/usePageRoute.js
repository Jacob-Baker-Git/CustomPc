import { useEffect, useState } from 'react'
import { partIdFromPath } from '../lib/partPages'

export const PAGES = ['help', 'parts', 'glossary', 'feedback', 'privacy', 'terms']

// Content pages are REAL PATHS (/help), not hash routes.
//
// They used to be slashed hashes (#/help) chosen so they could not collide with
// the builder's single-word view hashes (#build, #summary). That worked in the
// browser and cost the site its entire search presence: a crawler treats
// everything after # as the same document, so a site with a glossary, a parts
// browser and a FAQ presented Google with exactly ONE indexable URL holding
// about sixty words. The builder's view hashes are untouched — they are app
// state on one page, which is what a hash is for.
//
// Requires a server that serves index.html for unknown paths. Netlify does it
// via public/_redirects; `vite dev` and `vite preview` do it natively.
const pathOf = (p) => (p ? `/${p}` : '/')

// A route is a page plus, for the one page that has children, which part.
//
// PAGES is an exact-match list and could not express /parts/<id> — there are 540
// of those, one per catalogue part, which is where the long-tail search traffic
// for a builder actually is. So the part route is matched as a SEGMENT (see
// partPages.partIdFromPath, which also rejects anything that is not a bare id)
// and reported alongside its parent page: a part page is a child of /parts, so
// the chrome, the back link and the crawl path all still lead through it.
const routeOf = (path) => {
  const partId = partIdFromPath(path)
  if (partId) return { page: 'parts', partId }
  const p = path.replace(/^\/+|\/+$/g, '')
  return { page: PAGES.includes(p) ? p : null, partId: null }
}

const fromPath = () => routeOf(window.location.pathname)

// Old links still exist — in the wild, in anyone's bookmarks, and in the
// Search Console property. Rewriting the hash form to the path form on arrival
// keeps them working AND collapses the two URLs into one, which is the point
// of the change. replaceState so it does not add a history entry the user has
// to press Back through twice.
const canonicaliseLegacyHash = () => {
  const m = /^#\/([a-z]+)$/.exec(window.location.hash)
  if (m && PAGES.includes(m[1])) {
    window.history.replaceState(null, '', pathOf(m[1]))
    return { page: m[1], partId: null }
  }
  return null
}

export function usePageRoute() {
  const [route, setRoute] = useState(() => canonicaliseLegacyHash() ?? fromPath())

  // Takes a path body — 'parts', 'parts/gpu-rtx-4090', or null for the root — so
  // one function still covers both depths and callers never build a URL by hand.
  const navigate = (p) => {
    window.history.pushState(null, '', pathOf(p))
    setRoute(routeOf(pathOf(p)))
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    const onPop = () => setRoute(fromPath())
    window.addEventListener('popstate', onPop)

    // One delegated listener rather than an onClick on every link. The site's
    // page links live in five components that have no route context and should
    // not grow one — they stay plain crawlable anchors with real hrefs, and
    // this turns a same-origin click into a pushState instead of a reload.
    // Anything it does not recognise falls through to the browser untouched.
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target.closest?.('a')
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      if (a.origin !== window.location.origin) return

      const to = a.pathname.replace(/^\/+|\/+$/g, '')
      // A part link is a plain <a href="/parts/gpu-rtx-4090"> like every other
      // link on the site — crawlable, right-clickable, and handled here so it
      // does not reload the app. Without this branch all 540 of them would.
      const isPart = partIdFromPath(a.pathname) !== null
      if (to !== '' && !isPart && !PAGES.includes(to)) return
      if (a.hash) return                       // in-page anchors keep working

      e.preventDefault()
      navigate(to === '' ? null : to)
    }
    document.addEventListener('click', onClick)

    return () => {
      window.removeEventListener('popstate', onPop)
      document.removeEventListener('click', onClick)
    }
  }, [])

  return { page: route.page, partId: route.partId, navigate }
}
