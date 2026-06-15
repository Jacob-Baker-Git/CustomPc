// Fan mount points in the assembly's world frame (motherboard at the origin),
// mounted flat on the case walls and centred on each panel with even spacing
// (per the sketch: 1 left, 3 right, 3 top). When a fan pack is selected every
// mount is filled, otherwise each shows an empty square slot. Each fan/slot
// faces +Z by default and is re-oriented by `rotation`.
const RIGHT_X = 1.43   // just inside the right wall
const LEFT_X = -1.43   // just inside the left wall
const TOP_Y = 1.6      // just under the top panel
const DEPTH_Z = 0.35   // centred front-to-back

export const FAN_MOUNTS = [
  // Right side wall — column of three, centred vertically, facing into the case.
  { position: [RIGHT_X, 0.65, DEPTH_Z],  rotation: [0, -Math.PI / 2, 0] },
  { position: [RIGHT_X, -0.1, DEPTH_Z],  rotation: [0, -Math.PI / 2, 0] },
  { position: [RIGHT_X, -0.85, DEPTH_Z], rotation: [0, -Math.PI / 2, 0] },
  // Top panel — row of three, centred across, facing up.
  { position: [-0.9, TOP_Y, DEPTH_Z], rotation: [-Math.PI / 2, 0, 0] },
  { position: [0,    TOP_Y, DEPTH_Z], rotation: [-Math.PI / 2, 0, 0] },
  { position: [0.9,  TOP_Y, DEPTH_Z], rotation: [-Math.PI / 2, 0, 0] },
  // Left side wall — one fan, centred, facing into the case.
  { position: [LEFT_X, -0.1, DEPTH_Z], rotation: [0, Math.PI / 2, 0] },
]
