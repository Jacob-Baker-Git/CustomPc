import { FAN_MOUNTS } from '../lib/fanMounts'
import { caseInterior } from '../lib/assemblyGeometry'
import { mm, FAN_MM } from '../lib/pcScale'

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

  it('keeps every fan inside the case', () => {
    const inner = caseInterior()
    FAN_MOUNTS.forEach((mount, n) => {
      const box = boxOf(mount)
      for (let i = 0; i < 3; i++) {
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
