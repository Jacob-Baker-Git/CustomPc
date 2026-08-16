import { ArrowLeft } from 'lucide-react'
import SiteFooter from './SiteFooter'
import BoardBackground from './BoardBackground'
import { COLUMN_3XL } from '../lib/boardGeometry'

export default function SiteChrome({ onBack, children }) {
  return (
    <div className="relative min-h-screen text-ink">
      {/* These are the pages the scrim exists for: /help, /glossary and the
          legal pages carry the longest prose on the site, and gold under body
          text reads fine on a 27" monitor and badly on a phone in daylight. */}
      <BoardBackground column={COLUMN_3XL} />
      <header className="sticky top-0 z-40 bg-surface border-b border-line px-4 py-3 flex items-center gap-3">
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
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  )
}
