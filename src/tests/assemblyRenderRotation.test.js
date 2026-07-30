import { describe, it, expect } from 'vitest'
import { Euler, Quaternion, Vector3, Matrix4, Box3 } from 'three'
import { GLTF_MODELS } from '../lib/gltfModels'
import { assemblyLayout } from '../lib/assemblyLayout'
import { PART_SPECS } from '../lib/partSpecs'
import { partSize, partLocalSize } from '../lib/assemblyGeometry'

const withMb = { motherboard: { id: 'mb-x' } }
const quat = (r) => new Quaternion().setFromEuler(new Euler(r[0], r[1], r[2]))

// World-space AABB of a raw mesh box after the given rotation.
const rotatedExtent = (raw, q) => {
  const m = new Matrix4().makeRotationFromQuaternion(q)
  const box = new Box3()
  for (let c = 0; c < 8; c++) {
    box.expandByPoint(
      new Vector3(
        (c & 1 ? 0.5 : -0.5) * raw[0],
        (c & 2 ? 0.5 : -0.5) * raw[1],
        (c & 4 ? 0.5 : -0.5) * raw[2],
      ).applyMatrix4(m),
    )
  }
  const s = new Vector3()
  box.getSize(s)
  return [s.x, s.y, s.z]
}

// A GLB is wrapped by TWO groups: PartModel's placement group (which takes its
// rotation from assemblyLayout) and GltfPart's own group. Their composition is
// what the camera actually sees, and it must equal the spec rotation applied
// EXACTLY ONCE — otherwise assemblyGeometry, which rotates once, is describing a
// scene that never renders, and every geometry test passes against a fiction.
describe('rendered part orientation matches assemblyGeometry', () => {
  const categories = Object.keys(GLTF_MODELS)

  it('covers every GLTF-backed category', () => {
    expect(categories).toEqual(
      expect.arrayContaining(['motherboard', 'gpu', 'cooler', 'ram', 'storage', 'psu']),
    )
  })

  for (const cat of categories) {
    it(`applies the ${cat} model rotation exactly once`, () => {
      const outer = quat(assemblyLayout(cat, withMb).rotation)
      const inner = quat(GLTF_MODELS[cat].rotation ?? [0, 0, 0])
      const total = outer.clone().multiply(inner)
      expect(total.angleTo(quat(PART_SPECS[cat].rotation))).toBeLessThan(1e-6)
    })

    it(`renders ${cat} at the size assemblyGeometry predicts`, () => {
      const outer = quat(assemblyLayout(cat, withMb).rotation)
      const inner = quat(GLTF_MODELS[cat].rotation ?? [0, 0, 0])
      // partLocalSize already carries the per-axis scale, so this covers the
      // stretched PSU as well as every uniformly-fitted part.
      const rendered = rotatedExtent(partLocalSize(cat), outer.clone().multiply(inner))
      partSize(cat).forEach((expected, i) => {
        expect(rendered[i]).toBeCloseTo(expected, 6)
      })
    })
  }

  // The plain-language version of the same bug: double-rotating [PI/2,0,0] gives
  // PI, which leaves the board thin along Y — lying flat on its back instead of
  // standing against the rear tray.
  it('stands the motherboard vertical: thinnest axis is Z, not Y', () => {
    const [x, y, z] = partSize('motherboard')
    expect(z).toBeLessThan(x)
    expect(z).toBeLessThan(y)

    const outer = quat(assemblyLayout('motherboard', withMb).rotation)
    const inner = quat(GLTF_MODELS.motherboard.rotation ?? [0, 0, 0])
    const [rx, ry, rz] = rotatedExtent(PART_SPECS.motherboard.raw, outer.clone().multiply(inner))
    expect(rz).toBeLessThan(rx)
    expect(rz).toBeLessThan(ry)
  })
})
