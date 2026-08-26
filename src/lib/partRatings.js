import { partQuality } from './partQuality'
import { checkCompatibility } from './compatibility'
import { gameFps } from './gameFps'
import { partSynergy } from './partSynergy'
import { BUILD_PROFILES, USE_CASE_LABEL } from './buildProfiles'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const FPS_USES = new Set(['gaming', 'streaming'])

// Nothing on sale today is worthless. The cheapest current part in a category
// still boots, still games at *some* setting, and calling it a 0 was the single
// biggest reason honest budget builds scored in the twenties. So the catalogue
// percentile is mapped into [LEVEL_FLOOR, 100] rather than [0, 100]; only a part
// that is not in the catalogue at all — i.e. genuinely obsolete — reads 0.
const LEVEL_FLOOR = 25

// Falling short of the level a use case expects is not linear pain. A part at
// half the expected tier does not deliver half the experience; it delivers most
// of it with less headroom. The concave curve says that, and stops "a bit below
// ideal" from reading as "broken".
const ADEQUACY_CURVE = 0.7

// Meeting the expectation is *enough*, and enough is worth 88 rather than 100.
// The last twelve points are reserved for genuinely exceeding the brief, so a
// build that merely clears every bar reads as "great" instead of "perfect" and
// the top of the scale still means something.
const ENOUGH_SCORE = 88
const ABOVE_SPAN = 0.4

// A part is mostly judged by its weaker dimension — the point of the rating is
// to find the weak link — but taking a flat minimum punished a part twice for
// one flaw. Let the stronger dimension pull the score back up by this much.
const STRONGER_PULL = 0.3

// Below this, a part's row earns a written explanation rather than a bare score.
const NOTE_BELOW = 72

// Per-category quality range, memoised per catalog. partLevel is called once
// per candidate AND once per category inside rateBuild for every candidate, so
// rescanning all ~317 parts each time dominated the rating panel's render cost.
// Keyed on the catalog array itself: the store swaps in a new array when the
// live catalog loads, which invalidates the entry for free.
const rangeCache = new WeakMap()

function categoryRange(catalog, category) {
  let byCategory = rangeCache.get(catalog)
  if (!byCategory) {
    byCategory = new Map()
    rangeCache.set(catalog, byCategory)
  }
  let range = byCategory.get(category)
  if (range === undefined) {
    let min = Infinity
    let max = -Infinity
    let count = 0
    for (const p of catalog) {
      if (p.category !== category) continue
      const q = partQuality(p)
      if (q < min) min = q
      if (q > max) max = q
      count++
    }
    range = count === 0 ? null : { min, max }
    byCategory.set(category, range)
  }
  return range
}

// Where a part sits within its category across the catalog, on a LEVEL_FLOOR-100
// scale. Order is a plain percentile of quality; the floor keeps the weakest
// part on sale from reading as nothing at all.
export function partLevel(part, catalog) {
  if (!part) return 0
  const range = categoryRange(catalog, part.category)
  if (!range) return 0
  const { min, max } = range
  if (!(max > min)) return 100
  return Math.round(LEVEL_FLOOR + (100 - LEVEL_FLOOR) * (partQuality(part) - min) / (max - min))
}

// Plain-English band for a level, so explanations can say "mid-range" instead
// of quoting a percentile at someone who came here to buy a computer.
function tierWord(level) {
  if (level >= 88) return 'top-end'
  if (level >= 72) return 'high-end'
  if (level >= 55) return 'upper mid-range'
  if (level >= 40) return 'mid-range'
  return 'entry-level'
}

function verdictFor(overall, label) {
  if (overall >= 88) return `Excellent for ${label}`
  if (overall >= 74) return `Great for ${label}`
  if (overall >= 58) return `Solid for ${label}`
  if (overall >= 40) return `Gets by for ${label}`
  return `Entry-level for ${label}`
}

