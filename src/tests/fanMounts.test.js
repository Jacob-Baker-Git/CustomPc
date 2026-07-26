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
