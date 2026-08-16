import { Cpu, ArrowRight, Bookmark } from 'lucide-react'
import Backdrop from './Backdrop'
import SiteFooter from './SiteFooter'
import useBuilderStore, { selTotalSpent } from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import { TELEMETRY } from '../lib/uiTokens'

// The app's home. Previously this forked into "new PC" vs "upgrade", which led
// to the same builder either way — so it now leads with continuing or starting
// a build. Parts/glossary/help/feedback are deliberately footer-only: they were
// briefly promoted to a row of tiles, which said the same four things twice on
// one screen and gave secondary pages the same visual weight as the one action
// this page exists for.
export default function MainMenu({ onStart, onResume, onSaved }) {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const budget        = useBuilderStore((s) => s.budget)
  const spent         = useBuilderStore(selTotalSpent)
  const savedCount    = useSavedStore((s) => s.saved.length)

  const partCount = Object.values(selectedParts).filter(Boolean).length
  const hasBuild = partCount > 0

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-ink bg-ground py-12">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center px-4 w-full max-w-2xl">
        {/* Two visible lines, both inside the h1. The heading used to be the
            wordmark alone — "PC Builder" — which told a reader nothing the logo
            had not already said and gave the root URL, the one page with no path
            to describe it, no heading worth indexing. The second line is the same
            promise index.html's <title> and description already make, so the
            page and its metadata finally agree. Deliberately NOT an sr-only
            span: if it is worth telling a crawler it is worth showing a reader. */}
        <h1 className="rise font-display mb-3 text-ink tracking-tight text-center">
          {/* The brand orange lives here, in TopBar, SiteChrome and
              ErrorBoundary, and nowhere else — accentIsBrandOnly.test.js.
              @wordmark */}
          <span className="block text-5xl font-extrabold">Custom PC <span className="text-accent">Builder</span></span>
          <span className="block mt-2 text-lg font-semibold text-muted">Build and price a gaming PC in 3D</span>
        </h1>
        <p className="rise text-muted mb-1">Pick parts that actually work together.</p>
        <p className="rise text-faint text-xs mb-10">Free · no sign-up · everything runs in your browser</p>

        <div className="rise rise-2 w-full flex flex-col gap-3">
          {hasBuild && (
            <button
              onClick={onResume}
              className="w-full px-6 py-5 rounded-xl border border-copper bg-gold-soft hover:brightness-110 text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-xl font-semibold text-copper">Carry on building</div>
                  <div className="text-sm text-muted mt-0.5">
                    <span className={TELEMETRY}>{partCount}</span> part{partCount === 1 ? '' : 's'} chosen
                    {budget > 0 && <> · <span className={TELEMETRY}>£{spent.toFixed(0)}</span> of <span className={TELEMETRY}>£{budget.toFixed(0)}</span></>}
                  </div>
                </div>
                <ArrowRight size={20} className="text-copper transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </div>
            </button>
          )}

          <button
            onClick={onStart}
            className={`w-full px-6 py-5 rounded-xl border text-left transition-colors group
              ${hasBuild
                ? 'border-line bg-surface hover:border-copper hover:bg-gold-soft'
                : 'border-copper bg-gold-soft hover:brightness-110'}`}
          >
            <div className="flex items-center gap-3">
              <Cpu size={24} className="text-copper shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <div className={`text-xl font-semibold ${hasBuild ? 'text-ink group-hover:text-copper' : 'text-copper'}`}>
                  {hasBuild ? 'Start a different build' : 'Start a build'}
                </div>
                <div className="text-sm text-muted mt-0.5">
                  Set a budget, or enter the PC you already own to see what's worth upgrading.
                </div>
              </div>
              <ArrowRight size={20} className="text-copper transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </div>
          </button>

          <button
            onClick={onSaved}
            className="w-full px-6 py-4 rounded-xl border border-line bg-surface hover:border-copper text-left transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Bookmark size={20} className="text-copper shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <div className="text-base font-semibold text-ink group-hover:text-copper">Saved builds</div>
                <div className="text-sm text-muted mt-0.5">
                  {savedCount === 0
                    ? 'Nothing saved yet'
                    : `${savedCount} saved · load one, or compare two side by side`}
                </div>
              </div>
              <ArrowRight size={16} className="text-muted transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </div>
          </button>
        </div>

        <div className="rise rise-3 w-full"><SiteFooter /></div>
      </div>
    </div>
  )
}
