// Does the 3D canvas draw anything while nobody is touching it?
//
//   node scripts/probe-3d-idle.mjs [baseUrl]      (default http://localhost:4183)
//
// `frameloop="demand"` in BuildCanvas.jsx is supposed to mean the scene renders
// only when something invalidates it. This measures whether that is true, by
// counting real WebGL draw calls across windows in which no input is sent.
//
// ⚠️ Read this before trusting any number it prints, or any number you get from
// a probe of your own. Every item below produced a confident, plausible, wrong
// answer during the 2026-08-27 investigation.
//
// 1. POINT IT AT A PRODUCTION BUILD, NOT THE DEV SERVER. `npm run build &&
//    npm run preview -- --port 4183`. This is why the default is 4183.
// 2. A LOST CONTEXT REPORTS EXACTLY THE SAME 0 draws/sec AS A PERFECTLY IDLE
//    SCENE. Liveness is therefore asserted in every window, not once at the
//    start, and a row that cannot be trusted says so.
// 3. USE A REAL GPU. `--use-angle=d3d11` gets one here; the default headless
//    path is SwiftShader, which could not keep this scene's context alive at
//    all, quite apart from being useless for timing.
// 4. THE POSITIVE CONTROL IS NOT OPTIONAL. Phase C drags and zooms; if those do
//    not produce draws, the zeroes in phases A, B and D mean nothing. An early
//    version of this script performed the drag BEFORE opening the measurement
//    window and reported a confident zero.
// 5. DO NOT INSTALL __THREE_DEVTOOLS__ OR WRAP renderer.render. Both were tried;
//    every run that had them lost the context mid-load, on the real GPU as well
//    as the software one. The probe was breaking the thing it measured.
// 6. DO NOT page.screenshot() THE CANVAS MID-RUN. That alone was enough to lose
//    a software context.
// 7. THE CANVAS IS TALLER THAN THE VIEWPORT (894x1482 in a 900px window), so its
//    own centre is off-screen. The target is clamped into the visible band and
//    checked with elementFromPoint before anything is believed.
// 8. THE CANVAS IS LAZY and pulls ~11 MB of GLB, so it sits at the default
//    300x150 for a while. Reading its box too early aims the pointer at nothing.
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:4183'

const HOOKS = () => {
  const p = (window.__probe = { draws: 0, raf: 0, pointermove: 0, resize: 0, ctxLost: 0 })
  window.addEventListener('webglcontextlost', () => p.ctxLost++, true)

  for (const Ctor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Ctor) continue
    for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
      const orig = Ctor.prototype[m]
      if (!orig) continue
      Ctor.prototype[m] = function (...args) {
        p.draws++
        return orig.apply(this, args)
      }
    }
  }

  // r3f cancels its rAF when demand mode goes quiet, so the frame count is an
  // independent second opinion on whether the loop is actually stopped.
  const rAF = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => rAF((t) => { p.raf++; return cb(t) })

  window.addEventListener('pointermove', () => p.pointermove++, true)
  const RO = window.ResizeObserver
  if (RO) window.ResizeObserver = class extends RO {
    constructor(cb) { super((...a) => { p.resize++; return cb(...a) }) }
  }
}

const READ = () => ({ ...window.__probe })

const GL_STATE = () => {
  const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]
  if (!c) return { error: 'no canvas' }
  const gl = c.getContext('webgl2') || c.getContext('webgl')
  if (!gl) return { error: 'no webgl context' }
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  return {
    lost: gl.isContextLost(),
    lostEvents: window.__probe.ctxLost,
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    draws: window.__probe.draws,
  }
}

const CANVASES = () =>
  [...document.querySelectorAll('canvas')].map((c) => {
    const r = c.getBoundingClientRect()
    return { buffer: `${c.width}x${c.height}`, css: `${Math.round(r.width)}x${Math.round(r.height)}`, at: `${Math.round(r.x)},${Math.round(r.y)}` }
  })

const AT_POINT = ([x, y]) => {
  const el = document.elementFromPoint(x, y)
  return el ? el.tagName.toLowerCase() : 'nothing'
}

