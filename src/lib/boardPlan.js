// Geometry for the motherboard page background.
//
// Pure and React-free on purpose: the routing rules this file exists to enforce
// (45 degree corners, constant bus pitch, length-matched memory traces) are only
// checkable if the thing under test is the path data itself. A component that
// hand-draws paths can only be snapshot-tested, which pins the drawing instead
// of the rules — and hand-drawn paths are exactly how the previous version's
// bundles drifted apart.

const TOL = 1e-6

// Absolute segments [x1,y1,x2,y2] from a path built of M/H/V/L only.
// The generators below emit nothing else, deliberately: curves cannot be
// checked against the 45 degree rule.
export function segmentsOf(d) {
  const out = []
  let x = 0
  let y = 0
  for (const token of String(d).match(/[MHVL][^MHVL]*/g) ?? []) {
    const nums = token.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number)
    switch (token[0]) {
      case 'M': [x, y] = nums; break
      case 'H': out.push([x, y, nums[0], y]); x = nums[0]; break
      case 'V': out.push([x, y, x, nums[0]]); y = nums[0]; break
      case 'L': out.push([x, y, nums[0], nums[1]]); [x, y] = nums; break
      default: break
    }
  }
  return out
}

export function pathLength(d) {
  return segmentsOf(d).reduce((sum, [x1, y1, x2, y2]) => sum + Math.hypot(x2 - x1, y2 - y1), 0)
}

export function isOrthoOr45([x1, y1, x2, y2]) {
  const dx = Math.abs(x2 - x1)
  const dy = Math.abs(y2 - y1)
  return dx < TOL || dy < TOL || Math.abs(dx - dy) < TOL
}

// Trim float noise out of emitted path data. The stagger below is irrational,
// so without this every dogleg carries seventeen digits.
const n = (v) => Number(v.toFixed(3))

// How far apart, along the run, two adjacent conductors turn.
//
// ⚠️ NOT the pitch, which is the obvious answer and is provably wrong: two
// parallel 45 degree lines whose start points differ by (pitch, pitch) are the
// SAME LINE. With pitch 6 and a rise of 12 both doglegs sit on y = x - 58, so
// adjacent traces overlap and the bundle reads as one thick smear at every
// corner — the exact "loose squiggle" defect this rewrite exists to remove.
//
// Two parallel 45 degree lines are `pitch` apart when their start points differ
// by (pitch*(1-sqrt2), pitch), which is this factor. The SIGN matters as much
// as the magnitude: the conductor already furthest along in the direction of
// the rise has to turn FIRST, or its neighbour's straight runs through its
// diagonal. Both are asserted in boardPlan.test.js.
const TURN_STAGGER = Math.SQRT2 - 1

// `count` parallel traces leaving a component edge at `fromX`, stepping
// vertically by `rise` and terminating at `toX`.
export function bus({ fromX, fromY, toX, count, pitch, lead = 8, rise = 0 }) {
  const dir = Math.sign(toX - fromX) || 1
  const paths = []
  const vias = []
  // Turn offsets measured along `dir`, then shifted so the earliest turn sits
  // exactly `lead` past the component edge whichever way the stagger runs.
  const step = -Math.sign(rise) * pitch * TURN_STAGGER
  const offsets = Array.from({ length: count }, (_, i) => i * step)
  const base = lead - Math.min(...offsets)
  for (let i = 0; i < count; i += 1) {
    const y0 = fromY + i * pitch
    const y1 = y0 + rise
    if (rise === 0) {
      paths.push(`M${fromX} ${y0} H${toX}`)
    } else {
      const dogX = n(fromX + dir * (base + offsets[i]))
      // Derived from the ROUNDED dogleg, so the diagonal stays exactly 45
      // degrees rather than 45 degrees plus a rounding error.
      const turnX = n(dogX + dir * Math.abs(rise))
      paths.push(`M${fromX} ${y0} H${dogX} L${turnX} ${y1} H${toX}`)
    }
    vias.push({ x: toX, y: y1 })
  }
  return { paths, vias }
}

// A 45 degree triangular detour advances 2a horizontally while covering
// 2a*sqrt(2) of copper, so each cycle buys this much extra length per unit of
// amplitude. This constant is why the wiggle is triangular rather than square:
// a square detour would break the 45 degree rule.
const CYCLE_GAIN = 2 * (Math.SQRT2 - 1)

// Length-matching. Every trace in a bundle is padded with detours until it is
// as long as the longest, which is what keeps a parallel bus in time. Applied
// only where a real board has one — a serpentine on a power trace would be
// decoration imitating structure.
//
// ⚠️ There is a hard ceiling on what this can do, and callers have to respect
// it: a fully-serpentined trace is exactly sqrt(2) times its straight run, so a
// bundle whose longest run exceeds ~1.41x its shortest cannot be matched at ANY
// amplitude. Asked for more, the generator fills its run and stops short rather
// than wandering outside the space it was given.
export function serpentine({ fromX, fromY, ends, pitch, amplitude }) {
  const target = Math.max(...ends) - fromX
  const paths = []
  const vias = []
  ends.forEach((endX, i) => {
    const y = fromY + i * pitch
    const run = endX - fromX
    const wanted = Math.round((target - run) / (amplitude * CYCLE_GAIN))
    // A detour consumes 2a of run, so a trace can never carry more cycles than
    // its own run affords, however much length it is short by.
    const cycles = Math.max(0, Math.min(wanted, Math.floor(run / (2 * amplitude))))
    let d = `M${fromX} ${y}`
    let x = fromX
    for (let c = 0; c < cycles; c += 1) {
      d += ` L${x + amplitude} ${y - amplitude} L${x + 2 * amplitude} ${y}`
      x += 2 * amplitude
    }
    d += ` H${endX}`
    paths.push(d)
    vias.push({ x: endX, y })
  })
  return { paths, vias }
}
