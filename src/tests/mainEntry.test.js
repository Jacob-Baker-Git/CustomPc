import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const main = readFileSync(resolve(process.cwd(), 'src/main.jsx'), 'utf8')

// Comments stripped before asserting, so that main.jsx is free to EXPLAIN why
// StrictMode is absent without the explanation itself tripping the check. The
// first version of this test asserted on the raw file and failed on its own
// documentation.
const code = main.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// This file guards a DECISION, not a behaviour, because the behaviour cannot be
// guarded here: the failure is a lost WebGL context, jsdom has no WebGL at all,
// and CI's Playwright runs on SwiftShader, which drops this scene's context on
// its own often enough that asserting isContextLost() there would be flaky in
// both directions. So the check is on the source, and the reasoning lives here.
describe('the app entry point', () => {
  it('does NOT wrap the tree in React.StrictMode', () => {
    // ⚠️ Re-adding StrictMode BREAKS THE 3D VIEW IN DEVELOPMENT. It is not a
    // style preference and it is not a missing best practice.
    //
    // r3f's unmountComponentAtNode defers its teardown by 500 ms and then calls
    // `state.gl.forceContextLoss()` and `_roots.delete(canvas)` — with no check
    // that a newer root has since claimed that canvas.
    //
    // StrictMode mounts a component, tears its effects down, and mounts it
    // again. So root A is created, A's teardown is queued for t+500, root B is
    // created on the SAME <canvas> — and a canvas only ever hands out one WebGL
    // context, so B is given A's — and then A's teardown force-loses the
    // context B is drawing with and removes B from the map r3f's render loop
    // iterates.
    //
    // Measured 2026-08-27 on the production build vs `npm run dev`, real GPU
    // (--use-angle=d3d11), context liveness asserted every window:
    //
    //   production            lostEvents 0, isContextLost false, drag 24371 draws
    //   dev + StrictMode      lostEvents 1, isContextLost TRUE,  drag     0 draws
    //   dev, StrictMode gone  lostEvents 0, isContextLost false, drag 24371 draws
    //
    // ~512 draw calls in, the canvas froze: no rotation, no zoom, for every
    // local dev session. Nothing caught it — the e2e specs assert the canvas is
    // present and that OrbitControls claims touch-action, both of which stay
    // true on a dead canvas.
    //
    // Neutralising forceContextLoss alone was tried and is NOT enough; the
    // `_roots.delete(canvas)` half still strips the live root out of the loop.
    //
    // StrictMode's double-invoke is development-only, so this costs production
    // nothing whatsoever. Revisit if r3f ever guards that teardown.
    expect(code).not.toContain('StrictMode')
  })

  it('still mounts App inside the ErrorBoundary', () => {
    // The mounting itself is the thing that must survive the removal above — a
    // regex that only checked StrictMode was gone would pass on an empty file.
    expect(code).toMatch(/<ErrorBoundary>[\s\S]*<App\s*\/>[\s\S]*<\/ErrorBoundary>/)
    expect(code).toContain("createRoot(document.getElementById('root'))")
  })
})
