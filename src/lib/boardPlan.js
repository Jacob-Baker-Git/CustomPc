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

// The board viewBox. The full-bleed layer renders at this and is cropped by
// preserveAspectRatio="slice", so these are proportions, not millimetres.
export const BOARD = { w: 640, h: 420 }

// ATX landmarks, rear I/O top-left, which is how an ATX board is conventionally
// drawn in landscape. `weight` selects the stroke group in BoardBackground:
// 'signal' | 'outline' | 'power', matching the three tuned weights.
//
// ⚠️ These are OUTLINES ONLY. Solid gold pads live in the edge-pinned hardware
// layers and are not planned here — nothing readable can sit on solid gold
// (measured 1.95:1 for --ink), so the full-bleed layer carries no fills.
//
// ⚠️ The DIMM bank starts at 364, not hard against the socket. The 54 units
// between them are a routing channel, and they are load-bearing rather than
// aesthetic: the memory fan-out is length-matched, length-matching cannot
// stretch a trace past sqrt(2) times its run, and a narrower channel forces the
// near conductors into stubs too short to match or to read as traces at all.
export const LANDMARKS = [
  { id: 'rear-io',      x: 20,  y: 18,  w: 100, h: 52,  weight: 'outline' },
  { id: 'vrm',          x: 132, y: 18,  w: 68,  h: 40,  weight: 'outline' },
  { id: 'eps-8pin',     x: 214, y: 18,  w: 36,  h: 16,  weight: 'power' },
  { id: 'socket',       x: 210, y: 88,  w: 100, h: 100, weight: 'outline' },
  { id: 'dimm-0',       x: 364, y: 70,  w: 8,   h: 140, weight: 'outline' },
  { id: 'dimm-1',       x: 380, y: 70,  w: 8,   h: 140, weight: 'outline' },
  { id: 'dimm-2',       x: 396, y: 70,  w: 8,   h: 140, weight: 'outline' },
  { id: 'dimm-3',       x: 412, y: 70,  w: 8,   h: 140, weight: 'outline' },
  { id: 'atx-24pin',    x: 440, y: 78,  w: 30,  h: 72,  weight: 'power' },
  { id: 'm2-1',         x: 150, y: 224, w: 180, h: 8,   weight: 'outline' },
  { id: 'pcie-x16-1',   x: 150, y: 250, w: 270, h: 12,  weight: 'outline' },
  { id: 'm2-2',         x: 150, y: 274, w: 180, h: 8,   weight: 'outline' },
  { id: 'pcie-x1',      x: 150, y: 286, w: 110, h: 8,   weight: 'outline' },
  { id: 'pcie-x16-2',   x: 150, y: 310, w: 230, h: 12,  weight: 'outline' },
  // Same reasoning as the DIMM channel: the chipset sits 50 units clear of the
  // bottom x16 slot so its uplink has somewhere to go. Drafted at 400 it had
  // 20 units to spend on a bundle needing 26, and every conductor doubled back
  // on itself — a diagonal that overshoots its destination has to come back.
  { id: 'chipset',      x: 430, y: 280, w: 70,  h: 70,  weight: 'outline' },
  { id: 'sata',         x: 500, y: 200, w: 40,  h: 64,  weight: 'outline' },
  { id: 'front-panel',  x: 300, y: 388, w: 62,  h: 12,  weight: 'outline' },
]

const at = (id) => LANDMARKS.find((l) => l.id === id)

