# Phase 4a — Performance + SEO Basics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lazy-load the 3D canvas off first paint and add real SEO/share metadata.

**Architecture:** `index.html` gains a title + Open Graph/Twitter meta (guarded by a small HTML test). `BuildCanvas` becomes a `React.lazy` import behind `<Suspense>`, so Vite splits three.js into its own chunk loaded only when the build view mounts.

**Tech Stack:** React 19, Vite, Tailwind, Vitest.

**Conventions for every task:**
- Node at `C:\Program Files\nodejs`. In PowerShell once per shell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`.
- Full suite: `npm run test:run`. Single file: `npm run test:run -- src/tests/<file>`. Baseline **109 passing**.
- Every commit appends: `-m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"`.
- Work on `main` locally; do not push.

---

### Task 1: SEO + share metadata

**Files:**
- Create: `src/tests/indexHtml.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing test**

Create `src/tests/indexHtml.test.js`:

```js
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

describe('index.html metadata', () => {
  it('has a descriptive title, not the placeholder', () => {
    expect(html).not.toContain('<title>custompc</title>')
    expect(html).toMatch(/<title>[^<]*PC Builder[^<]*<\/title>/)
  })

  it('has description, Open Graph and Twitter card meta', () => {
    expect(html).toContain('name="description"')
    expect(html).toContain('property="og:title"')
    expect(html).toContain('property="og:description"')
    expect(html).toContain('property="og:image"')
    expect(html).toContain('name="twitter:card"')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/indexHtml.test.js`
Expected: FAIL — current title is `<title>custompc</title>` and the OG/Twitter tags are absent.

- [ ] **Step 3: Add the metadata**

In `index.html`, replace the line `<title>custompc</title>` with:

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/indexHtml.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add index.html src/tests/indexHtml.test.js
git commit -m "feat: SEO + Open Graph / Twitter share metadata"
```

---

### Task 2: Lazy-load the 3D canvas

**Files:**
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Switch the React import to include lazy + Suspense**

In `src/screens/BuilderScreen.jsx`, change the first line:

```js
import { useState, lazy, Suspense } from 'react'
```

- [ ] **Step 2: Make BuildCanvas a lazy import**

Replace the static import line:

```js
import BuildCanvas from '../components/BuildCanvas'
```

with:

```js
const BuildCanvas = lazy(() => import('../components/BuildCanvas'))
```

- [ ] **Step 3: Wrap the canvas in Suspense**

Find:

```jsx
          <div className="relative w-full h-full">
            <BuildCanvas selectedParts={selectedParts} />
```

and replace it with:

```jsx
          <div className="relative w-full h-full">
            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm animate-pulse">Assembling 3D…</div>}>
              <BuildCanvas selectedParts={selectedParts} />
            </Suspense>
```

- [ ] **Step 4: Run the full suite**

Run: `npm run test:run`
Expected: PASS — 111 tests (109 baseline + 2 from Task 1).

- [ ] **Step 5: Confirm the chunk splits in the build**

Run: `npm run build`
Expected: build succeeds; the output lists a **separate `BuildCanvas-*.js` chunk** (~1 MB+, containing three.js), distinct from the main `index-*.js` bundle — confirming the 3D code is no longer in the initial bundle.

- [ ] **Step 6: Verify in the dev server**

Start the dev server:
- Load the budget screen. Use `preview_network` to confirm the heavy 3D chunk is **not** fetched yet. Use `preview_eval` on `document.head.innerHTML` to confirm the OG/Twitter meta are present.
- Enter the builder → the "Assembling 3D…" fallback is briefly visible, the 3D chunk is now fetched, and the canvas renders. Screenshot the build view to confirm the 3D still works.

- [ ] **Step 7: Commit**

```bash
git add src/screens/BuilderScreen.jsx
git commit -m "perf: lazy-load the 3D canvas off first paint"
```

---

## Self-Review

- **Spec coverage:** SEO metadata → Task 1; lazy-load 3D → Task 2. Both spec features covered.
- **Placeholders:** none — exact HTML, exact code, exact commands.
- **Type/name consistency:** `BuildCanvas` is used identically (`<BuildCanvas selectedParts={selectedParts} />`) before and after becoming lazy; `Suspense`/`lazy` imported from React in Task 2 Step 1. The HTML test asserts attribute presence (`property="og:title"` etc.), not copy, so it won't break on wording tweaks.
- **Testing reality:** lazy-loading is a build/runtime behaviour, not unit-testable — it's verified via the build output (chunk split) and the preview (network + render), which is the right level. The HTML test guards the metadata from regressions.
- **Test count:** 109 + 2 (indexHtml) = **111** at the end.
