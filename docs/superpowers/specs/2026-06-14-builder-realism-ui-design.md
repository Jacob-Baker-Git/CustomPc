# Builder Realism + UI Overhaul — Design Spec
**Date:** 2026-06-14
**Builds on:** Phase 1, 3D models, builder overhaul (A/B/C)

---

## Overview

A second enhancement pass focused on realism and visual quality, grouped into four chunks:

- **Chunk D — Flow & data:** skip the landing screen (open straight to the 3D ring), drop the 70%→**60%** budget rule, and expand the catalog further (~20–25 per category where good options exist).
- **Chunk E — Realistic vertical assembly:** re-orient the 3D parts to sit like a real ATX build inside the case (vertical motherboard, horizontal GPU in the PCIe slot, PSU basement, etc.), and render case fans as the actual **count** in the selected pack at realistic mount points.
- **Chunk F — Rotation-tracking orbit lines:** filled-slot lines point to each part's real on-screen position and follow it as the build rotates; empty-slot lines still meet at the center.
- **Chunk G — UI overhaul:** sleek dark glassmorphism with cyan/blue neon accents across all components.

---

## Chunk D — Flow & Data

### Skip the landing screen
`BuilderScreen` currently shows `CategoryPicker` first (`showCategoryPicker` defaults true) with a "View All Categories" button. After budget entry, open **directly** on the 3D ring builder. Remove the `CategoryPicker` landing usage and the "View All Categories" button — the orbit ring lists all 9 categories and serves as the picker. `BudgetEntry` (shown while `budget` is 0) is unchanged. The `CATEGORIES` constant currently lives in `CategoryPicker.jsx`; move it to its own module `src/lib/categories.js` so removing the landing screen doesn't strand the shared constant, and update importers (`OrbitRing`).

### 60% budget rule
In `src/lib/partFilter.js`, change the default-view price cap from `budget * 0.7` to `budget * 0.6`. Update `partFilter.test.js` expectations accordingly (e.g. a £1000 budget hides parts over £600).

### More components
Expand `partsData.json` toward ~20–25 entries per category (more where realistic options exist), keeping all existing parts, the per-category field shapes, `perfScore` on every CPU/GPU, and internal compatibility consistency (matching sockets / RAM types / form factors so builds remain completable).

---

## Chunk E — Realistic Vertical Tower Assembly

Rework `assemblyLayout.js` so each part has a `position` AND a `rotation` that place it like a real ATX build inside the case shell. Coordinate convention: case interior centered at origin; the motherboard mounts vertical against the back panel (PCB plane vertical, components facing the viewer / into the case along +Z); "up" is +Y.

| Part | Placement |
|---|---|
| Motherboard | Vertical against the back panel; PCB plane vertical, components facing +Z |
| CPU | On the board face, upper-centre, facing +Z |
| Cooler | On the CPU, tower protruding toward +Z, fan vertical |
| RAM | Vertical sticks on the board, to the side of the CPU |
| GPU | **Horizontal**, plugged into the top PCIe slot, extending toward +Z (front) |
| Storage | M.2 flat on the board / on the tray |
| PSU | Bottom basement of the case (−Y) |
| Case | Shell around the whole build (unchanged geometry) |
| Fans | Front intake + top exhaust mount points |

The model components keep their existing local geometry; the new per-part `rotation` in `assemblyLayout` orients them. `BuildCanvas` camera/lighting is adjusted so the upright build is centered and well-lit.

### Fan count realism
`FansModel` reads `part.specs.count` (1–3) and renders that many fan units spread across the mount (a row along the case front; larger packs add a top fan), instead of a single generic fan. The `assemblyLayout` `fans` transform positions the group at the case's front-interior so the row reads as intake fans.

---

## Chunk F — Rotation-Tracking Orbit Lines

Today all `OrbitRing` lines meet at the screen center. New behavior:
- **Empty slots:** line runs label → center (unchanged).
- **Filled slots:** line runs label → the part's live 2D screen position, updated every frame as the camera orbits.

