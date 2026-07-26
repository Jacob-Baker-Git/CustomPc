// One scale for the whole 3D scene: 1 world unit = 122 mm.
//
// Chosen so the established framing keeps working — a 305 mm ATX board lands on
// 2.50 world units, matching the size the camera and zoom clamps were already
// built around. Every physical dimension goes through mm() so parts share one
// scale and can actually connect to each other.
export const WU_PER_MM = 1 / 122

export const mm = (v) => v * WU_PER_MM
