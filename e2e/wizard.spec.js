import { test, expect } from '@playwright/test'

// Walks the real setup flow in a real browser and asserts the parts UI is
// actually VISIBLE — guards paint/compositing regressions that unit tests
// (jsdom) can never catch. Also the only test where the CSS actually applies,
// so it proves exactly one set of view tabs is on screen.
test('setup generates a build and the selected parts are visible', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /start a build/i }).click()
  await page.getByRole('button', { name: /pick parts for me/i }).click()

  await page.getByPlaceholder('Enter budget').fill('1600')
  await page.getByRole('button', { name: /next: use case/i }).click()
  await page.getByRole('button', { name: /gaming/i }).click()
  await page.getByRole('button', { name: /generate build/i }).click()

  // The generated-build banner summarises the use-case build.
  await expect(page.getByText(/gaming build/i)).toBeVisible()

  // Selected parts are visible on screen (part list rows).
  await expect(page.getByRole('button', { name: /remove cpu$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /remove gpu/i })).toBeVisible()

  // The Build tab now rates the generated build inline.
  await expect(page.getByText('/100')).toBeVisible()

  // Both tab sets are in the DOM — the header row and the bottom bar — but CSS
  // shows one at a time, and the hidden one drops out of the accessibility
  // tree. So exactly one is reachable by role, at any width.
  const summaryTab = page.getByRole('button', { name: /^summary$/i })
  await expect(summaryTab).toHaveCount(1)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: /^summary$/i })).toHaveCount(1)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Deep-linkable tabs: summary shows the same build.
  await summaryTab.click()
  await expect(page).toHaveURL(/#summary/)
  await expect(page.getByText(/your build/i)).toBeVisible()
})

// The 3D column's min-height used to leak into the row above it: .area-viz
// spanned two grid rows, and CSS Grid splits a spanning item's excess height
// equally across the rows it spans, so half of it became dead space between the
// use-case chips and the rating panel — 47px at 1900px tall, 213px at 2400px,
// growing without limit as the user zoomed out (browser zoom divides the
// viewport's CSS pixel height by the zoom factor).
//
// jsdom computes no grid layout, so this can only be caught here.
test('the left column stays tight to the 3D preview at any viewport height', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /start a build/i }).click()
  await page.getByRole('button', { name: /pick parts for me/i }).click()
  await page.getByPlaceholder('Enter budget').fill('1600')
  await page.getByRole('button', { name: /next: use case/i }).click()
  await page.getByRole('button', { name: /gaming/i }).click()
  await page.getByRole('button', { name: /generate build/i }).click()
  await expect(page.getByText('/100')).toBeVisible()

  for (const height of [900, 1900, 2400]) {
    await page.setViewportSize({ width: 1440, height })

    // BOTH seams, because fixing only the first one just moved the slack down a
    // level: collapsing the two rows into .area-left cured the chips/score gap
    // and left 512px between the score and the parts panel at 2400px instead.
    //
    // The chips/score reader understands the OLD two-row layout too, so reverting
    // that fix fails here on a real measured gap rather than a missing selector.
    const gaps = await page.evaluate(() => {
      const grid = document.querySelector('.build-grid')
      const left = grid.querySelector('.area-left')
      const chips = left ? left.firstElementChild : grid.querySelector('.area-usecase')
      const score = left ? left.lastElementChild : grid.querySelector('.area-rating')
      const column = left ?? grid.querySelector('.area-rating')
      const viz = grid.querySelector('.area-viz')
      return {
        chipsToScore: score.getBoundingClientRect().top - chips.getBoundingClientRect().bottom,
        // The two cells share a row. If the 3D's minimum forces the row taller
        // than the text column needs, the 3D outruns it and the difference IS
        // the dead space. Measuring this rather than the distance to the next
        // panel keeps the generated-build banner out of the number.
        vizOverrunsColumn:
          viz.getBoundingClientRect().bottom - column.getBoundingClientRect().bottom,
      }
    })

    // Only the flex gap (0.75rem = 12px) may separate the chips and the score.
    expect(gaps.chipsToScore, `chips->score @ ${height}`).toBeLessThanOrEqual(13)
    expect(gaps.chipsToScore, `chips->score @ ${height}`).toBeGreaterThanOrEqual(0)

    // With a full build the text column is always the taller of the two, so the
    // 3D should stretch to exactly meet it. (An empty build legitimately hits
    // the pixel floor instead — this test always generates a full rig.)
    expect(gaps.vizOverrunsColumn, `viz overrun @ ${height}`).toBeLessThanOrEqual(2)
  }
})
