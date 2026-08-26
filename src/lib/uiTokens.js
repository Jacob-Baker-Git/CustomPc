// Shared Tailwind class strings for the Workbench look. Literal strings so
// Tailwind's content scanner emits the classes; components compose them via
// template literals. Colours resolve from the CSS vars in src/index.css via
// the semantic Tailwind tokens in tailwind.config.js.

// Solid card surface for anything that is NOT a seated part: friendly rounded
// corners, 1px hairline, real contrast.
//
// ⚠️ All ten part-shaped panels are RamBoxes now — the last three
// (BuildRatingPanel, BuildSummary, SavedBuilds) migrated on 2026-08-25, having
// shipped as plain panels beside seven DIMMs. The rule for the next one:
// RamBox when the thing on screen stands for hardware that plugs in, PANEL when
// it does not. PANEL_STRONG stays a plain panel for exactly that reason — a
// floating menu is not a seated part, and giving it contacts would be
// decoration pretending to be structure.
//
// Which leaves ONE caller: the 3D viewport frame in BuilderScreen. That frame
// is a window onto the build, not a component of it.
export const PANEL = 'bg-surface border border-line rounded-xl'

// Raised variant for popovers / floating menus that sit over busy content.
export const PANEL_STRONG = 'bg-surface-2 border border-line-strong rounded-xl'

// Monospace telemetry — apply to live-updating numbers only (labels stay sans).
//
// ⚠️ whitespace-nowrap is load-bearing, not tidying. A number is an atom, and
// the browser does not agree by default: "+£10" rendered as "+" at the end of
// one line and "£10" at the start of the next inside the "Best next move"
// sentence at 390px. Nothing in the markup asked for that break — UAX#14 simply
// permits one between PLUS SIGN and POUND SIGN (both line-break class PR, and
// only PR × NU is protected), and a narrow column takes every opportunity it is
// offered. Desktop never wraps there, so this was invisible until a phone.
//
// This is safe for the multi-word strings that also wear TELEMETRY — "no extra
// cost", "+5 fps", "9 / 9", "112 @ 1440p" — because each is far narrower than
// the column it sits in; they simply stop being able to break, which for a
// value and its unit is what you want anyway. Guarded at phone widths by
// e2e/mobileLayout.spec.js.
export const TELEMETRY = 'font-mono tabular-nums whitespace-nowrap'

// Flat primary action — one metal, dark ink on top, no gradients or glows.
// Copper is the ACTION metal. Not the brand orange: that is the wordmark's
// alone, which is what keeps it reading as identity rather than as one more UI
// accent. See accentIsBrandOnly.test.js.
export const BTN_PRIMARY = 'bg-copper hover:brightness-110 text-accent-ink font-semibold'

// ---------------------------------------------------------------------------
// The elevation scale
//
// Two steps above the page, and each one MEANS something rather than being
// picked by eye:
//
//   ELEV_GROUP   a group — a shut genre bar, a card, a hover hint
//   ELEV_ACTIVE  the thing being attended to — an open group, the target column
//
// The page itself is the third step and has no token, because nothing composes
// it: `html { background: var(--ground) }` in index.css paints it once. An
// `ELEV_PAGE = 'bg-ground'` sat here unimported by anything — the live
// `bg-ground` classes are wells, notches and the board substrate, none of which
// is "the page".
//
// They were used ad hoc before this. Two days of de-bordering the Performance
// tab left every surface at almost the same value, so nothing led the eye: with
// the borders gone and the fills undifferentiated there was no hierarchy left to
// read. Depth carries it now — NOT more borders, which is what was deliberately
// removed.
//
// ⚠️ These are whole tokens on purpose. `bg-surface/85` and friends emit NO CSS
// on this palette; tokenOpacity.test.js fails the build for it. If you want a
// step between two of these, the answer is a new token in index.css, not an
// alpha.
export const ELEV_GROUP = 'bg-surface'
export const ELEV_ACTIVE = 'bg-surface-2'

// A 2px gold rail down the leading edge, marking the ACTIVE thing — the open
// genre, the open row. Gold is the SEATED metal, so the rail says "this is the
// one you are looking at" rather than "you may click this"; copper would say the
// latter, which is the confusion this rail was added to fix.
//
// An inset box-shadow rather than `border-l-2`: a border changes the box and
// shifts the row's contents 2px out of line with every row above it. This paints
// inside the existing box and moves nothing. It also sidesteps the opacity trap
// entirely, since it names the CSS var directly.
export const RAIL_ACTIVE = 'shadow-[inset_2px_0_0_0_var(--gold)]'
