// Fan mount points around the case interior, in the assembly's world frame
// (motherboard at the origin). The selected fan pack fills the first `count`
// mounts; the rest render as empty slots. Each fan/slot is modelled facing +Z
// and re-oriented by the mount's rotation.
// Ordered so a selected fan pack fills the most visible mounts first: the front
// intake column, then the top exhaust row, then the rear.
export const FAN_MOUNTS = [
  // Front intake — a column of three on the left wall, facing into the case.
  { position: [-1.4, 0.55,  0.1], rotation: [0, Math.PI / 2, 0] },
  { position: [-1.4, -0.15, 0.1], rotation: [0, Math.PI / 2, 0] },
  { position: [-1.4, -0.85, 0.1], rotation: [0, Math.PI / 2, 0] },
  // Top exhaust — a row of three, lying flat (facing up).
  { position: [-0.65, 1.55, 0.05], rotation: [-Math.PI / 2, 0, 0] },
  { position: [0,     1.55, 0.05], rotation: [-Math.PI / 2, 0, 0] },
  { position: [0.65,  1.55, 0.05], rotation: [-Math.PI / 2, 0, 0] },
  // Rear/side exhaust — one high on the right wall, facing into the case.
  { position: [1.4, 0.7, 0.05], rotation: [0, -Math.PI / 2, 0] },
]

// RGB ring colours cycled across the mounted fans.
export const FAN_GLOW = ['#22d3ee', '#a855f7', '#ec4899']
