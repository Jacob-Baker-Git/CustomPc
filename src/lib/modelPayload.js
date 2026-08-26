// What the 3D view actually costs to download, stated ONCE so the number in the
// copy cannot quietly stop being true.
//
// The eight GLB models come to 11.08 MB (they are already meshopt- and
// WebP-compressed, so the wire cost is essentially the file size — gzip has
// almost nothing left to take). The lazy BuildCanvas chunk adds ~285 kB gzipped
// on top, which rounds away against 11 MB.
//
// ⚠️ This is user-facing copy about a real quantity, which is exactly the kind
// of claim that rots silently: re-export a model, and the screen keeps quoting
// the old figure forever. modelPayload.test.js sums public/models/*.glb and
// fails when this stops matching, so the number and the assets move together.
export const MODEL_PAYLOAD_MB = 11
