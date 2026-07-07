import { ArrowLeft } from 'lucide-react'
import SiteFooter from './SiteFooter'

export default function SiteChrome({ onBack, children }) {
  return (
    <div className="min-h-screen bg-[#05080f] text-white">
      <header className="sticky top-0 z-40 bg-slate-950/70 backdrop-blur-md border-b border-slate-800/60 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-7 h-7 flex items-center justify-center rounded-sm border border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
        </button>
        <span className="font-bold text-lg tracking-tight">PC <span className="text-cyan-400">Builder</span></span>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  )
}
