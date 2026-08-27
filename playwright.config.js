import { defineConfig } from '@playwright/test'
// Explicit, because eslint.config.js gives every .js file browser globals and
// only exempts src/tests. Same reason as vite.config.js.
import process from 'node:process'

// Two servers, because two different things are being tested.
//
// `npm run dev` is the normal target: fast, HMR, and — critically — it sends NO
// Content-Security-Policy at all. That is fine for every spec that is about
// layout or behaviour, and useless for the one class of bug that only ever
// appears in production.
//
// The csp project targets a build served with public/_headers actually applied
// (scripts/preview-csp.mjs). Its command BUILDS FIRST, every run, and does not
// reuse an existing server: a stale dist/ on :4184 would let the suite certify a
// bundle nobody is shipping, which is the failure this whole project exists to
// prevent. The build costs ~2s.
export default defineConfig({
  testDir: './e2e',

  // ⚠️ This suite runs close to its ceiling. Specs in topBar.spec.js have been
  // measured at 10-28.6s, so the old 30s cap was a coin toss, not a limit: on
  // 2026-08-27 wizard.spec.js died on "Test timeout of 30000ms exceeded" and
  // then passed 10/10 in isolation at 1.2-3.8s, with the full suite green on a
  // plain re-run. Nothing was wrong with the app. The tell for that failure is
  // an auto-retrying assertion reporting `Received string: ""` — the empty
  // value means the TEST timeout killed it before it ever polled.
  timeout: 60000,

  // Retries do not hide a break — every attempt must fail for the test to fail,
  // and a pass-after-retry is reported as "flaky" rather than swallowed. They
  // only stop ambient machine load producing false reds. CI gets one more
  // because a shared ubuntu-latest runner is noisier than this desktop.
  retries: process.env.CI ? 2 : 1,
  use: {
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'app',
      testIgnore: /csp\.spec\.js/,
      use: { baseURL: 'http://localhost:5173' },
    },
    {
      name: 'csp',
      testMatch: /csp\.spec\.js/,
      use: { baseURL: 'http://localhost:4184' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
    {
      command: 'npm run build && npm run preview:csp',
      url: 'http://localhost:4184',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
})
