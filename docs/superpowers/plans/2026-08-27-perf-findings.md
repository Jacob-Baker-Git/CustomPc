# Performance findings — 2026-08-27

What the performance pass actually measured, including the results that said
"nothing to do here". Written because the spec committed to reporting a clean
profile as a finding rather than inventing work to fill it.

## Assets

| asset | before | after | change |
|---|---|---|---|
| `city.hdr` | 1,540,678 | **131,121** | **−1,409,557 (−91.5%)** |
| entry chunk | 518,530 | 520,539 | +2,009 |
| `BuildCanvas` chunk | 1,048,135 | 1,048,237 | +102 |
| `PerformanceScreen` chunk | 449,000 | 449,000 | 0 |
| CSS | 36,521 | 36,978 | +457 |

**Net −1.41 MB.** The JS grew by ~2.1 kB — the genre-mark module and the new
comments — which is a fair price for the HDRI saving and is noted here so the
increase is not mistaken later for drift.

## Idle GPU work — the headline

Measured by hooking `drawElements` / `drawArrays` / `drawElementsInstanced`
before any page script runs, then leaving the page completely alone.

| pointer state | before | after |
|---|---|---|
| off the canvas (reading, scrolling) | 193/sec | **0/sec** |
| parked stationary on the canvas | 193/sec | ~~82/sec~~ **0/sec** — see below |

Before: **964 draw calls during 5 seconds of absolute idle** on a build nobody
was touching. After: **0 across six consecutive 3-second windows.**

### ⚠️ The 82/sec was WRONG, and the correction is the interesting part

**Re-measured 2026-08-27 and withdrawn.** A stationary pointer resting on the
canvas costs **nothing**: 0 draws and 0 animation frames across 15 seconds of it,
reproduced byte-identically on two runs, with a positive control in the same run
proving the scene could draw (a drag: 24,371 draws across 99 frames).

The attributed cause was impossible to begin with. There is **no hover highlight
in the 3D scene** — it was removed on request, and `PartModel.jsx` records it
going along with the store's `hoveredCategory`. Nothing in the scene has a
pointer handler at all.

What the original number actually measured was **a WebGL context that had already
been lost.** `npm run dev` was destroying the 3D view's context on every load:

| target | `webglcontextlost` | `isContextLost()` | drag → draws |
|---|---|---|---|
| production build | 0 | `false` | 24,371 over 99 frames |
| dev server, StrictMode on | 1 | **`true`** | **0** |
| dev server, StrictMode removed | 0 | `false` | 24,371 over 99 frames |

`React.StrictMode` mounts a component, tears its effects down and mounts it
again. r3f's `unmountComponentAtNode` defers its teardown by 500 ms and then
calls `gl.forceContextLoss()` and `_roots.delete(canvas)` **without checking
whether a newer root has since claimed that canvas** — and a canvas only ever
hands out one WebGL context, so the second mount is given the first mount's.
About 512 draw calls in, the canvas froze: no rotation, no zoom, every local dev
session. Nothing caught it, because the e2e specs assert the canvas is present
and that OrbitControls claims `touch-action`, and both stay true on a dead
canvas.

**Fixed** by dropping `React.StrictMode` from `src/main.jsx`, which makes dev
behave byte-identically to production. StrictMode's double-invoke is a
development behaviour, so production was never affected either way.
`src/tests/mainEntry.test.js` guards it, mutation-checked.

Neutralising `forceContextLoss` alone was tried first and is **not** enough: the
context survives but the drag still draws nothing, because the
`_roots.delete(canvas)` half strips the live root out of the loop r3f iterates.

⚠️ **The 193/sec "before" figure is not re-verified** and may have been measured
the same way. The **0/sec "after" figure is independently confirmed** on the
production build, so the headline of this work stands — it is only the residual
that was fiction.

`scripts/probe-3d-idle.mjs` re-runs this measurement and refuses to report a
result it cannot stand behind: it asserts context liveness in every window, and
fails loudly if the positive control draws nothing.

### Both hazards checked, neither materialised

- **Damping survives `frameloop="demand"`.** A drag produced 8610 draws and the
  tail after release produced 492 more, so the camera still glides. Dropping
  `enableDamping` was NOT necessary.
- **The shadow re-bakes.** With `frames={1}` the ContactShadows depth pass needs
  a `key` or it is correct only for the parts present at first paint. Swapping
  the GPU from a 7900 XTX to an Arc A380 produced 1482 draws and then went quiet
  again.

## Render quality after the HDRI cut

Same build, same untouched camera, before and after:

| metric | value |
|---|---|
| mean per-pixel delta | **0.555 / 255** |
| pixels changed by > 2/255 | 4.7% |
| max delta | 27/255, isolated to specular highlights |

Half a level of mean change across 1.33M pixels. Indistinguishable side by side.

