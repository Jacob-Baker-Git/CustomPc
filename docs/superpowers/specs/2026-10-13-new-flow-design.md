# New flow: two paths, game-search performance, build-for-a-game

Date: 2026-10-13. Status: design agreed in chat; awaiting spec review.

## Intent

Make the site easy to follow and put real benchmark data front and centre.
Order of work (the user's call): **I build the new flow functionally first →
the user decides where everything goes → Lovable polishes the visuals.**
This spec covers the first step only. The parts-as-buttons theme (each button a
different part — RAM, GPU, CPU, SSD…) is the Lovable step and is out of scope here.

## The flow

```
WELCOME (3 buttons)
├─ What will my build get? → Build (enter parts) → Performance → Peripherals → Summary
├─ Build for a game        → Game target + budget → Generated build → Peripherals → Summary
└─ Saved builds            → Summary
```

- **Welcome**: exactly three buttons — "What will my build get?", "Build for a
  game", "Saved builds". "Start a build" and its setup wizard go.
- **Removed**: "enter the PC I already own" and the budget + use-case
  auto-build ("Pick parts for me"). Path 1 just says enter your PC parts.
- **3D view only on Summary.** Build, Performance and Peripherals lose the 3D
  panel and use the full width.
- **Summary** = 3D view + CustomPC score + parts list. The use-case chips
  (Gaming, Everyday & Office, Content Creation, Programming, Streaming) live
  next to the score for now and re-rate the build on switch. They will move later.
- **Peripherals** stays as it is (optional extras), in both paths.

## Path 1 — Performance: game-search estimator

Replaces the all-games table as the main view.

1. Search box over the game list (the 58 games the corpus covers).
2. Pick resolution (1080p / 1440p / 4K) and graphics setting (the presets
   the engine knows, including upscaling "performance mode" variants).
3. Show one big estimate for the selected parts: average FPS, 1% lows, the
   bottleneck part, and what the figure is based on (existing basis text).
4. A combination with no data says so — never an invented number.

Uses the existing `estimateBuildPerformance` / `perfModel.json`; no engine
changes. Whether the all-games table survives below the estimator is the
user's call when arranging (keep it collapsed until then).

## Path 2 — Build for a game (new logic)

Inputs: game, target FPS, resolution, graphics setting, budget.

Outputs:
- **Best build in budget**: the build maximising estimated FPS for that game
  and settings within the budget.
- **If it misses the target**: also the **cheapest build that hits the
  target**, with its price, even over budget.
- **If no build can hit it**: say so plainly and give the fastest build's FPS.

Then the user continues to Peripherals → Summary with the best-in-budget build
(one click to swap to the cheapest-that-hits build).

Optimiser: new module next to `autoBuilder.js`, reusing its compatibility-aware
part selection and PSU pricing (`psuPricer`), but with the objective being the
perf engine's FPS for one game/resolution/preset rather than the CustomPC score.
CPU + GPU drive FPS; the rest of the build is the cheapest compatible set that
is sensible (enough RAM for the game profile, PSU from `recommendedPsuW`).
Must be deterministic (signed-off rule for auto-build).

## Navigation and state

- `flow` today is `hub | setup | saved | builder`. `setup` goes; add a
  `target` screen for the path-2 inputs. Builder hash tabs stay
  (`#build`, `#performance`, `#peripherals`, `#summary`); path 2 skips `#build`
  and `#performance` in its step order but they stay reachable.
- Persisted store gains the path-2 inputs; bump the persist version with a
  migration (old `setup` → `hub`).
- Share links (`?build=`) and saved builds open on `#summary`.

## Testing

- Unit: the game-target optimiser (best-in-budget ≥ every cheaper sampled
  build's FPS; cheapest-that-hits really is the cheapest found; unreachable
  target reported; deterministic), store migration, the estimator's no-data state.
- e2e: both paths end to end; Welcome shows exactly three buttons; 3D canvas
  mounts only on Summary.
- Existing suites stay green; update the ones that assert the removed setup
  wizard and the 3D panel on `#build`.
- The local gate: `npm run lint && npx vitest run && npm run build`, then
  `npx playwright test`; re-run `npm run prerender` (shared UI changes).

## Out of scope

The visual theme (Lovable step), moving the use-case chips, any data or
engine changes, deploying (push only when asked).
