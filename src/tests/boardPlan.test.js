import { describe, it, expect } from 'vitest'
import { segmentsOf, pathLength, isOrthoOr45, bus, serpentine } from '../lib/boardPlan'

describe('path inspection', () => {
  it('splits a path into absolute segments', () => {
    expect(segmentsOf('M10 20 H30 V40 L50 60')).toEqual([
      [10, 20, 30, 20],
      [30, 20, 30, 40],
      [30, 40, 50, 60],
    ])
  })

  it('measures total path length', () => {
    // 20 across, then 20 down: 40.
    expect(pathLength('M0 0 H20 V20')).toBeCloseTo(40, 6)
  })

  it('accepts axis-aligned and 45 degree segments, rejects anything else', () => {
    expect(isOrthoOr45([0, 0, 10, 0])).toBe(true)
    expect(isOrthoOr45([0, 0, 0, 10])).toBe(true)
    expect(isOrthoOr45([0, 0, 10, 10])).toBe(true)
    expect(isOrthoOr45([0, 0, 10, 4])).toBe(false)
  })
})

// Perpendicular distance between two parallel segments. This is what "pitch"
// means for a bundle that turns a corner: the vertical gap only measures it on
// the straights, and the straights are not where bundles go wrong.
function perpGap(a, b) {
  const [ax, ay, ax2, ay2] = a
  const len = Math.hypot(ax2 - ax, ay2 - ay)
  const ux = (ax2 - ax) / len
  const uy = (ay2 - ay) / len
  return Math.abs((b[0] - ax) * uy - (b[1] - ay) * ux)
}

// Closest approach of two segments, by dense sampling. Sampling rather than the
// exact formula because a test wants to be obviously right rather than clever.
function minGap(a, b) {
  const pts = ([x1, y1, x2, y2]) => {
    const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 4))
    return Array.from({ length: n + 1 }, (_, i) => [x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n])
  }
  let best = Infinity
  for (const [px, py] of pts(a)) {
    for (const [qx, qy] of pts(b)) best = Math.min(best, Math.hypot(px - qx, py - qy))
  }
  return best
}

describe('bus', () => {
  const spec = { fromX: 100, fromY: 50, toX: 200, count: 4, pitch: 6, rise: 12 }

  it('emits one trace per conductor, each ending on a via', () => {
    const { paths, vias } = bus(spec)
    expect(paths).toHaveLength(4)
    expect(vias).toHaveLength(4)
    for (const v of vias) expect(v.x).toBe(200)
  })

  it('holds constant pitch from the first trace to the last, across the dogleg', () => {
    // ⚠️ Measured on the SEGMENTS, not on the vias. The vias sit at
    // fromY + i*pitch + rise, which is constant-pitch by construction however
    // the dogleg is routed — an assertion against them cannot fail and would
    // have waved through the collinear-diagonal bug this test exists to catch.
    const traces = bus(spec).paths.map(segmentsOf)
    for (let i = 1; i < traces.length; i += 1) {
      expect(traces[i]).toHaveLength(traces[i - 1].length)
      for (let s = 0; s < traces[i].length; s += 1) {
        expect(perpGap(traces[i - 1][s], traces[i][s]), `trace ${i}, segment ${s}`).toBeCloseTo(6, 2)
      }
    }
  })

  it('never lets two conductors in a bundle touch', () => {
    // Staggering the dogleg by the pitch itself — the obvious choice — puts
    // adjacent diagonals on the same line. They do not merely converge; they
    // overlap, and the bundle reads as one thick smear at every corner.
    const traces = bus(spec).paths.map(segmentsOf)
    for (let i = 0; i < traces.length; i += 1) {
      for (let j = i + 1; j < traces.length; j += 1) {
        for (const a of traces[i]) {
          for (const b of traces[j]) {
            expect(minGap(a, b), `trace ${i} vs trace ${j}`).toBeGreaterThan(1)
          }
        }
      }
    }
  })

  it('turns only at right angles or 45 degrees', () => {
    for (const d of bus(spec).paths) {
      for (const seg of segmentsOf(d)) {
        expect(isOrthoOr45(seg), `${d} -> ${seg}`).toBe(true)
      }
    }
  })

  it('routes straight through when there is no rise', () => {
    const { paths } = bus({ ...spec, rise: 0 })
    expect(paths[0]).toBe('M100 50 H200')
  })
})

describe('serpentine', () => {
  // Four traces reaching pins at different depths — the situation a real DDR
  // fan-out is in, and the reason length-matching exists.
  //
  // ⚠️ The spread here is deliberate and bounded. A 45 degree detour buys at
  // most sqrt(2) times the straight run (see the ceiling test below), so a
  // bundle whose longest run is more than ~1.41x its shortest CANNOT be
  // matched by this technique at any amplitude. 80/60 = 1.33 is inside that.
  const spec = { fromX: 100, fromY: 40, ends: [180, 172, 165, 160], pitch: 5, amplitude: 3 }

  it('brings every trace in the bundle to the same length', () => {
    const lengths = serpentine(spec).paths.map(pathLength)
    const longest = Math.max(...lengths)
    for (const l of lengths) {
      // Tolerance is half a cycle's gain: cycles are whole, so exact equality
      // is not achievable and claiming it would be a lie about the model.
      expect(Math.abs(l - longest)).toBeLessThan(2)
    }
  })

  it('leaves the already-longest trace straight', () => {
    expect(serpentine(spec).paths[0]).toBe('M100 40 H180')
  })

  it('turns only at right angles or 45 degrees', () => {
    for (const d of serpentine(spec).paths) {
      for (const seg of segmentsOf(d)) {
        expect(isOrthoOr45(seg), `${d} -> ${seg}`).toBe(true)
      }
    }
  })

  it('never wiggles further than the run it has to play with', () => {
    for (const [i, d] of serpentine(spec).paths.entries()) {
      for (const [x1, , x2] of segmentsOf(d)) {
        expect(Math.max(x1, x2)).toBeLessThanOrEqual(spec.ends[i])
      }
    }
  })

  it('gives up rather than overrunning when the match is not physically possible', () => {
    // A 45 degree detour advances 2a of run for 2a*sqrt(2) of copper, so a
    // fully-serpentined trace is exactly sqrt(2) times its straight run. That
    // is a hard ceiling: asked to stretch a run of 40 to 80 — a factor of two —
    // the generator must stop at the fence rather than wander off it.
    const { paths } = serpentine({ ...spec, ends: [180, 140] })
    const stretched = pathLength(paths[1])
    expect(stretched).toBeLessThanOrEqual(40 * Math.SQRT2)
    expect(stretched).toBeGreaterThan(40)
    for (const [x1, , x2] of segmentsOf(paths[1])) {
      expect(Math.max(x1, x2)).toBeLessThanOrEqual(140)
    }
  })
})
