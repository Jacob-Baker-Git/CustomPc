// Fits the benchmark corpus into src/data/perfModel.json.
//
//   npm run perf:fit
//
// Runs at BUILD time, never in the browser: the client ships the small fitted
// artefact, not the raw corpus. That keeps the corpus auditable in the repo,
// makes every constant diffable in review, and lets a bad data drop fail the
// build instead of reaching a user.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fitTwoWay } from '../src/lib/perfEngine/fitTwoWay.js'
import { concentration } from '../src/lib/perfEngine/concentration.js'
import { fitArchEfficiency } from '../src/lib/perfEngine/archEfficiency.js'

const MODEL_VERSION = '1.0.0'
const RESOLUTIONS = ['1080p', '1440p', '4k']

// GPU-scaling reviews use a top-end CPU, so at these resolutions the CPU term is
// small enough to ignore for the GPU fit. 1080p is deliberately excluded from
// the GPU fit for the opposite reason — there the CPU is doing the limiting.
const GPU_FIT_RESOLUTIONS = ['1440p', '4k']

// Illustrative starting value. Pass 4 (Phase 3) fits it against the crossover
// measurements; until then it is declared, not discovered, and the artefact
// records which.
const DEFAULT_BLEND_K = 5.1
const DEFAULT_RES_CPU_SCALE = { '1080p': 1.0, '1440p': 1.012, '4k': 1.031 }

// Source concentration is MEASURED AND REPORTED, not gated.
//
// This used to be a hard 20%-of-corpus cap per source, and it failed the build
// the moment real data arrived: one ComputerBase review supplied 74% of 216
// entries, so 216 genuine measurements sat unused and the Performance tab kept
// answering a single game. Two problems with that as a rule:
//
//   · it was applied per REVIEW while appealing to not taking one OUTLET's
//     compilation, so two articles from the same outlet read as two independent
//     sources and ComputerBase's real 80% presented itself as 74%;
//   · a share cap can be satisfied by taking MORE from everybody, which reduces
//     nobody's taking. Growing the corpus to 800 rows would have made the same
//     160 look acceptable.
//
// The deliberate decision (2026-08-10) is to accept any VALID data while the
// corpus is being built, because measurements for an individual part are hard to
// come by, and to dilute or corroborate once there is a complete set. Validity is
// still enforced everywhere it was — a row missing an upscaling mode, a part that
// cannot be mapped, or a low that contradicts its own minimum is still rejected.
// What is gone is only the refusal to run.
//
// The imbalance is written into the artefact (sourceConcentration) so the
// dilution work is driven by a number rather than by somebody remembering.
const OUTLET_SHARE_NOTE = 0.20

const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'))
const write = (rel, data) =>
  writeFileSync(fileURLToPath(new URL(rel, import.meta.url)),
                `${JSON.stringify(data, null, 2)}\n`)

const sources = read('../data/benchmarks/sources.json')
const entries = read('../data/benchmarks/entries.json')
const validation = read('../data/benchmarks/validation.json')
const parts = read('../src/data/partsData.json')
const gpuSpecs = read('../data/specs/gpuSpecs.json')

const sourceById = new Map(sources.map((s) => [s.id, s]))
const live = entries.filter((e) => !e.supersededBy)

// --- source concentration -------------------------------------------------
const spread = concentration(entries, sources)
const warnings = []
for (const o of spread.byOutlet) {
  if (o.share > OUTLET_SHARE_NOTE) {
    warnings.push(`${o.outlet} supplies ${(o.share * 100).toFixed(1)}% of the corpus ` +
                  `(${o.entries} of ${spread.total} entries, from ${o.sources.length} ` +
                  `review${o.sources.length === 1 ? '' : 's'}) — dilute when data allows`)
  }
}

// --- pass 1: GPU index, one fit per resolution ----------------------------
// Each resolution is fitted separately but anchored to the SAME card, so the
// three numbers stay comparable. Anchoring each independently would make
// "31.0 at 1080p, 27.4 at 4K" meaningless.
const gpuEntries = live.filter((e) =>
  sourceById.get(e.sourceId)?.kind === 'gpu-scaling' &&
  GPU_FIT_RESOLUTIONS.includes(e.resolution))

const anchorGpuId = mostCommon(gpuEntries.map((e) => e.gpuId))
const gpuFits = {}
for (const res of RESOLUTIONS) {
  const inRes = gpuEntries.filter((e) => e.resolution === res)
  gpuFits[res] = fitTwoWay(
    inRes.map((e) => ({
      // Upscaling is part of the cell because it is part of the measurement.
      // Without it an A fitted from DLSS-Quality rows pairs with a B fitted from
      // native rows and the blend describes neither. indices.js builds the same
      // key with cellKeyFor — a mismatch between the two is SILENT.
      cellKey: `${e.gameId}|${e.presetId}|${e.upscaling}`,
      partKey: e.gpuId,
      logT: Math.log(1000 / e.avgFps),
      weight: e.weight ?? 1,
    })),
    { anchorPartKey: anchorGpuId, anchorValue: 100 },
  )
}

