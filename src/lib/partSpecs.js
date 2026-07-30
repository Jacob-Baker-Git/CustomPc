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
  motherboard: {
    raw: [30.56, 4.96, 30.85],
    lengthMm: 305,
    rotation: [Math.PI / 2, 0, 0],
    surfaceOffset: [0, -1.7305, 0],
  },

  // The bare package lies flat in its mesh (thin axis is mesh Y, same as the
  // board), so it takes the board's quarter turn to sit against the vertical
  // tray. ~40 mm square, matching a modern desktop socket. Mostly hidden under
  // the cooler's pump block — it is modelled for the moments it isn't.
  cpu: { raw: [3.162, 0.231, 3.162], lengthMm: 40, rotation: [Math.PI / 2, 0, 0] },

  // Card lies horizontal: the mesh's long axis (30.187) becomes world X.
  gpu: { raw: [4.381, 30.187, 12.819], lengthMm: 285, rotation: [0, 0, Math.PI / 2] },

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
  },

  // A DIMM stands edge-on in its slot: its 133 mm length is mesh Z and must run
  // vertical (world Y), leaving the 7 mm thickness across the board.
  ram: { raw: [0.033, 0.226, 0.608], lengthMm: 133, rotation: [Math.PI / 2, 0, 0] },

  // Flat M.2 stick lying on the board face: 80 mm along world X, 22 mm up, and
  // near-zero thickness toward the glass.
  storage: { raw: [4.332, 0.009, 1.201], lengthMm: 80, rotation: [Math.PI / 2, 0, 0] },

  // The PSU mesh is near-cubic (20.4 x 21.9 x 22.7) but a real ATX unit is not:
  // 150 wide x 86 tall x ~160 deep. Any UNIFORM fit therefore has to be wrong on
  // two axes — pinning the height to 86 mm, as this did, rendered an 89x86x80 mm
  // block that sat in one corner of a 450x110x210 basement looking like a spare
  // part rather than the thing everything plugs into. `sizeMm` names all three
  // world dimensions instead, so the mesh is stretched to the volume a real
  // supply fills: [front-to-back, up, side-to-side].
  //
  // The quarter turn puts the IEC socket where it belongs. In the mesh the I/O
  // face (nodes `iio`/`iio.001` plus the rating text) is at -Z and the honeycomb
  // exhaust (`berlubang`) at +Z; unrotated that aimed the socket at the side
  // panel and the vent at the glass. Turning +90 degrees about Y maps mesh -Z to
  // world -X, so the plug faces the back of the case where the cable exits.
  psu: { raw: [20.446, 21.937, 22.73], sizeMm: [160, 86, 150], rotation: [0, Math.PI / 2, 0] },
}