// Every bundle on the board, generated rather than drawn. Each one leaves a
// component edge and ends on a via, so no conductor finishes in open copper.
//
// ⚠️ THE PRECONDITION, and the reason three earlier drafts of this table were
// unroutable: a dogleg spends |rise| of horizontal run making its 45 degrees,
// so a bus needs run > lead + stagger + |rise|. Given less, the diagonal
// overshoots its destination and the final leg has to come back for it — one
// draft asked for an 18-unit drop across 10 units of run and every conductor
// in it pointed the wrong way.
//
// This lives here rather than in the component because the generators being
// correct says nothing about whether the ROUTES are, and the routes are what
// went wrong. boardPlan.test.js asserts against this function directly.
export function routes() {
  const socket = at('socket')
  const dimm0 = at('dimm-0')
  const chipset = at('chipset')
  const rearIo = at('rear-io')
  const eps = at('eps-8pin')
  const vrm = at('vrm')
  const slot2 = at('pcie-x16-2')

  // Memory: socket east edge into the DIMM channel, length-matched. The pins
  // sit at staggered depths, which is the case serpentines exist for. The
  // spread is inside the sqrt(2) ceiling — see the channel-width assertion.
  const memory = serpentine({
    fromX: socket.x + socket.w + 4,
    fromY: socket.y + 8,
    ends: [dimm0.x - 4, dimm0.x - 8, dimm0.x - 12, dimm0.x - 16],
    pitch: 6,
    amplitude: 3,
  })

  // Rear I/O across to the socket, dropping under the VRM. The traces leave
  // below the VRM's bottom edge rather than beside it: the 12 units between
  // that edge and the rear I/O block's own is the only clear lane, which is
  // what sets the tight pitch here.
  const io = bus({
    fromX: rearIo.x + rearIo.w,
    fromY: vrm.y + vrm.h + 1,
    toX: socket.x - 4,
    count: 4,
    pitch: 3,
    rise: 40,
  })

  // Chipset uplink: west edge across and down to the bottom x16 slot, ending
  // just clear of it rather than crossing its outline.
  const uplink = bus({
    fromX: chipset.x,
    fromY: chipset.y + 16,
    toX: slot2.x + slot2.w + 4,
    count: 3,
    pitch: 5,
    rise: 14,
  })

  // The one power run that is short enough to be honest: EPS 12V into the VRM,
  // which is exactly where it goes on a real board. Thick, and deliberately
  // alone — power delivery reads as power delivery because there is little of
  // it, not because there is a lot.
  const power = bus({
    fromX: eps.x,
    fromY: eps.y + 4,
    toX: vrm.x + vrm.w,
    count: 2,
    pitch: 8,
    rise: 0,
  })

  // The CPU's own lanes to the primary x16 slot — the busiest link on a real
  // board, and the one the eye looks for. It leaves the socket's south edge and
  // has to thread the one clear corridor there is: right of the M.2 slot, below
  // the DIMM bank, and above the x16 slot it is heading for. The vias stop in
  // that gap rather than on the slot outline.
  const gpu = bus({
    fromX: socket.x + 90,
    fromY: socket.y + socket.h,
    toX: 410,
    count: 3,
    pitch: 5,
    rise: 44,
  })

  // VRM out to the DIMM bank. Thick, because it is power, and running under the
  // EPS connector rather than through it — the lane between the connector's
  // bottom edge and the VRM's is the only clear one.
  const dimmPower = bus({
    fromX: vrm.x + vrm.w,
    fromY: vrm.y + vrm.h - 18,
    toX: dimm0.x - 4,
    count: 2,
    pitch: 8,
    rise: 0,
  })

  // Front panel back up to the chipset, along the bottom edge where a real
  // board runs its header wiring.
  const frontPanel = at('front-panel')
  const panel = bus({
    fromX: frontPanel.x + frontPanel.w,
    fromY: frontPanel.y + 4,
    toX: chipset.x + 30,
    count: 3,
    pitch: 4,
    rise: -40,
  })

  return [
    { key: 'memory', weight: 'signal', ...memory },
    { key: 'io', weight: 'signal', ...io },
    { key: 'uplink', weight: 'signal', ...uplink },
    { key: 'gpu', weight: 'signal', ...gpu },
    { key: 'panel', weight: 'signal', ...panel },
    { key: 'eps', weight: 'power', ...power },
    { key: 'dimm-power', weight: 'power', ...dimmPower },
  ]
}
