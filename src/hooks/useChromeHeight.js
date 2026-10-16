import { useEffect } from 'react'

// Publishes the live height of a sticky header (`chromeRef`) as --chrome-h on
// its scroll container (`targetRef`), so a Fold's pinned header can sit just
// below it rather than underneath it. Does nothing where ResizeObserver is
// missing (jsdom); Folds then fall back to the top.
export function useChromeHeight(chromeRef, targetRef) {
  useEffect(() => {
    const chrome = chromeRef.current
    if (!chrome || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      targetRef.current?.style.setProperty('--chrome-h', `${chrome.offsetHeight}px`)
    })
    ro.observe(chrome)
    return () => ro.disconnect()
  }, [chromeRef, targetRef])
}
