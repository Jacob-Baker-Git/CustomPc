# Pre-rendering the content pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship real content and correct per-page meta in the first HTTP response for the root and the six content pages, without committing any asset hash.

**Architecture:** Three pieces split by what needs a browser. `npm run prerender` runs locally, drives Playwright over a built site and commits seven **body fragments**. `npm run build` gains a post-step that injects each fragment plus its head into the freshly-built `dist/`, where the asset hashes are current. `PAGE_META` moves into a plain zero-import module so the runtime and the build step read one definition.

**Tech Stack:** Node ESM scripts (`scripts/*.mjs`), Vite 8 (`build` + `preview` APIs), Playwright 1.61 via `@playwright/test` (already a devDependency, Chromium already installed), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-11-prerendering-design.md`

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/pageMeta.js` | The one definition of per-page title/description/canonical | **Create** |
| `src/App.jsx:32-58,96` | Applies meta at runtime | Import instead of declaring |
| `scripts/prerender.mjs` | Capture seven body fragments with a browser | **Create** |
| `scripts/apply-prerender.mjs` | Inject fragments + heads into `dist/` | **Create** |
| `prerendered/*.html` | The committed fragments | **Create** (generated) |
| `src/tests/prerender.test.js` | Guards the constraint the design rests on | **Create** |
| `package.json` | `build` gains a post-step, `prerender` is added | Modify |

### ⚠️ Two different things are called `PAGES`

- `src/hooks/usePageRoute.js:4` — `['help','parts','glossary','feedback','privacy','terms']`, the **route list**. This is the one to iterate.
- `src/App.jsx:19` — a route→component map. Not a route list; do not import it into scripts, it would drag React into a build script.

---

### Task 1: Extract `PAGE_META` into a zero-import module

**Files:**
- Create: `src/lib/pageMeta.js`
- Modify: `src/App.jsx:32-58` and `src/App.jsx:96`
- Test: `src/tests/pageMeta.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/pageMeta.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { PAGE_META, SITE, canonicalFor } from '../lib/pageMeta'
import { PAGES } from '../hooks/usePageRoute'

describe('pageMeta', () => {
  it('has a title and a description for every content route', () => {
    // A route with no entry silently falls back to the root's copy, which is the
    // six-addresses-for-one-document problem real paths were meant to fix.
    const missing = PAGES.filter((p) => !PAGE_META[p]?.title || !PAGE_META[p]?.description)
    expect(missing).toEqual([])
  })

  it('describes no route that does not exist', () => {
    const extra = Object.keys(PAGE_META).filter((p) => !PAGES.includes(p))
    expect(extra).toEqual([])
  })

  it('deliberately holds no entry for the root', () => {
    // index.html is the source of truth for the root's copy. A second definition
    // here would drift, and generating the root's head from it would drop the
    // google-site-verification tag.
    expect(PAGE_META['']).toBeUndefined()
    expect(PAGE_META.index).toBeUndefined()
  })

  it('builds a canonical with no double slash and no trailing slash on a page', () => {
    expect(canonicalFor('help')).toBe(`${SITE}/help`)
    expect(canonicalFor(null)).toBe(`${SITE}/`)
    expect(canonicalFor('')).toBe(`${SITE}/`)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/pageMeta.test.js
```

Expected: FAIL — cannot resolve `../lib/pageMeta`.

- [ ] **Step 3: Create the module**

Create `src/lib/pageMeta.js`:

