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
  let sign
  if (rake === 'left') sign = ''
  else if (rake === 'right') sign = '-'
  else throw new Error(`bladeStyle: unknown rake "${rake}"`)

  return {
    left: `${left}%`,
    width: `${width}%`,
    height: `${height}px`,
    transform: `skewX(${sign}${RAKE_DEG}deg)`,
    transformOrigin: 'bottom left',
  }
}

// ---------------------------------------------------------------------------
// The heatspreader face
//
// The body used to paint a lighter band from 2px down to 26px and then ramp
// darker, with content starting at pt-5 (20px). That put every heading in a
// designator-less box — "Your CustomPC score", "Your parts", "Build summary" —
// astride the boundary: measured in the browser, the score heading occupied
// 21px–41px against a 26px stop, so the top quarter of the glyphs sat on the
// light band and the rest on the dark field. Text has to sit on ONE colour.
//
// So the lip now ends ABOVE where content begins, and the gap between the two
// numbers is the whole point of naming them together.
//
// ⚠️ BODY_LIP_END must stay strictly below CONTENT_TOP. Raising one without the
// other puts the straddle straight back, and jsdom computes no layout so no
// component test can see it. ramBoxGeometry.test.js asserts the ordering, and
// RamBox.test.jsx asserts the padding classes still map to these figures.
export const BODY_LIP_END = 18

// pt-5 and pt-8 in pixels. The plain figure also has to clear the lit bar,
// which occupies 8px–17px down the face.
export const CONTENT_TOP = 20
export const CONTENT_TOP_DESIGNATOR = 32
