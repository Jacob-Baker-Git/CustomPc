// How tall is each screen on a phone? Reports every screen's height in
// "screens" (multiples of the viewport), so a layout change can be judged by a
// number rather than by eye. Folds are left as a phone first sees them (shut).
//
// Run from the repo root with the dev server up:
//   node scripts/measure-mobile-heights.mjs [http://localhost:5173] [out-dir]
//
// Uses an iPhone 13 (390x844). Builds a PC through "Build for a game"
// (Cyberpunk 2077, £1600) so every builder tab has a full build to show, and
// saves a screenshot of each screen's first view to out-dir.
import { chromium, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = process.argv[3] ?? 'scratch/out/mobile'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
// Pass `desktop` as a third argument for 1440x900 screenshots instead.
const DESKTOP = process.argv[4] === 'desktop'
const ctx = await browser.newContext(DESKTOP ? { viewport: { width: 1440, height: 900 } } : { ...devices['iPhone 13'] })
const page = await ctx.newPage()
const VIEW_H = DESKTOP ? 900 : 844

// The builder scrolls an inner div; every other screen scrolls the document.
const height = () => page.evaluate(() => {
  const inner = [...document.querySelectorAll('div')]
    .find((d) => d.classList.contains('overflow-y-auto') && d.scrollHeight > d.clientHeight)
  return inner ? inner.scrollHeight : document.documentElement.scrollHeight
})
const rows = []
async function record(name) {
  await page.waitForTimeout(700)
  const px = await height()
  rows.push({ screen: name, px, screens: +(px / VIEW_H).toFixed(1) })
  await page.screenshot({ path: `${OUT}/${name.replace(/[^a-z0-9]+/gi, '-')}.png` })
}
const tab = (name) => page.getByRole('navigation', { name: 'Steps' })
  .getByRole('button', { name: new RegExp(`${name}$`, 'i') }).click()

try {
  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE)
  await record('welcome')

  await page.getByRole('button', { name: /build for a game/i }).click()
  await page.getByRole('combobox', { name: 'Game' }).fill('Cyberpunk 2077')
  await page.getByRole('spinbutton', { name: /budget/i }).fill('1600')
  await page.getByRole('button', { name: /find builds/i }).click()
  await page.getByRole('button', { name: /use this build/i }).first().waitFor()
  await record('build for a game (results)')
  await page.getByRole('button', { name: /use this build/i }).first().click()
  await record('peripherals')

  await tab('summary'); await record('summary')
  await tab('build'); await record('build')
  await tab('performance'); await record('performance')

  // The current screen is remembered, so leave the builder by its Back button.
  await page.getByRole('button', { name: /back to menu/i }).click()
  await page.getByRole('button', { name: /saved builds/i }).click()
  await record('saved builds')

  console.table(rows)
} finally {
  await browser.close()
}
