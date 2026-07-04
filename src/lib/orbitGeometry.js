// Ring geometry for the desktop orbit layout. The ring is an ellipse: the
// vertical radius follows the classic 40%-of-viewport rule, but the horizontal
// radius is clamped so part chips (which extend ~120px past the ring point)
// never reach the fixed side-panel columns (~304px each side, plus margin).
const PANEL_CLEARANCE = 430
const MIN_RADIUS = 200

export function orbitRadii(w, h) {
  const base = Math.min(w, h) * 0.40
  const rx = Math.max(MIN_RADIUS, Math.min(w / 2 - PANEL_CLEARANCE, base))
  return { rx, ry: base }
}
