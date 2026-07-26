// Part categories backed by a real GLTF/GLB model in /public/models. Each entry
// is auto-fitted by GltfPart: `targetSize` is the largest bounding-box dimension
// in world units, and `rotation`/`position` are a base offset applied after
// centring (refined against the actual render). Categories NOT listed here keep
// their procedural (primitive) model, and any listed model that fails to load
// falls back to the primitive too — so adding a .glb here is always safe.
//
// To add a part: drop `<category>.glb` in public/models, add an entry, reload.
export const GLTF_MODELS = {
  // GeForce RTX 3080 by _surovic_ (Sketchfab, CC-BY 4.0). Raw model is
  // 4.38 x 30.19 x 12.82 (thickness x length x height). Laid horizontal via
  // +90° about Z. targetSize 2.2 sizes it so its ~12.8-deep dimension fits the
  // shallow gap between board and glass (~0.9 world units); pushed forward in Z
  // so it clears the motherboard instead of intersecting it.
  gpu: { url: '/models/gpu.glb', targetSize: 2.35, rotation: [0, 0, Math.PI / 2], position: [-0.12, 0, 0.22] },

  // First-pass sizes from the measured dims; orientation/position refined against
  // the screenshot in the holistic pass.
  // Board is flat (30.6 x 30.9), components ~5 tall — the layout's stand-up
  // rotation lifts it vertical with components facing the glass.
  motherboard: { url: '/models/motherboard.glb', targetSize: 2.5, rotation: [0, 0, 0], position: [0, 0, 0] },
  // Liquid AIO — compact (1.49 x 1.94 x 2.94). Slightly smaller than first guess.
  cooler:      { url: '/models/cooler.glb',      targetSize: 1.15, rotation: [0, 0, 0], position: [0, 0, 0] },
  // Roughly cubic PSU. Was floating below the case floor — raise it and shrink
  // a touch so it sits on the floor inside the shell.
  psu:         { url: '/models/psu.glb',         targetSize: 1.0, rotation: [0, 0, 0], position: [0, 0.35, 0] },
  // Flat M.2 stick — long axis 4.33.
  storage:     { url: '/models/storage.glb',     targetSize: 0.9, rotation: [0, 0, 0], position: [0, 0, 0] },
  // Two DDR4 sticks side by side (instanced). targetSize/rotation are first
  // guesses — refined from the measurement + screenshot.
  ram: {
    url: '/models/ram.glb',
    targetSize: 0.85,
    // Vengeance RGB Pro: long axis is Z, so -90° about Z stands it vertical with
    // its broad (RGB) face toward the glass. Two sticks side by side.
    rotation: [0, 0, -Math.PI / 2],
    instances: [[-0.2, 0, 0], [0.2, 0, 0]],
  },
}