```js
// The one definition of the content pages' title, description and canonical.
//
// NO IMPORTS. scripts/apply-prerender.mjs loads this under plain Node during
// `npm run build`, and Node's ESM resolver rejects this project's extensionless
// relative imports. Same constraint as src/lib/benchSchema.js — keep it a data
// module and nothing else.
//
// One definition, two readers: App.jsx applies these after mount, and
// apply-prerender bakes them into the served HTML. Two copies would drift, which
// is exactly what `npm run sitemap` and `npm run perf:games` exist to prevent.
export const SITE = 'https://custompcbuilder.netlify.app'

// Giving the pages their own URLs achieves nothing if all six then serve the
// root's title, description and canonical — to a crawler that is six addresses
// for one document, which is the problem hash routes had.
export const PAGE_META = {
  help: {
    title: 'Help & FAQ — Custom PC Builder',
    description: 'How to plan a build, read the CustomPC score, check compatibility and share what you have chosen.',
  },
  parts: {
    title: 'PC Parts Browser — Prices & Specifications',
    description: 'Browse processors, graphics cards, memory, storage and cases with specifications and curated UK price estimates.',
  },
  glossary: {
    title: 'PC Hardware Glossary — Custom PC Builder',
    description: 'Plain-English definitions of the PC building terms — sockets, chipsets, TDP, form factors, VRAM and the rest.',
  },
  feedback: {
    title: 'Feedback — Custom PC Builder',
    description: 'Tell us what worked, what did not, and what is missing.',
  },
  privacy: {
    title: 'Privacy Policy — Custom PC Builder',
    description: 'What this site stores about you, which is nothing personal, and why.',
  },
  terms: {
    title: 'Terms of Use — Custom PC Builder',
    description: 'The terms covering price estimates, compatibility checks and performance figures on this site.',
  },
}

// The root is DELIBERATELY absent above: index.html owns its own copy and
// App.jsx reads it back via captureRootMeta().
export const canonicalFor = (path) => (path ? `${SITE}/${path}` : `${SITE}/`)
```

- [ ] **Step 4: Point `App.jsx` at it**

In `src/App.jsx`, add to the imports:

```js
import { PAGE_META, canonicalFor } from './lib/pageMeta'
```

Delete the `const SITE = …` line and the whole `const PAGE_META = { … }` block (currently lines 32–58, including the comment above them — that comment moves into `pageMeta.js` and is already written there).

Replace the canonical line (currently line 96):

```js
    setMeta('link[rel="canonical"]', 'href', canonicalFor(path))
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/tests/pageMeta.test.js src/tests/App.test.jsx
```

Expected: PASS. If no `App.test.jsx` exists, run `npm test` instead and expect all green — this task changes no behaviour.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pageMeta.js src/App.jsx src/tests/pageMeta.test.js
git commit -m "refactor: give the page meta one definition both readers can import"
```

---

### Task 2: The head/body injector, as pure testable functions

This is the task with the real logic, so it is TDD'd properly. `apply-prerender.mjs` exports pure functions and only writes files when run directly — the same shape as `scripts/build-sitemap.mjs:84`, so a test can import it without a `dist/`.

**Files:**
- Create: `scripts/apply-prerender.mjs`
- Test: `src/tests/prerender.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/prerender.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { applyMeta, injectFragment, escapeAttr } from '../../scripts/apply-prerender.mjs'
import { PAGE_META, canonicalFor } from '../lib/pageMeta'

// A miniature of index.html carrying one of every tag the injector rewrites,
// plus the verification tag it must not touch.
const SHELL = `<!doctype html>
<html lang="en"><head>
<title>Custom PC Builder — Build &amp; Price Your Gaming PC in 3D</title>
<meta name="description" content="Root description." />
<meta name="google-site-verification" content="4l1jmNOPVTE9FrguZxnUVmpXPi2YM-lS7g0w_8a_3c4" />
<link rel="canonical" href="https://custompcbuilder.netlify.app/" />
<meta property="og:title" content="Root title" />
<meta property="og:description" content="Root description." />
<meta property="og:url" content="https://custompcbuilder.netlify.app/" />
<meta name="twitter:title" content="Root title" />
<meta name="twitter:description" content="Root description." />
</head><body style="margin:0;background:#0F1114">
<div id="root"><div class="boot" style="position:fixed">Custom PC Builder…</div></div>
<script type="module" src="/assets/index-ABC12345.js"></script>
</body></html>`

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"')
const attrOf = (html, re) => decode(re.exec(html)[1])

