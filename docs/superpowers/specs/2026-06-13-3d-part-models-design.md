# Realistic 3D Part Models — Design Spec
**Date:** 2026-06-13
**Builds on:** Phase 1 (`2026-06-13-pc-builder-design.md`)

---

## Overview

Replace the placeholder colored-box geometry (`PartModel.jsx`) with detailed, procedurally-built 3D models for each of the 8 part categories. Models are built from Three.js primitives in code — no external GLB files, no licensing dependencies, fully under our control. As parts are added they snap into realistic mount positions so the scene looks like an actual PC assembling itself.

**Decisions locked during brainstorming:**
- **Procedural geometry** (not sourced GLB files) — autonomous, no licensing, themeable. Real GLBs can be swapped in later.
- **Realistic assembly** (not exploded/floating) — motherboard is the anchor; parts mount in their true relative positions.

---

## Visual Target

"Looks convincingly like real hardware" — detailed but not photoreal.

| Part | Geometry |
|---|---|
| Motherboard | Green PCB board; visible CPU socket, RAM slots, PCIe slot, chipset heatsinks, rear I/O shroud, 24-pin connector. **The anchor.** |
| CPU | Square chip with metal heat-spreader (IHS) on top, contact/pin underside |
| CPU Cooler | Finned heatsink tower + fan (air), or block + radiator (AIO) |
| RAM | Vertical sticks with heatspreader, standing in DIMM slots |
| GPU | Horizontal card with shroud, 2 fans, backplate |
| Storage | M.2 stick flat on board (SSD) / metal box (HDD) |
| PSU | Metal box with fan grille, sits low |
| Case | Semi-transparent / wireframe shell enclosing the build (see-through) |

Poly counts kept modest (simple primitives, a few fins/fans) so the scene stays smooth with all 8 parts present.

---

## Architecture

```
src/components/models/
  MotherboardModel.jsx   — one focused file per category, each builds
  CpuModel.jsx             detailed geometry from Three.js primitives
  GpuModel.jsx
  RamModel.jsx
  StorageModel.jsx
  PsuModel.jsx
  CaseModel.jsx
  CoolerModel.jsx
  partModelRegistry.js   — maps category string → model component
src/lib/assemblyLayout.js — PURE: category → { position, rotation }
                            motherboard-relative, with fallbacks. Unit-tested.
src/components/PartModel.jsx — thin dispatcher: looks up the model component
                            for a part's category, wraps it in a <group> at
                            the transform from assemblyLayout.
src/components/BuildCanvas.jsx — unchanged interface; may get camera/light tweaks
```

**Separation of concerns:** geometry (WebGL, untestable in jsdom) is isolated from positioning logic (pure math, testable). Each model file has one responsibility and stays small.

**Data flow:** `BuildCanvas` passes `selectedParts` → for each part `PartModel` renders the category's model component inside a `<group>` positioned by `assemblyLayout(category, selectedParts)`.

---

## Assembly Layout (`assemblyLayout.js`)

Motherboard lies flat at the origin (PCB in the horizontal plane, components facing up +Y). Every other part has a mount transform relative to it:

| Part | Mount position (relative to motherboard at origin) |
|---|---|
| Motherboard | Origin — the anchor |
| CPU | In the socket, upper-centre of the board |
| Cooler | Directly above the CPU (+Y) |
| RAM | Standing in the DIMM slots, to the right of the socket |
| GPU | In the PCIe slot, parallel to and in front of the board |
| Storage | M.2 flat on the board (SSD) / lower bay (HDD) |
| PSU | Low and to the rear (case-basement position) |
| Case | Shell centred around the whole assembly |

**Interface:** `assemblyLayout(category, selectedParts) → { position: [x,y,z], rotation: [x,y,z] }`

---

## Edge Cases

- **No motherboard selected** — parts can't mount to an absent socket, so each falls back to a sensible standalone position (a loose ring/stack). When a motherboard is later added, parts snap into their true mount positions.
- **Unknown category** — returns a fallback transform (origin) and the dispatcher renders a simple box, so bad data can't crash the scene.
- **Performance** — modest poly counts; reuse simple primitives.

---

## Testing & Verification

- **`assemblyLayout.js`** — real unit tests (pure math):
  - cooler mounts above the CPU position
  - GPU sits in front of the board plane (offset on the board-normal axis)
  - parts fall back to standalone positions when no motherboard is selected
  - unknown category returns a fallback transform
- **Model components** — can't be unit-tested (WebGL not available in jsdom); verified by successful `vite build` + manual browser check of the assembled scene.
- **No regressions** — the existing 27 Phase-1 tests must stay green.

---

## Out of Scope

- Sourcing/loading external GLB model files (deferred; the dispatcher/registry makes this an easy later swap)
- Brand-accurate models
- Animations beyond the existing orbit-drag and part appearance
- Per-part textures from image files (procedural materials only)
