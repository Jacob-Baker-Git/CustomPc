import { defineConfig } from '@playwright/test'

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
  timeout: 30000,
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
