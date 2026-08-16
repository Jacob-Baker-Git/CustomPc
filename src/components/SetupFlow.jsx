import { useState } from 'react'
import { Wand2, Wrench, FileQuestion } from 'lucide-react'
import BoardBackground from './BoardBackground'
import { COLUMN_2XL } from '../lib/boardGeometry'
import CategoryList from './CategoryList'
import PartSelector from './PartSelector'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import useSavedStore from '../store/useSavedStore'
import { decodeBuild } from '../lib/buildCodec'
import { TIERS } from '../lib/tiers'
import { BUILD_PROFILES, USE_CASES } from '../lib/buildProfiles'
import { buildForUseCase } from '../lib/useCaseBuilder'
import { enterBuildTab } from '../lib/enterBuildTab'
import { BTN_PRIMARY, TELEMETRY } from '../lib/uiTokens'
import RamBox from './RamBox'

const totalOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)

const START_POINTS = [
  {
    id: 'generate',
    icon: Wand2,
    label: 'Pick parts for me',
    blurb: 'Give us a budget and we assemble a balanced build you can then change.',
  },
  {
    id: 'existing',
    icon: Wrench,
    label: 'I already have a PC',
    blurb: 'Enter what you own and see which part is holding it back.',
  },
  {
    id: 'empty',
    icon: FileQuestion,
    label: 'Empty build',
    blurb: 'Start with nothing and choose every part yourself.',
  },
]

