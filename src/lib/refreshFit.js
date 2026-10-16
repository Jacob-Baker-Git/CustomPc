// Where a frame rate lands against the refresh rates monitors actually ship at.
// A number like "75 fps" means little on its own; "keeps up with a 60 Hz
// screen" is what someone choosing a build can act on. Worked out from the two
// figures the engine gives (average and 1% lows) and nothing else.
//
// 30 is on the scale as the playable floor, not as a screen: no monitor runs
// at 30 Hz, so it is named in fps wherever it is named.
export const REFRESH_TIERS = [30, 60, 120, 144, 240]

const tierBelow = (fps) => [...REFRESH_TIERS].reverse().find((t) => fps >= t) ?? null
const pct = (fps, max) => Math.min(100, Math.round((100 * fps) / max))
const steady = (t) => (t === 30 ? '30 fps' : `${t} Hz`)

function verdictFor(avg, low) {
  if (avg < 30) return 'Under 30 fps: expect it to feel choppy. A lower setting or resolution will help.'
  const avgTier = tierBelow(avg)
  if (low == null) return `Averages over ${avgTier} fps.`
  const lowTier = tierBelow(low)
  if (lowTier === avgTier) {
    return avgTier === 30
      ? 'Holds 30 fps, dips included, but falls short of a 60 Hz screen.'
      : `Keeps up with a ${avgTier} Hz screen, dips included.`
  }
  return lowTier
    ? `Averages over ${avgTier} fps, but dips to ${low}; steady at ${steady(lowTier)}.`
    : `Averages over ${avgTier} fps, but dips to ${low}.`
}

export function refreshFit(avg, low, { ceiling = false } = {}) {
  // Room above the average so the bar never touches the end of its own scale.
  const scaleMax = REFRESH_TIERS.find((t) => t >= avg * 1.1) ?? REFRESH_TIERS[REFRESH_TIERS.length - 1]
  // A tick within a fifth of the scale of the next one would print its label
  // on top of it (120 and 144 Hz on a 144 scale), so the lower one goes.
  const ticks = REFRESH_TIERS.filter((t, i, all) => t <= scaleMax
    && !(all[i + 1] <= scaleMax && (all[i + 1] - t) / scaleMax < 0.2))
  const verdict = verdictFor(avg, low)
  return {
    scaleMax,
    ticks,
    tickLabels: ticks.map((t) => (t === 30 ? '30 fps' : `${t} Hz`)),
    avgPct: pct(avg, scaleMax),
    lowPct: low == null ? null : pct(low, scaleMax),
    // A ceiling can only be lower, so its verdict is the best case.
    verdict: ceiling ? `At best, ${verdict[0].toLowerCase()}${verdict.slice(1)}` : verdict,
  }
}