// --- pass 2: CPU index ----------------------------------------------------
// CPU-scaling reviews run a top-end GPU at 1080p. The GPU term is small but not
// zero, so where pass 1 can price it the p-norm is inverted to subtract it.
//
// ⚠️ In the STANDARD workflow that subtraction does not fire. Pass 1 skips
// 1080p (the CPU contaminates it), so there is no fitted cell constant at
// 1080p to price the GPU term with, and `gpuFrameTime` returns null — the CPU
// index simply absorbs the small GPU term instead. That is a known Phase 1
// approximation, not an accident: within one review the absorbed term is a
// constant that lands in B, so it does not distort CPU-to-CPU ratios; across
// reviews using different test GPUs it introduces a few percent. The
// subtraction path below is live only for the atypical case of a cpu-scaling
// entry at a resolution pass 1 did fit. Phase 2 closes this properly.
const cpuEntries = live.filter((e) => sourceById.get(e.sourceId)?.kind === 'cpu-scaling')
const k = DEFAULT_BLEND_K
const cpuObs = []
const droppedGpuBound = []
for (const e of cpuEntries) {
  const tObs = 1000 / e.avgFps
  const tGpu = gpuFrameTime(e)
  let tCpu = tObs
  if (tGpu != null) {
    const residual = Math.pow(tObs, k) - Math.pow(tGpu, k)
    if (residual <= 0) {
      // The entry is GPU-bound: it carries no CPU signal at all. Clamping it to
      // zero would invent one, so drop it and say so in the diagnostics.
      droppedGpuBound.push(e.id)
      continue
    }
    tCpu = Math.pow(residual, 1 / k)
  }
  cpuObs.push({
    cellKey: `${e.gameId}|${e.presetId}|${e.upscaling}`,
    partKey: e.cpuId,
    logT: Math.log(tCpu / (DEFAULT_RES_CPU_SCALE[e.resolution] ?? 1)),
    weight: e.weight ?? 1,
  })
}
const anchorCpuId = mostCommon(cpuEntries.map((e) => e.cpuId))
const cpuFit = fitTwoWay(cpuObs, { anchorPartKey: anchorCpuId, anchorValue: 100 })

// --- assemble the artefact -----------------------------------------------
// A part outside the anchor's connected component has no measurement relating
// its scale to the anchor's — fitTwoWay hands back a number for it anyway, and
// that number is an artefact of the initialisation, not data. Drop those parts
// entirely: the engine then reports "no benchmark data" for them, which is
// true, instead of a fabricated index that looks exactly like a real one.
const droppedDisconnected = []
const gpuIndex = {}
for (const res of RESOLUTIONS) {
  const usable = gpuFits[res].connected
  for (const gpuId of gpuFits[res].disconnected) {
    droppedDisconnected.push({ kind: 'gpu', res, partId: gpuId })
  }
  for (const [gpuId, value] of gpuFits[res].index) {
    if (!usable.has(gpuId)) continue
    gpuIndex[gpuId] ??= { basis: 'measured', anchors: 0 }
    gpuIndex[gpuId][res] = round(value, 2)
  }
}
for (const gpuId of Object.keys(gpuIndex)) {
  gpuIndex[gpuId].anchors = gpuEntries.filter((e) => e.gpuId === gpuId).length
  // A resolution with no data of its own copies 1440p, and records that it did
  // so — the copy costs confidence later rather than passing as a measurement.
  const copied = []
  for (const res of RESOLUTIONS) {
    if (gpuIndex[gpuId][res] == null && gpuIndex[gpuId]['1440p'] != null) {
      gpuIndex[gpuId][res] = gpuIndex[gpuId]['1440p']
      copied.push(res)
    }
  }
  if (copied.length) gpuIndex[gpuId].copiedResolutions = copied
}

const cpuIndex = {}
for (const cpuId of cpuFit.disconnected) {
  droppedDisconnected.push({ kind: 'cpu', res: null, partId: cpuId })
}
for (const [cpuId, value] of cpuFit.index) {
  if (!cpuFit.connected.has(cpuId)) continue
  cpuIndex[cpuId] = {
    value: round(value, 2), basis: 'measured',
    anchors: cpuEntries.filter((e) => e.cpuId === cpuId).length,
  }
}