describe('applyMeta', () => {
  const out = applyMeta(SHELL, {
    title: PAGE_META.help.title,
    description: PAGE_META.help.description,
    canonical: canonicalFor('help'),
  })

  it('rewrites title, description and canonical to the page values', () => {
    expect(attrOf(out, /<title>([\s\S]*?)<\/title>/)).toBe(PAGE_META.help.title)
    expect(attrOf(out, /<meta name="description" content="([^"]*)"/)).toBe(PAGE_META.help.description)
    expect(attrOf(out, /<link rel="canonical" href="([^"]*)"/)).toBe(canonicalFor('help'))
  })

  it('rewrites the og and twitter pairs too, so a social preview is not the root', () => {
    expect(attrOf(out, /<meta property="og:title" content="([^"]*)"/)).toBe(PAGE_META.help.title)
    expect(attrOf(out, /<meta property="og:description" content="([^"]*)"/)).toBe(PAGE_META.help.description)
    expect(attrOf(out, /<meta property="og:url" content="([^"]*)"/)).toBe(canonicalFor('help'))
    expect(attrOf(out, /<meta name="twitter:title" content="([^"]*)"/)).toBe(PAGE_META.help.title)
    expect(attrOf(out, /<meta name="twitter:description" content="([^"]*)"/)).toBe(PAGE_META.help.description)
  })

  it('escapes an ampersand rather than emitting bare & in an attribute', () => {
    // "Help & FAQ — Custom PC Builder" is the live case.
    expect(out).toContain('Help &amp; FAQ')
    expect(escapeAttr('a & "b"')).toBe('a &amp; &quot;b&quot;')
  })

  it('leaves the google-site-verification tag alone', () => {
    // Losing it silently unverifies the Search Console property.
    expect(out).toContain('name="google-site-verification"')
    expect(out).toContain('4l1jmNOPVTE9FrguZxnUVmpXPi2YM-lS7g0w_8a_3c4')
  })

  it('leaves the asset script untouched', () => {
    expect(out).toContain('/assets/index-ABC12345.js')
  })
})

