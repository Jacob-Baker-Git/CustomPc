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

    // ⚠️ BLOCK THE LIVE CATALOG. App.jsx calls loadCatalog() on mount, which
    // fetches parts/peripherals/games from Supabase and swaps them in over the
    // bundled snapshot. Two things go wrong if that is allowed to race here:
    //
    // 1. The capture becomes NON-DETERMINISTIC. Whether the swap lands before
    //    the HTML is read decides what gets committed, so the same command can
    //    produce two different fragments from one commit.
    // 2. It used to hang the run outright. `waitUntil: 'networkidle'` waits for
    //    those three requests to settle, and under load they do not inside the
    //    30s default — this script failed four runs in a row that way, each
    //    dying on a different route, while curl fetched the same endpoint in
    //    0.9s. The page itself had finished loading in ~360ms.
    //
    // Blocking them is also the CORRECT subject: a pre-render is the instant
    // first paint, and a first-time visitor sees the bundled snapshot before any
    // fetch resolves. Capturing that is what makes the fragment match what React
    // renders on hydration.
    await context.route('**://*.supabase.co/**', (r) => r.abort())

    const page = await context.newPage()
    // 'load' rather than 'networkidle': the real gate is the content check
    // below, which waits for React to have replaced the boot placeholder.
    // Network quiet was only ever a proxy for it, and a bad one.
    await page.goto(`${base}${route}`, { waitUntil: 'load' })

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
