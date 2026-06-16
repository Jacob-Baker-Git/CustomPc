# Phase 1 — Build Persistence & Sharing — Design

**Date:** 2026-06-16
**Status:** Approved (pending spec review)
**Part of:** the 4-phase "make the site better" roadmap. This is Phase 1 of 4 (persistence & sharing → smart assistance → game targets → reach/perf). Each phase is its own spec → plan → build cycle.

## Goal

Stop users losing their build, let them share it as a link, and give the app a proper "finish" view (parts list + totals + buy links). All three features revolve around one core idea: a build is a small serialisable object.

## The build shape

```
{ budget: number, resolution: '1080p'|'1440p'|'4k',
  parts:       { [category]: partId },     // core build
  peripherals: { [category]: peripheralId } }
```

Persistence saves the live store; sharing encodes this shape into the URL; the summary view renders it. No backend, no router — `window.location` is read/written directly.

## Budget semantics (unchanged)

The budget applies to the **core build only** — matching the existing `selTotalSpent` (which already excludes peripherals) and `selPeripheralsTotal`. The summary therefore shows the build subtotal *vs budget*, peripherals as a separate subtotal, and a grand total (build + peripherals) as an info figure.

## Feature 1 — Persistence

Wrap the Zustand store in the `persist` middleware (`zustand/middleware`):

- Storage key `custompc-build-v1`, `version: 1` (room for future migrations).
- `partialize` to persist exactly: `budget`, `selectedParts`, `selectedPeripherals`, `resolution`, `caseTransparent`. (Actions and transient UI are not persisted.)
- Whole part objects are stored (the catalog is static JSON — no id-resolution needed on rehydrate).
- Effect: refresh restores the build; `App.jsx` already routes to the builder when `budget` is truthy, so a returning user skips BudgetEntry.

## Feature 2 — Stateless share links

New pure module `src/lib/buildCodec.js`:

- `encodeBuild({ budget, resolution, parts, peripherals })` → compact object `{ b, r, p:{cat:id}, x:{cat:id} }` → `JSON.stringify` → base64url (URL-safe: `+/`→`-_`, strip `=`). Returns the code string.
- `decodeBuild(code)` → `{ budget, resolution, parts, peripherals }` where `parts`/`peripherals` are `{ category: partObject }`, resolved by id against `partsData.json` + `peripheralsData.json` via a prebuilt `id→part` map. Unknown ids are silently skipped. Invalid/garbage input returns `null`.

`buildCodec` is pure (no store, no DOM) so it is fully unit-testable.

The DOM/store wiring around the pure codec lives in a new `src/lib/shareLink.js`:

**Startup hydration (no flash):** `applyShareLinkFromUrl()` reads `?build=` from `location.search`; if present, `decodeBuild`s it and calls `useBuilderStore.setState({ budget, resolution, selectedParts, selectedPeripherals })`, then `history.replaceState({}, '', location.pathname)` to strip the param (so a later refresh falls back to persisted localStorage, not the stale link). `src/main.jsx` calls it **before** `createRoot(...).render(...)`; running after the module-load persist-rehydration means a shared link takes precedence over local state for that visit.

**Producing a link:** `buildShareUrl()` = `${location.origin}${location.pathname}?build=${encodeBuild(currentState)}`. The summary's "Copy share link" writes it via `navigator.clipboard.writeText` and shows a transient "Copied!" confirmation.

## Feature 3 — Build summary view

New `src/components/BuildSummary.jsx`, shown via a third **"Summary"** tab added to the existing `view` toggle in `BuilderScreen.jsx` (`['build','peripherals','summary']`).

Contents:
- **Header:** "Your build" + build subtotal vs budget (mono; red if over).
- **Core build** section: one row per selected core part — `CATEGORY` (mono label) · part name · `£price` (mono) · **Buy ↗**.
- **Peripherals** section: same row format for selected peripherals.
- **Totals bar:** Build subtotal · Peripherals subtotal · Power draw (`selTotalPower`) · Grand total.
- **Actions:** `Copy share link`, `Print` (`window.print()`), `Copy parts list` (plain-text list to clipboard).
- **Empty state:** if no parts/peripherals selected, show "No parts selected yet — head to the Build tab." and disable the actions.

Styling uses the existing Industrial Utilitarian tokens (`PANEL`, `font-mono` for prices, sharp corners, cyan accents).

**Buy links** — new pure module `src/lib/retailerLinks.js`:
- `searchUrl(name)` → `https://www.amazon.co.uk/s?k=${encodeURIComponent(name)}` and, if a module-level `AMAZON_TAG` constant is set, append `&tag=${AMAZON_TAG}` (empty by default — affiliate-ready, no account needed now). Opens in a new tab (`target="_blank" rel="noopener noreferrer"`).

## Files

| File | Change |
|---|---|
| `src/store/useBuilderStore.js` | Wrap `create(...)` with `persist(...)`, add `partialize` + key/version |
| `src/lib/buildCodec.js` | New — `encodeBuild` / `decodeBuild` (pure) |
| `src/lib/retailerLinks.js` | New — `searchUrl` (pure) |
| `src/lib/shareLink.js` | New — `buildShareUrl` + `applyShareLinkFromUrl` (DOM/store wiring around the pure codec) |
| `src/components/BuildSummary.jsx` | New — Summary tab UI |
| `src/screens/BuilderScreen.jsx` | Add `summary` to the view toggle; render `<BuildSummary />` |
| `src/main.jsx` | Call `applyShareLinkFromUrl()` synchronously before render |

## Testing

- `src/tests/buildCodec.test.js` — round-trip (budget/resolution/part ids/peripheral ids preserved through encode→decode); unknown id is dropped; garbage/empty input returns `null`.
- `src/tests/retailerLinks.test.js` — `searchUrl` contains `amazon.co.uk` and the URL-encoded name; appends `&tag=` only when `AMAZON_TAG` is set.
- `src/tests/BuildSummary.test.jsx` — renders selected core + peripheral rows with names/prices, the grand total, and a Buy link whose `href` contains the encoded part name; empty build shows the prompt and disabled actions.
- **Persistence** is verified in the dev-server preview (set a build, reload, confirm it restores) rather than a brittle middleware unit test.

## Edge cases

- Shared link references an id no longer in the catalog → that category is silently omitted.
- `?build=` present *and* localStorage has a build → the link wins for that visit; param is stripped afterward.
- Over-budget build → total rendered red (reuses existing remaining-budget colour logic).
- `navigator.clipboard` unavailable (insecure context) → fall back to selecting a hidden text field; never throw.

## Non-goals (later phases / explicitly out)

- No backend, accounts, or cloud "my builds" library (Phase-1 sharing is stateless URLs only).
- No real affiliate-account integration (search links now; `AMAZON_TAG` hook left for later).
- No auto-build, presets, game targets, responsive, or SEO — those are Phases 2–4.
