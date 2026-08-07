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

// No single outlet may dominate: the licensing position rests on nobody's
// compilation being substantially taken.
const SOURCE_SHARE_WARN = 0.15
const SOURCE_SHARE_FAIL = 0.20

// The share cap alone is unsatisfiable on a young corpus: with N evenly-split
// outlets each holds 1/N, so nothing under FIVE sources can ever clear 20% and
// the very first curation session would fail the build with perfectly good
// data. Two absolute escapes, because what the law actually cares about is
// whether a substantial part of somebody's compilation was taken — and twelve
// figures is not substantial however large a share of a small corpus it is:
//
//   · below CONCENTRATION_MIN_CORPUS total entries, share is not meaningful
//     enough to act on at all
//   · a source holding fewer than SOURCE_MIN_ABSOLUTE entries is never a
//     substantial taking, whatever its share
const CONCENTRATION_MIN_CORPUS = 40
const SOURCE_MIN_ABSOLUTE = 15

const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'))
const write = (rel, data) =>
  writeFileSync(fileURLToPath(new URL(rel, import.meta.url)),
                `${JSON.stringify(data, null, 2)}\n`)

const sources = read('../data/benchmarks/sources.json')
const entries = read('../data/benchmarks/entries.json')
const validation = read('../data/benchmarks/validation.json')
const parts = read('../src/data/partsData.json')

const sourceById = new Map(sources.map((s) => [s.id, s]))
const live = entries.filter((e) => !e.supersededBy)

// --- source concentration -------------------------------------------------
const perSource = new Map()
for (const e of live) perSource.set(e.sourceId, (perSource.get(e.sourceId) ?? 0) + 1)
const warnings = []
if (live.length >= CONCENTRATION_MIN_CORPUS) {
  for (const [id, n] of perSource) {
    const share = n / live.length
    if (n < SOURCE_MIN_ABSOLUTE) continue
    if (share > SOURCE_SHARE_FAIL) {
      console.error(`FAIL: source ${id} is ${(share * 100).toFixed(1)}% of the corpus ` +
                    `(${n} of ${live.length} entries, cap ${SOURCE_SHARE_FAIL * 100}%). ` +
                    `Add entries from other outlets.`)
      process.exit(1)
    }
    if (share > SOURCE_SHARE_WARN) {
      warnings.push(`source ${id} is ${(share * 100).toFixed(1)}% of the corpus`)
    }
  }
} else if (live.length > 0) {
  warnings.push(`corpus is only ${live.length} entries — the per-source ` +
                `concentration cap does not apply below ${CONCENTRATION_MIN_CORPUS}`)
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
      cellKey: `${e.gameId}|${e.presetId}`,
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
    cellKey: `${e.gameId}|${e.presetId}`,
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
    const [gameId, presetId] = cellKey.split('|')
    gameConst[gameId] ??= {}
    gameConst[gameId][res] ??= {}
    gameConst[gameId][res][presetId] = {
      ...(gameConst[gameId][res][presetId] ?? {}),
      A: round(A, 2),
      ...cellStats(live, gameId, res, presetId),
    }
  }
}
for (const [cellKey, B] of cpuFit.cellConst) {
  if (!cpuFit.connectedCells.has(cellKey)) {
    droppedDisconnected.push({ kind: 'cpu-cell', res: null, cellKey })
    continue
  }
  const [gameId, presetId] = cellKey.split('|')
  for (const res of RESOLUTIONS) {
    gameConst[gameId] ??= {}
    gameConst[gameId][res] ??= {}
    gameConst[gameId][res][presetId] = {
      ...(gameConst[gameId][res][presetId] ?? {}), B: round(B, 2),
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
  const key = `${e.cpuId}|${e.gpuId}|${e.gameId}|${e.resolution}|${e.presetId}`
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

// Source count and spread for a cell — the honest measure of how much the
// outlets disagree, which feeds the confidence score in Phase 2.
function cellStats(rows, gameId, res, presetId) {
  const inCell = rows.filter((e) =>
    e.gameId === gameId && e.resolution === res && e.presetId === presetId)
  const sourceCount = new Set(inCell.map((e) => e.sourceId)).size
  if (inCell.length < 2) return { sources: sourceCount, cv: null }
  const fps = inCell.map((e) => e.avgFps)
  const mean = fps.reduce((a, b) => a + b, 0) / fps.length
  const sd = Math.sqrt(fps.reduce((s, f) => s + (f - mean) ** 2, 0) / (fps.length - 1))
  return { sources: sourceCount, cv: round(sd / mean, 4) }
}
