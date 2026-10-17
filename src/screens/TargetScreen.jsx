import { useState } from 'react'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import perfModel from '../data/perfModel.json'
import { buildForGame, findPreset, gameById, presetKey } from '../lib/gameTargetBuilder'
import { buildCards } from '../lib/buildCards'
import GameSettingsFields from '../components/GameSettingsFields'
import { CATEGORIES } from '../lib/categories'
import { BTN_PRIMARY } from '../lib/uiTokens'
import { useIsDesktop } from '../hooks/useIsDesktop'

const fpsText = (o) => `${o.bound === 'upper' ? 'up to ' : ''}${o.fps} fps`

// One answer: the frame rate, the price and the button together at the top,
// so the choice is made on one screen; the parts that make it up fold
// underneath (spec 2026-10-16). On desktop the answers sit side by side with
// the parts open, and a part that differs from the answer to its left is
// marked, so the columns say what the extra money buys (spec 2026-10-17).
function BuildOption({ card, open, onUse }) {
  const { option } = card
  const parts = CATEGORIES.filter((c) => option.parts[c.id])
  return (
    <section className="border-t border-line pt-4">
      <h2 className="text-sm text-muted">
        <span className="text-ink">{card.title}</span>
        {card.also && <span> · {card.also}</span>}
      </h2>
      {card.step && <p className="text-[13px] text-muted">{card.step}</p>}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="font-wide text-2xl font-extrabold text-ink lg:text-xl">
          {fpsText(option)} <span className="text-muted">·</span> £{option.total.toFixed(0)}
        </p>
        <button onClick={onUse} className={`${BTN_PRIMARY} min-h-11 rounded-xl px-4 text-sm`}>Use this build</button>
      </div>
      {card.overBudget && <p className="mt-1 text-[13px] text-bad">over budget</p>}
      <details className="mt-2" open={open}>
        <summary className="cursor-pointer py-2 text-sm text-brass">{parts.length} parts</summary>
        <ul className="pb-2 text-[13px] text-muted">
          {parts.map((c) => {
            const changed = card.changed.has(c.id)
            return (
              <li key={c.id} data-changed={changed ? 'true' : undefined}
                  className={`border-t border-line py-1.5 ${changed ? 'border-l-2 border-l-brass pl-2' : ''}`}>
                {c.label}: <span className="text-ink">{option.parts[c.id].name}</span>
              </li>
            )
          })}
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
  const desktop = useIsDesktop()
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

  const cards = shown && !shown.noData ? buildCards(shown, { budget: shown.budget, fps: shown.fps }) : []

  return (
    <div className="lg:grid lg:grid-cols-[320px_1fr] lg:gap-10">
      <div className="lg:sticky lg:top-[calc(var(--chrome-h,0px)+1.5rem)] lg:self-start">
        <h1 className="mb-4 font-wide text-3xl font-extrabold">Build for a game</h1>
        <GameSettingsFields stack />
        <div className="mt-3 flex flex-wrap items-end gap-3 lg:flex-col lg:items-stretch">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Target FPS
            <input type="number" min="1" value={fps} onChange={(e) => setFps(e.target.value)}
                   className="w-28 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink lg:w-full" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Budget (£)
            <input type="number" min="1" value={budget} onChange={(e) => setBudgetText(e.target.value)}
                   className="w-32 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink lg:w-full" />
          </label>
          <button onClick={find} disabled={!ready}
                  className={`${BTN_PRIMARY} text-sm px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed`}>
            Find builds
          </button>
        </div>
        {game && !ready && (
          <p className="mt-2 text-xs text-muted">Enter a frame rate and a budget above zero.</p>
        )}
      </div>

      {!shown && desktop && (
        <p className="mt-6 text-sm text-muted lg:mt-14">Pick a game, a frame rate and a budget, then Find builds.</p>
      )}

      {shown && (
        <div className="mt-6 flex flex-col gap-3 lg:mt-14">
          <p className="text-xs text-muted">{shown.game.name} · {shown.resolution} · {shown.preset.label} · target {shown.fps} fps</p>
          {shown.noData ? (
            <p className="text-sm text-muted">No benchmark data for {shown.game.name} at these settings yet, so there is nothing to build towards.</p>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                {/* The no-value line stands where the Middle answer would. */}
                {cards.flatMap((card) => [
                  <BuildOption key={card.kind} card={card} open={desktop} onUse={() => use(card.option)} />,
                  card.kind === 'cheapest' && shown.noValueStep && (
                    <p key="no-value" className="border-t border-line pt-4 text-sm text-muted">
                      Nothing above the cheapest build is worth the extra money.
                    </p>
                  ),
                ])}
              </div>
              {!shown.best && <p className="text-sm text-muted">No complete build fits £{shown.budget.toLocaleString('en-GB')}.</p>}
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
