// Captures the Showroom's still picture of the PC plus the label anchors.
//   node scripts/capture-showroom-still.mjs [http://localhost:5173]
// Builds Cyberpunk 2077 at 1600 GBP through Build for a game so all 7
// slots are picked. Writes public/img/showroom-pc.webp and
// src/data/showroomAnchors.json (anchors = percent of the cropped image).
// Needs a real GPU for WebGL, hence the ANGLE flags.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = 'public/img/showroom-pc.webp'
const OUT_JSON = 'src/data/showroomAnchors.json'
const IDS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'cooler']
const MAX_WIDTH = 1700
const QUALITY = 0.8

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 5 })
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
  await page.locator('.area-viz canvas').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(8000) // models stream in; dots appear after the first frame
  await page.addStyleTag({ content: 'header, nav[aria-label="Steps"] { display: none !important }' })
  await page.locator('.area-viz').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)

  // Read the dots first; fail loudly if any is missing or occluded (display:none).
  const canvas = page.locator('.area-viz canvas').first()
  const dots = await page.evaluate((ids) => {
    const cv = document.querySelector('.area-viz canvas').getBoundingClientRect()
    return ids.map((id) => {
      const el = document.querySelector(`.area-viz [data-dot="${id}"]`)
      if (!el) return { id, missing: true }
      const r = el.getBoundingClientRect()
      if (getComputedStyle(el).display === 'none' || !r.width) return { id, missing: true }
      return { id, x: (r.left + r.width / 2 - cv.left) / cv.width, y: (r.top + r.height / 2 - cv.top) / cv.height }
    })
  }, IDS)
  const gone = dots.filter((d) => d.missing).map((d) => d.id)
  if (gone.length) throw new Error(`dots missing/hidden: ${gone.join(', ')}`)

  await page.addStyleTag({ content: '.area-viz .pointer-events-none, [data-viewport-hint], .area-viz button { visibility: hidden !important }' })
  await page.waitForTimeout(500)
  const png = await canvas.screenshot()

  const res = await page.evaluate(async ({ b64, maxWidth, quality, dots }) => {
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
    const anchors = {}
    for (const d of dots) {
      anchors[d.id] = {
        x: +(((d.x * width - x0) / w) * 100).toFixed(1),
        y: +(((d.y * height - y0) / h) * 100).toFixed(1),
      }
    }
    return { url: out.toDataURL('image/webp', quality), w: out.width, h: out.height, anchors }
  }, { b64: png.toString('base64'), maxWidth: MAX_WIDTH, quality: QUALITY, dots })

  if (!res.url.startsWith('data:image/webp')) throw new Error('this browser did not encode WebP')
  for (const [id, a] of Object.entries(res.anchors)) {
    if (!(a.x >= 0 && a.x <= 100 && a.y >= 0 && a.y <= 100)) throw new Error(`anchor ${id} outside the crop: ${a.x},${a.y}`)
  }
  const bytes = Buffer.from(res.url.split(',')[1], 'base64')
  mkdirSync('public/img', { recursive: true })
  writeFileSync(OUT, bytes)
  writeFileSync(OUT_JSON, JSON.stringify({ width: res.w, height: res.h, anchors: res.anchors }, null, 2) + '\n')
  console.log(`wrote ${OUT}: ${res.w}x${res.h}, ${bytes.length} bytes`)
  console.log(JSON.stringify(res.anchors))
} finally {
  await browser.close()
}