// How close a part gets to the level this use case expects of its category.
function adequacyFor(level, expected) {
  const target = Math.max(expected ?? 1, 1)
  const ratio = level / target
  const score = ratio >= 1
    ? ENOUGH_SCORE + (100 - ENOUGH_SCORE) * Math.min((ratio - 1) / ABOVE_SPAN, 1)
    : ENOUGH_SCORE * Math.pow(ratio, ADEQUACY_CURVE)
  return clamp(Math.round(score), 0, 100)
}

// The note shown when the part simply sits below the tier the use case wants.
// Never "underpowered": it says which tier it is, which tier is expected, and
// what the shortfall actually costs day to day. Phrased without an article in
// front of the category, because "a Case Fans" and "an upper mid-range" are
// both waiting to happen once these are stitched together.
function adequacyNote(category, level, expected, label) {
  const have = tierWord(level)
  const want = tierWord(expected)
  return {
    reason: have === want
      ? `A little under what ${label} asks for here`
      : `${have.charAt(0).toUpperCase()}${have.slice(1)} where ${label} leans ${want}`,
    detail: `${label} builds usually sit around ${want} for this part; this one is ${have}. That is a difference of degree rather than a fault: everything works, there is just less room before this is the part asking you to turn something down. On a fixed budget it is often the right thing to leave alone until the parts above it are settled.`,
  }
}

// mobo / case / fans have no single partner to be measured against, so they are
// judged against the level of the build around them.
function tierBalance(level, buildLevel) {
  const balance = clamp(Math.round(100 * level / Math.max(buildLevel, 1)), 0, 100)
  if (balance >= 100) return { balance, reason: null, detail: null }
  return {
    balance,
    reason: 'Modest next to the rest of this build',
    detail: `Most of this build sits around ${tierWord(buildLevel)}; this part is ${tierWord(level)}. Nothing stops working over it. In this category the gap is usually airflow, features and finish rather than raw speed, but it is where the build will start to feel uneven, and it is normally the cheapest thing on the list to put right.`,
  }
}

// Score every present part /100 for the use case. `balance` (how well it pairs
// with the rest of the build) comes from partSynergy for cpu/gpu/ram/storage/psu/
// cooler; mobo/case/fans fall back to a vs-build-tier comparison. A part is led
// by its worse of {adequacy vs the use-case expectation, balance}, softened by
// STRONGER_PULL so one flaw is not counted twice, and the limiting factor is
// surfaced as `reason` (a headline) plus `detail` (the answer to "why?").
export function rateBuild(parts, useCase, catalog) {
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  const label = USE_CASE_LABEL[useCase] ?? 'this use'
  if (!parts.cpu || !parts.gpu) return { overall: 0, verdict: verdictFor(0, label), parts: {} }

  const cats = Object.keys(parts).filter((c) => parts[c])
  const w = profile.weights
  const expect = profile.expect

  const level = {}
  for (const c of cats) level[c] = partLevel(parts[c], catalog)

  let wsum = 0, lsum = 0
  for (const c of cats) { const wc = w[c] ?? 0; wsum += wc; lsum += wc * level[c] }
  const D = wsum > 0 ? lsum / wsum : 0

  const out = {}
  for (const c of cats) {
    const adequacy = adequacyFor(level[c], expect[c])
    const pair = partSynergy(parts, c, useCase) ?? tierBalance(level[c], D)
    const balance = pair.balance

    const lo = Math.min(adequacy, balance)
    const hi = Math.max(adequacy, balance)
    const score = Math.round(lo + STRONGER_PULL * (hi - lo))

    // Explain whichever dimension is actually holding the part back — but only
    // once the part is genuinely being held back. A caution pinned to a 90
    // warns about nothing, and teaches people to ignore the ones that matter.
    const weak = score < NOTE_BELOW
    const fromAdequacy = () => adequacyNote(c, level[c], expect[c], label)
    const note = !weak ? null
      : adequacy <= balance ? fromAdequacy()
      : pair.reason ? pair : fromAdequacy()

    out[c] = {
      score,
      level: level[c],
      part: parts[c],
      isWeakLink: weak,
      reason: note?.reason ?? null,
      detail: note?.detail ?? null,
    }
  }

  let owsum = 0, ossum = 0
  for (const c of cats) { const wc = w[c] ?? 0; owsum += wc; ossum += wc * out[c].score }
  const overall = owsum > 0 ? Math.round(ossum / owsum) : 0
  return { overall, verdict: verdictFor(overall, label), parts: out }
}

