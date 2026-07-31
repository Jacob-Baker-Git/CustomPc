// Fan mount points in the assembly's world frame (motherboard at the origin).
// Derived from the case interior so they stay correct if the case changes, and
// spaced exactly one fan apart so adjacent frames touch without intersecting.
// Each fan/slot faces +Z by default and is re-oriented by `rotation`.
import { caseInterior, CASE, ioBlockBox } from './assemblyGeometry'
import { mm, FAN_MM } from './pcScale'

const inner = caseInterior()
const io = ioBlockBox()

const FAN = mm(FAN_MM)        // full width of a 120 mm fan
const HALF = FAN / 2
export const FAN_HALF_DEPTH = mm(12.5) // half a fan's ~25 mm frame depth
const THICK_HALF = FAN_HALF_DEPTH
const PANEL = mm(CASE.panelMm)

// A fan sits IN its panel's cut-out, not against the panel's inner face: its
// outer face finishes flush with the outside of the wall, so the frame is
// genuinely recessed into the panel rather than parked behind it. Sitting one
// half-thickness inside the interior — as this did — is what read as the fans
// being stuck onto solid walls, since CaseModel drew no aperture either.
export const FAN_INSET = PANEL - THICK_HALF
const FRONT_X = inner.max[0] + FAN_INSET
const REAR_X = inner.min[0] - FAN_INSET
const TOP_Y = inner.max[1] - THICK_HALF
const MID_Z = (inner.min[2] + inner.max[2]) / 2

// Highest a wall fan can sit without pushing into the top row.
const COLUMN_TOP = TOP_Y - THICK_HALF - HALF

// The rear exhaust sits toward the window rather than on the case's centreline,
// so it clears the board's I/O stack.
//
// That stack runs 163 mm up the board's rear edge and stands 48 mm proud of the
// PCB, and the exhaust is on the same wall at the same height — so a fan on
// MID_Z ran straight through the USB ports, which is exactly what the render
// showed. Real towers put the I/O hard against the tray side and the exhaust
// beside it, which is what this reproduces. Clamped so it can never leave the
// case if the I/O measurement or the case width changes.
const REAR_Z = io
  ? Math.min(io.max[2] + mm(10) + HALF, inner.max[2] - HALF - mm(6))
  : MID_Z

// Every fan hangs on a vertical end wall — front intake, rear exhaust — which is
// how air actually moves through a tower. Nothing mounts on the top panel: the
// AIO radiator occupies that span, so a top row put two sets of fan geometry in
// the same place.
export const FAN_MOUNTS = [
  // Front panel — intake column of three, stacked downward from the top row.
  { wall: 'front', position: [FRONT_X, COLUMN_TOP, MID_Z], rotation: [0, -Math.PI / 2, 0] },
  { wall: 'front', position: [FRONT_X, COLUMN_TOP - FAN, MID_Z], rotation: [0, -Math.PI / 2, 0] },
  { wall: 'front', position: [FRONT_X, COLUMN_TOP - 2 * FAN, MID_Z], rotation: [0, -Math.PI / 2, 0] },
  // Rear panel — single exhaust mounted high and off to the window side.
  { wall: 'rear', position: [REAR_X, COLUMN_TOP, REAR_Z], rotation: [0, Math.PI / 2, 0] },
]

// The panel cut-outs live in caseApertures.js, which also has to account for the
// I/O stack, the PSU's socket and the roof vent — see that file.