// Cells get the same treatment as parts. A cell measured only by parts outside
// the anchor's component was fitted in that component's own arbitrary gauge, so
// its constant is not comparable with a properly anchored index — pairing the
// two would rebuild the fabricated number the part filter exists to stop, one
// level up. Dropping the cell makes the engine say "no data" for that game,
// which is the truth.
const gameConst = {}
for (const res of RESOLUTIONS) {
  for (const [cellKey, A] of gpuFits[res].cellConst) {
    if (!gpuFits[res].connectedCells.has(cellKey)) {
      droppedDisconnected.push({ kind: 'gpu-cell', res, cellKey })
      continue
    }
    const [gameId, presetId, upscaling] = cellKey.split('|')
    const leaf = `${presetId}|${upscaling}`
    gameConst[gameId] ??= {}
    gameConst[gameId][res] ??= {}
    gameConst[gameId][res][leaf] = {
      ...(gameConst[gameId][res][leaf] ?? {}),
      A: round(A, 2),
      ...cellStats(live, gameId, res, presetId, upscaling),
      ...lowBaseFor(live, gameId, res, presetId, upscaling),
    }
  }
}
for (const [cellKey, B] of cpuFit.cellConst) {
  if (!cpuFit.connectedCells.has(cellKey)) {
    droppedDisconnected.push({ kind: 'cpu-cell', res: null, cellKey })
    continue
  }
  const [gameId, presetId, upscaling] = cellKey.split('|')
  const leaf = `${presetId}|${upscaling}`
  for (const res of RESOLUTIONS) {
    gameConst[gameId] ??= {}
    gameConst[gameId][res] ??= {}
    gameConst[gameId][res][leaf] = {
      ...(gameConst[gameId][res][leaf] ?? {}), B: round(B, 2),
    }
  }
}

// --- exact-match table ----------------------------------------------------
// A combination that was actually measured should return the measurement, not
// a model of it. The raw corpus never reaches the browser, so the exact rows
// have to ride in the artefact. Where several sources measured the same
// combination they are averaged in FRAME TIME, not in fps — averaging fps
// weights the fast source too heavily.
const exactGroups = {}
for (const e of live) {
  // Must stay identical to exactKey in indices.js, including the upscaling tail.
  // A mismatch is silent: the table simply never hits, and every combination
  // somebody actually measured quietly falls through to the modelled path.
  const key = `${e.cpuId}|${e.gpuId}|${e.gameId}|${e.resolution}|${e.presetId}|${e.upscaling}`
  ;(exactGroups[key] ??= []).push(e)
}
const exact = {}
for (const [key, rows] of Object.entries(exactGroups)) {
  const totalWeight = rows.reduce((s, r) => s + (r.weight ?? 1), 0)
  const meanMs =
    rows.reduce((s, r) => s + (r.weight ?? 1) * (1000 / r.avgFps), 0) / totalWeight
  exact[key] = {
    frameTimeMs: round(meanMs, 4),
    sources: new Set(rows.map((r) => r.sourceId)).size,
    entries: rows.length,
  }
}

// --- arch efficiency -------------------------------------------------------
// The per-architecture correction the spec-derived capability index needs. Fitted
// here rather than hand-written in capability.js so it cannot drift from the
// corpus it came from, and so growing the corpus re-derives it for free.
const archEfficiency = fitArchEfficiency({ gpuIndex, gpuSpecs })
if (archEfficiency.calibrated.length) {
  console.log(`ARCH_EFFICIENCY fitted against ${archEfficiency.reference} = 1.0: ` +
    archEfficiency.calibrated.map((a) =>
      `${a} ${archEfficiency.byArch[a].efficiency} (n=${archEfficiency.byArch[a].parts}, ` +
      `spread ${archEfficiency.byArch[a].spreadPct}%)`).join(', '))
}
if (archEfficiency.uncalibrated.length) {
  warnings.push(`architectures with fewer than ${archEfficiency.minParts} measured parts stay ` +
                `uncalibrated at 1.0: ${archEfficiency.uncalibrated.join(', ')}`)
}

const model = {
  modelVersion: MODEL_VERSION,
  datasetVersion: new Date().toISOString().slice(0, 10),
  fittedAt: new Date().toISOString(),
  entryCount: live.length,
  sourceCount: sources.length,
  blendK: DEFAULT_BLEND_K,
  blendKBasis: 'default',        // becomes 'fitted' in Phase 3
  resCpuScale: DEFAULT_RES_CPU_SCALE,
  anchors: { gpu: anchorGpuId ?? null, cpu: anchorCpuId ?? null },
  gpuIndex,
  cpuIndex,
  gameConst,
  exact,
  // Per-architecture correction for the spec-derived capability index, with the
  // part count and spread behind each value. Shipped to the client because
  // capability.js needs it at render time; architectures below the minimum stay
  // at exactly 1.0 and are listed as uncalibrated rather than omitted.
  archEfficiency,
}