// The single best next purchase, given a rating and the per-category upgrade
// options the panel has already computed. Aimed at the WORST-scoring part,
// because that is the one actually holding the build back — falling through to
// the next-worst when nothing affordable would improve it, so there is still
// something to offer while any money is left.
//
// Pure and separate from rateBuild so it can be tested on hand-written input,
// and so the caller pays for partUpgradeOptions exactly once.
export function pickRecommendation(rating, optionsByCategory, headroom = Infinity) {
  const cats = Object.keys(rating.parts ?? {})
  const worstFirst = cats.sort((a, b) => rating.parts[a].score - rating.parts[b].score)

  for (const category of worstFirst) {
    const from = rating.parts[category]
    const affordable = (optionsByCategory[category] ?? [])
      .filter((o) => o.extraCost <= headroom && o.newScore > from.score)
    if (affordable.length === 0) continue

    // Most score per pound. A free or cheaper swap wins outright; the bigger
    // jump breaks a tie, so we never recommend a £900 halo part over a £40 one
    // that closes the same gap.
    const value = (o) => (o.newScore - from.score) / Math.max(o.extraCost, 1)
    const best = affordable.reduce((a, b) => {
      const [va, vb] = [value(a), value(b)]
      if (vb !== va) return vb > va ? b : a
      if (b.newScore !== a.newScore) return b.newScore > a.newScore ? b : a
      return b.extraCost < a.extraCost ? b : a
    })

    return {
      category,
      fromPart: from.part,
      toPart: best.toPart,
      extraCost: best.extraCost,
      fromScore: from.score,
      toScore: best.newScore,
      fpsGain: best.fpsGain ?? null,
    }
  }
  return null
}

// Better-in-category swaps that would raise this part's score. Cheapest first,
// capped to `limit`. gaming/streaming cpu/gpu also carry an fps gain when a
// representative `game` is supplied.
export function partUpgradeOptions(parts, useCase, category, catalog, { game = null, limit = 5 } = {}) {
  const current = parts[category]
  if (!current) return []
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  const curLevel = partLevel(current, catalog)
  const curScore = rateBuild(parts, useCase, catalog).parts[category]?.score ?? 0
  const showFps = Boolean(game) && FPS_USES.has(useCase) && (category === 'cpu' || category === 'gpu')
  const baseFps = showFps ? gameFps(parts.cpu, parts.gpu, profile.resolution, game, 'high') : 0

  const out = []
  for (const cand of catalog) {
    if (cand.category !== category) continue
    // Never suggest upgrading TO something discontinued — see autoBuilder.
    if (cand.legacy) continue
    if (partLevel(cand, catalog) <= curLevel) continue
    if (cand.price <= current.price) continue
    if (!checkCompatibility(parts, cand).compatible) continue
    const next = { ...parts, [category]: cand }
    const newScore = rateBuild(next, useCase, catalog).parts[category]?.score ?? 0
    if (newScore <= curScore) continue
    const opt = { toPart: cand, extraCost: cand.price - current.price, newScore }
    if (showFps) opt.fpsGain = gameFps(next.cpu, next.gpu, profile.resolution, game, 'high') - baseFps
    out.push(opt)
  }
  return out.sort((a, b) => a.extraCost - b.extraCost).slice(0, limit)
}
