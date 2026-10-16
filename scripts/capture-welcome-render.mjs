// Captures the Welcome screen's picture: a still render of an example build
// from the site's own 3D view (configurator redesign, spec 2026-10-16).
//
// Run from the repo root with the dev server up:
//   node scripts/capture-welcome-render.mjs [http://localhost:5173]
//
// It builds a PC through "Build for a game" (Cyberpunk 2077, £1600), opens
// Summary, screenshots the 3D panel, crops to the model and writes
// public/img/welcome-pc.webp. Needs a real GPU for WebGL, hence the ANGLE flags
// (see the WebGL verification notes). Must stay in the repo root's reach of
// @playwright/test, which is why it lives in scripts/.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = 'public/img/welcome-pc.webp'
const MAX_WIDTH = 1200
const QUALITY = 0.8

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 })
try {
  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE)
  await page.getByRole('button', { name: /build for a game/i }).click()
  await page.getByRole('combobox', { name: 'Game' }).fill('Cyberpunk 2077')
  await page.getByRole('spinbutton', { name: /budget/i }).fill('1600')
  await page.getByRole('button', { name: /find builds/i }).click()
  await page.getByRole('button', { name: /use this build/i }).first().click()
  await page.getByRole('button', { name: /^summary$/i }).first().click()
  await page.locator('canvas').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(8000) // models stream in; let the scene settle
  // Hide the overlay controls, and the sticky header that would otherwise sit
  // over the top of the canvas in the screenshot and spoil the crop.
  await page.addStyleTag({ content: '.area-viz .pointer-events-none, [data-viewport-hint], .area-viz button, header, nav[aria-label="Steps"] { display: none !important }' })
  await page.locator('.area-viz').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)
  const png = await page.locator('.area-viz canvas').first().screenshot()

  // Crop to the pixels that differ from the page ground, then re-encode as
  // WebP in the browser (no image library needed).
  const webp = await page.evaluate(async ({ b64, maxWidth, quality }) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const { data, width, height } = g.getImageData(0, 0, c.width, c.height)
    const bg = [data[0], data[1], data[2]]
    let x0 = width, y0 = height, x1 = 0, y1 = 0
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4
        if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 24) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
        }
      }
    }
    const pad = 24
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad)
    x1 = Math.min(width, x1 + pad); y1 = Math.min(height, y1 + pad)
    const w = x1 - x0, h = y1 - y0
    const scale = Math.min(1, maxWidth / w)
    const out = document.createElement('canvas')
    out.width = Math.round(w * scale); out.height = Math.round(h * scale)
    out.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, out.width, out.height)
    return { url: out.toDataURL('image/webp', quality), w: out.width, h: out.height }
  }, { b64: png.toString('base64'), maxWidth: MAX_WIDTH, quality: QUALITY })

  if (!webp.url.startsWith('data:image/webp')) throw new Error('this browser did not encode WebP')
  const bytes = Buffer.from(webp.url.split(',')[1], 'base64')
  mkdirSync('public/img', { recursive: true })
  writeFileSync(OUT, bytes)
  console.log(`wrote ${OUT}: ${webp.w}x${webp.h}, ${bytes.length} bytes`)
} finally {
  await browser.close()
}
