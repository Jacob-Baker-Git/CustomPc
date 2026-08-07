import { blendFrameTime, cpuShare, limitedBy, applyFpsCap, msToFps } from './frameTime'
import { gpuIndexFor, cpuIndexFor, cellFor, exactFor } from './indices'
import { resolvePreset } from '../gamePresets'

// The public contract of the performance engine.
//
// Phase 1 answers ONLY where the corpus covers the exact combination, and
// returns basis "none" everywhere else. Interpolation, the perfScore prior and
// confidence scoring arrive in Phase 2; 1% lows, memory and VRAM in Phase 3.
// Shipping the honest gap first is deliberate — an engine that fills holes
// before it can say how good the filling is has no way to earn trust back.

function estimateGame({ game, model, cpu, gpu, gpuIdx, cpuIdx, resolution, presetId }) {
  const { preset, exact: presetExact } = resolvePreset(game, presetId)
  const cell = cellFor(model, game, resolution, preset.id)
  const measured = exactFor(model, { cpu, gpu, game, resolution, presetId: preset.id })

  const base = { gameId: game.id, name: game.name, preset: preset.label, presetExact }

  // The frame SPLIT always comes from the fitted model, even when the frame
  // TIME is a measurement — a measurement is a duration, not an attribution of
  // it. Without the fitted constants there is nothing to attribute with, so the
  // split is reported as unknown rather than invented.
  const modelled = cell && gpuIdx.value > 0 && cpuIdx.value > 0
    ? (() => {
        const tGpu = cell.A / gpuIdx.value
        const tCpu = (cell.B * (model.resCpuScale?.[resolution] ?? 1)) / cpuIdx.value
        const share = cpuShare(tGpu, tCpu, model.blendK)
        return { frameTimeMs: blendFrameTime(tGpu, tCpu, model.blendK), share }
      })()
    : null

  // A real measurement of this exact combination beats a model of it.
  const source = measured
    ? { ms: measured.frameTimeMs, basis: 'measured', sources: measured.sources }
    : modelled
      ? { ms: modelled.frameTimeMs, basis: 'modelled', sources: cell.sources ?? 0 }
      : null

  if (!source) {
    return { ...base, avgFps: null, frameTimeMs: null, cpuShare: null,
             limitedBy: null, atEngineCap: false, basis: 'none', sources: 0 }
  }

  const capped = applyFpsCap(source.ms, game.fpsCap)
  return {
    ...base,
    avgFps: Math.round(msToFps(capped)),
    frameTimeMs: Number(capped.toFixed(2)),
    cpuShare: modelled ? Number(modelled.share.toFixed(3)) : null,
    limitedBy: modelled ? limitedBy(modelled.share) : null,
    atEngineCap: Boolean(game.fpsCap && capped > source.ms),
    basis: source.basis,
    sources: source.sources,
  }
}

export function estimateBuildPerformance({
  parts, resolution = '1440p', presetId = 'high', gameIds, model, games,
}) {
  const cpu = parts?.cpu
  const gpu = parts?.gpu
  if (!cpu || !gpu || !model || !games) return null

  const gpuIdx = gpuIndexFor(model, gpu, resolution)
  const cpuIdx = cpuIndexFor(model, cpu)

  const selected = gameIds?.length
    ? games.filter((g) => gameIds.includes(g.id))
    : games

  const rows = selected
    .map((game) => estimateGame({ game, model, cpu, gpu, gpuIdx, cpuIdx, resolution, presetId }))
    // Covered games first, fastest first within each group. An uncovered row is
    // still shown — a silently missing game reads as a bug, not as a gap.
    .sort((a, b) => {
      if ((a.avgFps == null) !== (b.avgFps == null)) return a.avgFps == null ? 1 : -1
      return (b.avgFps ?? 0) - (a.avgFps ?? 0)
    })

  return {
    modelVersion: model.modelVersion,
    datasetVersion: model.datasetVersion,
    resolution,
    presetId,
    build: {
      cpu: { id: cpu.id, name: cpu.name },
      gpu: { id: gpu.id, name: gpu.name, vramGb: gpu.specs?.vram ?? null },
    },
    games: rows,
    coverage: {
      // Answered at all vs answered from a direct measurement of this exact
      // combination. Collapsing the two would hide the difference between
      // "we measured this" and "we derived it", which is the distinction the
      // whole engine exists to preserve.
      gamesAnswered: rows.filter((r) => r.basis !== 'none').length,
      gamesExact: rows.filter((r) => r.basis === 'measured').length,
      gamesTotal: rows.length,
      gpuBasis: gpuIdx.basis,
      cpuBasis: cpuIdx.basis,
    },
  }
}
