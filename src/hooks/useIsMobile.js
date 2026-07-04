import { useSyncExternalStore } from 'react'

// The desktop orbit layout (ring + three floating side panels) needs ~1300px
// to avoid panels overlapping the ring; anything narrower gets the stacked layout.
const QUERY = '(max-width: 1279px)'

function subscribe(callback) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
