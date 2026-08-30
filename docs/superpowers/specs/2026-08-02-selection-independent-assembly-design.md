# Selection-independent 3D assembly

**Date:** 2026-08-02
**Status:** design approved, spec under review

## Problem

In the 3D build view, a part's rendered position depends on *what else is selected*:

- Selecting parts before a motherboard exists scatters them into arbitrary
  "exploded" positions. The moment a motherboard is added, every part **jumps**
  to its real assembled spot.
- Case fans are hidden entirely unless a case **and** a motherboard are both
  selected — so "pick case fans, no case" shows nothing.

The user wants a consistent "how it goes together" view: **select any part in any
order and it renders exactly where it belongs in a finished build, and nothing
already placed ever moves.** A complete set of parts is a complete build, reached
smoothly rather than by a snap-into-place when the motherboard appears.

## Current mechanism (root cause)

`src/lib/assemblyLayout.js` has two modes:

- **No motherboard selected** → returns a hardcoded `FALLBACK` scatter map
  (cooler at `[0, 1.2, 0]`, gpu at `[0, -1.4, 0]`, …). These are not real
  positions.
- **Motherboard selected** → returns `mountedTransform(category)` =
  `partCentre(category)`, the real assembled position.

The jump is the switch between these two on the frame a motherboard is added.

The key insight: **`partCentre(category)` is already fully selection-independent.**
It takes only a category and derives everything from fixed references — the board
at the origin, `caseInterior()` (also anchored to the board at the origin), and
`partBox('cpu')` for the cooler's mount. None of it reads `selectedParts`. So the
correct position for every part already exists and never moves; the fallback is
the only thing introducing selection-dependence.

`src/components/BuildCanvas.jsx` separately gates the fan system:
`selectedParts.case && selectedParts.motherboard`.

Cables (`CableHarness` → `cableRoutes(selectedParts)`) already gate on their real
endpoints: `cableRoutes` returns `[]` without a motherboard **and** PSU, and only
adds the PCIe lead when a GPU is present. This is correct and stays as-is.

## Design

### 1. `assemblyLayout` becomes selection-independent

Delete the `FALLBACK` map and the `hasMotherboard` branch. `assemblyLayout`
returns the real transform for every category, unconditionally:

- Mounted categories (`motherboard, cpu, cooler, ram, storage, gpu, psu`) →
  `mountedTransform(category)`.
- `case` → centred on `caseInterior()`.
- Anything else → identity.

The `selectedParts` argument is no longer read. Drop it from the signature and
update the sole runtime caller, `PartModel`. (`gltfModels` and `caseApertures`
only mention `assemblyLayout` in comments, not calls, so they are unaffected.)

The dead `fans` branch (`[0, 1.55, 0.05]`) is removed: `PartModel` returns `null`
for `fans` before calling `assemblyLayout`, and fan placement lives in
`FanSystem` via `FAN_MOUNTS`.

### 2. Fans render whenever selected; outlines stay tied to the case

In `BuildCanvas.jsx`, replace the gate with:

```jsx
{(selectedParts.fans || selectedParts.case) && (
  <FanSystem filled={Boolean(selectedParts.fans)} />
)}
```

- fans selected (case or not) → fans render in their mount positions.
- case selected, no fans → the 4 empty slot outlines show where fans go.
- neither → nothing.

This keeps the useful "here's where fans mount" hint bound to the case (the thing
that physically has fan mounts) while fixing the "no case, no fans shown" bug.

### 3. No change to cables or camera

- Cables already appear only when both connected parts are present.
- The camera stays framed on the fixed case region, so the view is stable. A
  single small part renders small within that frame — acceptable and consistent.
  Adaptive framing to the current selection is explicitly **out of scope**.

## Testing

- **Rewrite `src/tests/assemblyLayout.test.js`.** The new contract is
  selection-independence: for every category, `assemblyLayout(cat)` equals
  `assemblyLayout(cat)` regardless of any `selectedParts`, and equals the real
  `partCentre`-derived transform. The old tests asserting the `FALLBACK` scatter
  are removed.
- The existing geometry tests (`assemblyGeometry.test.js` etc.) already prove the
  absolute positions are correct and are unaffected.
- **Manual, in the render:** add parts one at a time in a random order and confirm
  each appears in its final spot with nothing shifting; remove the motherboard from
  a full build and confirm nothing else moves; select fans with no case and confirm
  they render; select a case with no fans and confirm the outlines appear.

## Non-goals

- Adaptive camera zoom to the current selection.
- Placeholder outlines for any category other than fans.
- Any change to compatibility handling — the 3D view is a stylised illustration;
  parts render in their canonical spots whether or not the selection is compatible.

## Files affected

- `src/lib/assemblyLayout.js` — simplify (main change).
- `src/components/BuildCanvas.jsx` — fan gate.
- `src/components/PartModel.jsx` — drop the `selectedParts` arg to `assemblyLayout`.
- `src/tests/assemblyLayout.test.js` — rewrite around the new contract.
