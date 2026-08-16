import { ArrowLeft } from 'lucide-react'
import SiteFooter from './SiteFooter'

export default function SiteChrome({ onBack, children }) {
  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="sticky top-0 z-40 bg-surface border-b border-line px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-muted hover:text-ink hover:border-line-strong transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
        </button>
        {/* wordmark — see accentIsBrandOnly.test.js */}
        <span className="font-display font-extrabold text-lg tracking-tight">PC <span className="text-accent">Builder</span></span>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  )
}
