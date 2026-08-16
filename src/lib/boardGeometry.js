// Every tuned number for the board background, in one file — the same split as
// ramBoxGeometry.js, and for the same two reasons: a decision that gets
// revisited needs one place to live, and a component file that exports
// constants breaks Fast Refresh.
//
// ⚠️ THE MEASUREMENT THAT DRIVES ALL OF IT:
//
//   --faint (#878E9C) on a full-strength gold pad ....... 1.46:1
//   --ink   (#EDEFF2) on a full-strength gold pad ....... 1.95:1
//
// Nothing readable can sit on solid gold at any token we own, so this is not a
// "choose a lighter text colour" problem. For --faint to clear AA the brightest
// pixel behind it must be at or below ~15% gold over --ground. Every number
// below follows from that one line.

// --ground is #0E0F11, written out as channels because a CSS var holding a hex
// cannot be composed into rgba() — the same limitation that makes `bg-gold/60`
// emit no CSS at all. Keep in step with the token.
export const GROUND_RGB = '14,15,17'

// The heaviest trace runs at 0.68, and 0.68 * (1 - 0.82) = 0.122, inside the
// ~0.15 ceiling. Raising this dims the board for nothing; lowering it fails
// real text.
export const SCRIM_ALPHA = 0.82

// The scrim's soft shoulder. A hard-edged clear rect was the earlier design and
// reads as a stripe down the middle of the page; fading over 100px lets the
// board look continuous while doing the same job where it counts.
export const SCRIM_FADE = 100

// Clearance kept between a hardware layer and the readable column. Touching is
// already a failure — a gold pad half a pixel off a descender is as unreadable
// as one behind it — so the gap is explicit rather than incidental.
export const GUTTER_MARGIN = 24

// Vias are the only filled thing allowed in the full-bleed layer. A 4px dot is
// small enough to lose to the scrim; anything brighter is a pad and belongs at
// the edges. BoardBackground.test.jsx enforces it.
export const LINE_FILL_CEILING = 0.5

// Pixel widths of the Tailwind column classes the pages actually use. They live
// here so the scrim and the column it protects cannot drift apart silently — a
// page that widens its column without widening its scrim puts prose back on the
// artwork, and nothing in the suite would notice.
export const COLUMN_2XL = 672
export const COLUMN_3XL = 768

// ⚠️ Load-bearing, and not an optimisation.
//
// Both layers use preserveAspectRatio="slice", which scales the drawing to
// cover its box — on a 1412x958 viewport the full-bleed layer runs at 2.28x.
// Without this the tuned 0.6 / 1 / 2 stroke widths render at 1.4 / 2.3 / 4.6
// screen pixels: a heavier board on a bigger monitor, and far more bright
// pixels under the same text than the scrim was ever sized for.
export const CRISP = { vectorEffect: 'non-scaling-stroke' }

// How wide a hardware layer may be, given the column it has to stay clear of.
//
// ⚠️ A flat 16vw was the first attempt. It passed at 1440 and FAILED on /help
// at 1024, where 33 glyphs landed over the right-hand layer — a fixed width has
// no idea how wide the column it must avoid is. The gutter is the real
// constraint, so the gutter sizes it.
//
// clamp() collapses the layer to nothing when the gutter runs out, so there is
// no breakpoint to keep in step with the column widths, and the 16vw cap stops
// a very wide screen handing half the page over to artwork.
export function hardwareWidth(column) {
  return `clamp(0px, calc((100% - ${column}px) / 2 - ${GUTTER_MARGIN}px), 16vw)`
}