### Architecture
- `src/lib/projectToScreen.js` — a pure, unit-tested helper `ndcToPixel(ndcX, ndcY, width, height) → { x, y }` (NDC −1..1 → pixel coords; y flipped).
- `src/lib/partScreenPositions.js` — a tiny module singleton: `export const partScreenPositions = { current: {} }` mapping `category → { x, y }` in container pixels (plus the container size). Avoids per-frame React state.
- `src/components/ScreenTracker.jsx` — rendered **inside** the R3F `<Canvas>`; a `useFrame` loop projects each selected part's world position (its `assemblyLayout` position) through the camera, converts via `ndcToPixel`, and writes into `partScreenPositions.current`. It also records the canvas pixel size.
- `OrbitRing` runs a `requestAnimationFrame` loop that, for each filled slot, sets that line's `x2/y2` to the tracked part position (reading the singleton, mutating SVG line refs directly — no React re-render per frame). Empty slots keep `x2/y2` at center.

Because `BuildCanvas` and `OrbitRing` share the same absolutely-positioned container, canvas pixels == overlay pixels.

---

## Chunk G — UI Overhaul (Dark Glass + Neon)

A consistent visual language across all components. Centralize shared tokens (accent gradient, glass panel classes, glow) as small Tailwind class constants in `src/lib/uiTokens.js` (e.g. `GLASS_PANEL`, `ACCENT_TEXT`, `GLOW`) so components stay consistent and DRY.

- **Glass panels** — translucent dark surfaces + `backdrop-blur` for `TopBar`, `BottleneckIndicator`, `PartSelector`, orbit labels, toggles.
- **Neon accents** — cyan→blue gradient as primary accent; soft outer glow on active/interactive elements (recommended-next slot, selected parts, active resolution, hovered cards).
- **Refined part cards** — rounded glass cards with hover lift + glow, clearer price/spec hierarchy, compatibility badge styling.
- **Polished bars** — gradient fills with subtle glow on budget/power/bottleneck bars (`DynamicBars`, `BottleneckIndicator`).
- **Motion** — smooth transitions on hover/selection/part snap-in; `BudgetEntry` splash gets a gradient backdrop + glow.
- **Consistency** — unified rounded corners, border treatment, spacing, and typographic hierarchy.

No behavioral change — styling only. Verified via `vite build` + manual browser check.

---

## Architecture & New/Changed Files

| File | Change |
|---|---|
| `src/lib/categories.js` | NEW — `CATEGORIES` moved here from CategoryPicker |
| `src/lib/projectToScreen.js` | NEW — pure `ndcToPixel` helper |
| `src/lib/partScreenPositions.js` | NEW — singleton ref for tracked positions |
| `src/lib/uiTokens.js` | NEW — shared glass/accent/glow class constants |
| `src/components/ScreenTracker.jsx` | NEW — in-canvas per-frame projector |
| `src/lib/assemblyLayout.js` | Vertical-tower positions + rotations |
| `src/components/models/FansModel.jsx` | Render `specs.count` fans |
| `src/components/OrbitRing.jsx` | Rotation-tracking lines + glass styling |
| `src/components/BuildCanvas.jsx` | Camera/lighting + render ScreenTracker |
| `src/screens/BuilderScreen.jsx` | Skip landing; remove "View All Categories" |
| `src/components/CategoryPicker.jsx` | Deleted — landing gone; its `CATEGORIES` moves to `categories.js` and all importers point there |
| `src/lib/partFilter.js` + test | 60% rule |
| `src/data/partsData.json` | More parts |
| `TopBar`, `PartSelector`, `PartCard`, `DynamicBars`, `BottleneckIndicator`, `ResolutionToggle`, `CaseToggle`, `CaseModel`, `BudgetEntry`, `SearchBar` | Glass/neon restyle |

---

## Testing

- **Pure logic, unit-tested:** `projectToScreen.js` (`ndcToPixel`), the updated 60% rule in `partFilter.test.js`, `assemblyLayout.js` (each category returns position+rotation triples; GPU stays visible). Existing tests stay green.
- **3D / UI / per-frame tracking:** verified via `vite build` + manual browser check (camera projection and WebGL can't run in jsdom).

---

## Build Order

**D → E → F → G.** Each chunk leaves the app working. Commit locally; **do not push/deploy** until the user asks (per project preference).

---

## Out of Scope

- Live parts pricing (catalog remains a curated snapshot)
- Brand-accurate models / textured models
- Animated fan spin (static blades; spin could be a later polish)
