import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { Matrix4, Vector3, Box3, Quaternion } from 'three'
import { PART_SPECS } from '../lib/partSpecs'
import { GLTF_MODELS } from '../lib/gltfModels'
import { FAN_MM } from '../lib/pcScale'

// Union bbox of a .glb, matching Box3.setFromObject(scene) — accessor min/max
// pushed through each node's world matrix. Quantised meshes (KHR_mesh_quantization
// / meshopt) store integers whose dequantisation lives in that same matrix, so
// `normalized` accessors are divided back down first.
const DIV = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }

// `materialName` narrows the result to the sub-mesh drawn with that material,
// letting a test ask where a specific feature sits inside a model rather than
// just how big the whole thing is.
function meshBounds(publicPath, materialName = null) {
  const file = resolve(process.cwd(), 'public', publicPath.replace(/^\//, ''))
  const buf = readFileSync(file)
  const json = JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString('utf8'))

  const local = (n) =>
    n.matrix
      ? new Matrix4().fromArray(n.matrix)
      : new Matrix4().compose(
          new Vector3().fromArray(n.translation || [0, 0, 0]),
          new Quaternion().fromArray(n.rotation || [0, 0, 0, 1]),
          new Vector3().fromArray(n.scale || [1, 1, 1]),
        )

  const box = new Box3()
  const walk = (idx, parent) => {
    const n = json.nodes[idx]
    const world = new Matrix4().multiplyMatrices(parent, local(n))
    if (n.mesh !== undefined) {
      for (const p of json.meshes[n.mesh].primitives || []) {
        if (materialName && json.materials?.[p.material]?.name !== materialName) continue
        const a = json.accessors[p.attributes?.POSITION]
        if (!a?.min) continue
        const d = a.normalized ? DIV[a.componentType] || 1 : 1
        for (let c = 0; c < 8; c++) {
          box.expandByPoint(
            new Vector3(
              (c & 1 ? a.max[0] : a.min[0]) / d,
              (c & 2 ? a.max[1] : a.min[1]) / d,
              (c & 4 ? a.max[2] : a.min[2]) / d,
            ).applyMatrix4(world),
          )
        }
      }
    }
    for (const child of n.children || []) walk(child, world)
  }
  for (const r of json.scenes?.[json.scene ?? 0]?.nodes ?? json.nodes.map((_, i) => i)) {
    walk(r, new Matrix4())
  }

  return box
}

const meshSize = (publicPath, materialName = null) => {
  const s = new Vector3()
  meshBounds(publicPath, materialName).getSize(s)
  return [s.x, s.y, s.z]
}

// PART_SPECS.raw is hand-recorded from each mesh, and EVERY size in the scene is
// derived from it — so if a model is ever re-exported or swapped, the numbers go
// stale silently and the whole assembly quietly mis-scales. Nothing else in the
// suite reads the actual files.
describe('PART_SPECS.raw matches the shipped meshes', () => {
  for (const [category, model] of Object.entries(GLTF_MODELS)) {
    it(`${category} matches ${model.url}`, () => {
      const actual = meshSize(model.url)
      PART_SPECS[category].raw.forEach((expected, i) => {
        // raw is recorded to 3dp, so allow the rounding as an absolute floor —
        // a relative bound alone is impossibly tight on near-zero axes like the
        // M.2 stick's 0.009 thickness. A genuinely different mesh misses by far
        // more than either.
        expect(Math.abs(actual[i] - expected)).toBeLessThan(Math.max(0.001, expected * 0.01))
      })
    })
  }
})

// Where the PCB actually is inside the motherboard mesh decides where EVERY
// board-mounted part sits. The board's bounding box is 49 mm deep because it
// includes the VRM heatsinks and the I/O shroud, so treating its front face as
// the mounting surface floated every part 41.6 mm clear of the board.
describe('motherboard PCB plane', () => {
  const spec = PART_SPECS.motherboard

  it('surfaceOffset still points at the mesh PCB component face', () => {
    const whole = meshBounds('/models/motherboard.glb')
    const pcb = meshBounds('/models/motherboard.glb', 'Board')
    const centre = new Vector3()
    whole.getCenter(centre)

    // Mesh Y is the board's thin axis; the PCB's +Y face is the component side.
    expect(spec.surfaceOffset[1]).toBeCloseTo(pcb.max.y - centre.y, 2)
  })

  it('puts the PCB face well behind the bounding box front', () => {
    const whole = meshBounds('/models/motherboard.glb')
    const size = new Vector3()
    whole.getSize(size)
    // Guards the actual defect: if these ever coincide the mounting surface has
    // silently reverted to the shroud.
    expect(spec.surfaceOffset[1]).toBeLessThan(size.y / 2 - 1)
  })
})

// The case fans are not PART_SPECS parts — they are instanced straight onto
// FAN_MOUNTS, which documents that every fan "faces +Z by default and is
// re-oriented by `rotation`". A replacement model that isn't square-on-XY and
// thin-in-Z would land edge-on in all seven mounts.
describe('case fan mesh', () => {
  const bounds = () => meshSize("/models/fan.glb")

  it('is square across X and Y', () => {
    const [x, y] = bounds()
    expect(Math.abs(x - y) / x).toBeLessThan(0.02)
  })

  it('faces +Z: its thinnest axis is Z', () => {
    const [x, y, z] = bounds()
    expect(z).toBeLessThan(x)
    expect(z).toBeLessThan(y)
  })

  it(`is proportioned like a real ${FAN_MM}mm fan (~25mm deep)`, () => {
    const [x, , z] = bounds()
    const depthMm = (z / x) * FAN_MM
    expect(depthMm).toBeGreaterThan(20)
    expect(depthMm).toBeLessThan(32)
  })
})
