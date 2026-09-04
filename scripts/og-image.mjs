// Renders the 1200x630 social preview card to public/og-image.png.
// Run with: npm run og:image
//
// The card wears the LIVE board palette (src/index.css): a matte-black ground,
// the yellow METALS (brass #E0A93B / gold #C9A86B / straw #E8D49A), and the
// orange wordmark accent (#F26B3A) that is the site's ONLY non-yellow. Keep it
// that way. This file used to carry the retired cyan/slate look (#22d3ee, a
// teal glow, a cyan bar), so a plain regenerate quietly re-baked a dead palette
// onto every shared link. If you touch the colours they must stay these tokens,
// and — per accentIsBrandOnly.test.js — orange must stay on the wordmark alone:
// the glow, dots and bar are metals, never the brand hue.
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

// Self-host the exact site faces (Archivo display, Hanken Grotesk body, JetBrains
// Mono chips) so the card matches the app rather than falling back to Segoe UI.
// The latin subset is enough — the card copy is ASCII; the one '→' sits outside
// the range below and falls back to a system mono, where an arrow looks the same.
// Inlined as data: URIs because page.setContent() serves from no origin, so a
// /fonts/* URL would never resolve.
const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'

const dataUri = (file) => {
  const bytes = readFileSync(new URL(`../public/fonts/${file}`, import.meta.url))
  return `data:font/woff2;base64,${bytes.toString('base64')}`
}

const fontFace = (family, weight, file) => `
  @font-face {
    font-family: '${family}'; font-style: normal; font-weight: ${weight};
    font-display: swap; unicode-range: ${LATIN};
    src: url(${dataUri(file)}) format('woff2');
  }`

const html = `<!doctype html>
<html><head><style>
  ${fontFace('Archivo', 800, 'archivo-latin.woff2')}
  ${fontFace('Hanken Grotesk', 500, 'hanken-grotesk-latin.woff2')}
  ${fontFace('JetBrains Mono', 500, 'jetbrains-mono-latin.woff2')}
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #0E0F11; color: #EDEFF2;
    font-family: 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif;
    position: relative;
  }
  /* A warm brass glow, not the old teal. Kept a metal, not the brand orange: a
     wash of #F26B3A this large would put the wordmark's hue somewhere it is not
     the wordmark. */
  .glow { position: absolute; inset: 0;
    background: radial-gradient(ellipse 60% 55% at 50% 44%, rgba(224,169,59,0.13), rgba(14,15,17,0) 72%); }
  /* Faint board texture — a gold dot grid standing in for the PCB. */
  .dots { position: absolute; inset: 0; opacity: 0.10;
    background-image: radial-gradient(rgba(201,168,107,0.85) 1.5px, transparent 1.5px);
    background-size: 34px 34px; }
  .wrap { position: relative; height: 100%; display: flex; flex-direction: column;
    justify-content: center; padding: 0 90px; }
  /* The wordmark as the app renders it: Archivo extrabold, tracking-tight,
     "Custom PC" in ink and "Builder" in the brand orange (MainMenu.jsx). */
  h1 { font-family: 'Archivo', 'Hanken Grotesk', ui-sans-serif, sans-serif;
    font-size: 82px; font-weight: 800; letter-spacing: -2px; }
  h1 .accent { color: #F26B3A; }
  p { margin-top: 20px; font-size: 30px; color: #99A0AB; max-width: 860px; line-height: 1.35; }
  .chips { margin-top: 46px; display: flex; gap: 14px; }
  .chip { border: 1.5px solid #3A404B; border-radius: 4px; padding: 12px 22px;
    font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 22px; color: #B8BEC8; }
  .chip b { color: #E8D49A; font-weight: 600; }  /* straw: the data metal */
  /* A metal sweep — gold → brass → straw — for the signature strip. */
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 10px;
    background: linear-gradient(90deg, #C9A86B, #E0A93B, #E8D49A); }
</style></head>
<body>
  <div class="glow"></div>
  <div class="dots"></div>
  <div class="wrap">
    <h1>Custom PC <span class="accent">Builder</span></h1>
    <p>Plan a compatible gaming PC in 3D — set a budget, pick an FPS target, and get a build that hits it.</p>
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
// Wait out font-display: swap so the shot never catches a fallback face.
await page.evaluate(async () => { await document.fonts.ready })
await page.screenshot({ path: 'public/og-image.png' })
await browser.close()
console.log('wrote public/og-image.png')
