import { blendFrameTime, cpuShare, limitedBy, applyFpsCap, msToFps } from './frameTime'
import { gpuIndexFor, cpuIndexFor, cellFor, exactFor } from './indices'
import { lowFrameTime } from './lows'
import { estimatePower, estimateThermals } from './power'
import { memoryProfile } from './memory'
import { bottleneckSummary } from './bottleneck'
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
  // `cell.B > 0` is checked here rather than inside cellFor: B is the CPU-side
  // constant and only the split needs it, so a cell without one is still a
  // perfectly good source of A and lowBase.
  const modelled = cell?.B > 0 && gpuIdx.value > 0 && cpuIdx.value > 0
    ? (() => {
        const tGpu = cell.A / gpuIdx.value
        const tCpu = (cell.B * (model.resCpuScale?.[resolution] ?? 1)) / cpuIdx.value
        const share = cpuShare(tGpu, tCpu, model.blendK)
        return { frameTimeMs: blendFrameTime(tGpu, tCpu, model.blendK), share, tGpu, tCpu }
      })()
    : null

  // A real measurement of this exact combination beats a model of it.
  const source = measured
    ? { ms: measured.frameTimeMs, basis: 'measured', sources: measured.sources }
    : modelled
      ? { ms: modelled.frameTimeMs, basis: 'modelled', sources: cell.sources ?? 0 }
      : null

  if (!source) {
    return { ...base, avgFps: null, lowFps: null, frameTimeMs: null,
             lowFrameTimeMs: null, lowBasis: 'none', cpuShare: null,
             limitedBy: null, atEngineCap: false, basis: 'none', sources: 0 }
  }

  const capped = applyFpsCap(source.ms, game.fpsCap)
  const avgFps = Math.round(msToFps(capped))

  // The stutter number. Modelled off the average frame time and the CPU share,
  // so it exists wherever the average does. An engine cap floors it too — a
  // locked game cannot stutter above its own lock.
  const low = lowFrameTime(capped, { cell, cpuShare: modelled?.share ?? null, model })
  const lowCapped = low.lowMs == null ? null : applyFpsCap(low.lowMs, game.fpsCap)

  // "the reported rate sits at the engine's ceiling", NOT "flooring changed the
  // number". Those agree everywhere except exactly at the cap — which is the
  // likeliest real reading there is for a hard-locked game, since a reviewer
  // benchmarking a rock-solid 60 fps lock records exactly 60. Comparing frame
  // times instead reported false in precisely that case.
  //
  // It also does the disclosure work for a measured row the cap binds: the
  // number shown is then the ceiling rather than the raw reading, and this is
  // what says so.
  const atEngineCap = Boolean(game.fpsCap && avgFps >= game.fpsCap)

  return {
    ...base,
    avgFps,
    lowFps: lowCapped == null ? null : Math.round(msToFps(lowCapped)),
    frameTimeMs: Number(capped.toFixed(2)),
    lowFrameTimeMs: lowCapped == null ? null : Number(lowCapped.toFixed(2)),
    lowBasis: low.basis,
    cpuShare: modelled ? Number(modelled.share.toFixed(3)) : null,
    limitedBy: modelled ? limitedBy(modelled.share) : null,
    // What each side could deliver ALONE, if the other were infinitely fast.
    // The gap between them is the bottleneck, in the units people think in.
    gpuOnlyFps: modelled ? Math.round(msToFps(modelled.tGpu)) : null,
    cpuOnlyFps: modelled ? Math.round(msToFps(modelled.tCpu)) : null,
    atEngineCap,
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

  // Mean CPU share across the rows that have one. Feeds the power model, which
  // draws less from the graphics card when the CPU is setting the pace. With no
  // frame data at all it stays null and power falls back to a neutral split —
  // the power figures do not depend on the benchmark corpus, and must not start
  // depending on it.
  const shares = rows.map((r) => r.cpuShare).filter((s) => s != null)
  const meanCpuShare = shares.length
    ? shares.reduce((a, b) => a + b, 0) / shares.length
    : null

  return {
    modelVersion: model.modelVersion,
    datasetVersion: model.datasetVersion,
    resolution,
    presetId,
    power: estimatePower(parts, meanCpuShare ?? 0.5),
    thermals: estimateThermals(parts),
    memory: memoryProfile(parts),
    // null until the corpus covers at least one game — a bottleneck verdict
    // with no measured frames behind it is the guess this engine exists to
    // avoid, and every FPS calculator on the internet already sells it.
    bottleneck: bottleneckSummary(rows),
    meanCpuShare,
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
      // The fit copies the 1440p GPU index into any resolution with no data of
      // its own. That is a reasonable fallback and a terrible thing to leave
      // silent: the row still says basis "measured", so without this the UI
      // would present a 4K figure derived from a 1440p measurement exactly as
      // it presents a real one. `indices.js` has computed this since the
      // beginning and nothing consumed it.
      gpuResolutionCopied: gpuIdx.resolutionCopied,
    },
  }
}
