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
  // Primary PCIe x16, below the socket.
  //
  // A long expansion card is placed by its BRACKET, not its centre: the bracket
  // bolts to the case's rear panel and the card extends FORWARD from there.
  // `xMm` treated -70 as the card's centre, so a 285 mm card straddled it and
  // hung 90 mm off the back of the board — the reason the GPU never looked
  // plugged in. `rearInsetMm` places its rear edge relative to the board's, so
  // the position stays right for a card of any length.
  gpu: { rearInsetMm: 0, yMm: -55 },
  // M.2 slot between the socket and the PCIe slot.
  storage: { xMm: -10, yMm: -20 },
}
