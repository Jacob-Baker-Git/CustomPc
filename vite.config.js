import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.js',
    // Playwright specs live in e2e/ and run via `npm run test:e2e`.
    include: ['src/tests/**/*.{test,spec}.{js,jsx}'],
  },
})
