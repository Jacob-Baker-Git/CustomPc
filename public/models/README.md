# Part models

Drop part `.glb` files here and wire them up in `src/lib/gltfModels.js`
(`FILES`) plus `src/lib/partSpecs.js` (`PART_SPECS`). `src/tests/modelBounds.test.js`
asserts every recorded `raw` bounding box still matches the shipped mesh, so a
re-export or a swapped model fails loudly instead of silently mis-scaling the
whole assembly.

Models not yet wired up live in `/models-staging/` at the repo root — kept out of
`public/` so they aren't copied into `dist/` and uploaded on every deploy.

## Attribution

These models are used under **CC Attribution 4.0** (CC-BY), which requires credit.

| File | Model | Author | Source |
| --- | --- | --- | --- |
| `fan.glb` | 120mm Computer Fans | kusuma844 | https://sketchfab.com/3d-models/120mm-computer-fans-6c17bfc4a2a5438eb9996fb3c73e1a91 |
| `cpu.glb` | PC CPU processor | apleesee | https://sketchfab.com/3d-models/pc-cpu-processor-efb6b95b255c4a37a9661df178ea3bb3 |

Staged in `/models-staging/`, not yet in use:

| File | Model | Author | Source |
| --- | --- | --- | --- |
| `fan-white.glb` | computer fan | Temoor | https://sketchfab.com/3d-models/computer-fan-5360bd331c5848eeb9338b4f894e78e5 |
| `case.glb` | Fractal Design Meshify C | MUSHROOM_BUILDS | https://sketchfab.com/3d-models/fractal-design-meshify-c-pc-case-a46526af2ac84fa098edc3f01c012450 |

`motherboard.glb`, `gpu.glb`, `cooler.glb`, `ram.glb`, `storage.glb` and
`psu.glb` predate this file and their sources were not recorded at the time. If
you still have the download links, add them above — CC-BY requires the credit.
