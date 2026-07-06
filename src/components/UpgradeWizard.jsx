import { useState, useMemo } from 'react'
import Backdrop from './Backdrop'
import CategoryList from './CategoryList'
import PartSelector from './PartSelector'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { decodeBuild } from '../lib/buildCodec'
import { sortCandidates } from '../lib/upgradeAdvisor'
import { systemUpgrades } from '../lib/systemUpgrades'
import { checkCompatibility } from '../lib/compatibility'
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
const NON_UPGRADEABLE = new Set(['case', 'motherboard', 'fans'])
const APPLY_ORDER = ['cpu', 'gpu', 'ram', 'cooler', 'storage', 'psu']
const CAT_LABEL = {
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', storage: 'Storage', psu: 'PSU',
  cooler: 'Cooler', motherboard: 'Motherboard', case: 'Case', fans: 'Fans',
}
const totalOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)

function buildPlan(analysis) {
  const plan = []
  const perf = sortCandidates([...(analysis.byCat.cpu ?? []), ...(analysis.byCat.gpu ?? [])], 'value')
  const best = perf.find((c) => c.meetsGoal) ?? perf[0]
  if (best) plan.push(best)
  for (const d of analysis.deficiencies) {
    if (d.severity === 'low' || d.category === 'cpu') continue
    const fix = (analysis.byCat[d.category] ?? [])[0]
    if (fix && !plan.some((p) => p.category === fix.category)) plan.push(fix)
  }
  return plan
}

function CandidateCard({ c, targetFps, onApply }) {
  const isFps = c.resultFps != null
  return (
    <div className="border border-slate-700/70 rounded-sm px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-100">
          <span className="uppercase text-[10px] text-slate-500 mr-1">{CAT_LABEL[c.category] ?? c.category}</span>
          {c.toPart.name}
        </span>
        {isFps
          ? <span className={`${TELEMETRY} text-emerald-300 text-sm font-semibold`}>+{c.fpsGain} fps</span>
          : <span className="text-[11px] text-slate-400">{c.reason}</span>}
      </div>
      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
        <span>{c.extraCost <= 0 ? 'no extra cost' : `+£${c.extraCost.toFixed(0)}`}</span>
        {isFps && c.extraCost > 0 && <span>· £{c.pricePerFps.toFixed(1)}/fps</span>}
        {isFps && c.meetsGoal && <span className="text-cyan-300">· hits {targetFps} fps</span>}
        {isFps && c.fixesBottleneck && <span className="text-amber-300">· fixes bottleneck</span>}
      </div>
      <button onClick={onApply} className={`mt-2 w-full ${BTN_PRIMARY} text-sm font-medium py-1.5 rounded-sm transition-colors`}>
        Apply
      </button>
    </div>
  )
}

