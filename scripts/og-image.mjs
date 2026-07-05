// Renders the 1200x630 social preview card to public/og-image.png.
// Run with: npm run og:image
import { chromium } from '@playwright/test'

const html = `<!doctype html>
<html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #05080f; color: #fff;
    font-family: 'Segoe UI', ui-sans-serif, system-ui, sans-serif;
    position: relative;
  }
  .glow { position: absolute; inset: 0;
    background: radial-gradient(ellipse 60% 55% at 50% 44%, rgba(34,128,170,0.25), rgba(5,8,15,0) 72%); }
  .dots { position: absolute; inset: 0; opacity: 0.14;
    background-image: radial-gradient(rgba(148,163,184,0.6) 1.5px, transparent 1.5px);
    background-size: 34px 34px; }
  .wrap { position: relative; height: 100%; display: flex; flex-direction: column;
    justify-content: center; padding: 0 90px; }
  h1 { font-size: 76px; font-weight: 800; letter-spacing: -1px; }
  h1 .accent { color: #22d3ee; }
  p { margin-top: 18px; font-size: 30px; color: #94a3b8; max-width: 850px; line-height: 1.35; }
  .chips { margin-top: 44px; display: flex; gap: 14px; }
  .chip { border: 1.5px solid rgba(51,65,85,0.9); border-radius: 4px; padding: 12px 22px;
    font-family: 'Cascadia Mono', Consolas, monospace; font-size: 22px; color: #e2e8f0; }
  .chip b { color: #22d3ee; font-weight: 600; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 10px;
    background: linear-gradient(90deg, #0891b2, #22d3ee); }
</style></head>
<body>
  <div class="glow"></div>
  <div class="dots"></div>
  <div class="wrap">
    <h1>Custom <span class="accent">PC Builder</span></h1>
    <p>Plan a compatible gaming PC in 3D — set a budget, pick an FPS target, and generate a build that hits it.</p>
    <div class="chips">
      <div class="chip">Budget → FPS target → <b>build</b></div>
      <div class="chip"><b>3D</b> build view</div>
      <div class="chip">Per-game <b>FPS</b></div>
    </div>
  </div>
  <div class="bar"></div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.screenshot({ path: 'public/og-image.png' })
await browser.close()
console.log('wrote public/og-image.png')
