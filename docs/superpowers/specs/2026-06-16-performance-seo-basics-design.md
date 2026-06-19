# Phase 4a — Performance + SEO Basics — Design

**Date:** 2026-06-16
**Status:** Approved (pending spec review)
**Part of:** Phase 4 of the roadmap, split into 4a (this — perf + SEO basics) and 4b (responsive/mobile, a separate spec).

## Goal

Two quick, low-risk wins: stop shipping the ~1.2 MB 3D bundle on first paint, and give the site real SEO/share metadata. No store, logic, or layout changes.

## Feature 1 — Lazy-load the 3D canvas

`BuildCanvas` (which transitively pulls three.js + React Three Fiber + drei — the heaviest dependency) is loaded statically today, so it's in the initial bundle even on the budget screen where no 3D renders.

Change in `src/screens/BuilderScreen.jsx`:
- Replace `import BuildCanvas from '../components/BuildCanvas'` with a lazy import:
  ```js
  import { lazy, Suspense } from 'react'
  const BuildCanvas = lazy(() => import('../components/BuildCanvas'))
  ```
- Wrap the canvas in `<Suspense>` with a lightweight fallback that sits over the existing `Backdrop`:
  ```jsx
  <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm animate-pulse">Assembling 3D…</div>}>
    <BuildCanvas selectedParts={selectedParts} />
  </Suspense>
  ```

Vite automatically splits the dynamic import into its own chunk. Result: the `BudgetEntry` screen and the app shell (top bar, panels, orbit) load and paint first; the three.js chunk streams in only when the build view mounts, behind the fallback.

`BuildCanvas` is a default export, so the lazy import needs no shim.

## Feature 2 — SEO + share metadata

Replace `<title>custompc</title>` in `index.html` and add metadata to `<head>`:

```html
<title>Custom PC Builder — Build & Price Your Gaming PC in 3D</title>
<meta name="description" content="Plan a compatible custom gaming PC in 3D: auto-build to your budget, check real-game FPS, spot bottlenecks, and share your build." />
<meta name="theme-color" content="#05080f" />
<link rel="canonical" href="https://custompcbuilder.netlify.app/" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Custom PC Builder" />
<meta property="og:title" content="Custom PC Builder — Build & Price Your Gaming PC in 3D" />
<meta property="og:description" content="Plan a compatible custom gaming PC in 3D: auto-build to your budget, check real-game FPS, spot bottlenecks, and share your build." />
<meta property="og:url" content="https://custompcbuilder.netlify.app/" />
<meta property="og:image" content="https://custompcbuilder.netlify.app/favicon.svg" />

<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="Custom PC Builder — Build & Price Your Gaming PC in 3D" />
<meta name="twitter:description" content="Plan a compatible custom gaming PC in 3D: auto-build to your budget, check real-game FPS, spot bottlenecks, and share your build." />
```

`og:image` reuses the existing `/favicon.svg` for now (a dedicated raster share image is a later nice-to-have).

## Files

| File | Change |
|---|---|
| `src/screens/BuilderScreen.jsx` | `lazy(BuildCanvas)` + `Suspense` fallback |
| `index.html` | new `<title>` + description, Open Graph, Twitter, theme-color, canonical |

## Testing

- The existing **109 tests stay green** (no logic touched).
- `npm run build` succeeds and the output shows `BuildCanvas` (with three.js) split into its **own chunk**, separate from the main bundle.
- Dev-server preview:
  - On the budget screen, `preview_network` shows the heavy 3D chunk is **not** requested; entering the builder triggers it, with the "Assembling 3D…" fallback briefly visible, then the canvas renders.
  - Inspect the served HTML (`preview_eval` on `document.head.innerHTML` or read `index.html`) to confirm the meta/OG tags are present.

## Edge cases

- Brief fallback flash while the chunk loads — expected and acceptable.
- Re-entering the build view after the chunk is cached shows no fallback (already loaded).

## Non-goals

- No static-prerender/SSG pipeline (full SEO indexing of a client SPA is out of scope; this is metadata only).
- No responsive/mobile work — that's Phase 4b.
- No dedicated raster OG share image.
