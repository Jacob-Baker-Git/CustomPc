import { blendFrameTime, cpuShare, limitedBy, applyFpsCap, msToFps } from './frameTime'
import { gpuIndexFor, cpuIndexFor, cellFor, exactFor } from './indices'
import { lowFrameTime } from './lows'
import { estimatePower, estimateThermals } from './power'
import { memoryProfile } from './memory'
import { bottleneckSummary } from './bottleneck'
import { presetsFor } from '../gamePresets'

// The public contract of the performance engine.
//
// Phase 1 answers ONLY where the corpus covers the exact combination, and
// returns basis "none" everywhere else. Interpolation, the perfScore prior and
// confidence scoring arrive in Phase 2; 1% lows, memory and VRAM in Phase 3.
// Shipping the honest gap first is deliberate — an engine that fills holes
// before it can say how good the filling is has no way to earn trust back.

function estimateGame({ game, preset, requestedPresetId, model, cpu, gpu, gpuIdx, cpuIdx, resolution }) {
  const cell = cellFor(model, game, resolution, preset.id, preset.upscaling)
  const measured = exactFor(model, {
    cpu, gpu, game, resolution, presetId: preset.id, upscaling: preset.upscaling,
  })

  const base = {
    // One row per game, preset AND render scale, so the row needs its own key —
    // two presets of one game are two different measurements, and so are a
    // native and an upscaled run of the same preset. React needs to tell all of
    // them apart.
    rowId: `${game.id}|${preset.id}|${preset.upscaling}`,
    gameId: game.id,
    name: game.name,
    preset: preset.label,
    presetId: preset.id,
    presetTier: preset.tier,
    // Carried so the UI can label the scale without re-deriving it from the
    // label string it was baked into.
    upscaling: preset.upscaling,
    // Whether THIS row is the preset the caller asked for. Every row is now an
    // exact preset of its own, so this reports which one was requested rather
    // than whether a fallback happened.
    presetExact: preset.id === requestedPresetId,
  }

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

  // EVERY preset the corpus holds for a game gets a row, rather than one row per
  // game at a single chosen preset.
  //
  // The old shape asked resolvePreset for one preset and threw the rest away,
  // which quietly made coverage depend on which preset happened to be asked for:
  // once the game list carried real preset names, asking for "high" found an
  // exact match on the Notebookcheck rows — which are concentrated at 1080p —
  // and dropped the ComputerBase 1440p/4K rows measured at "Sehr hoch". Coverage
  // at 1440p fell from 8 games to 3 without a single measurement changing.
  // Reporting every preset removes the choice, and the caller can narrow later.
  const rows = []
  for (const game of selected) {
    for (const preset of presetsFor(game)) {
      rows.push(estimateGame({
        game, preset, requestedPresetId: presetId, model, cpu, gpu, gpuIdx, cpuIdx, resolution,
      }))
    }
  }

  // Answered first; then games ordered by their best result, so the fastest game
  // still leads; then a game's own presets together, heaviest first. Grouping by
  // game matters now that one game owns several rows — sorting purely on frame
  // rate would scatter a game's Low and Ultra rows to opposite ends of the list.
  const bestFps = new Map()
  for (const r of rows) {
    if (r.avgFps == null) continue
    bestFps.set(r.gameId, Math.max(bestFps.get(r.gameId) ?? 0, r.avgFps))
  }
  rows.sort((a, b) => {
    if ((a.avgFps == null) !== (b.avgFps == null)) return a.avgFps == null ? 1 : -1
    const ga = bestFps.get(a.gameId) ?? 0
    const gb = bestFps.get(b.gameId) ?? 0
    if (ga !== gb) return gb - ga
    if (a.gameId !== b.gameId) return a.gameId.localeCompare(b.gameId)
    return (b.presetTier ?? 0) - (a.presetTier ?? 0)
  })

  // The bottleneck reads one row per GAME, not per preset. Feeding it every
  // preset would weight a game by how many presets somebody benchmarked, so a
  // title measured at four settings would count four times toward "processor-
  // limited in N of M games". Heaviest answered preset per game.
  const perGame = new Map()
  for (const r of rows) {
    if (r.basis === 'none') continue
    const held = perGame.get(r.gameId)
    if (!held || (r.presetTier ?? 0) > (held.presetTier ?? 0)) perGame.set(r.gameId, r)
  }
  const gameRows = [...perGame.values()]

  // Mean CPU share across the rows that have one. Feeds the power model, which
  // draws less from the graphics card when the CPU is setting the pace. With no
  // frame data at all it stays null and power falls back to a neutral split —
  // the power figures do not depend on the benchmark corpus, and must not start
  // depending on it.
  // Averaged over GAMES, not over preset rows, for the same reason the
  // bottleneck is: a game benchmarked at four presets would otherwise pull the
  // build's power figure four times as hard as one benchmarked at a single
  // setting, and the power model has no business depending on how thorough a
  // reviewer was.
  const shares = gameRows.map((r) => r.cpuShare).filter((s) => s != null)
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
    bottleneck: bottleneckSummary(gameRows),
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
      //
      // Counted in GAMES, while `games` above is one row per game AND preset.
      // "19 of 22 games answered" is what a reader wants; "43 of 78 rows" counts
      // how many settings a reviewer happened to test, which is a fact about the
      // reviewer. The row-level totals are reported separately for the UI.
      gamesAnswered: new Set(rows.filter((r) => r.basis !== 'none').map((r) => r.gameId)).size,
      gamesExact: new Set(rows.filter((r) => r.basis === 'measured').map((r) => r.gameId)).size,
      gamesTotal: selected.length,
      rowsAnswered: rows.filter((r) => r.basis !== 'none').length,
      rowsExact: rows.filter((r) => r.basis === 'measured').length,
      rowsTotal: rows.length,
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
