import { useRef } from 'react'
import { useChromeHeight } from '../hooks/useChromeHeight'
import { ArrowLeft } from 'lucide-react'
import SiteFooter from './SiteFooter'

// The sticky header's height goes to the page as --chrome-h, so a Fold's
// pinned header (the Help FAQ) sits below it rather than under it.
// `wide`: a page laid out for the desktop width (Build for a game), not a
// reading column.
export default function SiteChrome({ onBack, children, wide = false }) {
  const rootRef = useRef(null)
  const headerRef = useRef(null)
  useChromeHeight(headerRef, rootRef)
  return (
    <div ref={rootRef} className="relative min-h-screen text-ink">
      <header ref={headerRef} className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-ground px-4 py-2">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-muted hover:text-ink hover:border-line-strong transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
        </button>
        {/* @wordmark — see accentIsBrandOnly.test.js */}
        <span className="font-display font-extrabold text-lg tracking-tight">PC <span className="text-accent">Builder</span></span>
      </header>
      <main className={`max-w-3xl mx-auto px-4 py-8 ${wide ? 'lg:max-w-6xl lg:px-8' : ''}`}>{children}</main>
      <SiteFooter />
    </div>
  )
}
