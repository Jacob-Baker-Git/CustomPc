// Verifies the hand-transcribed hardware specs before anything is allowed to
// depend on them.
//
//   npm run specs:check
//
// Two independent checks, because a transcription error is invisible on its own
// and obvious the moment you cross it with something else:
//
//   1. AGAINST THE CATALOGUE. Every part already carries a tdp, and GPUs carry
//      vram. Those are the same facts from a different source, so a mismatch
//      means one of the two is wrong and a human has to look.
//
//   2. AGAINST ARITHMETIC. Memory bandwidth is not an independent number — it
//      is busBits x effective memory clock / 8. So an implied clock outside the
//      range the memory generation can physically run at proves the row is
//      wrong even with nothing to compare it against. This is what catches a
//      bus width that was mis-read, which the catalogue cannot see.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'

const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'))

const parts = read('../src/data/partsData.json')
const { gpus, sources } = read('../data/specs/gpuSpecs.json')
const byId = new Map(parts.map((p) => [p.id, p]))

// Effective per-pin data rates actually shipped, by memory generation, in Gbps.
// A row implying a clock outside its generation's range has a mis-transcribed
// bus width or bandwidth — the two cannot both be right, and the catalogue
// cannot see it because the catalogue has neither number.
//
// Per-generation rather than one wide band, because a single 7-34 range is so
// permissive it catches almost nothing: a GDDR7 card mis-read as having a
// wider bus lands at a perfectly plausible GDDR6 rate and sails through.
const CLOCK_RANGE = {
  GDDR5: [5, 9],
  GDDR5X: [9, 12],
  GDDR6: [12, 21],
  GDDR6X: [19, 25],
  GDDR7: [26, 34],
}
const DEFAULT_RANGE = [5, 34]

const problems = []
const warnings = []
let checked = 0

for (const [id, spec] of Object.entries(gpus)) {
  const part = byId.get(id)
  const at = `${id}${part ? ` (${part.name})` : ''}`

  if (!part) { problems.push(`${at}: not a catalogue part id`); continue }
  if (!sources[spec.source]) problems.push(`${at}: unknown source "${spec.source}"`)
  checked += 1

  // --- 1. against the catalogue ---
  // `knownDiff` records that a human looked at a disagreement and decided which
  // side is right. It downgrades the failure to a warning but never hides it —
  // silently trusting one source over the other is how a wrong number becomes
  // permanent.
  const diffs = spec.knownDiff ?? {}
  if (spec.tdpW != null && part.tdp > 0 && spec.tdpW !== part.tdp) {
    const line = `${at}: TDP ${spec.tdpW}W from the spec sheet vs ${part.tdp}W in the catalogue`
    if (diffs.tdpW) warnings.push(`${line} — accepted: ${diffs.tdpW}`)
    else problems.push(line)
  }
  const catVram = part.specs?.vram
  if (catVram > 0 && spec.vramGb !== catVram) {
    const line = `${at}: VRAM ${spec.vramGb}GB from the spec sheet vs ${catVram}GB in the catalogue`
    if (diffs.vramGb) warnings.push(`${line} — accepted: ${diffs.vramGb}`)
    else problems.push(line)
  }

  // --- 2. against arithmetic ---
  if (spec.busBits > 0 && spec.bandwidthGbs > 0) {
    const memType = part.specs?.memType
    const [lo, hi] = CLOCK_RANGE[memType] ?? DEFAULT_RANGE
    const impliedGbps = (spec.bandwidthGbs * 8) / spec.busBits
    if (impliedGbps < lo || impliedGbps > hi) {
      problems.push(
        `${at}: ${spec.bandwidthGbs} GB/s over a ${spec.busBits}-bit bus implies `
        + `${impliedGbps.toFixed(1)} Gbps ${memType ?? 'memory'}, outside the ${lo}-${hi} Gbps `
        + `that generation ships at. The bus width or the bandwidth is mis-read.`,
      )
    }
  }

  // tdpW is optional: several sources leave it blank, and the capability model
  // does not use it — it exists here only as a second opinion to cross-check
  // the catalogue against. A row without one is less verified, not unusable.
  for (const field of ['shaders', 'boostMhz', 'vramGb', 'busBits', 'bandwidthGbs']) {
    if (!(spec[field] > 0)) problems.push(`${at}: ${field} is missing or not positive`)
  }
  if (spec.tdpW == null) {
    warnings.push(`${at}: no TDP in the source, so the catalogue's ${part.tdp}W is uncorroborated`)
  } else if (!(spec.tdpW > 0)) {
    problems.push(`${at}: tdpW is present but not positive`)
  }
}

// --- CPUs -----------------------------------------------------------------
// Only boostGhz can be cross-checked; the catalogue has no cache field, so
// l3Mb is single-sourced and that fact is surfaced rather than assumed away.
const { cpus } = read('../data/specs/cpuSpecs.json')
let cpusChecked = 0
let singleSourcedCache = 0

for (const [id, spec] of Object.entries(cpus)) {
  const part = byId.get(id)
  const at = `${id}${part ? ` (${part.name})` : ''}`
  if (!part) { problems.push(`${at}: not a catalogue part id`); continue }
  cpusChecked += 1

  const catBoost = part.specs?.boostClock
  if (catBoost > 0 && Math.abs(spec.boostGhz - catBoost) > 0.001) {
    problems.push(`${at}: boost ${spec.boostGhz} GHz from the spec sheet vs ${catBoost} GHz in the catalogue`)
  }
  if (!(spec.l3Mb > 0)) problems.push(`${at}: l3Mb is missing or not positive`)
  else singleSourcedCache += 1

  // Cores are deliberately absent — see the file's own _readme. A second copy
  // taken from a source that got them wrong would be worse than none.
  if (spec.cores != null) {
    problems.push(`${at}: cores must not be recorded here; the catalogue is the source for those`)
  }
}

// Coverage is a warning, not a failure — the capability model falls back for
// parts it has no specs for, and says so.
const allGpus = parts.filter((p) => p.category === 'gpu')
const missing = allGpus.filter((p) => !gpus[p.id])
if (missing.length) {
  warnings.push(`${missing.length} of ${allGpus.length} catalogue GPUs have no specs yet`)
}
const allCpus = parts.filter((p) => p.category === 'cpu')
const missingCpus = allCpus.filter((p) => !cpus[p.id])
if (missingCpus.length) {
  warnings.push(`${missingCpus.length} of ${allCpus.length} catalogue CPUs have no specs yet`)
}

for (const w of warnings) console.warn(`WARN: ${w}`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`  - ${p}`)
  exit(1)
}
console.log(`${checked} GPU spec rows verified against the catalogue and against bandwidth arithmetic.`)
console.log(`${cpusChecked} CPU spec rows verified on boost clock; `
  + `${singleSourcedCache} L3 cache figures are single-sourced and uncorroborated.`)
if (missing.length) {
  console.log(`Still to transcribe: ${missing.slice(0, 8).map((p) => p.id).join(', ')}${missing.length > 8 ? ', …' : ''}`)
}
