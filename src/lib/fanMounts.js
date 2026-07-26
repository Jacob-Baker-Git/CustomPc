// Fan mount points in the assembly's world frame (motherboard at the origin).
// Derived from the case interior so they stay correct if the case changes, and
// spaced exactly one fan apart so adjacent frames touch without intersecting.
// Each fan/slot faces +Z by default and is re-oriented by `rotation`.
import { caseInterior } from './assemblyGeometry'
import { mm, FAN_MM } from './pcScale'

const inner = caseInterior()

const FAN = mm(FAN_MM)        // full width of a 120 mm fan
const HALF = FAN / 2
const THICK_HALF = mm(12.5)   // half a fan's ~25 mm frame depth

// Each panel, one half-thickness inside the wall it mounts to.
const FRONT_X = inner.max[0] - THICK_HALF
const REAR_X = inner.min[0] + THICK_HALF
const TOP_Y = inner.max[1] - THICK_HALF
const MID_Z = (inner.min[2] + inner.max[2]) / 2

// Highest a wall fan can sit without pushing into the top row.
const COLUMN_TOP = TOP_Y - THICK_HALF - HALF

export const FAN_MOUNTS = [
  // Front panel — intake column of three, stacked downward from the top row.
  { position: [FRONT_X, COLUMN_TOP, MID_Z], rotation: [0, -Math.PI / 2, 0] },
  { position: [FRONT_X, COLUMN_TOP - FAN, MID_Z], rotation: [0, -Math.PI / 2, 0] },
  { position: [FRONT_X, COLUMN_TOP - 2 * FAN, MID_Z], rotation: [0, -Math.PI / 2, 0] },
  // Top panel — row of three, centred front-to-back, facing up.
  { position: [-FAN, TOP_Y, MID_Z], rotation: [-Math.PI / 2, 0, 0] },
  { position: [0, TOP_Y, MID_Z], rotation: [-Math.PI / 2, 0, 0] },
  { position: [FAN, TOP_Y, MID_Z], rotation: [-Math.PI / 2, 0, 0] },
  // Rear panel — single exhaust mounted high, like a real rear exhaust.
  { position: [REAR_X, COLUMN_TOP, MID_Z], rotation: [0, Math.PI / 2, 0] },
]
