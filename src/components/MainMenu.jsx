import { ArrowRight } from 'lucide-react'
import SiteFooter from './SiteFooter'
import Tag from './ui/Tag'
import useSavedStore from '../store/useSavedStore'
import perfGames from '../data/perfGames.json'

// The app's home: the Welcome screen's three paths (spec 2026-10-13) in the
// configurator look (spec 2026-10-16) — a PC as the picture, a wide headline,
// and the paths as plain hairline rows rather than boxes.
// Parts/glossary/help/feedback are deliberately footer-only: they were
// briefly promoted to a row of tiles, which said the same four things twice on
// one screen and gave secondary pages the same visual weight as the actions
// this page exists for.
function PathRow({ title, line, onClick, small = false }) {
  return (
    <button onClick={onClick} className="group flex w-full min-h-11 items-center justify-between gap-4 border-t border-line py-4 text-left">
      <span className="min-w-0">
        <span className={`block font-bold text-ink transition-colors group-hover:text-brass ${small ? 'text-[15px]' : 'text-lg'}`}>{title}</span>
        <span className="block text-sm text-muted">{line}</span>
      </span>
      <ArrowRight size={small ? 16 : 20} className="shrink-0 text-brass transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </button>
  )
}

export default function MainMenu({ onExplore, onTarget, onSaved }) {
  const savedCount = useSavedStore((s) => s.saved.length)

  return (
    <div className="relative flex min-h-screen flex-col text-ink">
      {/* The hub's landmark: a <main>, with the footer a sibling below it so its
          <footer> keeps its contentinfo. landmarks.test.jsx guards both. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-5">
        {/* A PC as the picture: a still render of an example build from the
            site's own 3D view (scripts/capture-welcome-render.mjs). A still,
            not the live view, because the live one is ~6 MB and phones never
            download it unasked. Decorative, so alt="". */}
        {/* Feathered left and right so the picture melts into the page where the
            column is narrower than the window, instead of ending in a hard edge. */}
        <div className="relative -mx-5 h-[280px] overflow-hidden sm:h-[360px] sm:[mask-image:linear-gradient(90deg,transparent,#000_14%,#000_86%,transparent)]">
          <img src="/img/welcome-pc.webp" alt="" width="1200" height="800"
               className="absolute inset-0 h-full w-full object-cover object-[50%_62%]" />
          <div aria-hidden="true" className="absolute inset-0"
               style={{ background: 'linear-gradient(180deg, var(--ground) 0%, transparent 25%, transparent 60%, var(--ground) 100%)' }} />
        </div>

        {/* Two visible lines, both inside the h1: the wordmark, then the same
            promise index.html's <title> and description make, so the page and
            its metadata agree. Not sr-only: if it is worth telling a crawler it
            is worth showing a reader. The brand orange lives here, in TopBar,
            SiteChrome and ErrorBoundary, and nowhere else —
            accentIsBrandOnly.test.js. @wordmark */}
        <h1 className="rise -mt-6 relative">
          <span className="block font-display text-lg font-extrabold tracking-tight">Custom PC <span className="text-accent">Builder</span></span>
          <span className="mt-2 block font-wide text-[32px] font-extrabold leading-[1.05] text-ink sm:text-[40px]">Build and price a gaming PC in 3D</span>
        </h1>
        <p className="rise mt-3"><Tag><b>{perfGames.length}</b> games benchmarked</Tag></p>
        <p className="rise mt-2 mb-8 text-sm text-muted">Pick parts that actually work together. Nothing to install, and your builds stay in your own browser.</p>

        <div className="rise rise-2 border-b border-line">
          <PathRow title="What will my build get?" line="Enter your parts and see the frame rate in a game." onClick={onExplore} />
          <PathRow title="Build for a game" line="A game, a frame rate and a budget in; a PC out." onClick={onTarget} />
          <PathRow small title="Saved builds"
                   line={savedCount === 0 ? 'Nothing saved yet' : `${savedCount} saved · load one, or compare two side by side`}
                   onClick={onSaved} />
        </div>
      </main>

      <div className="rise rise-3 w-full"><SiteFooter /></div>
    </div>
  )
}
