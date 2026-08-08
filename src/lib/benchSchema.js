// Validators for the hand-curated benchmark corpus.
//
// Pure and dependency-free so the curation harness (scripts/add-bench-entry.mjs)
// and the integrity test can share exactly one definition of "valid". A rule
// enforced in only one of those two places is a rule that leaks.

// 720p is a MEASUREMENT resolution, not a display one. CPU-scaling reviews run
// there deliberately: the point is to remove the graphics card as a limit so
// the processors separate, and at 1080p on a 4090 half the field is still GPU-
// bound. The engine never quotes a 720p figure — fit-perf-model.mjs keeps its
// own display list — but the corpus has to be able to record what was actually
// measured. Relabelling a 720p run as 1080p to fit the old list would be
// falsifying the measurement to satisfy a validator.
export const RESOLUTIONS = ['720p', '1080p', '1440p', '4k']
export const SOURCE_KINDS = ['gpu-scaling', 'cpu-scaling', 'pair', 'memory-scaling']
export const LOW_KINDS = ['1%', '0.1%', 'min']

// Upsampling is not a detail — it is most of the frame rate. A card rendering
// at 66% of 1440p and upscaling is doing roughly half the pixel work of one
// running native, so mixing the two produces an index that describes neither.
//
// Modern review parcours enable it BY DEFAULT and vary it per game, which is
// what makes this mandatory rather than optional: the numbers look identical in
// a table and are not comparable. Vendor-neutral on purpose — DLSS Quality,
// FSR Quality and XeSS Quality all render at the same fraction, and the fit
// cares about the fraction, not whose marketing name is on it.
export const UPSCALING = ['native', 'ultra-quality', 'quality', 'balanced', 'performance']

// Nothing renders faster than this, and nothing playable is slower. A figure
// outside the range is a transcription error, not a measurement.
const FPS_MIN = 1
const FPS_MAX = 2000

const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isHttpUrl = (v) => typeof v === 'string' && /^https?:\/\/\S+$/.test(v)
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0

// Type-check before range-checking. `"200" >= 1` is true in JavaScript, so a
// bare comparison waves through a hand-typed string — which is precisely the
// mistake this schema exists to catch at 11pm on entry number forty.
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v)
const inRange = (v, lo, hi) => isNumber(v) && v >= lo && v <= hi

export function validateSource(source) {
  const p = []
  const at = source?.id ?? '(no id)'
  if (!nonEmpty(source?.id)) p.push(`${at}: id is required`)
  if (!nonEmpty(source?.outlet)) p.push(`${at}: outlet is required`)
  if (!nonEmpty(source?.title)) p.push(`${at}: title is required`)
  if (!isHttpUrl(source?.url)) p.push(`${at}: url must be an http(s) URL`)
  if (!isIsoDate(source?.published)) p.push(`${at}: published must be YYYY-MM-DD`)
  if (!isIsoDate(source?.accessed)) p.push(`${at}: accessed must be YYYY-MM-DD`)
  if (!SOURCE_KINDS.includes(source?.kind)) {
    p.push(`${at}: kind must be one of ${SOURCE_KINDS.join(', ')}`)
  }
  // The test system is what makes two sources comparable at all. Without it a
  // measurement is a number with no context and cannot be normalised.
  const ts = source?.testSystem
  if (!ts || typeof ts !== 'object') p.push(`${at}: testSystem is required`)
  else {
    if (!nonEmpty(ts.cpu)) p.push(`${at}: testSystem.cpu is required`)
    if (!ts.ram || typeof ts.ram !== 'object') p.push(`${at}: testSystem.ram is required`)
    else if (!(isNumber(ts.ram.speed) && ts.ram.speed > 0)) {
      p.push(`${at}: testSystem.ram.speed must be a positive number (MT/s)`)
    }
  }
  return p
}

export function validateEntry(entry, { sourceIds, partIds, gameIds }) {
  const p = []
  const at = entry?.id ?? '(no id)'
  if (!nonEmpty(entry?.id)) p.push(`${at}: id is required`)
  if (!sourceIds.has(entry?.sourceId)) p.push(`${at}: unknown sourceId ${entry?.sourceId}`)
  if (!gameIds.has(entry?.gameId)) p.push(`${at}: unknown gameId ${entry?.gameId}`)
  if (!partIds.has(entry?.gpuId)) p.push(`${at}: unknown gpuId ${entry?.gpuId}`)
  if (!partIds.has(entry?.cpuId)) p.push(`${at}: unknown cpuId ${entry?.cpuId}`)
  if (!RESOLUTIONS.includes(entry?.resolution)) {
    p.push(`${at}: resolution must be one of ${RESOLUTIONS.join(', ')}`)
  }
  if (!nonEmpty(entry?.presetId)) p.push(`${at}: presetId is required`)
  if (!UPSCALING.includes(entry?.upscaling)) {
    p.push(`${at}: upscaling must be one of ${UPSCALING.join(', ')} — ` +
           `an upscaled frame rate is not a native one`)
  }
  if (!inRange(entry?.avgFps, FPS_MIN, FPS_MAX)) {
    p.push(`${at}: avgFps must be a number between ${FPS_MIN} and ${FPS_MAX}`)
  }
  if (entry?.lowFps != null) {
    if (!inRange(entry.lowFps, FPS_MIN, FPS_MAX)) {
      p.push(`${at}: lowFps must be a number between ${FPS_MIN} and ${FPS_MAX}`)
    } else if (entry.lowFps > entry.avgFps) {
      p.push(`${at}: lowFps ${entry.lowFps} is above avgFps ${entry.avgFps}`)
    }
    if (!LOW_KINDS.includes(entry.lowKind)) {
      p.push(`${at}: lowKind must be one of ${LOW_KINDS.join(', ')} when lowFps is present`)
    }
  }
  if (entry?.weight != null && !(isNumber(entry.weight) && entry.weight > 0 && entry.weight <= 1)) {
    p.push(`${at}: weight must be a number in (0, 1]`)
  }
  return p
}

export function auditCorpus({ sources, entries, parts, games }) {
  const problems = []
  const sourceIds = new Set()
  for (const s of sources) {
    problems.push(...validateSource(s))
    if (sourceIds.has(s?.id)) problems.push(`duplicate source id ${s.id}`)
    sourceIds.add(s?.id)
  }

  const partIds = new Set(parts.map((x) => x.id))
  const gameIds = new Set(games.map((g) => g.id))
  const entryIds = new Set()
  for (const e of entries) {
    problems.push(...validateEntry(e, { sourceIds, partIds, gameIds }))
    if (entryIds.has(e?.id)) problems.push(`duplicate entry id ${e.id}`)
    entryIds.add(e?.id)
  }

  // A source nobody cites is dead weight that still counts toward the
  // per-source concentration cap, so it has to be visible.
  const cited = new Set(entries.map((e) => e?.sourceId))
  for (const id of sourceIds) {
    if (!cited.has(id) && entries.length > 0) problems.push(`source ${id} has no entries`)
  }
  return problems
}
