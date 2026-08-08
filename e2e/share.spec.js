import { test, expect } from '@playwright/test'
import { generateBuild, openTab } from './helpers.js'

const STORE_KEY = 'custompc-builder-v1'

const selectedParts = (page) => page.evaluate((key) => {
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  const parsed = JSON.parse(raw)
  const parts = parsed?.state?.selectedParts ?? null
  if (!parts) return null
  // Ids only, sorted, so the comparison does not depend on key order or on
  // whatever else the store happens to persist alongside them.
  return Object.entries(parts)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${typeof v === 'string' ? v : v.id}`)
    .sort()
}, STORE_KEY)

// A share link is the one path where a build leaves the browser and comes back
// through the decoder. The codec is hardened against hostile input in unit
// tests; what is not covered there is the ordinary case actually surviving the
// trip, in a browser, with the store rehydrating from a cold start.
test('a shared build round-trips into a browser that has never seen it', async ({ page, context }) => {
  // Capture what the page copies rather than reading the clipboard, which
  // needs permissions and is flaky in headless runs for no benefit here.
  await context.addInitScript(() => {
    window.__copied = []
    const record = (text) => { window.__copied.push(String(text)) }
    // Both paths: the async Clipboard API, and the execCommand fallback.
    if (navigator.clipboard) navigator.clipboard.writeText = async (t) => record(t)
    document.execCommand = (cmd) => {
      if (cmd === 'copy') record(document.getSelection()?.toString() ?? '')
      return true
    }
  })

  await generateBuild(page)
  const before = await selectedParts(page)
  expect(before, 'the generated build persisted some parts').toBeTruthy()
  expect(before.length).toBeGreaterThan(3)

  await openTab(page, 'summary')
  await page.getByRole('button', { name: /copy share link/i }).click()

  const link = await page.evaluate(() => window.__copied?.[0] ?? null)
  expect(link, 'the button copied something').toBeTruthy()
  expect(link).toMatch(/^https?:\/\//)

  // A browser that has never seen this build: no persisted store at all. If the
  // link only "works" because the local store already held the same parts, this
  // is where that shows up.
  await page.goto('/')
  await page.evaluate((key) => window.localStorage.removeItem(key), STORE_KEY)
  await page.goto(link)

  // The parts survive the trip exactly. This is the assertion that matters:
  // the codec is the thing under test, not the landing screen.
  expect(await selectedParts(page)).toEqual(before)

  // The share code carries the build but not the `flow`, so a recipient lands
  // on the entry menu with the build waiting rather than inside the builder.
  // That is the designed behaviour, so the journey is asserted as it really
  // is — including that the menu already knows what was shared.
  await expect(page).toHaveURL(/localhost:5173\/?$/)
  await expect(page.getByText(new RegExp(`${before.length} parts chosen`, 'i'))).toBeVisible()

  await page.getByRole('button', { name: /carry on building/i }).click()
  await expect(page.getByText('/100')).toBeVisible()
  expect(await selectedParts(page)).toEqual(before)
})
