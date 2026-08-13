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
