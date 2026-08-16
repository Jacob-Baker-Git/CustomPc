//
// Every tuned number for the RamBox silhouette, in one file on purpose.
//
// ⚠️ Positions are PERCENTAGES, and that is a decision rather than an
// oversight. Fixed-pixel blades were prototyped and compared side by side at
// three aspect ratios; they hold tooth size constant but a narrow box loses
// blades outright (a 150px box kept two of five). Percentage keeps all five
// and the tuned rhythm everywhere, at the cost of tooth size varying with box
// width. If you are about to "fix" this, read the spec first — you are
// reversing a choice, not correcting a bug.

// Left bank rakes one way, right bank the other. The opposition is the point:
// it is what stops the top edge reading as a plain comb.
export const BLADES = [
  { left: 2, width: 16, height: 12, rake: 'left' },
  { left: 22, width: 10, height: 12, rake: 'left' },
  { left: 36, width: 21, height: 12, rake: 'left' },
  { left: 64, width: 18, height: 16, rake: 'right' },
  { left: 85, width: 15, height: 16, rake: 'right' },
]

export const RAKE_DEG = 20

// Fixed. Only the heatspreader stretches — a square box is the same physical
// part with a taller body, never a scaled-up drawing.
export const FIN_ROW_HEIGHT = 18
export const CONTACT_HEIGHT = 13

// transform-origin keeps the blade's foot planted on the body while the top
// leans; without it the skew pivots about the centre and lifts the blade off.
export function bladeStyle({ left, width, height, rake }) {
  return {
    left: `${left}%`,
    width: `${width}%`,
    height: `${height}px`,
    transform: `skewX(${rake === 'left' ? '' : '-'}${RAKE_DEG}deg)`,
    transformOrigin: 'bottom left',
  }
}
