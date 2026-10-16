import { useState } from 'react'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import perfModel from '../data/perfModel.json'
import { buildForGame, findPreset, gameById, presetKey } from '../lib/gameTargetBuilder'
import GameSettingsFields from '../components/GameSettingsFields'
import { CATEGORIES } from '../lib/categories'
import { BTN_PRIMARY } from '../lib/uiTokens'

const fpsText = (o) => `${o.bound === 'upper' ? 'up to ' : ''}${o.fps} fps`

// One answer: the frame rate, the price and the button together at the top,
// so the choice is made on one screen; the parts that make it up fold
// underneath (spec 2026-10-16).
function BuildOption({ title, option, onUse }) {
  const parts = CATEGORIES.filter((c) => option.parts[c.id])
  return (
    <section className="border-t border-line pt-4">
      <h2 className="text-sm text-muted">{title}</h2>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="font-wide text-2xl font-extrabold text-ink">
          {fpsText(option)} <span className="text-muted">·</span> £{option.total.toFixed(0)}
        </p>
        <button onClick={onUse} className={`${BTN_PRIMARY} min-h-11 rounded-xl px-4 text-sm`}>Use this build</button>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer py-2 text-sm text-brass">{parts.length} parts</summary>
        <ul className="pb-2 text-[13px] text-muted">
          {parts.map((c) => (
            <li key={c.id} className="border-t border-line py-1.5">{c.label}: <span className="text-ink">{option.parts[c.id].name}</span></li>
          ))}
        </ul>
      </details>
    </section>
  )
}

export default function TargetScreen() {
  const target = useBuilderStore((s) => s.target)
  const setTarget = useBuilderStore((s) => s.setTarget)
  const storeBudget = useBuilderStore((s) => s.budget)
  const resolution = useBuilderStore((s) => s.resolution)
  const parts = useCatalogStore((s) => s.parts)
  const [fps, setFps] = useState(String(target.fps))
  const [budget, setBudgetText] = useState(String(storeBudget > 0 ? storeBudget : 1000))
  const [result, setResult] = useState(null)
  const game = gameById(target.gameId)
  const fpsNum = Number(fps)
  const budgetNum = Number(budget)
  const ready = Boolean(game) && fpsNum > 0 && budgetNum > 0
  const preset = game ? findPreset(game, target.presetKey) : null
  // Results answer one set of inputs; once any changes they are hidden rather
  // than left under a "Use this build" button for settings they do not match.
  const inputs = game ? `${game.id}|${presetKey(preset)}|${resolution}|${fpsNum}|${budgetNum}` : null
  const shown = result?.inputs === inputs ? result : null

  function find() {
    setTarget({ fps: fpsNum })
    useBuilderStore.getState().setBudget(budgetNum)
    setResult({
      inputs, budget: budgetNum, fps: fpsNum, game, preset, resolution,
      ...buildForGame({ game, preset, resolution,
                        targetFps: fpsNum, budget: budgetNum, parts, model: perfModel }),
    })
  }

  function use(option) {
    const s = useBuilderStore.getState()
    s.setBuild(option.parts)
    s.setPath('game')
    s.setFlow('builder', 'peripherals')
  }

  return (
    <div>
      <h1 className="mb-4 font-wide text-3xl font-extrabold">Build for a game</h1>
      <GameSettingsFields />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Target FPS
          <input type="number" min="1" value={fps} onChange={(e) => setFps(e.target.value)}
                 className="w-28 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Budget (£)
          <input type="number" min="1" value={budget} onChange={(e) => setBudgetText(e.target.value)}
                 className="w-32 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink" />
        </label>
        <button onClick={find} disabled={!ready}
                className={`${BTN_PRIMARY} text-sm px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed`}>
          Find builds
        </button>
      </div>

      {shown && (
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-xs text-muted">{shown.game.name} · {shown.resolution} · {shown.preset.label} · target {shown.fps} fps</p>
          {shown.noData ? (
            <p className="text-sm text-muted">No benchmark data for {shown.game.name} at these settings yet, so there is nothing to build towards.</p>
          ) : (
            <>
              {shown.best
                ? <BuildOption title={`Best build within £${shown.budget}`} option={shown.best} onUse={() => use(shown.best)} />
                : <p className="text-sm text-muted">No complete build fits £{shown.budget}.</p>}
              {shown.cheapestHit && (
                <BuildOption title={`Cheapest build that hits ${shown.fps} fps`} option={shown.cheapestHit} onUse={() => use(shown.cheapestHit)} />
              )}
              {shown.unreachable && (
                <p className="text-sm text-muted">
                  No build in the catalogue reaches {shown.fps} fps in {shown.game.name} at these settings.
                  The fastest manages {fpsText(shown.fastest)} for £{shown.fastest.total.toFixed(0)}.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
