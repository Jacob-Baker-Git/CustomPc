import { useState } from 'react'

// Whether the screen is desktop width (lg, 1024px) at MOUNT. Read once on
// purpose: it decides defaults (a Fold starts open on desktop, closed on a
// phone), and re-deciding them on resize would snap open what someone shut.
// jsdom has no matchMedia, so tests get the phone answer unless they stub it.
export const DESKTOP_QUERY = '(min-width: 1024px)'

export function useIsDesktop() {
  const [desktop] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(DESKTOP_QUERY).matches),
  )
  return desktop
}
