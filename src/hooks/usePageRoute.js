import { useEffect, useState } from 'react'

const PAGES = ['help', 'parts', 'glossary', 'feedback', 'privacy', 'terms']

// Content pages use slashed hashes (#/help) so they never collide with the
// builder's single-word view hashes (#build, #summary) from useHashView.
const fromHash = () => {
  const h = window.location.hash.replace(/^#\/?/, '')
  return PAGES.includes(h) ? h : null
}

export function usePageRoute() {
  const [page, setPage] = useState(fromHash)
  useEffect(() => {
    const onHash = () => setPage(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const navigate = (p) => {
    window.location.hash = p ? `/${p}` : ''
    setPage(p ?? null)
  }
  return { page, navigate }
}
