# Pre-rendering the content pages

**Date:** 2026-08-11
**Status:** approved
**Context:** the last item on the ranked SEO list (see the SEO audit of 2026-08-04)

## The problem

Every route ships an empty shell. `dist/index.html` contains

```html
<div id="root"><div class="boot" …>Custom PC Builder…</div></div>
```

and nothing else. The root's own copy is roughly 60 words of `<meta>`; the six
content pages carry no per-page meta in the served HTML at all, because
`PAGE_META` is applied by `App.jsx` after React mounts.

Google renders JavaScript, so the pages *are* indexable. Pre-rendering is what
makes them competitive: real content in the first response, no execution
required, and correct per-page `<title>`/`<meta>`/canonical for anything that
does not run JS — every social preview crawler, and every crawler that is not
Google.

## Scope

**Seven routes: `/` and the six content pages** (`/help`, `/parts`, `/glossary`,
`/feedback`, `/privacy`, `/terms`).

The 544 part pages are **out of scope**. They would commit 544 HTML files and
regenerate wholesale on every catalogue widening, turning each widening into a
several-hundred-file diff. Revisit separately if the seven prove their worth.

## The constraint that shapes the design

**A committed pre-render must not contain asset URLs.**

`vite build` emits content-hashed bundles (`index-L1HLCUU1.js`,
`index-DF_WS1_Y.css`, and `BuildCanvas-*.js` as its own chunk). A committed
whole-page snapshot freezes one build's hashes; the next build changes them and
every pre-rendered page then references bundles that no longer exist — a
silently broken deploy, since the HTML still serves fine and only the scripts
404.

So the committed artefact is a **body fragment**, never a document. Hashes are
supplied at build time by the file Vite has just generated.

## Design

Three pieces, split by what can be derived without a browser.

### 1. `npm run prerender` — `scripts/prerender.mjs`

Run locally and occasionally; its output is committed.

1. `vite build` into `dist/`.
2. Serve `dist/` statically on a local port. Every unknown path must return
   `index.html`, mirroring `public/_redirects`, or the content routes 404 before
   React ever loads.
3. For each of the seven routes, open a **fresh Playwright browser context**,
   navigate, wait for the app to settle, and capture `#root`'s `innerHTML`.
4. Write each to `prerendered/<page>.html` (`index.html` for the root).

**The fresh context is load-bearing.** `useBuilderStore` persists to
localStorage as `custompc-builder-v1`, and `App.jsx` branches on the persisted
`flow`. A reused context would snapshot whatever build the previous route left
behind — so the root would pre-render somebody's half-finished PC instead of the
landing page. A first-time visitor is the only correct subject.

Playwright is already a devDependency (`^1.61.1`, `npm run test:e2e`), so this
adds no dependency.

**Settle condition:** wait for network idle *and* for `#root` to no longer
contain the boot placeholder. Network idle alone would happily capture the boot
message on a fast local server.

### 2. `npm run build` gains a post-build step

```
"build": "vite build && node scripts/apply-prerender.mjs"
```

`scripts/apply-prerender.mjs` reads `dist/index.html` — which carries the hashes
Vite has just produced — and for each fragment writes `dist/<page>/index.html`
with:

- the boot placeholder replaced by the fragment;
- the head's title, description, canonical, `og:*` and `twitter:*` replaced with
  that page's values from `PAGE_META`.

The root overwrites `dist/index.html` itself, and **its head is left untouched**.
`index.html` is already the source of truth for the root's title, description,
canonical and OG block — `App.jsx` has no `PAGE_META` entry for the root and
reads the document's own tags back via `captureRootMeta()`. Generating the root's
head from `PAGE_META` would mean inventing a second definition of copy that
already has one, and would silently drop the `google-site-verification` tag.
So for the root: body only.

Netlify runs `npm run build` and needs **no browser**. `public/_redirects` needs
no change: Netlify serves a real file before reaching the `/*` catch-all, and the
asset-directory rules above it are untouched.

### 3. `src/lib/pageMeta.js`

`PAGE_META` moves out of `App.jsx` into a plain module that both `App.jsx` and
`apply-prerender.mjs` import. Two definitions of the page titles is precisely the
drift `npm run sitemap` and `npm run perf:games` already exist to prevent.

`App.jsx`'s behaviour is unchanged — it imports the same object from one file
further away.

## What is deliberately NOT done

**The client stays on `createRoot`, not `hydrateRoot`.**

The app's first render depends on persisted localStorage: `flow` decides whether
the root shows `MainMenu`, the builder, or the saved-builds screen. A
pre-rendered fragment is always the first-visit branch, so for any returning
visitor the markup will not match and hydration would either warn loudly or
produce a wrong tree. React discarding the fragment and re-rendering costs one
render of an already-cheap component and is correct in every case.

The visitor still gains: real content paints immediately instead of "Custom PC
Builder…", and the crawler gets it without executing anything.

## Testing

`src/tests/prerender.test.js`, no browser required:

1. **Coverage** — every entry in `PAGES` plus the root has a fragment, and no
   fragment exists for a route that is not a page.
2. **Not stale placeholders** — no fragment contains the boot markup, and none is
   trivially short.
3. **No embedded hashes** — no fragment matches `/(assets|index)-[A-Za-z0-9_-]{8}\./`.
   This is the constraint the whole design rests on, so it is asserted directly
   rather than trusted.
4. **Head meta** — the head that `apply-prerender.mjs` generates for each of the
   six content routes equals `PAGE_META`'s values for it, including canonical.
5. **The root's head is preserved verbatim**, including
   `google-site-verification`. A test asserts the generated root still carries
   that tag, because losing it silently unverifies the Search Console property.

Full body freshness cannot be checked without a browser; that belongs to
`npm run test:e2e`, and the fragments being committed means a stale one is at
least visible in review.

## Verification before completion

1. `npm run prerender`, then confirm each of the seven files is non-empty and the
   root fragment contains the landing `h1` (both lines: the wordmark and "Build
   and price a gaming PC in 3D").
2. **Check the `/parts` fragment's size.** `PartsBrowser` is paginated via
   `pagedParts`, so it should be modest — but if it serialises the whole
   544-part catalogue the page weight is a real regression and the route should
   be dropped from the set rather than shipped fat.
3. `npm run build`, then confirm `dist/help/index.html` exists, references the
   **current** hashed bundles, and carries `/help`'s title and canonical.
4. Serve `dist/` and load `/`, `/help` and `/glossary` in a browser: content
   correct, no console errors, no hydration warnings, navigation still
   client-side.
5. `npm test`, `npm run lint`, `npm run build` all green.
6. Confirm `curl`-equivalent output (fetch with JS disabled) shows real text on
   the root — the actual thing being bought.

## Explicitly out of scope

- The 544 part pages.
- `hydrateRoot`, for the reason above.
- Any change to `public/_redirects`, the sitemap, or the Supabase catalogue.
- Any push or deploy.
