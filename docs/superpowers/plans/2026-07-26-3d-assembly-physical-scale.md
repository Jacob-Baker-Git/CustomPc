# 3D Assembly Physical Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3D PC parts sit at real-world scale and physically connect to each other, instead of floating at hand-guessed sizes and positions.

**Architecture:** One scale constant (`1 wu = 122 mm`) replaces arbitrary world units. Each part declares its real millimetre size and the connector it mounts by, and a pure geometry module derives every part's world-space box from those. Because the geometry is pure, correctness is proven by unit tests rather than by looking at the render — which matters because this machine's WebGL is wedged and the canvas cannot be inspected.

**Tech Stack:** React 19, Vite, three.js via @react-three/fiber + drei, Vitest.

---

## Coordinate convention (applies to every task)

The motherboard is centred at the world origin and stands vertical.

- **World X** = case front-to-back. **+X is toward the case front**, -X toward the rear I/O panel. The board's short edge lies along X.
- **World Y** = up. The board's 305 mm edge lies along Y.
- **World Z** = side-to-side. **+Z is out of the board toward the glass side panel** (the viewer). Components mount on the board's +Z face.

All millimetre values in `mountPoints.js` are measured from the board's centre.

## Measured constants (do not re-derive)

Raw GLB bounding boxes, measured from the mesh accessors:

| Category | raw bbox (x, y, z) |
|---|---|
| motherboard | 30.56, 4.96, 30.85 |
| gpu | 4.381, 30.187, 12.819 |
| cooler | 1.486, 1.935, 2.936 |
| psu | 20.446, 21.937, 22.73 |
| storage | 4.332, 0.009, 1.201 |
| ram | 0.033, 0.226, 0.608 |

The cooler's internal scale is **1 model unit = 92.3 mm**, established independently by its `Fan1`/`Fan2` nodes measuring 1.30 units (a 120 mm fan) and its `CPU` pump block measuring 0.45 x 0.76 x 0.76 (a ~70 mm block). Its 2.936-unit bbox is therefore 271 mm — a 240 AIO. The pump block's centre is offset from the mesh bbox centre by **[0.517, -0.589, -0.529]** model units.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/pcScale.js` (new) | The single scale constant and `mm()` helper. Nothing else. |
| `src/lib/partSpecs.js` (new) | Per category: raw bbox, the real size of one named axis, model rotation, anchor offset. |
| `src/lib/mountPoints.js` (new) | Where each part attaches to the board, in mm from board centre. |
| `src/lib/assemblyGeometry.js` (new) | Pure functions: part world size, world box, case interior. The testable core. |
| `src/lib/assemblyLayout.js` (modify) | Keeps its `{position, rotation}` API so `PartModel` is untouched, but derives values from the modules above. |
| `src/lib/gltfModels.js` (modify) | Drops `targetSize`; reads size and rotation from `partSpecs`. |
| `src/components/models/GltfPart.jsx` (modify) | Gains an optional `anchorNode`. |
| `src/components/models/CaseModel.jsx` (modify) | Shell dimensions from the geometry, plus a PSU basement shroud. |

---

## Task 1: The scale constant

**Files:**
- Create: `src/lib/pcScale.js`
- Test: `src/tests/pcScale.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { WU_PER_MM, mm } from '../lib/pcScale'