const run = async () => {
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await page.addInitScript(HOOKS)
  page.on('pageerror', (e) => console.log('  [page error]', String(e).slice(0, 160)))

  console.log(`target: ${BASE}\n`)
  await page.goto(BASE)
  await page.getByRole('button', { name: /start a build/i }).click()
  await page.getByRole('button', { name: /pick parts for me/i }).click()
  await page.getByPlaceholder('Enter budget').fill('1600')
  await page.getByRole('button', { name: /next: use case/i }).click()
  await page.getByRole('button', { name: /gaming/i }).click()
  await page.getByRole('button', { name: /generate build/i }).click()
  await page.getByText('/100').first().waitFor()

  const opt = page.getByRole('button', { name: /view in 3d/i })
  if (await opt.count()) await opt.first().click()

  await page
    .waitForFunction(() => [...document.querySelectorAll('canvas')].some((c) => c.getBoundingClientRect().width > 320), null, { timeout: 60000 })
    .catch(() => console.log('!! no canvas ever grew past the default 300x150'))

  // Settle on evidence, not on a guessed timeout: wait until the draw count
  // stops moving, so "idle" means the scene really did stop.
  let last = -1
  for (let i = 0; i < 30; i++) {
    const now = (await page.evaluate(READ)).draws
    if (now === last) break
    last = now
    await page.waitForTimeout(1000)
  }
  console.log('canvas: ', JSON.stringify(await page.evaluate(CANVASES)))
  console.log('gl:     ', JSON.stringify(await page.evaluate(GL_STATE)), '\n')

  const [box] = await page.evaluate(CANVASES)
  const [x, y] = box.at.split(',').map(Number)
  const [w, h] = box.css.split('x').map(Number)
  const target = [Math.round(x + w / 2), Math.round((Math.max(0, y) + Math.min(900, y + h)) / 2)]

  let failed = false
  const window_ = async (label, ms = 2000, act = null) => {
    const a = await page.evaluate(READ)
    if (act) await act()
    await page.waitForTimeout(ms)
    const b = await page.evaluate(READ)
    const d = { draws: b.draws - a.draws, raf: b.raf - a.raf, ptr: b.pointermove - a.pointermove, resize: b.resize - a.resize }
    const gl = await page.evaluate(GL_STATE)
    const dead = gl.lost !== false
    if (dead) failed = true
    console.log(
      `${label.padEnd(30)} draws=${String(d.draws).padStart(6)} (${(d.draws / (ms / 1000)).toFixed(1)}/s)  frames=${String(d.raf).padStart(4)}  ptrmove=${d.ptr}  resize=${d.resize}` +
        (dead ? '   🛑 CONTEXT LOST — this row is meaningless' : ''),
    )
    return d
  }

  console.log('--- A: pointer well away from the canvas, no input ---')
  await page.mouse.move(5, 5)
  await page.waitForTimeout(2000)
  for (let i = 0; i < 2; i++) await window_(`A${i + 1} off-canvas idle`)

  console.log('\n--- B: one move ONTO the canvas, then nothing at all ---')
  console.log(`  elementFromPoint(${target}) = ${await page.evaluate(AT_POINT, target)}`)
  await window_('B0 the move itself', 2000, () => page.mouse.move(target[0], target[1]))
  for (let i = 0; i < 3; i++) await window_(`B${i + 1} stationary on canvas`)
  const long = await window_('B4 stationary, 6s', 6000)

  console.log('\n--- C: positive controls, measured ACROSS the interaction ---')
  const drag = await window_('C0 a drag', 2500, async () => {
    await page.mouse.move(target[0], target[1])
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) await page.mouse.move(target[0] + i * 8, target[1] + i * 2)
    await page.mouse.up()
  })
  await window_('C1 settled after the drag')
  await window_('C2 a wheel zoom', 2500, () => page.mouse.wheel(0, -240))
  await window_('C3 settled after the wheel')

  console.log('')
  if (failed) console.log('RESULT: INCONCLUSIVE — the context was lost. Nothing above can be trusted.')
  else if (!drag.draws) console.log('RESULT: INCONCLUSIVE — the positive control drew nothing, so the zeroes prove nothing.')
  else if (long.draws) console.log(`RESULT: FAIL — a stationary pointer on the canvas drew ${long.draws} times in 6s.`)
  else console.log(`RESULT: PASS — idle is 0 draws; the control drew ${drag.draws} across ${drag.raf} frames.`)

  await browser.close()
  process.exit(failed || !drag.draws || long.draws ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