## Scroll — 🛑 NOTHING WRONG. This is the finding.

Profiled on an emulated Pixel 7, where the 3D is correctly deferred behind a tap
(`canvas` count before opting in: **0**), scrolling the inner container 2484px:

| metric | value |
|---|---|
| median frame | **16.7 ms** |
| worst frame | 17.7 ms |
| frames over 32 ms | **0** |
| long tasks (>50 ms) | **none** |

That is a locked 60 fps with no dropped frame at all. **No scroll fix was made,
because no scroll problem exists.** The user reported the page feeling laggy;
on the evidence that was the 3D burning a frame budget continuously, which the
`frameloop` change addresses, not the page's own scrolling.

### ⚠️ The first attempt at this profile was garbage, and the reason matters

An earlier run reported long tasks of **5815 ms and 1895 ms** during the same
scroll. Those were not real. That run launched Chromium with
`--use-gl=swiftshader`, which rasterises WebGL **on the CPU** — so the profile
was measuring a software renderer nobody's phone has, not the app.

Anything profiling this project must either use a real GPU path or, better,
emulate a genuine touch device so `Deferred3D` keeps WebGL out of the picture
entirely. A swiftshader profile of a page with a 3D canvas is worthless.

**Update 2026-08-27 — a real GPU IS reachable headless, so take it.** The
workaround above was written on the assumption that it was not. Launch Chromium
with `--use-angle=d3d11 --ignore-gpu-blocklist --enable-gpu` and the reported
renderer becomes the machine's actual card rather than SwiftShader:

```
default        ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)
--use-angle=d3d11   ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 SUPER, Direct3D11)
--use-angle=gl      ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 2070 SUPER/PCIe/SSE2, OpenGL 4.5.0)
```

This matters for far more than speed. SwiftShader could not keep this scene's
context alive at all — and **a lost context reports exactly the same 0 draws/sec
as a perfectly idle one**, which is how a measurement of nothing passes for a
measurement of success. Assert `isContextLost()` in every window, and always run
a positive control in the same run.

⚠️ CI has no such GPU, so this belongs in a local probe, not in a spec. An
`isContextLost()` assertion inside the Playwright suite would be flaky on the
runner in both directions.

## Tab switching

Five switches on the same emulated phone. Wall times include a fixed 1200 ms
settle in the harness, so the switch itself is the remainder.

| switch | wall | long tasks |
|---|---|---|
| 1st → performance (cold, fetches the 449 kB chunk) | 1268 ms | none |
| 2nd → build | 1301 ms | 67 ms |
| 3rd → performance (warm) | 1278 ms | none |
| 4th → build | 1304 ms | 55 ms |
| 5th → performance (warm) | 1275 ms | none |

Two observations, neither acted on:

- **The cold Performance switch is not slower than the warm ones** (1268 vs
  1275/1278 ms). The 449 kB chunk split is doing its job, and on a local dev
  server its fetch is invisible. This would look different on a cold network and
  is worth re-checking against the deployed site rather than here.
- **Returning to Build costs a single ~55–67 ms long task**, just over the
  threshold. Real but marginal, and it belongs to the build tab's own render,
  not to anything this pass changed. Left alone rather than guessed at.

## Withdrawn: the `JSON.parse` transform

The spec proposed converting the 163 kB `partsData.json` from a JS object
literal to `JSON.parse()` on a string. **It was already done.** Vite 8 defaults
`json.stringify` to `'auto'` at a 10 kB threshold:

```
vite/dist/node/index.d.ts:3128
  /** When set to 'auto', the data will be stringified only if the data is
      bigger than 10kB.  @default 'auto' */
```

and the shipped bundle contains `JSON.parse(\`[{"id":"mb-asus-x670e"...`. No
code was written. Recorded rather than deleted so the same wrong finding is not
made a third time.

## What is left, honestly

1. ~~**The hover raycast** — 82 draws/sec while a stationary pointer rests on the
   canvas.~~ **WITHDRAWN 2026-08-27 — it does not exist.** Idle is 0. The number
   came from a dev server whose WebGL context had already been lost, and the
   cause attributed to it (a hover highlight) had been deleted from the scene
   long before. See the correction above. What was real, and is now fixed, is
   that the 3D view was dead in development.
2. **The 1 MB `BuildCanvas` chunk** — three.js itself. Already split out and
   only fetched when the 3D is opened; shrinking it means shrinking three.
3. **Cold-network tab switching** — untested here, because a local dev server
   cannot show it. Needs the deployed site.
4. **246 draw calls per frame** while the model is being rotated — measured, not
   yet judged. It is nothing on a desktop GPU and the 3D is deferred behind a tap
   on touch, so this is recorded as a number rather than as a problem. Batching
   or merging would be the lever if it ever becomes one.
