// Where parts attach to the motherboard, in millimetres from the board's centre.
//
// Parts derive their position from the connector they plug into rather than from
// absolute scene coordinates, so they cannot drift apart from each other and a
// new model lands correctly without eyeball tuning.
//
// +X is toward the case front, +Y is up, +Z is out of the board toward the glass.
export const BOARD = {
  widthMm: 244, // ATX short edge, front-to-back
  heightMm: 305, // ATX long edge, vertical
  standoffMm: 8, // board sits this far off the rear tray
}

// The socket anchors both the CPU and the cooler that clamps onto it.
const SOCKET = { xMm: -20, yMm: 75 }

export const MOUNTS = {
  cpu: SOCKET,
  cooler: SOCKET,
  // DIMM slots run vertically, ahead of the socket, sticks spaced along X.
  ram: { xMm: 70, yMm: 40, pitchMm: 10 },
  // Primary PCIe x16, below the socket. The card extends toward the case front.
  gpu: { xMm: -95, yMm: -55 },
  // M.2 slot between the socket and the PCIe slot.
  storage: { xMm: -10, yMm: -20 },
}
