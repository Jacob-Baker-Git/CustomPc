import { Cpu, ArrowRight, Bookmark, Layers, BookOpen, HelpCircle, MessageSquare } from 'lucide-react'
import Backdrop from './Backdrop'
import SiteFooter from './SiteFooter'
import useBuilderStore, { selTotalSpent } from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import { TELEMETRY } from '../lib/uiTokens'

const LINKS = [
  { href: '#/parts',    icon: Layers,        label: 'Browse parts',  blurb: 'Every part in the catalogue' },
  { href: '#/glossary', icon: BookOpen,      label: 'Glossary',      blurb: 'Jargon, in plain English' },
  { href: '#/help',     icon: HelpCircle,    label: 'Help',          blurb: 'How this works' },
  { href: '#/feedback', icon: MessageSquare, label: 'Feedback',      blurb: 'Tell us what to fix' },
]

// The app's home. Previously this forked into "new PC" vs "upgrade", which led
// to the same builder either way — so it now leads with continuing or starting
// a build and surfaces the content pages that were buried in the footer.
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
        <h1 className="rise font-display text-5xl font-extrabold mb-3 text-ink tracking-tight">PC <span className="text-accent">Builder</span></h1>
        <p className="rise text-muted mb-1 text-lg">Pick parts that actually work together.</p>
        <p className="rise text-faint text-xs mb-10">Free · no sign-up · everything runs in your browser</p>

        <div className="rise rise-2 w-full flex flex-col gap-3">
          {hasBuild && (
            <button
              onClick={onResume}
              className="w-full px-6 py-5 rounded-xl border border-accent bg-accent-soft hover:brightness-110 text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-xl font-semibold text-accent">Carry on building</div>
                  <div className="text-sm text-muted mt-0.5">
                    <span className={TELEMETRY}>{partCount}</span> part{partCount === 1 ? '' : 's'} chosen
                    {budget > 0 && <> · <span className={TELEMETRY}>£{spent.toFixed(0)}</span> of <span className={TELEMETRY}>£{budget.toFixed(0)}</span></>}
                  </div>
                </div>
                <ArrowRight size={20} className="text-accent transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </div>
            </button>
          )}

          <button
            onClick={onStart}
            className={`w-full px-6 py-5 rounded-xl border text-left transition-colors group
              ${hasBuild
                ? 'border-line bg-surface hover:border-accent hover:bg-accent-soft'
                : 'border-accent bg-accent-soft hover:brightness-110'}`}
          >
            <div className="flex items-center gap-3">
              <Cpu size={24} className="text-accent shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <div className={`text-xl font-semibold ${hasBuild ? 'text-ink group-hover:text-accent' : 'text-accent'}`}>
                  {hasBuild ? 'Start a different build' : 'Start a build'}
                </div>
                <div className="text-sm text-muted mt-0.5">
                  Set a budget, or enter the PC you already own to see what's worth upgrading.
                </div>
              </div>
              <ArrowRight size={20} className="text-accent transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </div>
          </button>

          <button
            onClick={onSaved}
            className="w-full px-6 py-4 rounded-xl border border-line bg-surface hover:border-accent text-left transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Bookmark size={20} className="text-accent shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <div className="text-base font-semibold text-ink group-hover:text-accent">Saved builds</div>
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

        <div className="rise rise-3 mt-8 w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
          {LINKS.map(({ href, icon: Icon, label, blurb }) => (
            <a
              key={href}
              href={href}
              className="px-3 py-3 rounded-lg border border-line bg-surface hover:border-accent hover:text-accent text-muted transition-colors"
            >
              <Icon size={16} className="mb-1.5" aria-hidden="true" />
              <div className="text-xs font-semibold text-ink">{label}</div>
              <div className="text-[11px] text-faint leading-snug mt-0.5">{blurb}</div>
            </a>
          ))}
        </div>

        <div className="w-full"><SiteFooter /></div>
      </div>
    </div>
  )
}
