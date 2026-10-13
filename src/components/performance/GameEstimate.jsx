import { useMemo } from 'react'
import useBuilderStore from '../../store/useBuilderStore'
import perfModel from '../../data/perfModel.json'
import { findPreset, fpsFor, gameById } from '../../lib/gameTargetBuilder'
import GameSettingsFields from '../GameSettingsFields'
import { BASIS_LABEL, CAVEAT_TEXT } from './basisText'
import { ELEV_GROUP, TELEMETRY } from '../../lib/uiTokens'

const LIMIT = { cpu: 'the processor', gpu: 'the graphics card', balanced: 'neither — balanced' }

export default function GameEstimate() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const resolution = useBuilderStore((s) => s.resolution)
  const target = useBuilderStore((s) => s.target)
  const game = gameById(target.gameId)
  const preset = game ? findPreset(game, target.presetKey) : null
  const hasCore = Boolean(selectedParts.cpu && selectedParts.gpu)

  const row = useMemo(
    () => (hasCore && game ? fpsFor(selectedParts, game, resolution, preset, perfModel) : null),
    [hasCore, game, preset, selectedParts, resolution],
  )

  return (
    <section aria-labelledby="estimate-h" className={`mt-3 rounded-xl ${ELEV_GROUP} p-4 sm:p-5`}>
      <h2 id="estimate-h" className="text-lg text-ink mb-3">What will this build get?</h2>
      <GameSettingsFields />
      <div className="mt-4">
        {!hasCore ? (
          <p className="text-sm text-muted">Pick a CPU and a graphics card to estimate frame rates.</p>
        ) : !game ? (
          <p className="text-sm text-muted">Search for a game to see what this build gets in it.</p>
        ) : row?.avgFps == null ? (
          <p className="text-sm text-muted">
            No benchmark data for this build in {game.name} at these settings yet. We only show figures we can
            trace to a measurement or a model fitted to one, so there is no number here rather than a guess.
          </p>
        ) : (
          <div>
            <p data-testid="estimate-fps" className={`${TELEMETRY} text-4xl text-ink`}>
              {row.bound === 'upper' ? 'up to ' : ''}{row.avgFps} fps
            </p>
            {row.lowFps != null && <p className="text-sm text-muted">1% lows: {row.lowFps} fps</p>}
            <p className="text-sm text-muted">
              {row.limitedBy ? <>Held back by {LIMIT[row.limitedBy] ?? row.limitedBy}.</> : 'Which part holds it back is not modelled for this game.'}
            </p>
            <p className="mt-2 text-xs text-muted">
              Based on: {BASIS_LABEL[row.basis] ?? row.basis}.{' '}
              {row.caveats?.map((c) => CAVEAT_TEXT[c]).filter(Boolean).join(' ')}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
