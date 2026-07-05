import { useEffect, useState } from 'react'

const VIEWS = ['build', 'peripherals', 'summary', 'saved']

// Tab state synced to the URL hash so views are deep-linkable and the
// browser back button works between tabs.
export function useHashView(defaultView = 'build') {
  const fromHash = () => {
    const h = window.location.hash.replace('#', '')
    return VIEWS.includes(h) ? h : defaultView
  }

  const [view, setView] = useState(fromHash)

  useEffect(() => {
    const onHash = () => setView(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (v) => {
    window.location.hash = v
    setView(v)
  }

  return [view, set]
}
