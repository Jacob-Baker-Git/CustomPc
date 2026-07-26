import { Cpu, Wrench, ArrowRight } from 'lucide-react'
import Backdrop from './Backdrop'
import SiteFooter from './SiteFooter'

export default function MainMenu({ onNew, onUpgrade }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-ink bg-ground">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center px-4">
        <h1 className="rise font-display text-5xl font-extrabold mb-3 text-ink tracking-tight">PC <span className="text-accent">Builder</span></h1>
        <p className="rise text-muted mb-1 text-lg">What would you like to do?</p>
        <p className="rise text-faint text-xs mb-10">Free · no sign-up · everything runs in your browser</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onNew}
            className="rise rise-2 w-64 px-6 py-8 rounded-xl border border-line bg-surface hover:border-accent hover:bg-accent-soft text-left transition-colors group"
          >
            <Cpu size={28} className="text-accent mb-3" aria-hidden="true" />
            <div className="text-xl font-semibold text-ink group-hover:text-accent">Build a new PC</div>
            <div className="text-sm text-muted mt-1">Set a budget and we'll pick the best parts for how you'll use it.</div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-accent">
              Start <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </div>
          </button>
          <button
            onClick={onUpgrade}
            className="rise rise-3 w-64 px-6 py-8 rounded-xl border border-line bg-surface hover:border-accent hover:bg-accent-soft text-left transition-colors group"
          >
            <Wrench size={28} className="text-accent mb-3" aria-hidden="true" />
            <div className="text-xl font-semibold text-ink group-hover:text-accent">Upgrade your PC</div>
            <div className="text-sm text-muted mt-1">Enter your current rig and goal — we'll find the upgrades that matter.</div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-accent">
              Choose <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </div>
          </button>
        </div>
        <div className="w-full max-w-2xl"><SiteFooter /></div>
      </div>
    </div>
  )
}