write('../src/data/perfModel.json', model)
write('../src/data/perfModel.report.json', {
  fittedAt: model.fittedAt,
  warnings,
  gpuFit: Object.fromEntries(RESOLUTIONS.map((r) =>
    [r, { iterations: gpuFits[r].iterations, converged: gpuFits[r].converged,
          parts: gpuFits[r].index.size }])),
  cpuFit: { iterations: cpuFit.iterations, converged: cpuFit.converged,
            parts: cpuFit.index.size },
  droppedGpuBound,
  // Parts the corpus cannot relate to the anchor. A long list means the corpus
  // has split into islands — usually because a batch of entries shares no game
  // with anything already in it. The fix is data, not code: add one review
  // covering a game and a part both islands already have.
  droppedDisconnected,
  coverage: {
    gpusMeasured: Object.keys(gpuIndex).length,
    gpusTotal: parts.filter((p) => p.category === 'gpu').length,
    cpusMeasured: Object.keys(cpuIndex).length,
    cpusTotal: parts.filter((p) => p.category === 'cpu').length,
  },
  // How lopsided the corpus is, by outlet and by review. Recorded rather than
  // enforced: the corpus takes any valid data while it is being built and gets
  // diluted once there is a complete set, so this is the number that says how
  // much dilution is still owed and which outlet owes it.
  sourceConcentration: {
    total: spread.total,
    topOutlet: spread.topOutlet,
    topOutletShare: spread.topOutletShare == null ? null : round(spread.topOutletShare, 4),
    byOutlet: spread.byOutlet.map((o) => ({
      outlet: o.outlet, entries: o.entries, share: round(o.share, 4), reviews: o.sources.length,
    })),
  },
  // Populated in Phase 2, once there is enough corpus to hold data back.
  validation: { n: validation.length, mapeAvg: null, mapeLow: null },
})

for (const w of warnings) console.warn(`WARN: ${w}`)
console.log(`Fitted ${live.length} entries from ${sources.length} sources -> ` +
            `${Object.keys(gpuIndex).length} GPU indices, ` +
            `${Object.keys(cpuIndex).length} CPU indices.`)
if (live.length === 0) {
  console.log('The corpus is empty. The model is a valid empty artefact — the ' +
              'engine reports "not enough data" rather than guessing.')
}

// --- helpers --------------------------------------------------------------

function round(n, dp) { return Number(n.toFixed(dp)) }

function mostCommon(values) {
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = null
  for (const [v, n] of counts) if (best == null || n > counts.get(best)) best = v
  return best
}

function gpuFrameTime(entry) {
  const idx = gpuFits[entry.resolution]?.index.get(entry.gpuId)
  const A = gpuFits[entry.resolution]?.cellConst.get(`${entry.gameId}|${entry.presetId}`)
  return idx > 0 && A > 0 ? A / idx : null
}

// The 1% low, as a RATIO of the average frame time rather than an absolute.
// Reviews publish avg and 1% low together, and the ratio between them is far
// more stable across hardware than either number is on its own — which is what
// makes it interpolable at all.
//
// Only `lowKind: '1%'` counts. A 0.1% low and a hard minimum are different
// statistics measuring different things, and averaging them together would
// produce a figure describing none of them.
// ⚠️ Filters on upscaling as well as preset. Without it the cell key separates
// the render scales and then this pools them straight back together, so an
// upscaled run's stutter ratio would be averaged into the native cell's lowBase.
function lowBaseFor(rows, gameId, res, presetId, upscaling) {
  const withLows = rows.filter((e) =>
    e.gameId === gameId && e.resolution === res && e.presetId === presetId &&
    e.upscaling === upscaling &&
    e.lowKind === '1%' && e.lowFps > 0 && e.avgFps > 0)
  if (withLows.length === 0) return {}

  let totalWeight = 0
  let total = 0
  for (const e of withLows) {
    const w = e.weight ?? 1
    totalWeight += w
    total += w * (e.avgFps / e.lowFps)   // ratio of frame TIMES, inverted fps
  }
  return { lowBase: round(total / totalWeight, 4), lowSources: withLows.length }
}

// Source count and spread for a cell — the honest measure of how much the
// outlets disagree, which feeds the confidence score in Phase 2.
function cellStats(rows, gameId, res, presetId, upscaling) {
  const inCell = rows.filter((e) =>
    e.gameId === gameId && e.resolution === res && e.presetId === presetId &&
    e.upscaling === upscaling)
  const sourceCount = new Set(inCell.map((e) => e.sourceId)).size
  if (inCell.length < 2) return { sources: sourceCount, cv: null }
  const fps = inCell.map((e) => e.avgFps)
  const mean = fps.reduce((a, b) => a + b, 0) / fps.length
  const sd = Math.sqrt(fps.reduce((s, f) => s + (f - mean) ** 2, 0) / (fps.length - 1))
  return { sources: sourceCount, cv: round(sd / mean, 4) }
}