export default function UpgradeWizard({ onBack }) {
  const [screen, setScreen] = useState('specs')
  const [path, setPath] = useState(null)
  const [tab, setTab] = useState('build')
  const [currentParts, setCurrentParts] = useState({})
  const [selectedCats, setSelectedCats] = useState(() => new Set())
  const [pickerCategory, setPickerCategory] = useState(null)
  const [gameId, setGameId] = useState('fortnite')
  const [resolution, setResolution] = useState('1440p')
  const [fps, setFps] = useState(120)
  const [upgradeBudget, setUpgradeBudget] = useState(400)
  const [sortKey, setSortKey] = useState('value')

  const saved      = useSavedStore((s) => s.saved)
  const partsData  = useCatalogStore((s) => s.parts)
  const gamesData  = useCatalogStore((s) => s.games)
  const setBuild           = useBuilderStore((s) => s.setBuild)
  const setBudget          = useBuilderStore((s) => s.setBudget)
  const setStoreResolution = useBuilderStore((s) => s.setResolution)
  const setLastGenerated   = useBuilderStore((s) => s.setLastGenerated)

  const hasCore = Boolean(currentParts.cpu && currentParts.gpu)
  const gameObj = gamesData.find((g) => g.id === gameId)

  const analysis = useMemo(
    () => (screen === 'results' && hasCore && gameObj
      ? systemUpgrades(currentParts, { game: gameObj, resolution, targetFps: fps }, upgradeBudget, partsData)
      : null),
    [screen, hasCore, gameObj, currentParts, resolution, fps, upgradeBudget, partsData],
  )

  function selectPart(part) { setCurrentParts((p) => ({ ...p, [part.category]: part })); setPickerCategory(null) }
  function deselect(category) { setCurrentParts((p) => { const n = { ...p }; delete n[category]; return n }) }
  function loadSaved(code) {
    const d = decodeBuild(code)
    if (!d) return
    setCurrentParts(d.parts)
    if (d.resolution) setResolution(d.resolution)
  }
  function toggleCat(cat) {
    setSelectedCats((prev) => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n })
  }

  function commit(nextParts, headline) {
    enterBuildTab()
    setBuild(nextParts)
    setStoreResolution(resolution)
    setLastGenerated(headline)
    setBudget(totalOf(currentParts) + upgradeBudget)
  }
  function apply(c) {
    commit({ ...currentParts, [c.category]: c.toPart }, {
      upgrade: true, gameName: gameObj?.name, quality: 'high',
      met: c.meetsGoal, estFps: c.resultFps, targetFps: fps,
    })
  }
  function applyPlan(plan) {
    let parts = { ...currentParts }
    const byCat = Object.fromEntries(plan.map((c) => [c.category, c]))
    for (const cat of APPLY_ORDER) {
      const c = byCat[cat]
      if (c && checkCompatibility(parts, c.toPart).compatible) parts = { ...parts, [cat]: c.toPart }
    }
    const perf = plan.find((c) => c.resultFps != null)
    commit(parts, {
      upgrade: true, gameName: gameObj?.name, quality: 'high',
      met: perf?.meetsGoal, estFps: perf?.resultFps, targetFps: fps,
    })
  }

  const catCandidates = (cat) => {
    const list = analysis?.byCat[cat] ?? []
    return (cat === 'cpu' || cat === 'gpu') ? sortCandidates(list, sortKey) : list
  }
  const plan = analysis && path === 'unsure' ? buildPlan(analysis) : []
  const highSeverity = analysis ? analysis.deficiencies.filter((d) => d.severity === 'high') : []

  const activeLabel = screen === 'specs' ? 'Current PC'
    : screen === 'highlight' ? 'Choose parts'
    : screen === 'goal' ? 'Goal'
    : path === 'select' ? 'Upgrades' : 'Diagnosis'
  const steps = path === 'select' ? ['Current PC', 'Choose parts', 'Goal', 'Upgrades']
    : path === 'unsure' ? ['Current PC', 'Goal', 'Diagnosis']
    : ['Current PC']

  return (
    <div className="relative min-h-screen flex flex-col items-center text-white bg-[#05080f] py-12">
      <Backdrop />
      <div className="relative z-10 w-full max-w-2xl px-4">
        <h1 className="text-3xl font-bold mb-1 text-center">Upgrade your PC</h1>
        <ol className="flex items-center justify-center gap-2 mb-8 text-[11px] uppercase tracking-wider">
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-700">→</span>}
              <span className={activeLabel === label ? 'text-cyan-300' : 'text-slate-500'}>{i + 1} {label}</span>
            </li>
          ))}
        </ol>

        {screen === 'specs' && (
          <div className={`${PANEL} p-5`}>
            <div className="inline-flex rounded-sm border border-slate-800/60 p-0.5 mb-4">
              <button onClick={() => setTab('build')} className={`px-3 py-1 text-xs rounded-sm ${tab === 'build' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Build current PC</button>
              <button onClick={() => setTab('saved')} className={`px-3 py-1 text-xs rounded-sm ${tab === 'saved' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Select saved build</button>
            </div>

            {tab === 'build' ? (
              <CategoryList selectedParts={currentParts} onSelectCategory={setPickerCategory} onDeselect={deselect} />
            ) : saved.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No saved builds yet. Build one first, or use the "Build current PC" tab.</p>
            ) : (
              <div className="space-y-1">
                {saved.map((b) => (
                  <button key={b.id} onClick={() => loadSaved(b.code)} className="w-full flex items-center justify-between border-t border-slate-800/50 py-2 text-left hover:text-cyan-300">
                    <span className="text-sm text-slate-100">{b.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{new Date(b.savedAt).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-500 mt-4">CPU and GPU are required — they drive the estimate.</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={() => { setPath('select'); setScreen('highlight') }}
                disabled={!hasCore}
                className={`${BTN_PRIMARY} px-5 py-2 rounded-sm text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              >
                Select what I want to upgrade →
              </button>
              <button
                onClick={() => { setPath('unsure'); setScreen('goal') }}
                disabled={!hasCore}
                className="px-5 py-2 rounded-sm border border-slate-700/70 text-slate-200 text-sm hover:border-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                I'm unsure of my upgrade path →
              </button>
            </div>
            <button onClick={onBack} className="mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back to menu</button>
          </div>
        )}

        {screen === 'highlight' && (
          <div className={`${PANEL} p-5`}>
            <p className="text-sm text-slate-300 mb-4">Tap the parts you'd like to upgrade.</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(currentParts).map((cat) => {
                const on = selectedCats.has(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCat(cat)}
                    aria-pressed={on}
                    className={`px-3 py-2 rounded-sm border text-left text-sm transition-colors
                      ${on ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}
                  >
                    <span className="uppercase text-[10px] text-slate-500 block">{CAT_LABEL[cat] ?? cat}</span>
                    {currentParts[cat].name}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => setScreen('goal')}
                disabled={selectedCats.size === 0}
                className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              >
                Continue →
              </button>
              <button onClick={() => setScreen('specs')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Current PC</button>
            </div>
          </div>
        )}

        {screen === 'goal' && (
          <div className={`${PANEL} p-5`}>
            <div className="flex items-center gap-3 mb-5">
              <label htmlFor="upgrade-game" className="text-sm text-slate-400">Game</label>
              <select id="upgrade-game" value={gameId} onChange={(e) => setGameId(e.target.value)} className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-sm text-slate-100 px-3 py-2 focus:outline-none focus:border-cyan-400">
                {gamesData.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {RES_OPTIONS.map((r) => (
                <button key={r.id} onClick={() => setResolution(r.id)} aria-pressed={resolution === r.id}
                  className={`px-4 py-2 rounded-sm border text-sm transition-colors ${resolution === r.id ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {TARGETS.map((t) => (
                <button key={t} onClick={() => setFps(t)} aria-pressed={fps === t}
                  className={`px-4 py-2 rounded-sm border font-mono text-sm transition-colors ${fps === t ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}>
                  {t} fps
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setScreen('results')} className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium transition-colors`}>See upgrades</button>
              <button onClick={() => setScreen(path === 'select' ? 'highlight' : 'specs')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back</button>
            </div>
          </div>
        )}

        {screen === 'results' && analysis && (
          <div className={`${PANEL} p-5`}>
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <label htmlFor="upgrade-budget" className="text-slate-400">Upgrade budget</label>
                <span className={`${TELEMETRY} text-cyan-300`}>£{upgradeBudget}</span>
              </div>
              <input id="upgrade-budget" type="range" min="0" max="2000" step="50" value={upgradeBudget} onChange={(e) => setUpgradeBudget(Number(e.target.value))} className="w-full accent-cyan-500" />
            </div>
            <div className="flex gap-2 mb-4">
              {SORT_LABELS.map((s) => (
                <button key={s.key} onClick={() => setSortKey(s.key)} aria-pressed={sortKey === s.key}
                  className={`px-3 py-1.5 rounded-sm border text-xs transition-colors ${sortKey === s.key ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}>
                  {s.label}
                </button>
              ))}
            </div>

            {path === 'select' ? (
              <div className="space-y-5">
                {[...selectedCats].map((cat) => {
                  const list = catCandidates(cat)
                  return (
                    <section key={cat}>
                      <h3 className="text-sm text-white font-semibold mb-2">{CAT_LABEL[cat] ?? cat}</h3>
                      {NON_UPGRADEABLE.has(cat) ? (
                        <p className="text-xs text-slate-400">This part doesn't change performance — swap it directly in the Build tab if you want a different one.</p>
                      ) : list.length === 0 ? (
                        <p className="text-xs text-slate-400">Your {CAT_LABEL[cat] ?? cat} is already well-specced for this goal.</p>
                      ) : (
                        <div className="space-y-2">
                          {list.map((c) => <CandidateCard key={`${c.category}-${c.toPart.id}`} c={c} targetFps={fps} onApply={() => apply(c)} />)}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-5">
                <section>
                  <h3 className="text-sm text-white font-semibold mb-2">The limiter</h3>
                  {analysis.bottleneck && (
                    <p className="text-xs text-slate-300 mb-2">{analysis.bottleneck.verdict}</p>
                  )}
                  {highSeverity.length === 0 ? (
                    <p className="text-xs text-emerald-300">Nothing's holding this build back at your target — it's well balanced.</p>
                  ) : (
                    <div className="space-y-1">
                      {highSeverity.map((d) => (
                        <p key={`${d.category}-${d.reason}`} className="text-xs text-amber-200 border border-amber-500/40 bg-amber-500/10 rounded-sm px-3 py-2">{d.reason}</p>
                      ))}
                    </div>
                  )}
                </section>
                <section>
                  <h3 className="text-sm text-white font-semibold mb-2">The plan</h3>
                  {plan.length === 0 ? (
                    <p className="text-xs text-slate-400">No upgrade beats your current parts within £{upgradeBudget}. Try raising the budget.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {plan.map((c) => <CandidateCard key={`${c.category}-${c.toPart.id}`} c={c} targetFps={fps} onApply={() => apply(c)} />)}
                      </div>
                      <button onClick={() => applyPlan(plan)} className={`mt-3 w-full ${BTN_PRIMARY} text-sm font-medium py-2 rounded-sm transition-colors`}>
                        Apply all recommended
                      </button>
                    </>
                  )}
                </section>
              </div>
            )}

            <button onClick={() => setScreen('goal')} className="mt-5 text-xs text-slate-500 hover:text-slate-300 transition-colors">← Goal</button>
          </div>
        )}
      </div>

      {pickerCategory && (
        <PartSelector category={pickerCategory} contextParts={currentParts} ignoreBudget onSelect={selectPart} onClose={() => setPickerCategory(null)} />
      )}
    </div>
  )
}
