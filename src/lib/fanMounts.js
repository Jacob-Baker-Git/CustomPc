// Fan mount points in the assembly's world frame (motherboard at the origin).
// When a fan pack is selected every mount is filled; otherwise each shows an
// empty square slot. Each fan/slot faces +Z and is re-oriented by `rotation`.
export const FAN_MOUNTS = [
  // Front intake — a column of three on the right, facing the window (visible).
  { position: [1.2, 0.65, 0.45], rotation: [0, 0, 0] },
  { position: [1.2, -0.05, 0.45], rotation: [0, 0, 0] },
  { position: [1.2, -0.75, 0.45], rotation: [0, 0, 0] },
  // Top exhaust — a row of three flush under the top panel, facing up.
  { position: [-0.6, 1.6, 0.05], rotation: [-Math.PI / 2, 0, 0] },
  { position: [0,    1.6, 0.05], rotation: [-Math.PI / 2, 0, 0] },
  { position: [0.6,  1.6, 0.05], rotation: [-Math.PI / 2, 0, 0] },
  // Rear exhaust — one on the left, facing the window.
  { position: [-1.2, 0.65, 0.45], rotation: [0, 0, 0] },
]
