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

// MEASURED off the shipped Strix B550-F mesh, not guessed.
//
// Everything below used to be hand-picked round numbers that had never been
// compared to the board they mount onto, so the pump block sat beside the
// socket, the DIMMs stood in front of their slots and nothing looked plugged
// in. They were read off a face-on render of the bare board with debug markers
// at each mount point and a 10 mm ladder up the rear edge for scale.
//
// The calibration is trustworthy because it reproduces a known quantity: the
// four AM4 cooler mounting holes came out **54 x 90 mm** apart, which is the
// AM4 spec exactly, and the four DIMM slots came out on a **10.2 mm** pitch
// against a 10.16 mm spec.
//
// To re-measure after a board mesh swap: render the bare board face-on (camera
// on +Z looking at the origin), drop a marker at each mount plus one at each
// corner of partBox('motherboard'), and scale pixels to millimetres off those
// corners — the board is 244.5 x 305 mm. Then check the AM4 holes still come
// out 54 x 90 before trusting anything else you read off it.
const SOCKET = { xMm: 14, yMm: 60 }

export const MOUNTS = {
  cpu: SOCKET,
  cooler: SOCKET,
  // Four DIMM slots stand vertically ahead of the socket, on a 10.2 mm pitch.
  //
  // The channel's centre first read as 81 mm, but the debug marker was sitting
  // over the slots' lower ends and I clipped the reading short — which showed
  // as the sticks standing half out of their slots. Reading the full extent
  // gives a 132 mm channel centred on 71 mm. Trimmed against the render in two
  // passes since — 71 to 65 to **59** — while the stick itself grew to 142 mm
  // (partSpecs.ram) because it was reading short at the slot's lower end. The
  // extra length lands below, so the top stays where it already looked right.
  //
  // A two-stick kit goes
  // in A2/B2 — the 2nd and 4th slots — so the pair straddles the bank's centre
  // 20.4 mm apart. (gltfModels renders the two instances at +-pitch/2.)
  ram: { xMm: 79.5, yMm: 59, pitchMm: 20.4 },
  // Primary PCIe x16, below the socket.
  //
  // A long expansion card is placed by its BRACKET, not its centre: the bracket
  // bolts to the case's rear panel and the card extends FORWARD from there.
  // `xMm` treated -70 as the card's centre, so a 285 mm card straddled it and
  // hung 90 mm off the back of the board — the reason the GPU never looked
  // plugged in. `rearInsetMm` places its bracket against the CASE's rear panel,
  // which is the thing a bracket actually bolts to, so the position stays right
  // for a card of any length. (Measured off the board's rear edge instead, the
  // bracket stopped 6 mm short of the panel and bolted to nothing.)
  //
  // `slotYMm` is the slot's own centreline, and the card is seated so its PCB
  // lands on it rather than its bounding box — a triple-slot cooler puts the PCB
  // 13 mm off its box centre, so seating by the box left the card hovering
  // above the slot. See partSpecs.gpu.pcbOffset.
  //
  // ATX puts the 158.75 mm I/O window at the top of the board's 305 mm rear edge
  // and stacks the seven expansion slots below it on a 20.32 mm pitch, so slot 1
  // falls at -16.4 mm and slot 2 at -36.7 mm from the board's centre. This board
  // carries M.2_1 above the primary x16, which puts it on slot 2.
  // `pcbRearMm` is where the PCB's leading edge sits — the notch end, in the
  // slot. Pinned here rather than derived from the bracket so the card can be
  // made longer without dragging the connector forward out of the slot: this
  // mesh puts its PCB 17 mm in from the bracket (more than a real card), and
  // that gap grows with the card. Consequence: a long card's bracket ends up
  // within, and slightly through, the rear panel — see assemblyGeometry.test.js.
  // pcbRearMm -120 (from -125.2 → -122 → -120): nudged toward the front to seat
  // the notch in the slot. +X is the case front, so less-negative moves it
  // screen-right. Close to the limit: the card's I/O bracket bolts to the rear
  // panel, and past about -119 the bracket lifts off it (assemblyGeometry.test.js
  // pins the bracket into the panel). Any further right needs the mesh, not this.
  //
  // slotYMm -31 (from the ATX-derived -36.7): the card was rendering with its
  // connector below the slot, so it was lifted ~6 mm. slotYMm is the height the
  // PCB seats at, so less-negative raises the whole card.
  gpu: { pcbRearMm: -120, slotYMm: -31 },
  // M.2_1, between the socket and the primary x16 — measured from the mesh's
  // own heatsink node (`Material.004`, 141 x 23 mm centred at -32, -10). The old
  // guess sat 10 mm lower and collided with the card once the GPU was seated on
  // its real slot. A real drive lives under that heatsink, so it barely shows.
  // zLiftMm stands the drive proud of the board face — the mesh is near-zero
  // thickness so it lay flush and hid behind the board's own M.2 heatsink,
  // reading as "behind the motherboard". +3 mm sits it just off the board like a
  // real M.2 under its heatsink; +8 read as floating/poking through.
  storage: { xMm: -32, yMm: -10, zLiftMm: 3 },
}
