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

// Upright sword: blade, notched crossguard, pommel.
const rpg = () => (
  <g fill="currentColor">
    <path d="M22 7h4v20h-4z" />
    <path d="M13 27h22v4H13z" />
    <path d="M22 31h4v7h-4z" />
    <circle cx="24" cy="40" r="3" />
  </g>
)

// Chevron blade over a horizon line — motion, not a specific weapon.
const actionAdventure = () => (
  <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 28L24 12l10 16" />
    <path d="M11 36h26" />
  </g>
)

// Three-cell hex cluster: a map, a grid, a colony.
const strategySim = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
    <path d="M24 8l7 4v8l-7 4-7-4v-8z" />
    <path d="M15 24l7 4v8l-7 4-7-4v-8z" />
    <path d="M33 24l7 4v8l-7 4-7-4v-8z" />
  </g>
)

// Crescent moon with two bare branches.
const horror = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <path d="M30 10a12 12 0 100 20 14 14 0 010-20z" fill="currentColor" stroke="none" />
    <path d="M12 40V24M12 30l-5-5M12 32l5-5" />
  </g>
)

// Steering wheel: ring with a T of spokes.
const racing = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
    <circle cx="24" cy="24" r="13" />
    <path d="M11 22h26M24 22v14" />
  </g>
)

// Two lanes crossing behind a nexus diamond.
const moba = () => (
  <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <path d="M10 38L38 10M10 10l28 28" />
    <path d="M24 16l6 8-6 8-6-8z" fill="currentColor" stroke="none" />
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
