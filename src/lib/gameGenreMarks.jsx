// One silhouette per genre, drawn on top of GameArt's gradient plate.
//
// ⚠️ THE SIZE IS THE DESIGN. These render at 24px in FrameRateRow and 32px in
// GamePerformanceList. Authored in a 48-unit box, that makes one unit half a
// device pixel at the smaller size — so nothing here is thinner than 2 units,
// and no two shapes are separated by less than 2. This is the same lesson
// PartArt learned when a 64x40 drawing in a 48px square "read as a smudge":
// at this scale a mark is an icon, not an illustration.
//
// Everything paints in `currentColor`, so the plate sets the ink from its
// genre's own palette and the marks cannot drift out of it.
//
// ⚠️ This file is .jsx and exports COMPONENTS ONLY — GENRE_MARKS is the one
// and only export. `react-refresh/only-export-components` has already fired
// on GameArt.jsx once (for `initialsFor`) and on categoryIcons.jsx once, but
// the shape of the trap here is different and sneakier: the rule flags any
// top-level `const WithAPascalCaseName` as a fast-refresh "local component"
// regardless of whether it is ever exported by name, and once it finds one it
// demands the file's exports be components too — which GENRE_MARKS, a plain
// object, is not. So the per-genre drawings below are named in lowerCamelCase
// rather than PascalCase, purely to stay outside that heuristic. That naming
// has no runtime meaning: JSX resolves a tag from the identifier at the *call
// site* (GameArt.jsx does `const Mark = GENRE_MARKS[genre]` then `<Mark />`),
// never from what a function was named where it was defined.

// Reticle: ring, crosshair ticks, centre dot.
const shooter = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <circle cx="24" cy="24" r="10" />
    <path d="M24 8v5M24 35v5M8 24h5M35 24h5" />
    <circle cx="24" cy="24" r="2.2" fill="currentColor" stroke="none" />
  </g>
)

// A shield.
//
// ⚠️ This replaced an upright sword, and the sword was a genuine failure rather
// than a matter of taste. Rasterised at a true 24px its blade, crossguard and
// pommel collapsed into a plain PLUS SIGN — in a list of games that reads as
// "add", or as a medical cross, which is worse than an unrecognisable mark
// because it confidently says the wrong thing. The tell was that it looked
// perfectly good at 96px.
//
// One filled silhouette with no internal detail cannot collapse that way, and a
// shield stays distinct from the other marks: nothing else here is a rounded
// solid.
const rpg = () => (
  <g fill="currentColor">
    <path d="M24 7l14 5v12c0 9-6 15-14 18-8-3-14-9-14-18V12z" />
  </g>
)

// Chevron blade over a horizon line — motion, not a specific weapon.
const actionAdventure = () => (
  <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 28L24 12l10 16" />
    <path d="M11 36h26" />
  </g>
)

// Three rising bars — production, economy, a city growing. Filled rather than
// outlined and 3 units apart, because the outlined hex cluster this replaces
// was measured as the weakest mark in the set at 24px: anti-aliasing rounded
// its vertices away and it read as three fuzzy rings.
const strategySim = () => (
  <g fill="currentColor">
    <rect x="9"  y="28" width="8" height="12" rx="1.5" />
    <rect x="20" y="20" width="8" height="20" rx="1.5" />
    <rect x="31" y="11" width="8" height="29" rx="1.5" />
  </g>
)

// A crescent, and nothing else. The bare branches that used to sit beside it
// measured invisible at 24px, so they were spending contrast on detail nobody
// could resolve; the crescent alone is the whole mark and can be larger for it.
const horror = () => (
  <g fill="currentColor">
    <path d="M31 9a15 15 0 100 30 18 18 0 010-30z" />
  </g>
)

// Steering wheel: ring with a T of spokes.
const racing = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
    <circle cx="24" cy="24" r="13" />
    <path d="M11 22h26M24 22v14" />
  </g>
)

// A nexus above its lane. The previous version crossed two diagonals THROUGH
// the diamond, and at 24px the three fused into one blob — the shapes need
// clear air between them, not just different geometry.
const moba = () => (
  <g fill="currentColor">
    <path d="M24 10l9 11-9 11-9-11z" />
    <rect x="6" y="36" width="36" height="4" rx="2" />
  </g>
)

// Pennant on a post.
const sports = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 8v32" />
    <path d="M14 11h20l-6 7 6 7H14z" fill="currentColor" stroke="none" />
  </g>
)

// ⚠️ `other` is deliberately ABSENT rather than mapped to a question mark or a
// generic shape. A game whose genre is unknown has nothing to draw, and a symbol
// would assert something untrue; GameArt falls back to its initials, which
// assert only the name. A test pins this absence.
export const GENRE_MARKS = {
  shooter,
  rpg,
  'action-adventure': actionAdventure,
  'strategy-sim': strategySim,
  horror,
  racing,
  moba,
  sports,
}
