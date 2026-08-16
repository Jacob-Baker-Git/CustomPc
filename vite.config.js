import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Explicit, because eslint.config.js gives every .js file browser globals and
// only exempts src/tests. Importing it here beats widening that config for the
// whole repo to satisfy one line.
import process from 'node:process'

export default defineConfig({
  plugins: [react()],
  server: {
    // The port lives here rather than as a --port flag in .claude/launch.json so
    // the harness can hand us a free one via PORT when another session already
    // holds 5173. The 5173 fallback keeps playwright.config.js's hardcoded
    // baseURL valid when nothing sets PORT.
    //
    // strictPort keeps the point of 4186fce: without it Vite auto-increments off
    // an occupied port while the harness goes on proxying the one it assigned,
    // so preview hands back a dead port and the failure looks like a broken app.
    // Failing loudly is the whole idea — do not drop this to "recover" from a
    // clash.
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.js',
    // Playwright specs live in e2e/ and run via `npm run test:e2e`.
    include: ['src/tests/**/*.{test,spec}.{js,jsx}'],
  },
})
