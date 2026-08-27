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
| parked stationary on the canvas | 193/sec | **82/sec** |

Before: **964 draw calls during 5 seconds of absolute idle** on a build nobody
was touching. After: **0 across six consecutive 3-second windows.**

The residual 82/sec with the pointer resting on the canvas is r3f re-raycasting
for the hover highlight. That is a real feature doing real work, but
re-raycasting a *stationary* pointer every frame is still waste — the clearest
remaining perf item, and deliberately not fixed here because it needs its own
decision about whether the hover highlight is worth it.

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

1. **The hover raycast** — 82 draws/sec while a stationary pointer rests on the
   canvas. The largest remaining idle cost, and the only one with a clear fix.
2. **The 1 MB `BuildCanvas` chunk** — three.js itself. Already split out and
   only fetched when the 3D is opened; shrinking it means shrinking three.
3. **Cold-network tab switching** — untested here, because a local dev server
   cannot show it. Needs the deployed site.