describe('pcScale', () => {
  it('maps a 305mm ATX board to the established 2.5 world units', () => {
    expect(mm(305)).toBeCloseTo(2.5, 2)
  })

  it('maps a 450mm tower to roughly the existing case height of 3.7', () => {
    expect(mm(450)).toBeCloseTo(3.69, 2)
  })

  it('exposes the ratio directly', () => {
    expect(WU_PER_MM).toBeCloseTo(1 / 122, 6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- pcScale`
Expected: FAIL, "Failed to resolve import ../lib/pcScale"

- [ ] **Step 3: Write the implementation**

```js
// One scale for the whole 3D scene: 1 world unit = 122 mm.
//
// Chosen so the established framing keeps working — a 305 mm ATX board lands on
// 2.50 world units, matching the size the camera and zoom clamps were already
// built around. Every physical dimension goes through mm() so parts share one
// scale and can actually connect to each other.
export const WU_PER_MM = 1 / 122

export const mm = (v) => v * WU_PER_MM
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- pcScale`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/pcScale.js src/tests/pcScale.test.js
git commit -m "feat: Add a single physical scale constant for the 3D scene"
```

---

## Task 2: Part specs in real millimetres

A mesh's aspect ratio is fixed, so one true dimension sizes the whole model.
`fitAxis` names which **world** axis `lengthMm` refers to after rotation, because
the most reliably-known dimension differs per part: a GPU is quoted by length, a
PSU by height.

**Files:**
- Create: `src/lib/partSpecs.js`
- Test: `src/tests/partSpecs.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { PART_SPECS } from '../lib/partSpecs'

describe('partSpecs', () => {
  it('sizes every part against a real-world reference', () => {
    expect(PART_SPECS.motherboard.lengthMm).toBe(305) // ATX long edge
    expect(PART_SPECS.gpu.lengthMm).toBe(285)         // RTX 3080 FE
    expect(PART_SPECS.cooler.lengthMm).toBe(271)      // measured 240 AIO
    expect(PART_SPECS.ram.lengthMm).toBe(133)         // DDR4 DIMM
    expect(PART_SPECS.psu.lengthMm).toBe(86)          // ATX PSU height
    expect(PART_SPECS.storage.lengthMm).toBe(80)      // M.2 2280
  })

  it('records the raw GLB bounding box for every part', () => {
    for (const [cat, spec] of Object.entries(PART_SPECS)) {
      expect(spec.raw, cat).toHaveLength(3)
      expect(Math.max(...spec.raw), cat).toBeGreaterThan(0)
    }
  })

  it('uses only right-angle rotations, so world boxes stay axis-aligned', () => {
    for (const [cat, spec] of Object.entries(PART_SPECS)) {
      for (const r of spec.rotation) {
        expect(Math.abs(r % (Math.PI / 2)), cat).toBeCloseTo(0, 6)
      }
    }
  })

  it('names a valid fit axis where one is given', () => {
    for (const [cat, spec] of Object.entries(PART_SPECS)) {
      if (spec.fitAxis !== undefined) expect([0, 1, 2], cat).toContain(spec.fitAxis)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- partSpecs`
Expected: FAIL, "Failed to resolve import ../lib/partSpecs"

- [ ] **Step 3: Write the implementation**

```js
// Physical spec per part category.
//
// `raw`        — the GLB's own bounding box (x,y,z), measured from its accessors.
// `lengthMm`   — the real-world size of ONE axis. Since a mesh's aspect ratio is
//                fixed, one true dimension sizes the whole model.
// `fitAxis`    — which WORLD axis (0=X, 1=Y, 2=Z) lengthMm refers to, after
//                rotation. Omitted means "the longest axis".
// `rotation`   — model-local rotation bringing the mesh into scene convention
//                (+X case front, +Y up, +Z toward the glass). Right angles only.
// `anchorNode` — optional sub-node to align on instead of the bbox centre.
// `anchorOffset` — vector from the mesh bbox centre to that node's centre, in
//                raw model units. Kept here so the pure geometry can predict
//                where an anchored part lands without loading the mesh.
export const PART_SPECS = {
  // The board's long (305 mm) edge is mesh Z and must stand vertical, so mesh Z
  // maps to world Y.
  motherboard: { raw: [30.56, 4.96, 30.85], lengthMm: 305, rotation: [Math.PI / 2, 0, 0] },

  // Card lies horizontal: the mesh's long axis (30.187) becomes world X.
  gpu: { raw: [4.381, 30.187, 12.819], lengthMm: 285, rotation: [0, 0, Math.PI / 2] },

  // 240 AIO assembly. Mesh +Y is up (the pump block sits below the radiator) and
  // the radiator's long axis is mesh Z, which must run front-to-back (world X).
  // Anchoring on the pump block puts the radiator at the case top by itself —
  // the mesh locks them 131 mm apart, matching a real socket-to-radiator gap.
  cooler: {
    raw: [1.486, 1.935, 2.936],
    lengthMm: 271,
    rotation: [0, Math.PI / 2, 0],
    anchorNode: 'CPU',
    anchorOffset: [0.517, -0.589, -0.529],
    // Pump block's own bbox, so the block (not the whole assembly) sits flush on
    // the board. Without this the full 137 mm-deep cooler is pushed out from the
    // board face and the radiator punches through the side panel.
    anchorSize: [0.45, 0.76, 0.76],
  },

  // A DIMM stands edge-on in its slot: its 133 mm length is mesh Z and must run
  // vertical (world Y), leaving the 7 mm thickness across the board.
  ram: { raw: [0.033, 0.226, 0.608], lengthMm: 133, rotation: [Math.PI / 2, 0, 0] },

  // Flat M.2 stick lying on the board face: 80 mm along world X, 22 mm up, and
  // near-zero thickness toward the glass.
  storage: { raw: [4.332, 0.009, 1.201], lengthMm: 80, rotation: [Math.PI / 2, 0, 0] },

  // The PSU mesh is near-cubic, so sizing it by its longest axis would make it
  // far too tall for a basement. Pin its HEIGHT to a real 86 mm ATX unit instead.
  psu: { raw: [20.446, 21.937, 22.73], lengthMm: 86, fitAxis: 1, rotation: [0, 0, 0] },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- partSpecs`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/partSpecs.js src/tests/partSpecs.test.js
git commit -m "feat: Describe every 3D part by its real-world dimensions"
```

---

## Task 3: Derive world-space size from the specs

**Files:**
- Create: `src/lib/assemblyGeometry.js`
- Test: `src/tests/assemblyGeometry.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { partSize, rotateExtents, rotateVector } from '../lib/assemblyGeometry'
import { mm } from '../lib/pcScale'

const near = (v, expectedMm) => expect(v).toBeCloseTo(mm(expectedMm), 2)

describe('rotateExtents', () => {
  it('swaps Y and Z for a quarter turn about X', () => {
    expect(rotateExtents([1, 2, 3], [Math.PI / 2, 0, 0])).toEqual([1, 3, 2])
  })

  it('leaves extents untouched for a half turn', () => {
    expect(rotateExtents([1, 2, 3], [Math.PI, 0, 0])).toEqual([1, 2, 3])
  })
})

describe('rotateVector', () => {
  // Unlike extents, a signed offset must keep its direction. Right-hand rule
  // about X, matching three.js: +Y goes to +Z, and +Z goes to -Y.
  it('rotates a signed offset about X', () => {
    const [x, y, z] = rotateVector([0, 0, 1], [Math.PI / 2, 0, 0])
    expect([x, +y.toFixed(6), +z.toFixed(6)]).toEqual([0, -1, 0])
  })

  it('flips a vector under a half turn, where extents would not change', () => {
    const [, y] = rotateVector([0, 1, 0], [Math.PI, 0, 0])
    expect(+y.toFixed(6)).toBe(-1)
  })
})

describe('partSize', () => {
  it('sizes the motherboard as a 305mm ATX board standing vertical', () => {
    near(partSize('motherboard')[1], 305)
  })

  it('lays the GPU horizontal, 285mm front-to-back', () => {
    near(partSize('gpu')[0], 285)
  })

  it('stands a DIMM edge-on: 133mm tall, thin across the board', () => {
    const [x, y, z] = partSize('ram')
    near(y, 133)
    expect(x).toBeLessThan(z)
    expect(x).toBeLessThan(mm(15))
  })

  it('lays the M.2 flat against the board', () => {
    const [x, , z] = partSize('storage')
    near(x, 80)
    expect(z).toBeLessThan(mm(5))
  })

  it('runs the AIO radiator front-to-back rather than tipping it over', () => {
    const [x, y] = partSize('cooler')
    expect(x).toBeGreaterThan(y)
  })

  it('pins the PSU to a real 86mm height via fitAxis', () => {
    near(partSize('psu')[1], 86)
  })

  it('returns a zero-size box for an unknown category', () => {
    expect(partSize('banana')).toEqual([0, 0, 0])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- assemblyGeometry`
Expected: FAIL, "Failed to resolve import ../lib/assemblyGeometry"

- [ ] **Step 3: Write the implementation**

```js
import { mm } from './pcScale'
import { PART_SPECS } from './partSpecs'

const HALF_PI = Math.PI / 2
const isQuarterTurn = (a) => Math.abs(Math.abs(a) - HALF_PI) < 1e-6

// Swap extents for a right-angle rotation. Every rotation in PART_SPECS is a
// multiple of 90 degrees, so a rotated box stays axis-aligned and we only need
// to permute its dimensions — no matrix maths, and the result stays exact.
// A half turn leaves extents unchanged, which is why only quarter turns swap.
export function rotateExtents([x, y, z], [rx, ry, rz]) {
  let out = [x, y, z]
  if (isQuarterTurn(rx)) out = [out[0], out[2], out[1]]
  if (isQuarterTurn(ry)) out = [out[2], out[1], out[0]]
  if (isQuarterTurn(rz)) out = [out[1], out[0], out[2]]
  return out
}

// Rotate a SIGNED vector. Extents only need permuting, but an offset must keep
// its direction — getting this wrong would place an anchored part on the wrong
// side of its mount. Applied X then Y then Z, matching three.js's default order.
export function rotateVector([x, y, z], [rx, ry, rz]) {
  let v = [x, y, z]
  const spin = (a, b, angle) => [a * Math.cos(angle) - b * Math.sin(angle), a * Math.sin(angle) + b * Math.cos(angle)]
  if (rx) { const [ny, nz] = spin(v[1], v[2], rx); v = [v[0], ny, nz] }
  if (ry) { const [nz, nx] = spin(v[2], v[0], ry); v = [nx, v[1], nz] }
  if (rz) { const [nx, ny] = spin(v[0], v[1], rz); v = [nx, ny, v[2]] }
  return v
}

// Uniform scale taking raw model units to world units for a category.
export function modelScale(category) {
  const spec = PART_SPECS[category]
  if (!spec) return 0
  const rotated = rotateExtents(spec.raw, spec.rotation)
  const basis = spec.fitAxis === undefined ? Math.max(...rotated) : rotated[spec.fitAxis]
  return mm(spec.lengthMm) / basis
}

// World-space size of a part, in world units, after its model rotation.
export function partSize(category) {
  const spec = PART_SPECS[category]
  if (!spec) return [0, 0, 0]
  const scale = modelScale(category)
  return rotateExtents(spec.raw, spec.rotation).map((v) => v * scale)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- assemblyGeometry`
Expected: PASS, every test in the file

- [ ] **Step 5: Commit**

```bash
git add src/lib/assemblyGeometry.js src/tests/assemblyGeometry.test.js
git commit -m "feat: Derive 3D part sizes from real dimensions"
```

---

## Task 4: Mount points on the motherboard

**Files:**
- Create: `src/lib/mountPoints.js`
- Test: `src/tests/mountPoints.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { BOARD, MOUNTS } from '../lib/mountPoints'

describe('mountPoints', () => {
  it('describes an ATX board: 244mm front-to-back, 305mm tall', () => {
    expect(BOARD.widthMm).toBe(244)
    expect(BOARD.heightMm).toBe(305)
  })

  it('keeps every mount point on the board', () => {
    for (const [name, m] of Object.entries(MOUNTS)) {
      expect(Math.abs(m.xMm), name).toBeLessThanOrEqual(BOARD.widthMm / 2)
      expect(Math.abs(m.yMm), name).toBeLessThanOrEqual(BOARD.heightMm / 2)
    }
  })

  it('puts the CPU socket above the PCIe slot, as on a real board', () => {
    expect(MOUNTS.cpu.yMm).toBeGreaterThan(MOUNTS.gpu.yMm)
  })

  it('mounts the cooler on the CPU socket itself', () => {
    expect(MOUNTS.cooler).toEqual(MOUNTS.cpu)
  })

  it('puts the DIMM slots toward the case front, clear of the socket', () => {
    expect(MOUNTS.ram.xMm).toBeGreaterThan(MOUNTS.cpu.xMm)
  })

  it('spaces DIMM slots so two sticks cannot overlap', () => {
    expect(MOUNTS.ram.pitchMm).toBeGreaterThanOrEqual(7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- mountPoints`
Expected: FAIL, "Failed to resolve import ../lib/mountPoints"

- [ ] **Step 3: Write the implementation**

```js
// Where parts attach to the motherboard, in millimetres from the board's centre.
//
// Parts derive their position from the connector they plug into rather than from
// absolute scene coordinates, so they cannot drift apart from each other and a
// new model lands correctly without eyeball tuning.
//
// +X is toward the case front, +Y is up, +Z is out of the board toward the glass.
export const BOARD = {
  widthMm: 244,   // ATX short edge, front-to-back
  heightMm: 305,  // ATX long edge, vertical
  standoffMm: 8,  // board sits this far off the rear tray
}

// The socket anchors both the CPU and the cooler that clamps onto it.
const SOCKET = { xMm: -20, yMm: 75 }

export const MOUNTS = {
  cpu: SOCKET,
  cooler: SOCKET,
  // DIMM slots run vertically, ahead of the socket, sticks spaced along X.
  ram: { xMm: 70, yMm: 40, pitchMm: 10 },
  // Primary PCIe x16, below the socket. The card extends toward the case front.
  gpu: { xMm: -95, yMm: -55 },
  // M.2 slot between the socket and the PCIe slot.
  storage: { xMm: -10, yMm: -20 },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- mountPoints`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/mountPoints.js src/tests/mountPoints.test.js
git commit -m "feat: Define motherboard mount points for the 3D assembly"
```

---

## Task 5: Place parts from their mount points

An anchored part must land so its **connector** sits on the mount point, not its
bounding-box centre. The cooler is the case that proves this: its pump block is
54 mm below its mesh centre, so ignoring the offset would hang the radiator half
a socket too low and the geometry would disagree with the render.

**Files:**
- Modify: `src/lib/assemblyGeometry.js`
- Test: `src/tests/assemblyGeometry.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/assemblyGeometry.test.js`:

```js
import { partCentre, partBox, boardFaceZ } from '../lib/assemblyGeometry'
import { MOUNTS } from '../lib/mountPoints'

describe('partCentre', () => {
  it('centres the motherboard on the origin', () => {
    expect(partCentre('motherboard')).toEqual([0, 0, 0])
  })

  it('mounts RAM, GPU and M.2 in front of the board face, never inside it', () => {
    for (const cat of ['ram', 'gpu', 'storage']) {
      expect(partBox(cat).min[2], cat).toBeGreaterThanOrEqual(boardFaceZ() - 1e-6)
    }
  })

  it('lands the cooler pump block on the socket, not the mesh centre', () => {
    // The radiator hangs well above the socket, so the bbox centre must sit
    // higher than the mount point it is anchored by.
    expect(partCentre('cooler')[1]).toBeGreaterThan(mm(MOUNTS.cooler.yMm))
  })

  it('sits the GPU below the cooler', () => {
    expect(partCentre('gpu')[1]).toBeLessThan(partCentre('cooler')[1])
  })
})

describe('partBox', () => {
  it('returns a box consistent with the part size', () => {
    const box = partBox('gpu')
    expect(box.max[0] - box.min[0]).toBeCloseTo(partSize('gpu')[0], 6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- assemblyGeometry`
Expected: FAIL, "partCentre is not a function"

- [ ] **Step 3: Write the implementation**

Append to `src/lib/assemblyGeometry.js`:

```js
import { MOUNTS } from './mountPoints'

// The board's front face — where mounted components begin.
export function boardFaceZ() {
  return partSize('motherboard')[2] / 2
}

// Offset from a part's bbox centre to its anchor node, in world units and world
// axes. Zero for parts that mount by their body rather than a named connector.
function anchorOffsetWorld(category) {
  const spec = PART_SPECS[category]
  if (!spec?.anchorOffset) return [0, 0, 0]
  const scale = modelScale(category)
  return rotateVector(spec.anchorOffset, spec.rotation).map((v) => v * scale)
}

// Depth of the part's mounting face along world Z. For an anchored part that is
// the connector's own depth — an AIO touches the board only at its pump block,
// so placing its whole bounding box against the face would shove the radiator
// through the side panel. Uses rotateExtents because this is a size, not a
// signed offset.
function mountDepth(category) {
  const spec = PART_SPECS[category]
  const [, , depth] = partSize(category)
  if (!spec?.anchorSize) return depth
  return rotateExtents(spec.anchorSize, spec.rotation)[2] * modelScale(category)
}

// Centre of a part in world units, derived from its mount point. Mounted parts
// sit against the board's +Z face and extend outward by half their mounting
// depth; anchored parts are shifted so their connector, not their centre, lands
// on the mount point.
export function partCentre(category) {
  if (category === 'motherboard') return [0, 0, 0]

  const mount = MOUNTS[category]
  if (!mount) return [0, 0, 0]

  const offset = anchorOffsetWorld(category)
  return [
    mm(mount.xMm) - offset[0],
    mm(mount.yMm) - offset[1],
    boardFaceZ() + mountDepth(category) / 2 - offset[2],
  ]
}

export function partBox(category) {
  const size = partSize(category)
  const centre = partCentre(category)
  return {
    min: centre.map((c, i) => c - size[i] / 2),
    max: centre.map((c, i) => c + size[i] / 2),
  }
}
```

The anchor offset goes through `rotateVector`, **not** `rotateExtents`. Extents
only need their axes permuted, but a signed offset must keep its direction — using
the extent version here would place the cooler roughly 48 mm off along Z.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- assemblyGeometry`
Expected: PASS, every test in the file

- [ ] **Step 5: Commit**

```bash
git add src/lib/assemblyGeometry.js src/tests/assemblyGeometry.test.js
git commit -m "feat: Place 3D parts by their connector, not their bounding box"
```

---

## Task 6: Case interior and the PSU basement

The PSU is the one part that does not mount to the board — it sits in a basement
below it, which is what stops it intersecting the board.

`CASE.heightMm` starts at 500. **The containment test is the arbiter**: if a part
escapes the interior, raise the height or move the offending mount point. Do not
relax the test.

**Files:**
- Modify: `src/lib/assemblyGeometry.js`
- Test: `src/tests/assemblyGeometry.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/tests/assemblyGeometry.test.js`:

```js
import { caseInterior, CASE } from '../lib/assemblyGeometry'

describe('caseInterior', () => {
  it('is a real tower, deep enough for a board plus cooler clearance', () => {
    expect(CASE.depthMm).toBe(450)
    expect(CASE.widthMm).toBe(210)
    expect(CASE.heightMm).toBeGreaterThanOrEqual(450)
  })

  it('contains every part', () => {
    const inner = caseInterior()
    for (const cat of ['motherboard', 'gpu', 'ram', 'storage', 'psu', 'cooler']) {
      const box = partBox(cat)
      for (let i = 0; i < 3; i++) {
        expect(box.min[i], `${cat} axis ${i} min`).toBeGreaterThanOrEqual(inner.min[i] - 1e-6)
        expect(box.max[i], `${cat} axis ${i} max`).toBeLessThanOrEqual(inner.max[i] + 1e-6)
      }
    }
  })

  it('sits the PSU in the basement, entirely below the board', () => {
    expect(partBox('psu').max[1]).toBeLessThanOrEqual(partBox('motherboard').min[1] + 1e-6)
  })

  it('gives the basement room for the PSU', () => {
    const [, psuHeight] = partSize('psu')
    expect(mm(CASE.basementMm)).toBeGreaterThan(psuHeight)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- assemblyGeometry`
Expected: FAIL, "caseInterior is not a function"

- [ ] **Step 3: Write the implementation**

Append to `src/lib/assemblyGeometry.js`:

```js
import { BOARD } from './mountPoints'

// Tower interior. Height carries a PSU basement below the board and a
// top-mounted radiator above it, so it runs taller than the board alone needs.
export const CASE = {
  heightMm: 500,
  depthMm: 450,    // front-to-back, world X
  widthMm: 210,    // side-to-side, world Z
  basementMm: 110, // PSU compartment below the board
}

// Interior bounds in world units, anchored off the board: the rear tray sits one
// standoff behind the board, and the basement hangs below the board's lower edge.
export function caseInterior() {
  const board = partBox('motherboard')
  const rearZ = board.min[2] - mm(BOARD.standoffMm)
  const floorY = board.min[1] - mm(CASE.basementMm)
  return {
    min: [-mm(CASE.depthMm) / 2, floorY, rearZ],
    max: [mm(CASE.depthMm) / 2, floorY + mm(CASE.heightMm), rearZ + mm(CASE.widthMm)],
  }
}
```

Then add a PSU branch to `partCentre`, immediately after the `motherboard` branch:

```js
  if (category === 'psu') {
    const board = partBox('motherboard')
    const [, height, depth] = partSize('psu')
    const floorY = board.min[1] - mm(CASE.basementMm)
    const rearZ = board.min[2] - mm(BOARD.standoffMm)
    // Stands on the basement floor, pushed back against the rear tray.
    return [mm(-30), floorY + height / 2 + mm(8), rearZ + depth / 2 + mm(8)]
  }
```

`CASE` is referenced by `partCentre` before its declaration in file order. That is
safe for a module-scope `const` because `partCentre` only runs after the module
has finished evaluating.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- assemblyGeometry`
Expected: PASS. If the cooler's radiator escapes the top, raise `CASE.heightMm`
in 20 mm steps until it fits. If the GPU escapes the front, reduce
`MOUNTS.gpu.xMm` magnitude.

- [ ] **Step 5: Commit**

```bash
git add src/lib/assemblyGeometry.js src/tests/assemblyGeometry.test.js
git commit -m "feat: Size the case to a real tower with a PSU basement"
```

---

## Task 7: Prove nothing intersects

This is the test that encodes "the parts are connected properly" and guards the
whole class of regression.

**Files:**
- Create: `src/tests/assemblyNoOverlap.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { partBox, partSize } from '../lib/assemblyGeometry'
import { MOUNTS } from '../lib/mountPoints'
import { mm } from '../lib/pcScale'

// The cooler is deliberately absent. It is an L-shaped assembly — pump block low
// on the board, radiator high above it, tubes between — so its bounding box
// encloses a large volume it does not physically occupy, and the RAM legitimately
// sits inside that empty space. An AABB test would report a collision that isn't
// real. It gets its own targeted assertions below instead.
const PARTS = ['motherboard', 'gpu', 'ram', 'storage', 'psu']

// Pairs allowed to touch, because one physically mounts onto the other.
const MOUNTED_PAIRS = new Set(['gpu|motherboard'])

const key = (a, b) => [a, b].sort().join('|')

// Flush-mounted parts (ram, gpu, storage) sit with their back face exactly on
// boardFaceZ() by design — zero physical gap. That boundary computes centre
// +half-depth then -half-depth from the same value, which IEEE-754 does not
// guarantee to cancel to exactly zero. A genuine intersection from a misplaced
// mount point is millimetres wide, orders of magnitude above this floor, so the
// tolerance cannot hide a real defect.
const TOUCH_EPSILON = 1e-6

// Smallest per-axis overlap. Positive on all three axes means the boxes really
// do intersect; zero or negative means they are clear of each other.
const overlap = (a, b) => {
  const A = partBox(a)
  const B = partBox(b)
  let least = Infinity
  for (let i = 0; i < 3; i++) {
    least = Math.min(least, Math.min(A.max[i], B.max[i]) - Math.max(A.min[i], B.min[i]))
  }
  return least
}

describe('assembly has no floating or intersecting parts', () => {
  it('never lets two unrelated parts occupy the same space', () => {
    for (let i = 0; i < PARTS.length; i++) {
      for (let j = i + 1; j < PARTS.length; j++) {
        if (MOUNTED_PAIRS.has(key(PARTS[i], PARTS[j]))) continue
        expect(overlap(PARTS[i], PARTS[j]), `${PARTS[i]} vs ${PARTS[j]}`).toBeLessThanOrEqual(TOUCH_EPSILON)
      }
    }
  })

  it('keeps the two RAM sticks apart from each other', () => {
    expect(mm(MOUNTS.ram.pitchMm)).toBeGreaterThan(partSize('ram')[0])
  })

  // The cooler's own guard, replacing the AABB check it cannot meaningfully take.
  // Its radiator must clear the board's top edge entirely — that is what proves
  // the only part of it crossing RAM height is the empty span between block and
  // radiator, not solid geometry.
  it('lifts the AIO radiator clear of the board, above everything mounted on it', () => {
    const board = partBox('motherboard')
    const cooler = partBox('cooler')
    const radiatorThickness = mm(25)
    expect(cooler.max[1] - radiatorThickness).toBeGreaterThan(board.max[1])
  })
})
```

- [ ] **Step 2: Run test to verify it fails or passes honestly**

Run: `npm run test:run -- assemblyNoOverlap`
Expected: either PASS, or a named collision such as "ram vs cooler".

- [ ] **Step 3: Resolve any real overlaps**

Move the offending mount point in `src/lib/mountPoints.js`. **Do not add the pair
to `MOUNTED_PAIRS` to silence it** — that set is only for parts that physically
bolt onto each other, and excluding a pair to make a red test go green is exactly
the failure this task exists to prevent. Re-run after each change.

Note `MOUNTS.gpu.xMm` was already corrected to -70 during Task 6 (at -95 the card
overhung the case front by 12 mm), so the GPU should already be clear.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- assemblyNoOverlap`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/tests/assemblyNoOverlap.test.js src/lib/mountPoints.js
git commit -m "test: Prove no 3D part floats or intersects another"
```

---

## Task 8: Anchor GLTF models by their connector

**Files:**
- Modify: `src/components/models/GltfPart.jsx`
- Modify: `src/lib/gltfModels.js`

- [ ] **Step 1: Add anchorNode support to GltfPart**

Replace the component body in `src/components/models/GltfPart.jsx`:

```jsx
export default function GltfPart({ url, targetSize = 2, rotation = [0, 0, 0], position = [0, 0, 0], anchorNode }) {
  const { scene } = useGLTF(url)

  const { object, scale } = useMemo(() => {
    const obj = scene.clone(true)
    obj.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z) || 1

    // Align on the named connector when given (the AIO's pump block, say) so the
    // part meets its mount at the right point. Falls back to the bounding-box
    // centre, which is right for parts whose body IS the mounting surface.
    const anchor = anchorNode ? obj.getObjectByName(anchorNode) : null
    const centre = new THREE.Vector3()
    if (anchor) new THREE.Box3().setFromObject(anchor).getCenter(centre)
    else box.getCenter(centre)

    obj.position.sub(centre)
    return { object: obj, scale: targetSize / maxDim }
  }, [scene, targetSize, anchorNode])

  return (
    <group position={position} rotation={rotation}>
      <group scale={scale}>
        <primitive object={object} />
      </group>
    </group>
  )
}
```

- [ ] **Step 2: Point gltfModels at the specs**

Rewrite `src/lib/gltfModels.js` so size and rotation come from the specs rather
than being duplicated here.

```js
import { PART_SPECS } from './partSpecs'
import { modelScale } from './assemblyGeometry'
import { mm } from './pcScale'
import { MOUNTS } from './mountPoints'

// Categories backed by a real GLB in /public/models. Size and orientation come
// from PART_SPECS so the render and the geometry tests can never disagree. Any
// category missing here keeps its procedural model, and a GLB that fails to load
// falls back to the primitive — so adding an entry is always safe.
const FILES = {
  motherboard: 'motherboard.glb',
  gpu: 'gpu.glb',
  cooler: 'cooler.glb',
  ram: 'ram.glb',
  storage: 'storage.glb',
  psu: 'psu.glb',
}

// Two DIMMs, spaced along the board's front-to-back axis by the slot pitch.
const ramOffsets = () => {
  const half = mm(MOUNTS.ram.pitchMm) / 2
  return [[-half, 0, 0], [half, 0, 0]]
}

export const GLTF_MODELS = Object.fromEntries(
  Object.entries(FILES).map(([cat, file]) => {
    const spec = PART_SPECS[cat]
    return [cat, {
      url: `/models/${file}`,
      // GltfPart scales by the mesh's largest raw dimension, so hand it the
      // world size of that same axis.
      targetSize: Math.max(...spec.raw) * modelScale(cat),
      rotation: spec.rotation,
      position: [0, 0, 0],
      ...(spec.anchorNode ? { anchorNode: spec.anchorNode } : {}),
      ...(cat === 'ram' ? { instances: ramOffsets() } : {}),
    }]
  })
)
```

- [ ] **Step 3: Run the full suite**

Run: `npm run test:run`
Expected: PASS, all tests.

- [ ] **Step 4: Verify the bundle builds**

Run: `npm run build`
Expected: "built in ..." with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/models/GltfPart.jsx src/lib/gltfModels.js
git commit -m "feat: Anchor GLTF parts by their connector, not their bounding box"
```

---

## Task 9: Drive the layout and the case from the geometry

**Files:**
- Modify: `src/lib/assemblyLayout.js`
- Modify: `src/components/models/CaseModel.jsx`
- Test: `src/tests/assemblyLayout.test.js`

- [ ] **Step 1: Point assemblyLayout at the geometry module**

In `src/lib/assemblyLayout.js`, replace the `MOUNTED` table with derivations,
keeping the exported API identical so `PartModel` needs no change:

```js
import { partCentre, caseInterior } from './assemblyGeometry'
import { PART_SPECS } from './partSpecs'

// Positions come from assemblyGeometry so the render matches what the geometry
// tests prove. Rotation is the part's model rotation — PART_SPECS already
// orients each mesh into scene convention, so there is no second rotation to
// compose here.
const MOUNTED_CATEGORIES = ['motherboard', 'cpu', 'cooler', 'ram', 'storage', 'gpu', 'psu']

const mountedTransform = (category) => ({
  position: partCentre(category),
  rotation: PART_SPECS[category]?.rotation ?? [0, 0, 0],
})
```

Keep `FALLBACK` and `DEFAULT_TRANSFORM` exactly as they are. Replace the mounted
branch of `assemblyLayout` with:

```js
  if (MOUNTED_CATEGORIES.includes(category)) return mountedTransform(category)

  if (category === 'case') {
    const inner = caseInterior()
    return {
      position: inner.min.map((v, i) => (v + inner.max[i]) / 2),
      rotation: [0, 0, 0],
    }
  }

  if (category === 'fans') return { position: [0, 1.55, 0.05], rotation: [0, 0, 0] }

  return DEFAULT_TRANSFORM
```

- [ ] **Step 2: Update the one layout assertion that no longer holds**

`assemblyLayout.test.js` asserts the cooler's Z is greater than the CPU's. They
now share a socket anchor, so compare their front faces instead. Replace that test:

```js
  it('mounts the cooler in front of the CPU (sitting on it) when a motherboard is present', () => {
    const cpu = assemblyLayout('cpu', withMb).position[2]
    const cooler = assemblyLayout('cooler', withMb).position[2]
    expect(cooler).toBeGreaterThanOrEqual(cpu)
  })
```

- [ ] **Step 3: Size the case shell from the interior**

In `src/components/models/CaseModel.jsx`, replace the hardcoded `W`/`H`/`D`
constants. The panel-drawing code below is unchanged — it is all expressed in
terms of `W`, `H`, `D` and `T`.

```jsx
import { caseInterior, CASE } from '../../lib/assemblyGeometry'
import { mm } from '../../lib/pcScale'

const inner = caseInterior()
const W = inner.max[0] - inner.min[0]  // front-to-back
const H = inner.max[1] - inner.min[1]  // height
const D = inner.max[2] - inner.min[2]  // side-to-side
const T = mm(7)                        // panel thickness
```

Add the basement shroud inside the solid-mode `<group>`, immediately before the
tempered-glass panel:

```jsx
      {/* PSU basement shroud — the deck the board sits above */}
      <Panel args={[W, T, D]} position={[0, -H / 2 + mm(CASE.basementMm), 0]} color="#1a1c21" />
```

- [ ] **Step 4: Run the full suite, build and lint**

Run: `npm run test:run && npm run build && npm run lint`
Expected: all tests pass, build succeeds, lint reports only the 2 known
pre-existing `SpecSheet.jsx` react-refresh errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/assemblyLayout.js src/components/models/CaseModel.jsx src/tests/assemblyLayout.test.js
git commit -m "feat: Drive the 3D layout and case from the physical geometry"
```

---

## Task 10: Scale the case fans

**Files:**
- Modify: `src/components/models/FanUnit.jsx`
- Test: `src/tests/assemblyGeometry.test.js`

- [ ] **Step 1: Find the fan's current size**

Read `src/components/models/FanUnit.jsx` and locate the constant controlling the
fan's diameter (the radius or width fed to its geometry).

- [ ] **Step 2: Write the failing test**

Append to `src/tests/assemblyGeometry.test.js`:

```js
import { FAN_MM } from '../lib/pcScale'

describe('case fans', () => {
  it('uses a real 120mm fan', () => {
    expect(FAN_MM).toBe(120)
    expect(mm(FAN_MM)).toBeCloseTo(0.98, 2)
  })
})
```

- [ ] **Step 3: Add the constant and use it**

In `src/lib/pcScale.js`:

```js
// Standard case fan, used for both the fan models and the vent grilles they sit behind.
export const FAN_MM = 120
```

In `FanUnit.jsx`, replace the hardcoded diameter with `mm(FAN_MM)`, importing
`mm` and `FAN_MM` from `../../lib/pcScale`. Keep blade count and animation as they are.

- [ ] **Step 4: Run the full suite**

Run: `npm run test:run`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pcScale.js src/components/models/FanUnit.jsx src/tests/assemblyGeometry.test.js
git commit -m "feat: Scale case fans to a real 120mm"
```

---

## Task 11: Verify in the browser and hand off for a screenshot

**Files:** none modified.

- [ ] **Step 1: Start the dev server**

Use the preview tooling (not a raw shell command) to start `custompc-dev`, then
load the builder with a full build selected.

- [ ] **Step 2: Confirm the models still load**

Check network requests for `/models/*.glb` — all six should be 200 — and confirm
the console is free of errors.

The canvas itself **cannot** be inspected on this machine: `isContextLost()`
returns true because of a machine-wide WebGL wedge, so a blank canvas is NOT
evidence of a bug. The unit tests are the oracle for geometry.

- [ ] **Step 3: Report to the user**

Summarise what the geometry tests now prove — no intersections, everything inside
the case, mounted parts touching the board face, PSU in the basement — and ask
for a screenshot to confirm visually.

- [ ] **Step 4: Commit any final tuning**

Only if the screenshot reveals a real problem, adjust the mm values in
`mountPoints.js` or `partSpecs.js`, re-run `npm run test:run`, and commit.

---

## Notes for the implementer

- **Never widen a test's tolerance to make it pass.** The tests encode the
  physical contract; the mm values in `mountPoints.js`, `partSpecs.js` and
  `CASE` are the adjustable knobs.
- **The 3D cannot be eyeballed on this machine.** Do not conclude the code is
  broken from a blank canvas — check `isContextLost()` first.
- Node is not on the bash PATH: prepend `C:\Program Files\nodejs` in PowerShell.
- Run a single test file with `npm run test:run -- <name>`.
