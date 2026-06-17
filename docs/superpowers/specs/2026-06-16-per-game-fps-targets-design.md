# Phase 3 — Per-Game FPS Targets — Design

**Date:** 2026-06-16
**Status:** Approved (pending spec review)
**Part of:** the 4-phase roadmap. Phase 3 of 4 (after persistence & sharing, smart assistance). Its own spec → plan → build.

## Goal

Tell the user how their build runs real games: a focused **target check** (pick a game + target FPS → does it clear it, what to upgrade) and an at-a-glance **multi-game list** in the build summary. Both estimate from the existing perf model — clearly an estimate, not a benchmark.

## The model

Each game carries an `fpsFactor` — a multiplier on the existing generic `estimateFps` baseline:

```
gameFps(cpu, gpu, resolution, game) = round(estimateFps(cpu, gpu, resolution) × game.fpsFactor)
```

Esports titles run far above the baseline (`fpsFactor > 1`, e.g. Valorant 2.8, CS2 2.6); demanding AAA run below it (`fpsFactor < 1`, e.g. Cyberpunk 0.5, Alan Wake 2 0.4). Calibrated so an RTX-4090-class build (~150 generic FPS @1440p) reads ~390 in CS2 and ~75 in Cyberpunk. Returns 0 without a CPU+GPU.

## Data — `src/data/gamesData.json`

~12 curated titles, each `{ id, name, fpsFactor }`, spanning esports → demanding AAA: Valorant (2.8), League of Legends (3.0), Counter-Strike 2 (2.6), Rocket League (2.5), Fortnite (1.6), Apex Legends (1.5), Call of Duty: Warzone (1.1), Elden Ring (0.9), Baldur's Gate 3 (0.85), Starfield (0.65), Cyberpunk 2077 (0.5), Alan Wake 2 (0.4).

## Feature 1 — Games tab (target check)

New 4th tab (Build / Peripherals / Summary / **Games**), rendered by `src/components/GamePanel.jsx`:
- A game `<select>`, a target chip row (`FPS_TARGETS = [60, 120, 144]`), and a `ResolutionToggle` (reused) so the user can switch resolution here.
- Shows the estimated game FPS (mono, large) + "est. FPS @ {res}" and a clear verdict: `clears {target} ✓` (green) or `misses {target} ✗` (red).
- **If short:** call `suggestUpgrade(selectedParts, budget, partsData, resolution)`. If it returns a swap, apply it to a copy and recompute the game FPS, then show "Upgrade {category} → {toPart.name} (+£{extraCost}) → ~{newFps} FPS" and whether that clears the target. If no affordable upgrade exists, show "No affordable upgrade reaches {target} at this budget."
- **Empty state** (no CPU or GPU): "Select a CPU and a GPU to check game performance."

Local component state: selected `gameId` (default first game) and `target` (default 60). Resolution/budget/parts come from the store.

## Feature 2 — "How it runs" list in the Summary tab

New `src/components/GamePerformanceList.jsx` — a pure-ish list taking `{ cpu, gpu, resolution }` props:
- Maps `gamesData` → `{ game, fps: gameFps(...) }`, sorted high→low.
- Each row: a status dot (green ≥60, amber 30–59, red <30) · game name · mono FPS.
- Renders `null` when there's no CPU+GPU.

`BuildSummary.jsx` mounts it as a "How it runs @ {res}" section (header + list) below the parts/totals, only when a CPU+GPU are selected. It reads `cpu`, `gpu`, `resolution` from the store and passes them down.

## Files

| File | Change |
|---|---|
| `src/data/gamesData.json` | New — ~12 games `{ id, name, fpsFactor }` |
| `src/lib/gameFps.js` | New — `gameFps` + `FPS_TARGETS` (pure) |
| `src/components/GamePanel.jsx` | New — Games tab target check |
| `src/components/GamePerformanceList.jsx` | New — shared multi-game list |
| `src/components/BuildSummary.jsx` | Mount the "How it runs" section |
| `src/screens/BuilderScreen.jsx` | Add `games` to the view toggle; render `<GamePanel />` |

## Testing

- `src/tests/gameFps.test.js` — `gameFps` returns 0 without a CPU/GPU; equals `round(estimateFps × fpsFactor)`; a higher-`fpsFactor` game yields more FPS than a lower one for the same build.
- `src/tests/GamePerformanceList.test.jsx` — renders nothing without a CPU+GPU; with one, renders all game names and their FPS numbers.
- `src/tests/GamePanel.test.jsx` — shows the empty state without a CPU+GPU; with one, shows the chosen game's FPS and a target verdict.

## Edge cases

- No CPU/GPU → both surfaces show their empty state / render nothing.
- Game FPS already clears the target → no upgrade hint shown.
- Best affordable upgrade still misses the target → say so rather than implying success.
- Estimates carry the same "not a benchmark" framing as the existing FPS heuristic.

## Non-goals

- No real benchmark data, ray-tracing/DLSS modeling, or per-game settings presets (the `fpsFactor` is a single curated multiplier).
- No new perf engine — reuses `estimateFps` and `suggestUpgrade` unchanged.
- Responsive/mobile + SEO remain Phase 4.
