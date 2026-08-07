import { coolerCapacityW } from '../partSynergy'

// Realistic system power draw, as distinct from the conservative TDP sum that
// `systemDrawW` computes for the PSU warning. Both are wanted: one sizes the
// supply, this one describes what the machine actually pulls.
//
// Everything here comes from `tdp` fields the catalogue already carries on
// every part, so no benchmark data is needed — this works on day one, before a
// single measurement has been curated.

// Categories that draw roughly their rated figure whatever the workload. The
// CPU and GPU are excluded because their draw depends on which of them is
// setting the pace, which is the interesting part.
const STEADY = ['motherboard', 'ram', 'storage', 'cooler', 'fans', 'case', 'paste']

// 80 PLUS bands, as a fraction. Used to turn draw at the DC side into what the
// wall actually sees — the number on an electricity bill.
const EFFICIENCY = {
  titanium: 0.94, platinum: 0.92, gold: 0.90, silver: 0.88, bronze: 0.85, white: 0.82,
}

export function psuEfficiency(psu) {
  const rating = String(psu?.specs?.rating ?? '').toLowerCase()
  for (const [tier, value] of Object.entries(EFFICIENCY)) {
    if (rating.includes(tier)) return { value, tier }
  }
  return { value: 0.85, tier: null }   // unrated: assume the bronze-ish middle
}

// `cpuShare` is the engine's own 0-1 measure of how CPU-led the frame is. It
// couples power to the frame model: a CPU-bound frame leaves the graphics card
// waiting, and a waiting card does not draw full board power. Summing TDPs
// misses that entirely. Defaults to 0.5 when there is no frame data yet.
export function estimatePower(parts, cpuShare = 0.5) {
  const gpuTdp = parts?.gpu?.tdp ?? 0
  const cpuTdp = parts?.cpu?.tdp ?? 0
  const steadyW = STEADY.reduce((sum, c) => sum + (parts?.[c]?.tdp ?? 0), 0)

  const share = Math.min(1, Math.max(0, cpuShare ?? 0.5))
  const gpuLoad = 0.98 - 0.35 * share
  // Games rarely load a CPU past ~70% of its limit; they are latency-bound, not
  // throughput-bound the way a render or a compile is.
  const cpuLoad = 0.42 + 0.30 * share

  const gamingW = gpuTdp * gpuLoad + cpuTdp * cpuLoad + steadyW
  const peakW = gpuTdp + cpuTdp * 0.95 + steadyW
  const idleW = 0.06 * gpuTdp + 0.10 * cpuTdp + steadyW * 0.5 + 10

  const eff = psuEfficiency(parts?.psu)
  const wattage = parts?.psu?.wattage ?? 0

  return {
    idleW: Math.round(idleW),
    gamingW: Math.round(gamingW),
    peakW: Math.round(peakW),
    // Transient spikes are what actually trip a supply, not sustained draw, so
    // the recommendation is built on peak with real headroom over it.
    recommendedPsuW: peakW > 0 ? Math.ceil((peakW * 1.35) / 50) * 50 : null,
    psuWattage: wattage || null,
    psuHeadroomPct: wattage > 0 && peakW > 0
      ? Math.round((100 * wattage) / peakW - 100) : null,
    // Where the supply sits on its efficiency curve while gaming. Worth showing:
    // it is how you find out whether you over-bought, and supplies are quietest
    // and most efficient around the middle of their range.
    loadPointPct: wattage > 0 ? Math.round((100 * gamingW) / wattage) : null,
    efficiencyTier: eff.tier,
    fromWallW: Math.round(gamingW / eff.value),
    basedOnCpuShare: Number(share.toFixed(3)),
  }
}

// Cooling headroom: what the cooler can shed against what the CPU produces.
// Returns null rather than a number when either side is unknown, because a
// missing spec is not evidence of a problem.
export function estimateThermals(parts) {
  const capacityW = coolerCapacityW(parts?.cooler)
  const cpuTdp = parts?.cpu?.tdp ?? 0
  if (!(capacityW > 0) || !(cpuTdp > 0)) {
    return { capacityW: capacityW || null, cpuTdp: cpuTdp || null, headroomPct: null, verdict: null }
  }
  const headroomPct = Math.round((100 * capacityW) / cpuTdp - 100)
  const verdict = headroomPct >= 40 ? 'comfortable'
    : headroomPct >= 0 ? 'adequate'
      : 'working hard'
  return { capacityW, cpuTdp, headroomPct, verdict }
}
