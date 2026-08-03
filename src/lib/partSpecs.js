// Physical spec per part category.
//
// `raw`        — the GLB's own bounding box (x,y,z), measured from its accessors.
// `lengthMm`   — the real-world size of ONE axis. Since a mesh's aspect ratio is
//                fixed, one true dimension sizes the whole model.
// `fitAxis`    — which WORLD axis (0=X, 1=Y, 2=Z) lengthMm refers to, after
//                rotation. Omitted means "the longest axis".
// `rotation`   — model-local rotation bringing the mesh into scene convention
//                (+X case front, +Y up, +Z toward the glass). Right angles only.
// `anchorNode` — optional sub-node to align on instead of the bbox centre.
// `anchorOffset` — vector from the mesh bbox centre to that node's centre, in
//                raw model units. Kept here so the pure geometry can predict
//                where an anchored part lands without loading the mesh.
export const PART_SPECS = {
  // The board's long (305 mm) edge is mesh Z and must stand vertical, so mesh Z
  // maps to world Y.
  //
  // `surfaceOffset` is the vector from the mesh's bbox centre to the PCB's
  // component-side face, in raw model units — the plane things actually plug
  // into. It is NOT half the bounding box: this mesh is 49 mm deep because it
  // includes the VRM heatsinks and the tall ROG I/O shroud, whose top sits
  // 41.6 mm proud of the PCB. Mounting parts on the bbox front face left every
  // one of them floating that far clear of the board. Measured from the mesh's
  // `Board` material and checked by modelBounds.test.js.
  // `body`/`bodyOffset` exist because this mesh is much larger than the board it
  // draws. Besides the shroud and heatsinks it carries `Object_197`, a 0.65-thick
  // sheet running ~74 mm past the PCB's edge that belongs to no real motherboard
  // — the "random wires" hanging off the bottom-front corner.
  //
  // Sizing on the bounding box therefore rendered the PCB at 213 x 266 mm instead
  // of ATX's 244 x 305, and left its centre ~30 mm from the origin that MOUNTS
  // measures from. Both errors displaced every board-mounted part, which is why
  // the RAM and the GPU never looked seated.
  //
  // So the board is sized and centred on its PCB (the `Board` material) and the
  // decoration just comes along for the ride. The PCB's own aspect gives 244.5 mm
  // across when its long edge is 305, so a uniform scale is still right.
  motherboard: {
    raw: [30.56, 4.96, 30.85],
    body: [21.599, 0.747, 26.943],
    bodyOffset: [-2.996, -2.104, -0.915],
    lengthMm: 305,
    rotation: [Math.PI / 2, 0, 0],
    // From the PCB's centre to its component face — half the (thick) PCB.
    surfaceOffset: [0, 0.373, 0],
    hideNodes: ['Object_197'],
    // The rear I/O stack — the port cluster that pokes through the case's back
    // panel. Offset from the PCB centre and size, both in raw model units, as
    // the union of the mesh's `IO_Metal.001` and `IO_Heatsink_botton` nodes.
    //
    // Recorded because the rear exhaust fan has to CLEAR it: the I/O runs 163 mm
    // up the board's rear edge and stands 48 mm proud, so a 120 mm fan mounted
    // level with the board's top edge and centred on the case's width sat
    // straight through the USB ports. Nothing had ever compared the two.
    ioBlock: { offset: [-9.159, 2.394, -7.318], size: [4.99, 4.23, 14.39] },
  },

  // The bare package lies flat in its mesh (thin axis is mesh Y, same as the
  // board), so it takes the board's quarter turn to sit against the vertical
  // tray. ~40 mm square, matching a modern desktop socket. Mostly hidden under
  // the cooler's pump block — it is modelled for the moments it isn't.
  cpu: { raw: [3.162, 0.231, 3.162], lengthMm: 40, rotation: [Math.PI / 2, 0, 0] },

  // Card lies horizontal: the mesh's long axis (30.187) becomes world X.
  //
  // `powerInlet` is the mesh's own `12_pin` node, offset from the card's bbox
  // centre in raw model units — the actual socket the PCIe lead plugs into. It
  // sits on the card's OUTER edge (facing the side window), not on the upper
  // face where the harness used to aim; the old guess missed it by 34 mm.
  // `pcbOffset` is the `motherboard` node — the card's PCB, whose plane is the
  // one that has to line up with the board's PCIe slot.
  gpu: {
    raw: [4.381, 30.187, 12.819],
    // 300: trimmed from 285→320→308→300 against the render. The card is anchored
    // on its PCB's leading edge (MOUNTS.gpu.pcbRearMm), so length changes stretch
    // it FORWARD only — the notch stays put and a shorter card just pulls the fan
    // end back toward the slot. Still above the 3080 FE's real 285 because the
    // mesh's own proportions read short at that figure.
    lengthMm: 300,
    rotation: [0, 0, Math.PI / 2],
    powerInlet: [0.11, -2.74, 5.43],
    pcbOffset: [1.37, 3.77, 0.27],
    pcbSize: [0.10, 19.03, 11.18],
  },

  // 240 AIO assembly. Mesh +Y is up (the pump block sits below the radiator) and
  // the radiator's long axis is mesh Z, which must run front-to-back (world X).
  // Anchoring on the pump block puts the radiator at the case top by itself —
  // the mesh locks them 131 mm apart, matching a real socket-to-radiator gap.
  cooler: {
    raw: [1.486, 1.935, 2.936],
    lengthMm: 271,
    rotation: [0, Math.PI / 2, 0],
    // The pump block clamps onto the CPU's heat spreader, so the assembly starts
    // where the CPU ends rather than at the board face like everything else.
    mountsOn: 'cpu',
    // Measured from the mesh's pump-block node: offset from the assembly's bbox
    // centre to the block's centre, and the block's own bbox. Together these let
    // the geometry mount the AIO by its block while the radiator hangs where the
    // mesh puts it. The renderer stays unaware of them by design — see GltfPart.
    anchorOffset: [0.517, -0.589, -0.529],
    anchorSize: [0.45, 0.76, 0.76],
    // The two 120 mm fans on the radiator (`Object_11` and `Object_20`), as
    // offsets from the assembly's bbox centre in raw model units. The roof vent
    // is cut over THESE rather than over the whole assembly's bounding box: the
    // box is 13 mm forward of the blades, which showed as the vent sitting too
    // far along the roof from the fans it is meant to be venting.
    radiatorFans: { offsets: [[-0.04, 0.83, 0.50], [-0.04, 0.83, -0.79]], size: [1.30, 0.27, 1.30] },
  },

  // A DIMM stands edge-on in its slot: its length is mesh Z and must run
  // vertical (world Y), leaving the 7 mm thickness across the board.
  //
  // 142 rather than a real DIMM's 133: this board mesh draws its slots a little
  // longer than spec, and a stick sized to the real part sat visibly short of
  // the slot's lower end. Matching the drawn slot beats matching the datasheet
  // when the board is the thing you can see it against.
  ram: { raw: [0.033, 0.226, 0.608], lengthMm: 142, rotation: [Math.PI / 2, 0, 0] },

  // Flat M.2 stick lying on the board face: 100 mm along world X to fill the
  // drawn slot (a real 2280 is 80, but this board draws its slot longer, same as
  // the GPU and RAM), its real 22 mm width up world Y, ~2 mm thick toward glass.
  //
  // sizeMm, not lengthMm: scaling the length uniformly to fill the slot also blew
  // the width out to 27.7 mm, and that extra width dropped the stick's lower edge
  // into the GPU's bounding box (a real M.2 sits above the top PCIe slot, clear of
  // the card). Pinning the width to a real 22 mm keeps it centred on its slot and
  // clear of the GPU. This and the PSU are the only sizeMm parts.
  storage: { raw: [4.332, 0.009, 1.201], sizeMm: [100, 22, 2], rotation: [Math.PI / 2, 0, 0] },

  // The PSU mesh is near-cubic (20.4 x 21.9 x 22.7) but a real ATX unit is not:
  // 150 wide x 86 tall x ~160 deep. Any UNIFORM fit therefore has to be wrong on
  // two axes — pinning the height to 86 mm, as this did, rendered an 89x86x80 mm
  // block that sat in one corner of a 450x110x210 basement looking like a spare
  // part rather than the thing everything plugs into. `sizeMm` names all three
  // world dimensions instead, so the mesh is stretched to the volume a real
  // supply fills: [front-to-back, up, side-to-side].
  //
  // The quarter turn puts the IEC socket where it belongs. In the mesh the I/O
  // face is at -Z and the honeycomb exhaust at +Z; unrotated that aimed the
  // socket at the side panel and the vent at the glass. Turning +90 degrees
  // about Y maps mesh -Z to world -X, so the plug faces the back of the case
  // where the cable exits.
  //
  // `ioSocket` is the mains inlet and rocker switch on that face — the union of
  // the mesh's `Object_12`/`Object_14`/`Object_16`, offset from the mesh centre
  // and sized in raw model units. Recorded because the case's rear panel has to
  // be cut for it: the cut-out was previously centred on the PSU's face, which
  // put it on the wrong side of the unit entirely. The socket sits low and
  // toward the window, not in the middle.
  //
  // (An older comment here named nodes `iio`/`iio.001`/`berlubang`. No such
  // names exist in the shipped mesh — every node is `Object_N`. Do not trust it.)
  // `body`/`bodyOffset`/`hideNodes` for the same reason the motherboard has them:
  // the mesh carries `Object_78`, a lone 0.6-unit cube floating well above the
  // unit, and it MORE THAN DOUBLES the bounding box's height — 10.499 units of
  // actual supply inside a 21.937-unit box. Since `sizeMm` scales the whole box,
  // an 86 mm PSU rendered about 41 mm tall inside an 86 mm hitbox, which is why
  // its loom and its socket kept looking detached from it: they were anchored to
  // the box, and the box was twice the visible unit.
  psu: {
    raw: [20.446, 21.937, 22.73],
    body: [20.446, 10.499, 22.73],
    bodyOffset: [0, -5.7185, 0],
    hideNodes: ['Object_78'],
    // 80 rather than a real ATX unit's 86: asked to take the height down a
    // touch. Only the Y axis moves — this is a `sizeMm` part precisely so one
    // axis can change without the uniform fit dragging the other two with it
    // (the mistake that widened the M.2 into the GPU).
    sizeMm: [160, 80, 150],
    rotation: [0, Math.PI / 2, 0],
    // Offset from the BODY's centre (everything here is), which is why this is
    // not the raw -6.857 the node dump reports against the whole mesh.
    ioSocket: { offset: [-5.299, -1.1385, -8.937], size: [6.474, 5.347, 4.85] },
  },
}