describe('injectFragment', () => {
  it('replaces the boot placeholder with the fragment', () => {
    const out = injectFragment(SHELL, '<main><h1>Glossary</h1></main>')
    expect(out).toContain('<div id="root"><main><h1>Glossary</h1></main></div>')
    expect(out).not.toContain('class="boot"')
    expect(out).not.toContain('Custom PC Builder…')
  })

  it('THROWS if the placeholder is not found', () => {
    // If index.html's root div is ever restyled, a silent no-op would ship the
    // boot screen as the pre-rendered content of all seven pages and still look
    // like a successful build. Fail loudly instead.
    expect(() => injectFragment('<body><div id="app"></div></body>', '<p>x</p>'))
      .toThrow(/root/i)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/prerender.test.js
```

Expected: FAIL — cannot resolve `../../scripts/apply-prerender.mjs`.

- [ ] **Step 3: Implement**

Create `scripts/apply-prerender.mjs`:

```js
// Injects the committed pre-rendered fragments into a freshly built dist/.
//
//   node scripts/apply-prerender.mjs      (run by `npm run build`)
//
// WHY THIS IS SPLIT FROM scripts/prerender.mjs: a committed pre-render must not
// contain asset URLs. Vite emits content-hashed bundles, so a committed whole
// document freezes one build's hashes and every later build then serves HTML
// referencing scripts that 404 — a silently broken deploy, because the HTML
// still returns 200 and only the bundles are missing.
//
// So the committed artefact is a body FRAGMENT, and the hashes come from the
// dist/index.html Vite has just written. Netlify runs this and needs no browser.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { PAGE_META, canonicalFor } from '../src/lib/pageMeta.js'
import { PAGES } from './prerender-routes.mjs'

const DIST = new URL('../dist/', import.meta.url)
const FRAGMENTS = new URL('../prerendered/', import.meta.url)

export const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')

// The root div is matched non-greedily up to its own closing pair. index.html is
// ours and stable, and a mismatch throws rather than passing the input through:
// a silent no-op would ship the boot screen as every page's content.
const ROOT_RE = /<div id="root">[\s\S]*?<\/div><\/div>/

export function injectFragment(html, fragment) {
  if (!ROOT_RE.test(html)) {
    throw new Error('apply-prerender: could not find the #root placeholder in the shell — '
      + 'index.html changed shape, and injecting nothing would ship the boot screen')
  }
  return html.replace(ROOT_RE, `<div id="root">${fragment}</div>`)
}

const swapAttr = (html, pattern, value) => html.replace(pattern, `$1${escapeAttr(value)}$2`)

export function applyMeta(html, { title, description, canonical }) {
  let out = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`)
  out = swapAttr(out, /(<meta name="description" content=")[^"]*(")/, description)
  out = swapAttr(out, /(<meta property="og:title" content=")[^"]*(")/, title)
  out = swapAttr(out, /(<meta property="og:description" content=")[^"]*(")/, description)
  out = swapAttr(out, /(<meta property="og:url" content=")[^"]*(")/, canonical)
  out = swapAttr(out, /(<meta name="twitter:title" content=")[^"]*(")/, title)
  out = swapAttr(out, /(<meta name="twitter:description" content=")[^"]*(")/, description)
  out = swapAttr(out, /(<link rel="canonical" href=")[^"]*(")/, canonical)
  return out
}

function main() {
  const shell = readFileSync(new URL('index.html', DIST), 'utf8')
  const read = (name) => readFileSync(new URL(`${name}.html`, FRAGMENTS), 'utf8')
  let written = 0

  // The six content pages: fragment AND head.
  for (const page of PAGES) {
    const html = applyMeta(injectFragment(shell, read(page)), {
      title: PAGE_META[page].title,
      description: PAGE_META[page].description,
      canonical: canonicalFor(page),
    })
    mkdirSync(new URL(`${page}/`, DIST), { recursive: true })
    writeFileSync(new URL(`${page}/index.html`, DIST), html)
    written += 1
  }

  // The root: BODY ONLY. index.html already carries the correct title,
  // description, canonical and OG block, plus the google-site-verification tag
  // that regenerating the head would drop.
  writeFileSync(new URL('index.html', DIST), injectFragment(shell, read('index')))
  written += 1

  console.log(`apply-prerender: wrote ${written} pre-rendered pages into dist/`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(new URL('index.html', FRAGMENTS))) {
    console.error('apply-prerender: prerendered/ is empty — run `npm run prerender` first')
    process.exit(1)
  }
  main()
}
```

Create `scripts/prerender-routes.mjs`, so both scripts share the route list without either importing React:

```js
// The route list, re-exported for the build scripts.
//
// src/hooks/usePageRoute.js is the real definition, but it imports React and
// uses extensionless relative imports, so plain Node cannot load it. Re-listing
// the six here would be a second definition — so a test asserts these two agree.
export const PAGES = ['help', 'parts', 'glossary', 'feedback', 'privacy', 'terms']
```

- [ ] **Step 4: Add the drift guard for that duplicated list**

Add these two imports **at the top of `src/tests/prerender.test.js`**, beside the
existing ones — not inside the `describe`, where they would be a syntax error:

```js
import { PAGES as SCRIPT_PAGES } from '../../scripts/prerender-routes.mjs'
import { PAGES as APP_PAGES } from '../hooks/usePageRoute'
```

Then append this block at the end of the file:

```js
describe('route list', () => {
  it('the build scripts route list matches the router', () => {
    // Two definitions exist only because plain Node cannot import the router.
    // This is the check that keeps them honest — the same contract
    // sitemap.test.js holds over the sitemap.
    expect([...SCRIPT_PAGES].sort()).toEqual([...APP_PAGES].sort())
  })
})
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/tests/prerender.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/apply-prerender.mjs scripts/prerender-routes.mjs src/tests/prerender.test.js
git commit -m "feat: inject a body fragment and its head into a freshly built dist"
```

---

### Task 3: Capture the fragments with Playwright

**Files:**
- Create: `scripts/prerender.mjs`
- Modify: `package.json` (add the `prerender` script)

- [ ] **Step 1: Add the script entry**

In `package.json`, add to `"scripts"`:

```json
    "prerender": "node scripts/prerender.mjs",
```

- [ ] **Step 2: Write the capture script**

Create `scripts/prerender.mjs`:

```js
// Captures the pre-rendered body fragments. Run locally; output is COMMITTED.
//
//   npm run prerender
//
// Netlify never runs this — it runs `npm run build`, which only needs the
// committed fragments and no browser.
import { build, preview } from 'vite'
import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { PAGES } from './prerender-routes.mjs'

const OUT = new URL('../prerendered/', import.meta.url)

// The root is captured as `index`, matching what apply-prerender reads.
const ROUTES = [['index', '/'], ...PAGES.map((p) => [p, `/${p}`])]

const server = await (async () => {
  await build({ logLevel: 'error' })
  // `vite preview` serves dist with SPA fallback natively, which is what the
  // content routes need — without it /help 404s before React ever loads.
  return preview({ preview: { port: 4183, strictPort: true }, logLevel: 'error' })
})()

const base = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await chromium.launch()
mkdirSync(OUT, { recursive: true })

const sizes = []
try {
  for (const [name, route] of ROUTES) {
    // ⚠️ A FRESH CONTEXT PER ROUTE IS LOAD-BEARING. useBuilderStore persists to
    // localStorage as custompc-builder-v1 and App.jsx branches on the persisted
    // `flow` — so a reused context would capture whatever build the previous
    // route left behind, and the root would pre-render somebody's half-finished
    // PC instead of the landing page. A first-time visitor is the only correct
    // subject for a pre-render.
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })

    // Network idle alone happily captures the boot message on a fast local
    // server, so wait for the placeholder to actually be gone.
    await page.waitForFunction(() => {
      const root = document.querySelector('#root')
      return root && !root.querySelector('.boot') && root.innerHTML.length > 0
    }, null, { timeout: 15000 })

    const html = await page.$eval('#root', (el) => el.innerHTML)
    writeFileSync(new URL(`${name}.html`, OUT), `${html}\n`)
    sizes.push([name, html.length])
    await context.close()
  }
} finally {
  await browser.close()
  // Vite 8's PreviewServer exposes a real close(): Promise<void> — verified in
  // node_modules/vite/dist/node/index.d.ts. Do not reach into httpServer.
  await server.close()
}

for (const [name, len] of sizes) console.log(`  ${name.padEnd(10)} ${String(len).padStart(7)} bytes`)
console.log(`prerender: wrote ${sizes.length} fragments to prerendered/`)
```

- [ ] **Step 3: Run it**

```bash
npm run prerender
```

Expected: seven lines, then `prerender: wrote 7 fragments to prerendered/`.

**Check the `/parts` figure against the others.** `PartsBrowser` is paginated via `pagedParts`, so it should be comparable to the rest. If it is an order of magnitude larger it is serialising the whole 544-part catalogue, which is a real page-weight regression — **stop and report the number rather than shipping it**, and drop `parts` from `ROUTES` if that is the outcome.

- [ ] **Step 4: Confirm the fragments are committable**

```bash
git check-ignore -v prerendered/index.html || echo "NOT ignored — good"
```

Expected: `NOT ignored — good`. If `prerendered/` is ignored, remove that rule — these files must be committed.

- [ ] **Step 5: Confirm no asset hash leaked in**

```bash
grep -nE "(assets|index)-[A-Za-z0-9_-]{8}\." prerendered/*.html || echo "clean — no hashes"
```

Expected: `clean — no hashes`. This is the constraint the whole design rests on. If anything matches, a component is emitting an asset URL into markup and the fragment cannot be committed as-is.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/prerender.mjs prerendered/
git commit -m "feat: capture the seven content routes as committed body fragments"
```

---

### Task 4: Guard the committed fragments with tests

**Files:**
- Modify: `src/tests/prerender.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/prerender.test.js`:

```js
import { readFileSync, readdirSync } from 'node:fs'

describe('the committed fragments', () => {
  const dir = new URL('../../prerendered/', import.meta.url)
  const read = (n) => readFileSync(new URL(`${n}.html`, dir), 'utf8')
  const names = readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''))

  it('covers the root and every content route, and nothing else', () => {
    expect([...names].sort()).toEqual([...['index', ...APP_PAGES]].sort())
  })

  it('holds no boot placeholder and nothing trivially short', () => {
    // A fragment captured before the app settled is worse than none: it ships a
    // loading message as the page's indexable content.
    for (const n of names) {
      const html = read(n)
      expect(html, `${n} still holds the boot placeholder`).not.toContain('class="boot"')
      expect(html.length, `${n} is suspiciously short`).toBeGreaterThan(500)
    }
  })

  it('embeds NO asset hash — the constraint the design rests on', () => {
    // Vite rehashes every build. A committed hash means the next deploy serves
    // HTML pointing at bundles that 404, while still returning 200.
    for (const n of names) {
      expect(read(n), `${n} embeds a hashed asset URL`).not.toMatch(/(assets|index)-[A-Za-z0-9_-]{8}\./)
    }
  })

  it('puts real landing copy in the root fragment', () => {
    const root = read('index')
    expect(root).toContain('Custom PC Builder')
    expect(root).toMatch(/Build and price a gaming PC in 3D/i)
  })
})
```

- [ ] **Step 2: Run them**

```bash
npx vitest run src/tests/prerender.test.js
```

Expected: PASS. If the root fragment assertion fails, the capture ran against a persisted build state — the fresh-context rule in Task 3 was not applied.

- [ ] **Step 3: Commit**

```bash
git add src/tests/prerender.test.js
git commit -m "test: pin the fragments against staleness and embedded hashes"
```

---

### Task 5: Wire the build

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Change the build script**

```json
    "build": "vite build && node scripts/apply-prerender.mjs",
```

- [ ] **Step 2: Build and verify the output**

```bash
npm run build
```

Expected: the Vite summary, then `apply-prerender: wrote 7 pre-rendered pages into dist/`.

- [ ] **Step 3: Confirm `/help` is a real document with the current hashes**

```bash
node -e "const h=require('fs').readFileSync('dist/help/index.html','utf8');const d=require('fs').readFileSync('dist/index.html','utf8');const hash=/assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(d)[1];console.log('references current bundle:',h.includes(hash));console.log('title:',/<title>([^<]*)<\/title>/.exec(h)[1]);console.log('canonical:',/canonical\" href=\"([^\"]*)\"/.exec(h)[1]);console.log('has boot:',h.includes('class=\"boot\"'))"
```

Expected: `references current bundle: true`, the Help title, `https://custompcbuilder.netlify.app/help`, and `has boot: false`.

- [ ] **Step 4: Confirm the root kept its verification tag**

```bash
grep -c "google-site-verification" dist/index.html
```

Expected: `1`. Zero means the root's head was regenerated, which unverifies the Search Console property.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat: apply the pre-render as a post-build step"
```

---

### Task 6: Verify in a browser and finish

**Files:** none — verification only.

- [ ] **Step 1: Serve the built site and check three routes**

```bash
npx vite preview --port 4183
```

Load `/`, `/help` and `/glossary`. Confirm: content correct, **no console errors**, **no hydration warnings** (the app uses `createRoot`, so there should be none), and navigation between pages is still client-side rather than a full reload.

- [ ] **Step 2: Confirm the actual thing being bought — content with JS disabled**

```bash
node -e "fetch('http://localhost:4183/glossary').then(r=>r.text()).then(t=>{const body=t.split('<div id=\"root\">')[1]||'';console.log('bytes in root:',body.length);console.log('has boot:',t.includes('class=\"boot\"'));console.log(body.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,300))})"
```

Expected: several thousand bytes, `has boot: false`, and readable glossary prose. That prose in the first response, with no JavaScript executed, is the whole point of the change.

- [ ] **Step 3: Full verification**

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

Expected: all green.

- [ ] **Step 4: Stop the preview server and finish**

Use `superpowers:finishing-a-development-branch`.

---

## Done when

- `prerendered/` holds seven committed fragments, none containing a boot placeholder or an asset hash.
- `dist/help/index.html` and its five siblings exist, reference the **current** bundles, and carry their own title, description and canonical.
- `dist/index.html` has the landing content in `#root` and its head **unchanged**, `google-site-verification` included.
- Fetching `/glossary` with no JavaScript returns real prose.
- `npm test`, `npm run lint`, `npm run build` all green.
- Nothing pushed, nothing deployed, no Supabase write, no change to `public/_redirects` or the sitemap.
