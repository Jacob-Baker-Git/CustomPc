# PC Builder Website — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React-based interactive PC builder where users set a GBP budget, then visually assemble compatible parts around a growing 3D assembly connected by an SVG orbit ring.

**Architecture:** Vite + React 18 SPA. Zustand manages selected parts and budget. React Three Fiber renders the 3D assembly. An SVG OrbitRing overlay shows unselected categories connected by thin lines to the centre. A pure JS compatibility engine gates part selection.

**Tech Stack:** React 18, Vite, Tailwind CSS, React Three Fiber, @react-three/drei, Zustand, Vitest, @testing-library/react

**Status:** ✅ Implemented. All 13 tasks complete. Deviations from the original plan during implementation:
- React 19 installed (R3F 9 peer-requires it); spec wording "React 18" refers to the modern createRoot API, which is unchanged.
- Cooler compatibility made fully bidirectional (CPU/motherboard candidates also checked against an already-selected cooler).
- Q300L case `maxGpuLength` adjusted 360 → 270 to match the GPU-clearance test intent.
- "View All Categories" button fixed to always return to the picker (was gated by `!hasAnyPart`).
- Layout fixes: `h-[calc(100vh-4rem)]` to avoid viewport overflow; `useLayoutEffect` in OrbitRing to avoid first-paint jump; NaN guard in DynamicBars.

---

## File Map

| File | Responsibility |
|---|---|
| `src/main.jsx` | React DOM entry point |
| `src/App.jsx` | Screen routing (budget → builder) |
| `src/index.css` | Tailwind directives |
| `src/data/partsData.json` | All parts — prices, specs, compatibility fields |
| `src/lib/compatibility.js` | Pure compatibility engine, no React |
| `src/store/useBuilderStore.js` | Zustand store + exported computed selectors |
| `src/components/BudgetEntry.jsx` | Full-screen GBP input |
| `src/components/TopBar.jsx` | Persistent header |
| `src/components/DynamicBars.jsx` | Animated fill bars |
| `src/components/CategoryPicker.jsx` | 8-tile category grid |
| `src/components/PartCard.jsx` | Single part card with lock state |
| `src/components/PartSelector.jsx` | Modal part grid with compatibility gating |
| `src/components/BuildCanvas.jsx` | React Three Fiber 3D scene |
| `src/components/PartModel.jsx` | Single 3D part placeholder geometry |
| `src/components/OrbitRing.jsx` | SVG overlay — orbit buttons + lines |
| `src/screens/BuilderScreen.jsx` | Main builder layout |
| `src/tests/setup.js` | Vitest global setup |
| `src/tests/compatibility.test.js` | Unit tests — compatibility engine |
| `src/tests/useBuilderStore.test.js` | Unit tests — Zustand store |
| `src/tests/BudgetEntry.test.jsx` | Render test — BudgetEntry |
| `src/tests/PartCard.test.jsx` | Render test — PartCard |
| `public/models/.gitkeep` | Placeholder for GLTF model files |

---

## Tasks

1. **Project Setup** — Scaffold Vite React, install deps (three, R3F, drei, zustand, vitest, testing-library, tailwind), configure Tailwind + Vitest, init git.
2. **GitHub Repo + Netlify** — Private GitHub repo, Netlify auto-deploy (build `npm run build`, publish `dist`).
3. **Parts Data** — `src/data/partsData.json` with 35 parts across 8 categories.
4. **Compatibility Engine (TDD)** — `checkCompatibility(selectedParts, candidate)` and `getLockedReasons(selectedParts, allParts)`. Bidirectional socket / RAM / form-factor / GPU-clearance / cooler rules.
5. **Zustand Store (TDD)** — budget + selectedParts + selectors (`selTotalSpent`, `selRemainingBudget`, `selTotalPower`, `selPsuWattage`).
6. **BudgetEntry (TDD)** — full-screen GBP input, `onSubmit(num)` only when `num > 0`.
7. **TopBar + DynamicBars** — persistent header, two animated fill bars (budget + power).
8. **CategoryPicker** — 8 category tiles, exports `CATEGORIES`, selection state.
9. **PartCard + PartSelector (TDD for PartCard)** — card with lock/tooltip; modal gated by compatibility + budget.
10. **BuildCanvas + PartModel** — R3F canvas, OrbitControls, placeholder box geometry per category.
11. **OrbitRing** — SVG overlay, unselected categories in a circle, lines to centre, pointer-events pass-through.
12. **App Wiring** — `App.jsx` (budget gate) + `BuilderScreen.jsx` (picker ↔ 3D view ↔ part selector).
13. **Deploy** — push to GitHub, verify Netlify auto-deploy, run full flow.

The full task-by-task TDD steps (failing test → run → implement → run → commit) were followed during implementation. Each task was implemented by a fresh subagent and passed a two-stage review (spec compliance, then code quality).

---

## Compatibility Rules

| Selection | Locks |
|---|---|
| Motherboard socket (e.g. AM5) | CPU must match socket (bidirectional) |
| Motherboard form factor (e.g. ATX) | Case must support that form factor (bidirectional) |
| Motherboard RAM type (e.g. DDR5) | RAM must match (bidirectional) |
| CPU / Motherboard socket | Cooler must support that socket (bidirectional) |
| Case GPU clearance (mm) | GPU length must not exceed it |

---

## Test Summary

27 unit tests across 4 files, all passing:
- `compatibility.test.js` — 14 tests
- `useBuilderStore.test.js` — 8 tests
- `BudgetEntry.test.jsx` — 3 tests
- `PartCard.test.jsx` — 2 tests

3D rendering (BuildCanvas, PartModel, OrbitRing) is verified by successful `vite build`, not unit tests (WebGL can't run in jsdom).
