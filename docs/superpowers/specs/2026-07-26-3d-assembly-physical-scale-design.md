# 3D assembly: physical scale and mount points

**Date:** 2026-07-26
**Status:** Approved, ready for planning

## Problem

Parts in the 3D view float and do not connect to each other.

The cause is architectural, not cosmetic. `GltfPart` normalises every model to a
hand-guessed `targetSize` in arbitrary world units, and `assemblyLayout` places
each part at a hand-guessed absolute offset. Nothing ties a part's size to its
real dimensions, and nothing ties a part's position to the thing it plugs into.
Each new model therefore needs eyeball tuning, and the parts drift out of
alignment with each other.

Measured against the motherboard (2.50 world units = a 305 mm ATX board, so
**1 wu = 122 mm**), the current state is:

| Part | Current | Real | Error |
|---|---|---|---|
| Motherboard | 305 mm | 305 mm ATX | correct (reference) |
| GPU | 287 mm | ~285 mm | correct |
| Cooler | 140 mm | 271 mm (240 AIO) | 1.9x too small |
| RAM | 104 mm | 133 mm DIMM | 22% too small |
| PSU | 122 mm | 150 mm ATX | 19% too small |
| M.2 | 110 mm | 80 mm (2280) | 37% too big |
| Case | 366 x 451 x 146 mm | ~450 x 450 x 210 mm | too shallow, too short |

Parts also intersect rather than mount. World-space AABBs show the board filling
`z -0.20..0.20`, with RAM at `z 0.06..0.10` buried inside it and the cooler
straddling it at `z -0.18..0.58`. The PSU's box overlaps the motherboard on all
three axes.

Two orientation bugs compound this: RAM presents its broad face to the glass,
where a DIMM in a vertical board is seen edge-on standing ~30 mm proud of the
board; and the cooler receives a `[pi/2,0,0]` layout rotation that tips the
radiator out of its correct horizontal attitude.

## Approach

Give the scene one physical scale, and let parts derive position from the
connector they plug into rather than from absolute coordinates.

### 1. One scale constant

New `src/lib/pcScale.js`:

```js
export const WU_PER_MM = 1 / 122
export const mm = (v) => v * WU_PER_MM
```

`1 wu = 122 mm` is chosen so a real 450 mm mid-tower maps to 3.69 wu against the
current case height of 3.7, and a 305 mm ATX board to 2.50 wu against the current
2.5. **Existing camera framing and zoom clamps stay valid** — this is a
correctness change, not a re-shoot.

### 2. Sizes expressed in millimetres

`gltfModels.js` replaces `targetSize` (arbitrary wu) with `lengthMm`, the real
size of that model's longest axis. `GltfPart` converts via `mm()`. The auto-fit
maths is unchanged; only the units become meaningful.

| Category | `lengthMm` | Basis |
|---|---|---|
| motherboard | 305 | ATX long edge |
| gpu | 285 | RTX 3080 FE |
| cooler | 271 | measured: 240 AIO assembly bbox |
| ram | 133 | DDR4 DIMM |
| psu | 150 | ATX PSU width |
| storage | 80 | M.2 2280 |

The cooler figure is derived, not assumed. Its mesh contains `Fan1`, `Fan2`, a
`CPU` pump block and two Bezier tubes. The fans measure 1.30 model units and the
pump block 0.45 x 0.76 x 0.76. Reading those as a 120 mm fan and a ~70 mm block
gives **1 model unit = 92.3 mm** from two independent measurements, making the
2.94-unit overall bbox 271 mm.

### 3. Anchor by connector, not bounding box

This is the core change. `GltfPart` gains an optional `anchorNode`: when set, the
model is aligned so that named sub-node's centre sits at the origin, instead of
the whole bounding-box centre.

Connecting parts means aligning them by their connectors. A GPU meets the board
at its PCIe edge; an AIO meets it at the pump block. Bounding-box centres are
arbitrary and are exactly why parts float. Anchoring by a named node lets a mount
point mean something physical.

The AIO demonstrates the payoff. Its pump block and radiator are locked 131 mm
apart in the mesh, which matches the real distance from a CPU socket to a
top-mounted 240 radiator. Anchoring the block to the CPU socket therefore places
the radiator correctly with no need to split the mesh.

### 4. Mount points

New `src/lib/mountPoints.js` describes the board in millimetres from its centre:
CPU socket, DIMM slot origin and pitch, PCIe x16 slot, M.2 slot. Each part
declares which anchor it mounts to and how it protrudes from the board face.

Parts derive their position from the thing they plug into, so they cannot drift
apart, and a new model drops in correctly placed without eyeball tuning.

This is also where the two orientation bugs are fixed. The RAM mount point
encodes that a DIMM stands edge-on, proud of the board surface, with sticks
spaced along the board's horizontal axis.

The cooler's orientation is derived from its measured internal layout. Its
radiator's long axis is model Z and its thin axis model Y, with the pump block
below it on model -Y — so model +Y is "up". Mapping that into the scene's
convention (board vertical in XY, components facing +Z, case top +Y,
front-to-back X) requires the radiator's long axis to run along world X, giving a
`[0, pi/2, 0]` model rotation and an identity layout rotation. This replaces the
current `[pi/2,0,0]` layout rotation that tips the radiator over.

### 5. Case rescaled to a real mid-tower

`CaseModel` moves to 450 mm tall x 450 mm front-to-back x 210 mm side-to-side,
with a ~100 mm PSU basement and shroud line at the bottom. The board mounts on
standoffs ~8 mm off the rear tray. The PSU moves into the basement, which is what
stops it intersecting the board.

The see-through toggle, vent grilles and glass panel are preserved. The case
stays procedural: it anchors the assembly layout and owns the transparency
toggle.

### 6. Geometry becomes pure and testable

The layout maths moves into a pure function returning each part's world-space
AABB, independent of React and three.js rendering.

This matters more than usual here. The machine's WebGL wedge means the render
cannot be inspected directly (see the project's WebGL verification notes), so
"are the parts connected?" must be answerable without eyes. A pure geometry
function makes it a unit test.

Tests assert:

- no two parts intersect beyond intended mounting contact
- every part sits within the case interior
- RAM, GPU and M.2 touch the board's front face — neither floating nor embedded
- the PSU sits in the basement, clear of the board

These permanently guard against this class of regression.

## Scope

**In:** `pcScale.js`, `mountPoints.js`, `gltfModels.js`, `GltfPart.jsx`,
`assemblyLayout.js`, `CaseModel.jsx`, fans resized to 120 mm, geometry tests.

**Out:** catalog, ratings, and all non-3D code. CPU stays primitive (hidden under
the cooler). Fans keep their existing mount logic. Part size stays fixed per
category rather than driven by catalog dimensions — the models are generic
stand-ins, so an RTX 3080 mesh represents any GPU.

## Consequences

Sizing everything correctly will make the build look more crowded, because
several parts are currently undersized. This is faithful: a real mid-tower
interior is fairly full.

The `lengthMm` values assume each mesh represents a typical part. A user
selecting a 360 mm AIO still sees the 240 mm model. Driving size from catalog
dimensions was considered and deliberately deferred.

## Verification

Unit tests are the primary oracle, for the WebGL reason above. Final visual
confirmation still requires a screenshot from the user, but the tests should mean
positions are already correct when that screenshot is taken, rather than the
screenshot being the first check.