// Budget, current parts and use case in one flow. This replaces the old
// BudgetEntry and UpgradeWizard screens, which were separate entry points that
// both ended up on the same builder — the difference between them was only ever
// how selectedParts got seeded, so it is a step here rather than a fork.
export default function SetupFlow({ onBack }) {
  const [step, setStep] = useState(1)
  const [start, setStart] = useState('generate')
  const [value, setValue] = useState('')
  const [useCase, setUseCase] = useState('gaming')
  const [currentParts, setCurrentParts] = useState({})
  const [savedSelectedId, setSavedSelectedId] = useState(null)
  const [sourceTab, setSourceTab] = useState('build')
  const [pickerCategory, setPickerCategory] = useState(null)

  const setBudget         = useBuilderStore((s) => s.setBudget)
  const setBuild          = useBuilderStore((s) => s.setBuild)
  const clearBuild        = useBuilderStore((s) => s.clearBuild)
  const setResolution     = useBuilderStore((s) => s.setResolution)
  const setStoreUseCase   = useBuilderStore((s) => s.setUseCase)
  const setLastGenerated  = useBuilderStore((s) => s.setLastGenerated)
  const setFlow           = useBuilderStore((s) => s.setFlow)
  const partsData         = useCatalogStore((s) => s.parts)
  const saved             = useSavedStore((s) => s.saved)

  const existing   = start === 'existing'
  const partsTotal = totalOf(currentParts)
  const budgetNum  = parseFloat(value)
  const hasCore    = Boolean(currentParts.cpu && currentParts.gpu)
  const steps      = ['Start', existing ? 'Your PC' : 'Budget', 'Use case']
  const canAdvance = existing ? hasCore : budgetNum > 0

  function chooseStart(id) {
    setStart(id)
    // Pre-fill the budget box with what the entered parts cost, so the upgrade
    // path lands on a sensible number instead of an empty field.
    if (id === 'existing' && partsTotal > 0 && !value) setValue(String(Math.round(partsTotal)))
    setStep(2)
  }

  function selectPart(part) {
    setCurrentParts((p) => ({ ...p, [part.category]: part }))
    setPickerCategory(null)
  }

  function deselect(category) {
    setCurrentParts((p) => { const n = { ...p }; delete n[category]; return n })
  }

  function loadSaved(b) {
    const d = decodeBuild(b.code)
    if (!d) return
    setSavedSelectedId(b.id)
    setCurrentParts(d.parts)
    if (!value) setValue(String(Math.round(totalOf(d.parts))))
  }

  function finish() {
    const profile = BUILD_PROFILES[useCase]
    // Land on the Build tab, not whatever tab the last visit left in the hash.
    enterBuildTab()
    setResolution(profile.resolution)
    setStoreUseCase(useCase)

    if (existing) {
      const spend = partsTotal
      const budget = budgetNum > 0 ? budgetNum : spend
      setBuild(currentParts)
      setBudget(budget)
      setLastGenerated({ upgrade: true, useCase, spend, budget })
    } else if (start === 'generate') {
      const parts = buildForUseCase(budgetNum, useCase, partsData)
      setBuild(parts)
      setBudget(budgetNum)
      setLastGenerated({ useCase, spend: totalOf(parts), budget: budgetNum })
    } else {
      // Really start with nothing — also drops any build persisted from a
      // previous visit, which used to leak into "empty" sessions.
      clearBuild()
      setBudget(budgetNum)
      setLastGenerated(null)
    }
    setFlow('builder')
  }

  const back = () => (step === 1 ? onBack() : setStep(step - 1))

  return (
    <div className="relative min-h-screen flex flex-col items-center text-ink py-12">
      <BoardBackground column={COLUMN_2XL} />
      <div className="relative z-10 w-full max-w-2xl px-4 flex flex-col items-center">
        <h1 className="rise font-display text-4xl sm:text-5xl font-extrabold mb-6 text-ink tracking-tight text-center">Build Your PC</h1>
        <ol className="rise flex items-center gap-2 mb-8 text-[11px] uppercase tracking-wider">
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-line-strong">→</span>}
              <span className={`flex items-center gap-1.5 ${step === i + 1 ? 'text-gold' : 'text-faint'}`}>
                <span className="font-mono">{i + 1}</span>
                <span>{label}</span>
              </span>
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className="rise rise-2 w-full flex flex-col gap-3">
            <p className="text-muted text-center mb-1">Where are you starting from?</p>
            {START_POINTS.map(({ id, icon: Icon, label, blurb }) => (
              <button
                key={id}
                onClick={() => chooseStart(id)}
                className="w-full px-5 py-4 rounded-xl border border-line bg-surface hover:border-copper hover:bg-gold-soft text-left transition-colors group flex items-center gap-4"
              >
                <Icon size={22} className="text-copper shrink-0" aria-hidden="true" />
                <span className="flex-1">
                  <span className="block text-base font-semibold text-ink group-hover:text-copper">{label}</span>
                  <span className="block text-sm text-muted mt-0.5">{blurb}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && !existing && (
          <div className="rise rise-2 w-full flex flex-col items-center">
            <p className="text-muted mb-8 text-lg">What's your budget?</p>
            <form
              onSubmit={(e) => { e.preventDefault(); if (canAdvance) setStep(3) }}
              aria-label="form"
              className="flex flex-col items-center gap-6"
            >
              <div className="flex items-center gap-2 text-3xl">
                <span className="text-tech">£</span>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  placeholder="Enter budget"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="bg-surface text-ink font-mono tabular-nums text-3xl w-72 px-4 py-3 rounded-xl border border-line focus:outline-none focus:border-copper text-center placeholder:text-2xl placeholder:text-faint transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={!canAdvance}
                className={`${BTN_PRIMARY} px-10 py-3 rounded-lg text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              >
                Next: use case
              </button>
            </form>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-faint">or start from a preset:</span>
              {TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => { setValue(String(tier.budget)); setStep(3) }}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg border border-line bg-surface text-ink hover:border-copper hover:text-copper transition-colors"
                >
                  {tier.label} · £{tier.budget}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && existing && (
          // A wizard step always has content once it's on screen — always seated.
          <RamBox seated className="rise rise-2 w-full">
            <div className="inline-flex rounded-lg border border-line p-1 gap-0.5 mb-4">
              <button onClick={() => setSourceTab('build')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${sourceTab === 'build' ? 'bg-gold text-accent-ink' : 'text-muted hover:text-ink'}`}>Enter your parts</button>
              <button onClick={() => setSourceTab('saved')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${sourceTab === 'saved' ? 'bg-gold text-accent-ink' : 'text-muted hover:text-ink'}`}>Use a saved build</button>
            </div>

            {sourceTab === 'build' ? (
              <CategoryList selectedParts={currentParts} onSelectCategory={setPickerCategory} onDeselect={deselect} />
            ) : saved.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">No saved builds yet. Use the "Enter your parts" tab instead.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-faint">Pick one of your saved builds to rate and upgrade.</p>
                {saved.map((b) => {
                  const on = savedSelectedId === b.id
                  const d = decodeBuild(b.code)
                  const total = d ? totalOf(d.parts) : 0
                  return (
                    <button
                      key={b.id}
                      onClick={() => loadSaved(b)}
                      aria-pressed={on}
                      className={`w-full text-left border rounded-lg px-3 py-2.5 transition-colors
                        ${on ? 'border-gold bg-gold-soft' : 'border-line bg-surface hover:border-line-strong'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-ink">{b.name}</span>
                        <span className={`${TELEMETRY} text-xs ${on ? 'text-tech' : 'text-muted'}`}>£{total.toFixed(0)}</span>
                      </div>
                      <div className="text-[11px] text-faint font-mono">{new Date(b.savedAt).toLocaleDateString()}</div>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center gap-x-3 gap-y-2">
              <label htmlFor="setup-budget" className="text-xs text-muted">Your budget</label>
              <span className="text-sm text-tech">£</span>
              <input
                id="setup-budget"
                type="number"
                min="1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={partsTotal > 0 ? String(Math.round(partsTotal)) : '0'}
                className="bg-surface-2 text-ink font-mono tabular-nums w-28 px-2 py-1 rounded-lg border border-line focus:outline-none focus:border-copper"
              />
              <span className="text-[11px] text-faint flex-1 min-w-[12rem]">
                These parts cost <span className={TELEMETRY}>£{partsTotal.toFixed(0)}</span> — raise it to leave room for upgrades.
              </span>
            </div>

            <p className="text-[11px] text-faint mt-3">CPU and GPU are required — they drive the rating.</p>
            <button
              onClick={() => setStep(3)}
              disabled={!canAdvance}
              className={`${BTN_PRIMARY} px-6 py-2 rounded-lg text-sm mt-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
            >
              Next: use case →
            </button>
          </RamBox>
        )}

        {step === 3 && (
          <div className="rise rise-2 w-full flex flex-col items-center">
            <p className="text-muted mb-8 text-lg">What will you use this PC for?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {USE_CASES.map((u) => {
                const selected = useCase === u.id
                return (
                  <button
                    key={u.id}
                    onClick={() => setUseCase(u.id)}
                    aria-pressed={selected}
                    className={`px-4 py-4 rounded-xl border text-left transition-colors group
                      ${selected ? 'border-gold bg-gold-soft' : 'border-line bg-surface hover:border-copper'}`}
                  >
                    <div className={`text-lg font-bold ${selected ? 'text-gold' : 'text-ink group-hover:text-copper'}`}>{u.label}</div>
                    <div className={`text-xs mt-1 ${selected ? 'text-gold' : 'text-muted'}`}>{u.blurb}</div>
                  </button>
                )
              })}
            </div>
            <button onClick={finish} className={`${BTN_PRIMARY} px-8 py-3 rounded-lg mt-8 transition-colors`}>
              {existing ? 'Open my build →' : start === 'generate' ? 'Generate build →' : 'Start building →'}
            </button>
          </div>
        )}

        <button onClick={back} className="rise rise-4 mt-8 text-xs text-faint hover:text-ink transition-colors">
          {step === 1 ? '← Back to menu' : '← Back'}
        </button>
      </div>

      {pickerCategory && (
        <PartSelector category={pickerCategory} contextParts={currentParts} ignoreBudget onSelect={selectPart} onClose={() => setPickerCategory(null)} />
      )}
    </div>
  )
}
