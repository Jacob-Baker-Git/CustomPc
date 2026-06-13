# PC Builder Website — Design Spec
**Date:** 2026-06-13
**Phase:** 1 — Core Builder

---

## Overview

A browser-based PC building tool that lets users assemble a compatible PC visually. The centrepiece is an interactive 3D assembly that grows as parts are added. Users start with a budget in GBP, pick any part to begin, and the site guides compatibility from there.

---

## User Flow

1. **Budget entry** — full-screen prompt on load. User types a GBP amount and presses enter.
2. **Top bar appears** — persists for the rest of the session: `£1,200 budget | £840 remaining | 45W`
3. **Category picker** — grid of all 8 part categories (CPU, GPU, Motherboard, RAM, Storage, PSU, Case, CPU Cooler). User picks any to start.
4. **Part selector** — grid of parts in the chosen category, filtered to within budget. Incompatible parts are greyed out with a tooltip explaining why.
5. **3D canvas** — selected part appears as a 3D model in the centre of the screen. User can click-drag to rotate/flip it in all directions.
6. **Orbit ring** — remaining categories orbit the 3D assembly as clickable icons, each connected to the centre by a thin line.
7. **Add more parts** — each part added joins the 3D assembly in the centre. Budget and power bars update instantly. Incompatible options across all categories are locked.
8. **Repeat** until build is complete.

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS |
| 3D rendering | React Three Fiber + Three.js |
| 3D models | GLTF files sourced from Sketchfab (free, realistic PC parts) |
| State management | Zustand |
| Data | Static JSON files (no backend) |
| Hosting | Netlify (auto-deploy from GitHub) |
| Repo | Private GitHub repository |

---

## Components

### `BudgetEntry`
Full-screen splash on first load. Single GBP input field. Submits on Enter or button click. Validates that the amount is a positive number.

### `TopBar`
Persistent header showing:
- Total budget (£)
- Remaining budget (£) — updates as parts are selected
- Total power draw (W) — updates as parts are selected
- Budget fill bar (amber at 80%, red at 100%)
- Power draw fill bar (red if exceeds PSU wattage)

### `CategoryPicker`
Grid of 8 part category tiles shown after budget entry. Each tile shows the category name and icon. All tiles active on first load (no compatibility locks yet).

### `PartSelector`
Modal/panel grid of parts for a chosen category:
- Filtered to parts within remaining budget
- Incompatible parts visible but greyed out
- Hovering a greyed-out part shows a tooltip: e.g. "Requires AM5 socket — your motherboard uses LGA1700"
- Each part card shows: name, price (£), key specs, compatibility badge

### `BuildCanvas`
The main 3D scene (React Three Fiber):
- Renders all selected parts together as a single growing assembly
- Parts are loaded as GLTF models from paths stored in `partsData.json`
- Click-drag rotates the entire assembly on X and Y axes
- Smooth orbit controls (dampening enabled)

### `OrbitRing`
SVG overlay on top of `BuildCanvas`:
- Remaining (unselected) categories rendered as icons in a circle around the centre
- Each icon connected to the centre by a thin straight line
- Clicking an icon opens `PartSelector` for that category
- Selected categories are removed from the ring (already in the assembly)

### `DynamicBars`
Two fill bars in `TopBar`:
- **Budget bar**: `spent / total * 100%`
- **Power bar**: `totalTDP / psuwattage * 100%` (uses 750W default until PSU is selected)

### `CompatibilityEngine`
Pure JS module (`src/lib/compatibility.js`):
- Takes current `selectedParts` and a candidate part
- Returns `{ compatible: bool, reason: string }`
- Rules encoded as functions, one per constraint type

### `useBuilderStore`
Zustand store — single source of truth:
```
{
  budget: number,
  selectedParts: { [category]: Part | null },
  addPart(category, part): void,
  removePart(category): void,
  remainingBudget: computed,
  totalPower: computed,
  lockedCategories: computed   // derived from compatibility rules
}
```

---

## Data: `partsData.json`

Each part entry:
```json
{
  "id": "mb-asus-z790",
  "category": "motherboard",
  "name": "ASUS ROG Strix Z790-F",
  "price": 349.99,
  "socket": "LGA1700",
  "formFactor": "ATX",
  "ramType": "DDR5",
  "ramSlots": 4,
  "maxRamSpeed": 6400,
  "tdp": 15,
  "modelPath": "/models/mb-asus-z790.glb",
  "imageUrl": "/images/mb-asus-z790.jpg",
  "specs": { ... }
}
```

---

## Compatibility Rules

| Selection | Locks |
|---|---|
| Motherboard socket (e.g. AM5) | CPU must match socket |
| Motherboard form factor (e.g. ATX) | Case must support that form factor |
| Motherboard RAM type (e.g. DDR5) | RAM must be DDR5 |
| CPU socket | CPU cooler must match socket |
| Case GPU clearance (mm) | GPU length must not exceed it |
| All selected part TDPs | PSU wattage recommendation (selected TDP × 1.2) |

All rules are bidirectional: selecting a part that violates a constraint against an already-selected part locks it in either direction.

---

## Dynamic Bars Behaviour

- **Budget bar** fills as parts are added. Colour: green → amber (>80%) → red (>100%)
- **Power bar** fills based on total TDP of selected parts vs PSU wattage. If no PSU selected, uses 750W as reference. Goes red if total TDP exceeds PSU wattage.

---

## Part Categories in Scope (Phase 1)

- CPU
- GPU
- Motherboard
- RAM
- Storage (SSD / HDD)
- PSU
- Case
- CPU Cooler

---

## Out of Scope (Phase 1)

- Bottleneck calculator
- Game performance recommendations
- Performance per pound metric
- Upgrade My PC mechanic
- Upgrade path / future-proof projection
- Exterior devices tab
- AI search optimisation (SEO/schema markup)

---

## Future Phases

**Phase 2:** Bottleneck calculator, game recommendations by resolution, performance per pound
**Phase 3:** Upgrade My PC mechanic, upgrade path projection
**Phase 4:** Exterior devices tab, AI search optimisation
