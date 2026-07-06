import { Cpu, Wrench } from 'lucide-react'
import Backdrop from './Backdrop'

export default function MainMenu({ onNew, onUpgrade }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-white bg-[#05080f]">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center px-4">
        <h1 className="text-5xl font-bold mb-3 text-white">PC <span className="text-cyan-400">Builder</span></h1>
        <p className="text-gray-400 mb-10 text-lg">What would you like to do?</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onNew}
            className="w-64 px-6 py-8 rounded-sm border border-slate-700/70 hover:border-cyan-400 hover:bg-cyan-500/10 text-left transition-colors group"
          >
            <Cpu size={28} className="text-cyan-300 mb-3" aria-hidden="true" />
            <div className="text-xl font-semibold group-hover:text-cyan-200">Build a new PC</div>
            <div className="text-sm text-slate-400 mt-1">Start from your budget and build up.</div>
          </button>
          <button
            onClick={onUpgrade}
            className="w-64 px-6 py-8 rounded-sm border border-slate-700/70 hover:border-cyan-400 hover:bg-cyan-500/10 text-left transition-colors group"
          >
            <Wrench size={28} className="text-cyan-300 mb-3" aria-hidden="true" />
            <div className="text-xl font-semibold group-hover:text-cyan-200">Upgrade your PC</div>
            <div className="text-sm text-slate-400 mt-1">Tell us your current rig and goal.</div>
          </button>
        </div>
      </div>
    </div>
  )
}
