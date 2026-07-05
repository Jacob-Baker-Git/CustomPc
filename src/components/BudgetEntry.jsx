import { useState } from 'react'
import Backdrop from './Backdrop'
import useBuilderStore from '../store/useBuilderStore'
import { TIERS, partsForTier } from '../lib/tiers'
import { targetBuild } from '../lib/targetBuilder'
import partsData from '../data/partsData.json'
import gamesData from '../data/gamesData.json'

const RES_OPTIONS = [
  { id: '1080p', label: '1080p', blurb: 'Esports & high refresh' },
  { id: '1440p', label: '1440p', blurb: 'The sweet spot' },
  { id: '4k',    label: '4K',    blurb: 'Maximum fidelity' },
]
const TARGETS = [60, 120, 144, 240]
const STEPS = ['Budget', 'Resolution', 'FPS target']

export default function BudgetEntry({ onSubmit }) {
  const [step, setStep] = useState(1)
  const [value, setValue] = useState('')
  const [resolution, setLocalResolution] = useState(null)
  const [fps, setFps] = useState(120)
  const [gameId, setGameId] = useState('fortnite')
  const [shortfall, setShortfall] = useState(null)
  const setResolution = useBuilderStore((s) => s.setResolution)
  const setBuild = useBuilderStore((s) => s.setBuild)
  const setLastGenerated = useBuilderStore((s) => s.setLastGenerated)

  const budgetNum = parseFloat(value)

  function handleBudgetSubmit(e) {
    e.preventDefault()
    if (budgetNum > 0) setStep(2)
  }

  function applyTier(tier) {
    setResolution(tier.resolution)
    setBuild(partsForTier(tier, partsData))
    onSubmit(tier.budget)
  }

  function enterBuilder(parts) {
    setResolution(resolution)
    if (parts) setBuild(parts)
    onSubmit(budgetNum)
  }

  function generate() {
    const game = gamesData.find((g) => g.id === gameId)
    const result = targetBuild(budgetNum, resolution, fps, game, partsData)
    if (result.met) {
      setLastGenerated({ met: true, estFps: result.estFps, targetFps: fps, gameName: game.name })
      enterBuilder(result.parts)
    } else {
      setShortfall(result)
    }
  }

  const game = gamesData.find((g) => g.id === gameId)

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-white bg-[#05080f]">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center px-4">
        <h1 className="text-5xl font-bold mb-3 text-white">Build Your PC</h1>
        <ol className="flex items-center gap-2 mb-6 text-[11px] uppercase tracking-wider">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-700">→</span>}
              <span className={`flex items-center gap-1.5 ${step === i + 1 ? 'text-cyan-300' : 'text-slate-500'}`}>
                <span className="font-mono">{i + 1}</span>
                <span>{label}</span>
              </span>
            </li>
          ))}
        </ol>

        {step === 1 && (
          <>
            <p className="text-gray-400 mb-10 text-lg">What's your budget?</p>
            <form onSubmit={handleBudgetSubmit} aria-label="form" className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-2 text-3xl">
                <span className="text-cyan-300">£</span>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  placeholder="Enter budget"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="bg-slate-950/60 backdrop-blur-md text-white font-mono text-3xl w-72 px-4 py-3 rounded-sm border border-slate-700/70 focus:outline-none focus:border-cyan-400 text-center placeholder:text-2xl placeholder:text-slate-600 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-10 py-3 rounded-sm text-lg transition-colors"
              >
                Next: resolution
              </button>
            </form>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-slate-500">or quick-start:</span>
              {TIERS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTier(t)}
                  className="text-xs font-mono px-3 py-1.5 rounded-sm border border-slate-700/70 text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {t.label} · £{t.budget}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-gray-400 mb-10 text-lg">What resolution will you play at?</p>
            <div className="flex flex-col sm:flex-row gap-3">
              {RES_OPTIONS.map((r) => {
                const selected = resolution === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => setLocalResolution(r.id)}
                    aria-pressed={selected}
                    className={`w-44 px-4 py-5 rounded-sm border text-left transition-colors group
                      ${selected
                        ? 'border-cyan-400 bg-cyan-500/15'
                        : 'border-slate-700/70 hover:border-cyan-400'}`}
                  >
                    <div className={`text-2xl font-bold font-mono ${selected ? 'text-cyan-200' : 'group-hover:text-cyan-300'}`}>{r.label}</div>
                    <div className={`text-xs mt-1 ${selected ? 'text-cyan-300/80' : 'text-slate-400'}`}>{r.blurb}</div>
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setStep(3)}
              disabled={!resolution}
              className="mt-8 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-10 py-3 rounded-sm text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next: FPS target
            </button>
            <button onClick={() => setStep(1)} className="mt-6 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              ← Back to budget
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-gray-400 mb-8 text-lg">Pick an FPS target and the game that matters most.</p>
            <div className="flex gap-2 mb-6">
              {TARGETS.map((t) => (
                <button
                  key={t}
                  onClick={() => { setFps(t); setShortfall(null) }}
                  className={`px-5 py-2.5 rounded-sm border font-mono text-sm transition-colors
                    ${fps === t
                      ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}
                >
                  {t} fps
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 mb-8">
              <label htmlFor="wizard-game" className="text-sm text-slate-400">Game</label>
              <select
                id="wizard-game"
                value={gameId}
                onChange={(e) => { setGameId(e.target.value); setShortfall(null) }}
                className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-sm text-slate-100 px-3 py-2 focus:outline-none focus:border-cyan-400"
              >
                {gamesData.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {shortfall && (
              <div className="mb-6 max-w-md text-center border border-amber-500/40 bg-amber-500/10 rounded-sm px-4 py-3">
                <p className="text-sm text-amber-200">
                  £{budgetNum.toFixed(0)} can't hit {fps} fps in {game.name} at {resolution === '4k' ? '4K' : resolution}.
                  The closest build manages about <span className="font-mono font-semibold">{shortfall.estFps} fps</span>.
                </p>
                <button
                  onClick={() => {
                    setLastGenerated({ met: false, estFps: shortfall.estFps, targetFps: fps, gameName: game.name })
                    enterBuilder(shortfall.parts)
                  }}
                  className="mt-3 text-xs px-4 py-2 rounded-sm border border-amber-400/60 text-amber-200 hover:border-amber-300 transition-colors"
                >
                  Use closest build
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={generate}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-8 py-3 rounded-sm transition-colors"
              >
                Generate build
              </button>
              <button
                onClick={() => enterBuilder(null)}
                className="px-8 py-3 rounded-sm border border-slate-700/70 text-slate-300 hover:border-slate-500 transition-colors"
              >
                Start empty instead
              </button>
            </div>
            <button onClick={() => { setShortfall(null); setStep(2) }} className="mt-8 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              ← Back to resolution
            </button>
          </>
        )}
      </div>
    </div>
  )
}
