import { useState } from 'react'
import Backdrop from './Backdrop'
import CategoryList from './CategoryList'
import PartSelector from './PartSelector'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { decodeBuild } from '../lib/buildCodec'
import { upgradeCandidates, sortCandidates } from '../lib/upgradeAdvisor'
import { enterBuildTab } from '../lib/enterBuildTab'
import { PANEL, BTN_PRIMARY, TELEMETRY } from '../lib/uiTokens'

const RES_OPTIONS = [
  { id: '1080p', label: '1080p' },
  { id: '1440p', label: '1440p' },
  { id: '4k',    label: '4K' },
]
const TARGETS = [60, 120, 144, 240]
const SORT_LABELS = [
  { key: 'value', label: 'Best £/FPS' },
  { key: 'gain',  label: 'Most FPS' },
  { key: 'cost',  label: 'Cheapest' },
]
const totalOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)

export default function UpgradeWizard({ onBack }) {
  const [step, setStep] = useState(1)
  const [tab, setTab] = useState('build')
  const [currentParts, setCurrentParts] = useState({})
  const [pickerCategory, setPickerCategory] = useState(null)
  const [gameId, setGameId] = useState('fortnite')
  const [resolution, setResolution] = useState('1440p')
  const [fps, setFps] = useState(120)
  const [upgradeBudget, setUpgradeBudget] = useState(400)
  const [sortKey, setSortKey] = useState('value')

  const saved      = useSavedStore((s) => s.saved)
  const partsData  = useCatalogStore((s) => s.parts)
  const gamesData  = useCatalogStore((s) => s.games)
  const setBuild            = useBuilderStore((s) => s.setBuild)
  const setBudget           = useBuilderStore((s) => s.setBudget)
  const setStoreResolution  = useBuilderStore((s) => s.setResolution)
  const setLastGenerated    = useBuilderStore((s) => s.setLastGenerated)

  const hasCore = Boolean(currentParts.cpu && currentParts.gpu)
  const gameObj = gamesData.find((g) => g.id === gameId)

  function selectPart(part) {
    setCurrentParts((prev) => ({ ...prev, [part.category]: part }))
    setPickerCategory(null)
  }
  function deselect(category) {
    setCurrentParts((prev) => { const n = { ...prev }; delete n[category]; return n })
  }
  function loadSaved(code) {
    const d = decodeBuild(code)
    if (!d) return
    setCurrentParts(d.parts)
    if (d.resolution) setResolution(d.resolution)
  }

  const candidates = hasCore && gameObj
    ? sortCandidates(
        upgradeCandidates(currentParts, { game: gameObj, resolution, targetFps: fps, budget: upgradeBudget }, partsData),
        sortKey,
      )
    : []

  function apply(c) {
    const nextParts = { ...currentParts, [c.category]: c.toPart }
    enterBuildTab()
    setBuild(nextParts)
    setStoreResolution(resolution)
    setLastGenerated({
      met: c.meetsGoal, estFps: c.resultFps, targetFps: fps,
      gameName: gameObj?.name, quality: 'high', upgrade: true,
    })
    setBudget(totalOf(currentParts) + upgradeBudget) // flips App → BuilderScreen on the Build tab
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center text-white bg-[#05080f] py-12">
      <Backdrop />
      <div className="relative z-10 w-full max-w-2xl px-4">
        <h1 className="text-3xl font-bold mb-1 text-center">Upgrade your PC</h1>
        <ol className="flex items-center justify-center gap-2 mb-8 text-[11px] uppercase tracking-wider">
          {['Current PC', 'Goal', 'Upgrades'].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-700">→</span>}
              <span className={step === i + 1 ? 'text-cyan-300' : 'text-slate-500'}>{i + 1} {label}</span>
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className={`${PANEL} p-5`}>
            <div className="inline-flex rounded-sm border border-slate-800/60 p-0.5 mb-4">
              <button
                onClick={() => setTab('build')}
                className={`px-3 py-1 text-xs rounded-sm ${tab === 'build' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}
              >
                Build current PC
              </button>
              <button
                onClick={() => setTab('saved')}
                className={`px-3 py-1 text-xs rounded-sm ${tab === 'saved' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}
              >
                Select saved build
              </button>
            </div>

            {tab === 'build' ? (
              <CategoryList
                selectedParts={currentParts}
                onSelectCategory={setPickerCategory}
                onDeselect={deselect}
              />
            ) : saved.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No saved builds yet. Build one first, or use the "Build current PC" tab.</p>
            ) : (
              <div className="space-y-1">
                {saved.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => loadSaved(b.code)}
                    className="w-full flex items-center justify-between border-t border-slate-800/50 py-2 text-left hover:text-cyan-300"
                  >
                    <span className="text-sm text-slate-100">{b.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{new Date(b.savedAt).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-500 mt-4">CPU and GPU are required — they drive the estimate.</p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setStep(2)}
                disabled={!hasCore}
                className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              >
                Next: goal
              </button>
              <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back to menu</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={`${PANEL} p-5`}>
            <div className="flex items-center gap-3 mb-5">
              <label htmlFor="upgrade-game" className="text-sm text-slate-400">Game</label>
              <select
                id="upgrade-game"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-sm text-slate-100 px-3 py-2 focus:outline-none focus:border-cyan-400"
              >
                {gamesData.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {RES_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setResolution(r.id)}
                  aria-pressed={resolution === r.id}
                  className={`px-4 py-2 rounded-sm border text-sm transition-colors
                    ${resolution === r.id ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {TARGETS.map((t) => (
                <button
                  key={t}
                  onClick={() => setFps(t)}
                  aria-pressed={fps === t}
                  className={`px-4 py-2 rounded-sm border font-mono text-sm transition-colors
                    ${fps === t ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}
                >
                  {t} fps
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(3)} className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium transition-colors`}>
                See upgrades
              </button>
              <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Current PC</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={`${PANEL} p-5`}>
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <label htmlFor="upgrade-budget" className="text-slate-400">Upgrade budget</label>
                <span className={`${TELEMETRY} text-cyan-300`}>£{upgradeBudget}</span>
              </div>
              <input
                id="upgrade-budget"
                type="range"
                min="0"
                max="2000"
                step="50"
                value={upgradeBudget}
                onChange={(e) => setUpgradeBudget(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
            <div className="flex gap-2 mb-4">
              {SORT_LABELS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortKey(s.key)}
                  aria-pressed={sortKey === s.key}
                  className={`px-3 py-1.5 rounded-sm border text-xs transition-colors
                    ${sortKey === s.key ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {candidates.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No upgrade beats your current parts within £{upgradeBudget}. Try raising the budget.</p>
            ) : (
              <div className="space-y-2">
                {candidates.map((c) => (
                  <div key={`${c.category}-${c.toPart.id}`} className="border border-slate-700/70 rounded-sm px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-100">
                        <span className="uppercase text-[10px] text-slate-500 mr-1">{c.category}</span>
                        {c.toPart.name}
                      </span>
                      <span className={`${TELEMETRY} text-emerald-300 text-sm font-semibold`}>+{c.fpsGain} fps</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <span>{c.extraCost <= 0 ? 'no extra cost' : `+£${c.extraCost.toFixed(0)}`}</span>
                      {c.extraCost > 0 && <span>· £{(c.pricePerFps).toFixed(1)}/fps</span>}
                      {c.meetsGoal && <span className="text-cyan-300">· hits {fps} fps</span>}
                      {c.fixesBottleneck && <span className="text-amber-300">· fixes bottleneck</span>}
                    </div>
                    <button
                      onClick={() => apply(c)}
                      className={`mt-2 w-full ${BTN_PRIMARY} text-sm font-medium py-1.5 rounded-sm transition-colors`}
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setStep(2)} className="mt-5 text-xs text-slate-500 hover:text-slate-300 transition-colors">← Goal</button>
          </div>
        )}
      </div>

      {pickerCategory && (
        <PartSelector
          category={pickerCategory}
          contextParts={currentParts}
          ignoreBudget
          onSelect={selectPart}
          onClose={() => setPickerCategory(null)}
        />
      )}
    </div>
  )
}
