# Navigation rework + dead-code and performance cleanup

Date: 2026-07-28

## Problem

Two separate problems, addressed in one session.

### 1. The main menu forks into a false choice

`App.jsx` routes on `budget > 0`. "Build a new PC" and "Upgrade your PC" are not
two journeys — they are two ways of populating `selectedParts` before landing on
the identical builder screen. Nothing downstream remembers which door the user
came through. The user's words: "the menu doesn't rlly do much".

Three structural consequences:

- **`budget` doubles as the "am I in the builder" flag.** Leaving the builder is
  `setBudget(0)` (`TopBar.jsx:34`), with a tooltip reassuring the user their
  build survives. "Start empty instead" still forces a budget first.
- **A persisted `budget` means returning users never see the menu at all** —
  `budget > 0` short-circuits straight to the builder.
- **`saved` is a builder tab** but is a library across all builds, not a view of
  the current one.
- **Help / Parts browser / Glossary / Feedback** live on a second hash router
  (`usePageRoute`) reachable only from footer links. 317 browsable parts are
  effectively hidden.

### 2. Dead code and a hot loop

Accumulated across ~20 rounds of redesign:

- Four modules unreachable from `main.jsx`.
- Several exports with zero non-test consumers.
- Two long-standing lint errors in `SpecSheet.jsx`.
- `partLevel()` rescans the whole 317-part catalog on every call, making the
  Build-tab rating panel cost ~10 ms of blocking main-thread compute per render.

## Decisions

Chosen by the user from options presented 2026-07-28:

| Question | Decision |
|---|---|
| Two menu doors | **Collapse to one flow.** "Do you already have a PC?" becomes a step, not a door. |
| Tab position | **Merge into the top bar** on desktop; bottom bar on mobile. |
| Tab set | **Move `saved` to the hub**, leaving `build \| peripherals \| summary`. |
| Scope | Cleanup **and** flow rework in one session, committed in reviewable steps. |

## Design

### Routing

`useBuilderStore.flow` becomes the single source of truth:
`'hub' | 'setup' | 'saved' | 'builder'`. It is **persisted** (added to
`partialize`). `App.jsx` routes on `flow`, never on `budget`.

Persist version bumps `1 → 2`. Migration for existing users, who have a
persisted `budget` but no persisted `flow`:

```
flow = budget > 0 ? 'builder' : 'hub'
```

so a user mid-build resumes in the builder rather than being bounced to the hub.

`budget` reverts to meaning only "the budget". `setBudget(0)` no longer
navigates.

### Hub (rewrite of `MainMenu.jsx`)

- **Resume** card — rendered only when `selectedParts` is non-empty; shows part
  count and total; goes to `builder`.
- **Start a build** — primary CTA, goes to `setup`.
- **Saved builds** — goes to `saved`.
- Secondary row linking the existing content pages: Browse parts, Glossary,
  Help, Feedback.

### Setup (`SetupFlow.jsx`, replacing `BudgetEntry.jsx` + `UpgradeWizard.jsx`)

One component, one step indicator, three steps:

1. **Start point** — `Generate one for me` / `I already have a PC` / `Empty build`
2. **Budget** (generate/empty paths; keeps the existing `TIERS` presets)
   or **Your parts** (already-have path; the part-entry list and saved-build
   picker lifted from `UpgradeWizard`, budget derived from the parts total and
   editable)
3. **Use case** — the five `USE_CASES` cards, then the path-appropriate CTA.

### Builder chrome

- `build | peripherals | summary` move into the fixed `TopBar` at `md`+.
- On mobile they become a **bottom bar**. The header has a hard one-row
  constraint at 375 px (documented in `TopBar.jsx`) that three more controls
  would break; a bottom bar is also the better phone pattern.
- `saved` leaves the builder. `BuildSummary` gains a link to the hub's saved
  view, since saving happens there.
- The back arrow calls `setFlow('hub')` only.

### Cleanup

**Delete (unreachable from `main.jsx`):**
`BottleneckIndicator.jsx`, `GamePerformancePanel.jsx`, `ResolutionToggle.jsx`,
`targetBuilder.js`, plus their orphaned test files.

**Delete (no non-test consumers):**
`upgradeCandidates` / `sortCandidates` (`upgradeAdvisor.js`, left over from the
removed upgrade-wizard v2), `FPS_TARGETS` (`gameFps.js`), `ACCENT_TEXT`
(`uiTokens.js`).

**Lint:** move `insight()` and `specRows()` out of `SpecSheet.jsx` into a lib
module so the file exports only a component, clearing both
`react-refresh/only-export-components` errors.

**Performance:** memoize `partLevel`'s per-category quality range per catalog
(`WeakMap` keyed on the catalog array). `partUpgradeOptions` currently calls
`partLevel` per candidate and `rateBuild` per candidate, each rescanning the
catalog. Target: the ~10 ms panel render drops to low single digits.

## Non-goals

- No visual restyle. The Workbench tokens stay exactly as they are.
- No change to `rateBuild` / `partSynergy` / `autoBuild` scoring behaviour —
  the memoization must be output-identical.
- No change to the 3D assembly.
- `targetBuild` is deleted rather than rewired; the FPS-target flow it served
  was removed in an earlier session.

## Verification

- `npm run test:run` — 423 tests pass at baseline; must stay green, minus the
  tests for deleted modules, plus new tests for the migration and the memo.
- `npm run lint` — must reach **zero** errors (from the 2 known).
- `npm run build` — clean.
- Browser: hub → setup (all three start points) → builder; tab bar at 375 px and
  at desktop width; resume-after-reload.
- A test asserting memoized `partLevel` output matches the unmemoized result
  across the whole catalog.
