import { test, expect } from '@playwright/test'
import { generateBuild } from './helpers.js'

// Runs against :4184 — a real build served with public/_headers applied. See the
// `csp` project in playwright.config.js.
//
// ⚠️ Why this exists when src/tests/cspHeaders.test.js already reads the policy.
//
// That test asserts the policy TEXT: connect-src carries blob:, script-src
// carries 'wasm-unsafe-eval', no third-party host creeps in. It catches a
// regression in a directive someone ALREADY KNEW to need. It cannot catch a new
// dependency needing a directive nobody has thought of, because a static
// assertion only knows what it was told.
//
// This is the other half: a real browser, the real bundle, the real policy, and
// the 3D path — the one that fails QUIETLY, every textured part degrading to a
// grey primitive rather than throwing anything a human would notice.
test.describe('the production CSP does not break the app', () => {
  test('loads a 3D build under the real policy with a clean console', async ({ page }) => {
    test.setTimeout(180_000)

    const errors = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

    // Every .glb the page actually asked for, so "no errors" cannot be bought by
    // the 3D never having been attempted.
    const models = []
    page.on('response', (r) => {
      if (r.url().endsWith('.glb')) models.push({ url: r.url().split('/').pop(), status: r.status() })
    })

    // ⚠️ PREMISE 1: the server is actually applying a policy. Without this the
    // whole spec passes happily against a server that sends no CSP at all —
    // which is exactly what a broken _headers parser would produce, and it would
    // look like success forever after.
    const res = await page.goto('/')
    const csp = res.headers()['content-security-policy']
    expect(csp, 'Content-Security-Policy header on the document').toBeTruthy()
    expect(csp, 'the policy the 3D view depends on').toContain('blob:')

    await generateBuild(page)
    await page.getByText('Assembling 3D').waitFor({ state: 'detached', timeout: 90_000 }).catch(() => {})
    await page.waitForTimeout(3000)

    // ⚠️ PREMISE 2: the GLTF path ran. If WebGL never came up, no model is ever
    // fetched, nothing can violate connect-src, and a green result would mean
    // nothing at all.
    expect(models.length, 'GLB models requested').toBeGreaterThan(0)
    expect(
      models.filter((m) => m.status !== 200),
      'GLB models that did not return 200',
    ).toEqual([])

    // The actual assertion. A blocked blob: texture surfaces here as
    // "THREE.GLTFLoader: Couldn't load texture blob:…" — mutation-checked by
    // removing blob: from connect-src, which produced 20+ of them.
    expect(errors, 'console errors under the production CSP').toEqual([])
  })
})
