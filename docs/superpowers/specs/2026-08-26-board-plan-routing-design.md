# Board background: a real ATX plan with routed buses

**Date:** 2026-08-26
**Status:** approved, phase 1 of 3

## The problem

The page ground is drawn as a motherboard ([`BoardBackground.jsx`](../../../src/components/BoardBackground.jsx),
specced 2026-08-16). It reads as decorative circuitry rather than as a board.
The user's words: *"slightly off — make it look more motherboardy, just a bit
more organised like an actual board not just random lines."*

That is an accurate diagnosis and it decomposes into four specific failures:

1. **Traces stop in mid-air.** A real trace runs pad to pad. Several of the
   current `signal` paths end in empty copper.
2. **Bundles drift.** Traces leave a component in parallel and then diverge at
   different points, so a bus stops reading as a bus.
3. **No length-matching.** The most recognisable feature of a real DDR bus —
   serpentine wiggles that equalise trace length — is absent entirely.
4. **Components sit where they fit, not where they go.** There is no ATX
   topology: no rear I/O in the corner, no DIMM bank beside the socket, no PCIe
   stack across the lower left.

Fixing 1–3 is what makes the line work read as *routed*. Fixing 4 is what makes
the whole thing read as *a motherboard* rather than as circuit-board wallpaper.

## What must not change

The 2026-08-16 spec established a contrast contract that is measured, not
chosen, and this work sits entirely inside it:

```
--faint (#878E9C) on a full-strength gold pad ....... 1.46:1
--ink   (#EDEFF2) on a full-strength gold pad ....... 1.95:1
--muted (#99A0AB) on a full-strength trace .......... 1.63:1
```

Therefore, unchanged:

- **The layer split.** The full-bleed layer carries line work and **no solid
  fills** (vias stay capped at `LINE_FILL_CEILING`). Every solid gold pad stays
  in the **edge-pinned** hardware layers, which are structurally incapable of
  reaching the text column.
- **The three-weight hierarchy.** signal `0.6 / 0.2`, outline `1 / 0.4`, power
  `2 / 0.68`. Collapsing these returns the board to a wireframe.
- **`vector-effect: non-scaling-stroke`** on every stroked group. `slice` runs
  the full-bleed layer at up to 2.28x; without this the tuned widths scale with
  it and put far more bright pixels under text than the scrim is sized for.
- **`hardwareWidth`'s gutter-derived clamp** and the scrim.

**Consequence for the design:** the ATX plan is drawn *in outline* in the
full-bleed layer. It is a plan view of a board, not a filled render of one. The
edge-pinned layers keep their solid gold and are not re-planned.

## The ATX plan

Landmarks in the existing `640 x 420` viewBox, rear I/O at the top-left, which
is how an ATX board is conventionally drawn in landscape.

| landmark | region | weight |
|---|---|---|
| Rear I/O shroud | x 20–120, y 18–70 | outline |
| VRM heatsink bank | x 132–200, y 18–58 | outline |
| EPS 8-pin | x 214–250, y 18–34 | power |
| CPU socket + pin grid | x 210–310, y 88–188 | outline + existing `grid()` |
| DIMM slots x4 | x 340–396, y 70–210, pitch 16 | outline |
| 24-pin ATX | x 432–462, y 78–150 | power |
| M.2 slot 1 | x 150–330, y 224–232 | outline |
| PCIe x16 primary | x 150–420, y 250–262 | outline |
| M.2 slot 2 | x 150–330, y 274–282 | outline |
| PCIe x1 | x 150–260, y 286–294 | outline |
| PCIe x16 secondary | x 150–380, y 310–322 | outline |
| Chipset heatsink | x 400–470, y 280–350 | outline |
| SATA port bank | x 480–520, y 228–292 | outline |
| Front-panel header | x 300–362, y 388–400 | outline |
| Coin cell | circle (486, 198) r 15 | outline |

Positions are *relative* truth, not millimetre-accurate: the viewBox is 1.52:1
and a real ATX board is 1.25:1, and `slice` crops it anyway. What matters is
that the adjacencies are right — DIMMs beside the socket, PCIe below it,
chipset between PCIe and SATA.

## Routing rules, as helpers

The rules are enforced by construction rather than by hand-drawing, because
hand-drawn paths are exactly how the current drift got in.

### `bus({ from, to, count, pitch, drop })`

Emits `count` parallel traces at fixed `pitch`. Every corner is axis-aligned or
exactly 45°. Traces keep their pitch through corners rather than converging.

### `serpentine({ x, y, count, pitch, amplitude, cycles })`

The length-matching wiggle. Applied to the memory bus between the socket's east
edge and the DIMM bank. This is the single highest-value cue and it goes only
where a real board has one — a serpentine on a power trace would be wrong.

### `via(x, y)` and pad termination

Every emitted trace ends at a via or on a component edge. The helper returns the
terminating vias alongside the paths so a trace cannot be drawn without one.

### The 45° rule

All direction changes are `h`/`v` or a 45° diagonal. No arbitrary angles. This
is what most distinguishes routed copper from drawn squiggles, and it is
checkable — see testing.

## Testing

The board is geometry, so the tests are geometric. Snapshots are explicitly
avoided: they pin the drawing rather than the rules, and would need rewriting on
every tweak.

**Unit, on the pure helpers (`src/lib/boardPlan.js`, new):**

1. `bus` holds constant pitch from first trace to last, including across corners.
2. Every segment emitted by `bus` and `serpentine` is axis-aligned or 45° —
   parsed from the returned path data, not asserted about the input.
3. `serpentine` returns paths whose total length differs by less than a stated
   tolerance across the bundle. That is what length-matching *means*, so it is
   what the test should say.
4. Every trace terminates on a via or a declared component edge.
5. Landmark rectangles do not overlap each other.

**Component, on `BoardBackground.jsx`:**

6. The existing "no solid fill in the line layer" assertion still passes.
7. Every stroked group still carries `vector-effect: non-scaling-stroke`.

**e2e, unchanged in scope:** `e2e/boardBackground.spec.js` already checks no
glyph over a hardware layer and every glyph inside the scrim's flat core, at 5
widths x 4 routes. The board changes underneath it; the contract does not.

⚠️ Guard against vacuity in 1–5: each test must be shown to fail against a
deliberately broken helper. The 2026-08-17 session recorded a falsification that
silently matched nothing and printed success — introduce the break with `Edit`
and re-read the file, never with a string-replace script.

## Out of scope

Phase 2 (Performance tab: real panel surfaces, module treatment, and extending
the e2e route list to the four builder tabs) and phase 3 (Summary tab: seated
rows with designators, hover-revealed retailer links, button hierarchy) are
approved but deliberately not in this spec. The board is the largest and least
reversible of the three and lands on its own so it can be looked at first.

## Risks

- **The pre-render goes stale silently.** This is shared UI on every page, so
  `npm run prerender` must be re-run and the diff inspected. Every one of the
  seven fragments is expected to move; a fragment that does *not* move is the
  suspicious outcome.
- **Judge the result by measurement, not by screenshot.** Compressed screenshots
  have twice reported false colour faults in this project.
- **Density is the failure mode.** More organised does not mean more lines. If
  the plan reads busier than what it replaces, the fix is fewer buses, not
  thinner strokes — stroke width is already tuned against the scrim.
