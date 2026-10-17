import { useEffect, useState } from 'react'

// The builder's own views. "saved" is deliberately absent — saved builds are a
// library spanning every build, not a view of the current one, so they live on
// the hub instead.
// Order is the journey: pick the parts, see what they do, then dress the desk,
// then check out. Performance sits next to Build because it answers the question
// Build raises; peripherals are an accessory to a decision already made.
export const VIEWS = ['build', 'performance', 'peripherals', 'summary']

// Each Welcome path's steps through those views. A game-target build arrives
// already chosen, so its steps skip Build and Performance; both tabs stay
// reachable from the tab bar.
export const stepsFor = (path) => (path === 'game' ? ['peripherals', 'summary'] : VIEWS)

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
    // pushState rather than location.hash so the entry records that it belongs
    // to the builder (see flowHistory.js); Back still fires hashchange.
    window.history.pushState({ flow: 'builder' }, '', `#${v}`)
    setView(v)
  }

  return [view, set]
}
