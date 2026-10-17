// What the 3D view actually costs to download, stated ONCE so the number in the
// copy cannot quietly stop being true.
//
// The eight GLB models are 11.08 MB on disk but ship gzipped (meshopt geometry
// still halves under gzip; scripts/gzip-models.mjs), so the wire cost is the
// gzipped size, ~5.8 MB. The lazy BuildCanvas chunk adds ~285 kB on top.
//
// ⚠️ This is user-facing copy about a real quantity, which is exactly the kind
// of claim that rots silently: re-export a model, and the screen keeps quoting
// the old figure forever. modelPayload.test.js sums public/models/*.glb
// gzipped and fails when this stops matching, so the number and the assets move together.
export const MODEL_PAYLOAD_MB = 6
