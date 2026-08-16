import { test, expect } from '@playwright/test'

// jsdom computes no layout and applies no transform, so the unit tests can
// prove the STATE flips and nothing more. Whether the stick actually rises,
// whether the clips actually rock, and whether the page stays still while it
// happens can only be measured in a real browser.

const BOX = '[data-ram-box]'

// ⚠️ Poll, never read once. The lift is a 200ms transition, and a computed
// transform read the instant `data-lifted` flips is still the START of the
// animation — every one of these assertions failed first time against a
// perfectly working page, reporting the identity matrix.
const settles = (locator, fn) => expect.poll(() => locator.evaluate(fn), { timeout: 2000 })

test.describe('a seated box unseats on hover', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForSelector(BOX)
  })

  test('lifts the stick clear of its slot', async ({ page }) => {
    const box = page.locator(BOX).first()
    await expect(box).toHaveAttribute('data-lifted', 'false')

    const before = await box.locator('[data-contacts]').evaluate(
      (el) => getComputedStyle(el.parentElement).transform,
    )
    expect(before).toBe('none')

    await box.hover()
    await expect(box).toHaveAttribute('data-lifted', 'true')

    // 8px up. Asserted on the matrix rather than a class, because a Tailwind
    // class that has been purged still appears in the DOM.
    await settles(
      box.locator('[data-contacts]'),
      (el) => getComputedStyle(el.parentElement).transform,
    ).toBe('matrix(1, 0, 0, 1, 0, -8)')
  })

  test('breaks the connection but keeps the bar lit', async ({ page }) => {
    // The two jobs gold does in this system come apart here. The lit bar tracks
    // ATTENTION and stays on; the contacts track CONNECTION and go cold,
    // because the stick is physically out of its socket. Crossing these makes
    // the interaction stop meaning anything.
    const box = page.locator(BOX).first()
    await expect(box.locator('[data-contacts]')).toHaveAttribute('data-contacts', 'live')

    await box.hover()
    await expect(box.locator('[data-contacts]')).toHaveAttribute('data-contacts', 'cold')
    await expect(box.locator('[data-bar]')).toHaveAttribute('data-bar', 'lit')
  })

  test('rocks both retention clips outward', async ({ page }) => {
    const box = page.locator(BOX).first()
    await box.hover()
    // ±26°: cos 26 = 0.8988, sin 26 = 0.4384, opposite signs per side.
    await expect
      .poll(
        () =>
          box
            .locator('[data-clip]')
            .evaluateAll((els) => els.map((e) => getComputedStyle(e).transform)),
        { timeout: 2000 },
      )
      .toEqual([
        'matrix(0.898794, -0.438371, 0.438371, 0.898794, 0, 0)',
        'matrix(0.898794, 0.438371, -0.438371, 0.898794, 0, 0)',
      ])
  })

  test('moves nothing else on the page', async ({ page }) => {
    // ⚠️ The reason the socket floats behind the stick instead of sitting in
    // the flow. An in-flow socket adds 15px on every hover, so the whole page
    // twitches whenever the pointer crosses a card — which reads as a bug
    // rather than as a mechanism.
    const snap = () =>
      page.evaluate(() => ({
        boxes: [...document.querySelectorAll('[data-ram-box]')]
          .slice(1)
          .map((b) => Math.round(b.getBoundingClientRect().top)),
        docHeight: document.documentElement.scrollHeight,
      }))

    // Settle first: the entry screen runs a fade-and-rise on mount, and a
    // baseline taken during it would drift for reasons that have nothing to do
    // with hovering.
    await page.waitForTimeout(600)
    const rest = await snap()

    await page.locator(BOX).first().hover()
    await expect(page.locator(BOX).first()).toHaveAttribute('data-lifted', 'true')
    await page.waitForTimeout(300)
    expect(await snap()).toEqual(rest)
  })

  test('answers the keyboard, not just the mouse', async ({ page }) => {
    // ⚠️ Focus the BUTTON, not the box. The caller wraps this component in the
    // interactive element — <button><RamBox/></button> — so focus lands on an
    // ancestor and does not travel downward. An onFocus prop on the box's own
    // root looked right and fired never; the component binds to its closest
    // focusable ancestor instead, and this is the test that pins that down.
    const box = page.locator(BOX).first()
    await box.evaluate((el) => el.closest('button').focus())
    await expect(box).toHaveAttribute('data-lifted', 'true')
    await expect(box.locator('[data-contacts]')).toHaveAttribute('data-contacts', 'cold')

    await box.evaluate((el) => el.closest('button').blur())
    await expect(box).toHaveAttribute('data-lifted', 'false')
  })

  test('every entry slot is seated', async ({ page }) => {
    // Unconditionally, and that is a deliberate reversal — seating briefly
    // tracked content and left a first-time visitor looking at dead hardware.
    const seated = await page.locator(BOX).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-seated')),
    )
    expect(seated.length).toBeGreaterThan(0)
    expect(seated.every((s) => s === 'true')).toBe(true)
  })
})
