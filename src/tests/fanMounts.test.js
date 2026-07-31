import { FAN_MOUNTS, FAN_INSET } from '../lib/fanMounts'
import { caseInterior, CASE } from '../lib/assemblyGeometry'
import { mm, FAN_MM } from '../lib/pcScale'

const PANEL = mm(CASE.panelMm)

// A fan is a flat square: full width on two axes, thin on the axis it faces.
// The rotation tells us which axis is the thin one.
const halfExtents = ({ rotation }) => {
  const half = mm(FAN_MM) / 2
  const thin = mm(12.5)
  if (rotation[1]) return [thin, half, half]   // mounted on a front/rear panel
  if (rotation[0]) return [half, thin, half]   // mounted on the top panel
  return [half, half, thin]
}

const boxOf = (mount) => {
  const h = halfExtents(mount)
  return {
    min: mount.position.map((p, i) => p - h[i]),
    max: mount.position.map((p, i) => p + h[i]),
  }
}

describe('fanMounts', () => {
  // Air is pulled in the front and pushed out the back. Nothing mounts on the
  // top panel: that is where the AIO radiator lives, so a top row put two sets
  // of fan geometry in the same space.
  it('mounts every fan on a vertical end wall, never the top panel', () => {
    FAN_MOUNTS.forEach((mount, n) => {
      expect(mount.rotation[0], `fan ${n} should not face up or down`).toBe(0)
      expect(Math.abs(mount.rotation[1]), `fan ${n} should face along X`).toBeCloseTo(Math.PI / 2)
    })
  })

  it('is a three-fan front intake and a single rear exhaust', () => {
    const front = FAN_MOUNTS.filter((m) => m.position[0] > 0)
    const rear = FAN_MOUNTS.filter((m) => m.position[0] < 0)
    expect(front).toHaveLength(3)
    expect(rear).toHaveLength(1)
    expect(FAN_MOUNTS).toHaveLength(4)
  })

  // A fan now reaches INTO its panel's cut-out rather than stopping at the
  // interior boundary, so the shell — interior plus one panel thickness — is
  // what has to contain it. Sitting entirely inside the interior is what read
  // as the fans being stuck onto solid walls.
  it('keeps every fan within the case shell, never poking out of a wall', () => {
    const inner = caseInterior()
    const shell = {
      min: inner.min.map((v) => v - PANEL),
      max: inner.max.map((v) => v + PANEL),
    }
    FAN_MOUNTS.forEach((mount, n) => {
      const box = boxOf(mount)
      for (let i = 0; i < 3; i++) {
        expect(box.min[i], `fan ${n} axis ${i} min`).toBeGreaterThanOrEqual(shell.min[i] - 1e-6)
        expect(box.max[i], `fan ${n} axis ${i} max`).toBeLessThanOrEqual(shell.max[i] + 1e-6)
      }
    })
  })

  // The two axes it is NOT recessed on must still be fully inside.
  it('keeps every fan within the interior on the axes it is not recessed on', () => {
    const inner = caseInterior()
    FAN_MOUNTS.forEach((mount, n) => {
      const box = boxOf(mount)
      for (const i of [1, 2]) {
        expect(box.min[i], `fan ${n} axis ${i} min`).toBeGreaterThanOrEqual(inner.min[i] - 1e-6)
        expect(box.max[i], `fan ${n} axis ${i} max`).toBeLessThanOrEqual(inner.max[i] + 1e-6)
      }
    })
  })

  it('never lets two fans intersect each other', () => {
    for (let a = 0; a < FAN_MOUNTS.length; a++) {
      for (let b = a + 1; b < FAN_MOUNTS.length; b++) {
        const A = boxOf(FAN_MOUNTS[a])
        const B = boxOf(FAN_MOUNTS[b])
        let least = Infinity
        for (let i = 0; i < 3; i++) {
          least = Math.min(least, Math.min(A.max[i], B.max[i]) - Math.max(A.min[i], B.min[i]))
        }
        expect(least, `fan ${a} vs fan ${b}`).toBeLessThanOrEqual(1e-6)
      }
    }
  })
})

describe('fans are recessed into their panel, not parked against it', () => {
  // The complaint was that the fans sat ON the interior walls. They did: the
  // mount was one half-thickness inside the interior, so the frame finished
  // exactly on the panel's inner face — and CaseModel cut no aperture, so each
  // fan was stuck to blank metal.
  it('finishes each fan flush with the outside of its wall', () => {
    const inner = caseInterior()
    const thickHalf = mm(12.5)
    for (const mount of FAN_MOUNTS) {
      const x = mount.position[0]
      const outer = x > 0 ? x + thickHalf : x - thickHalf
      const wallOuter = x > 0 ? inner.max[0] + PANEL : inner.min[0] - PANEL
      expect(outer).toBeCloseTo(wallOuter, 9)
    }
  })

  it('buries only the panel thickness, leaving most of the frame inside', () => {
    const thickHalf = mm(12.5)
    expect(FAN_INSET).toBeCloseTo(PANEL - thickHalf, 9)
    expect(2 * thickHalf - PANEL).toBeGreaterThan(thickHalf)
  })
})

// Panel cut-outs moved to caseApertures.js — see caseApertures.test.js.
