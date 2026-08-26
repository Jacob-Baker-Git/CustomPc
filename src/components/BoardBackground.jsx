import {
  GROUND_RGB,
  SCRIM_ALPHA,
  SCRIM_FADE,
  LINE_FILL_CEILING,
  CRISP,
  hardwareWidth,
} from '../lib/boardGeometry'
import { LANDMARKS, BOARD, routes } from '../lib/boardPlan'

// The page ground drawn as a motherboard.
//
// ⚠️ THE CONSTRAINT THAT SHAPES THIS WHOLE FILE, measured rather than guessed:
//
//   --faint  (#878E9C) on a full-strength gold pad ....... 1.46:1
//   --ink    (#EDEFF2) on a full-strength gold pad ....... 1.95:1
//
// So this is NOT a "pick a lighter text colour" problem — nothing readable can
// sit on solid gold, at any token we own. For --faint to clear AA the brightest
// pixel behind it has to be at or below ~15% gold over --ground.
//
// Naively that kills a full-bleed board outright. What rescues it is that thin
// line work and solid fills behave completely differently behind text: a 1px
// trace is an interruption, a gold pad is a wall. So the board splits in two.
// The FULL-BLEED layer carries line work only. Every solid gold pad lives in an
// edge-pinned HARDWARE layer that is structurally incapable of reaching the
// text column — composition alone could not guarantee that, because
// preserveAspectRatio="slice" re-crops the drawing at every aspect ratio and a
// pad that clears the column on a laptop lands in it on an ultrawide.
//
// Replaces Backdrop, which also carried rgba(242,107,58,0.07) — the brand
// orange, as a literal rgba, which is why accentIsBrandOnly.test.js never saw
// it. That guard matches class names and cannot read a style attribute.


const GOLD = 'var(--gold)'

// Regular grids, generated rather than typed out: 81 socket pins and 40 header
// pins are not worth 121 lines of markup, and a typo in one of them would be
// invisible.
function grid({ x, y, cols, rows, pitch, r, key }) {
  return Array.from({ length: cols * rows }, (_, i) => (
    <circle
      key={`${key}${i}`}
      cx={x + (i % cols) * pitch}
      cy={y + Math.floor(i / cols) * pitch}
      r={r}
    />
  ))
}

// ── The full-bleed layer ────────────────────────────────────────────────────
// Line work only. Three weights, and the hierarchy is the point: power delivery
// is thick and bright, component outlines sit in the middle, and the signal
// fan-out is thin and dim. Collapse them to one weight and the board goes back
// to reading as a wireframe, which is what the outline-only prototype did.
//
// The weights below are NOT free parameters — they were measured against the
// scrim, which is sized for them. See boardGeometry.js.
const WEIGHTS = {
  signal: { strokeOpacity: '0.2', strokeWidth: '0.6' },
  outline: { strokeOpacity: '0.4', strokeWidth: '1' },
  power: { strokeOpacity: '0.68', strokeWidth: '2' },
}

const ORDER = ['signal', 'outline', 'power']

function Lines() {
  // Both the components and the copper come from the plan. Nothing in this
  // file draws a coordinate of its own — the previous version hand-wrote every
  // path, which is how its bundles drifted out of parallel with each other and
  // ended up reading as decorative squiggles rather than as routing.
  const bundles = routes()
  const socket = LANDMARKS.find((l) => l.id === 'socket')

  return (
    <svg
      aria-hidden="true"
      data-board-layer="lines"
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${BOARD.w} ${BOARD.h}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {ORDER.map((weight) => (
        <g
          key={weight}
          data-trace={weight}
          fill="none"
          stroke={GOLD}
          style={CRISP}
          {...WEIGHTS[weight]}
        >
          {LANDMARKS.filter((l) => l.weight === weight).map((l) => (
            <rect
              key={l.id}
              data-landmark={l.id}
              x={l.x}
              y={l.y}
              width={l.w}
              height={l.h}
              rx="1"
            />
          ))}
          {bundles
            .filter((b) => b.weight === weight)
            .flatMap((b) =>
              b.paths.map((d, i) => <path key={`${b.key}${i}`} data-conductor={b.key} d={d} />),
            )}
        </g>
      ))}

      {/* The socket pin field, and the vias. Capped at LINE_FILL_CEILING like
          everything filled in this layer: a 4px dot is small enough to lose to
          the scrim, and nothing brighter than that may sit under text. */}
      <g fill={GOLD} fillOpacity={LINE_FILL_CEILING} stroke="none">
        {grid({ x: socket.x + 12, y: socket.y + 12, cols: 9, rows: 9, pitch: 9, r: 1.1, key: 'sock' })}
        {bundles.flatMap((b) =>
          b.vias.map((v, i) => (
            <circle key={`${b.key}v${i}`} data-via={b.key} cx={v.x} cy={v.y} r="1.4" />
          )),
        )}
      </g>
    </svg>
  )
}

// ── The edge-pinned hardware layers ─────────────────────────────────────────
// Everything with real gold in it. Tall narrow viewBoxes so the drawing never
// scales UP at ordinary widths — at 300px wide and any viewport under 900px
// tall it meets horizontally and crops vertically from the centre, which keeps
// component sizes stable across screens.
//
// Both crop toward the middle of the page (xMin on the left, xMax on the
// right), so what gets cut is always the edge nearest the text.
function Hardware({ side, column }) {
  const left = side === 'left'
  return (
    <svg
      aria-hidden="true"
      data-board-layer="hardware"
      className={`absolute inset-y-0 ${left ? 'left-0' : 'right-0'} hidden h-full lg:block`}
      // ⚠️ Measured, not guessed. A flat 16vw was the first attempt and it
      // FAILED on /help at 1024px: 33 text nodes overlapped the right-hand
      // layer, because a fixed width has no idea how wide the column it must
      // stay clear of is. The gutter is what actually constrains this, so the
      // gutter is what sizes it — and GUTTER_MARGIN keeps a gap rather than
      // letting the two just touch.
      //
      // clamp() collapses the layer to nothing when the gutter runs out, so
      // there is no breakpoint to keep in step with the column widths. The
      // lg: gate above is only there to stop a narrow sliver of board showing
      // on a tablet, where the drawing would read as noise rather than as
      // hardware.
      style={{ width: hardwareWidth(column) }}
      viewBox="0 0 300 900"
      preserveAspectRatio={`${left ? 'xMin' : 'xMax'}YMid slice`}
    >
      {left ? (
        <>
          <g fill="none" stroke={GOLD} strokeOpacity="0.42" strokeWidth="1.2" style={CRISP}>
            <rect x="40" y="150" width="200" height="200" rx="3" />
            <rect x="58" y="168" width="164" height="164" />
            <path d="M40 172v-22h24M216 150h24v22M40 328v22h24M216 350h24v-22" />
            <rect x="34" y="380" width="230" height="14" rx="1" />
            <rect x="20" y="430" width="258" height="22" rx="1" />
            <rect x="20" y="500" width="140" height="20" rx="1" />
            <rect x="20" y="560" width="258" height="22" rx="1" />
            <rect x="34" y="620" width="230" height="14" rx="1" />
            <circle cx="250" cy="80" r="18" />
            <circle cx="250" cy="124" r="18" />
            <rect x="40" y="690" width="150" height="26" rx="1" />
          </g>
          <g fill="none" stroke={GOLD} strokeOpacity="0.62" strokeWidth="2.4" style={CRISP}>
            <path d="M250 98v34M140 350v30l-30 30v20" />
            <path d="M20 452v40l24 24h60" />
          </g>
          <g fill={GOLD} fillOpacity="0.45" stroke="none">
            {grid({ x: 76, y: 186, cols: 9, rows: 9, pitch: 18, r: 2.6, key: 'p' })}
          </g>
          <g fill={GOLD} fillOpacity="0.85" stroke="none">
            <rect x="28" y="436" width="92" height="10" />
            <rect x="128" y="436" width="142" height="10" />
            <rect x="28" y="566" width="92" height="10" />
            <rect x="128" y="566" width="142" height="10" />
            <rect x="28" y="506" width="124" height="8" />
          </g>
          <g fill={GOLD} fillOpacity="0.7" stroke="none">
            <rect x="40" y="384" width="218" height="6" />
            <rect x="40" y="624" width="218" height="6" />
          </g>
        </>
      ) : (
        <>
          <g fill="none" stroke={GOLD} strokeOpacity="0.42" strokeWidth="1.2" style={CRISP}>
            <rect x="36" y="70" width="28" height="300" rx="1" />
            <rect x="80" y="70" width="28" height="300" rx="1" />
            <rect x="124" y="70" width="28" height="300" rx="1" />
            <rect x="168" y="70" width="28" height="300" rx="1" />
            <rect x="40" y="470" width="170" height="140" rx="3" />
            <rect x="58" y="488" width="134" height="104" />
            <rect x="226" y="540" width="62" height="28" rx="1" />
            <rect x="226" y="582" width="62" height="28" rx="1" />
            <circle cx="250" cy="430" r="26" />
            <circle cx="252" cy="110" r="16" />
            <circle cx="252" cy="152" r="16" />
            <rect x="40" y="690" width="150" height="26" rx="1" />
          </g>
          <g fill="none" stroke={GOLD} strokeOpacity="0.62" strokeWidth="2.4" style={CRISP}>
            <path d="M196 400h40l20 20v30M40 610v30l-20 20v40" />
            <path d="M252 168v40l-30 30v40" />
          </g>
          <g fill={GOLD} fillOpacity="0.85" stroke="none">
            <rect x="42" y="96" width="16" height="248" />
            <rect x="86" y="96" width="16" height="248" />
            <rect x="130" y="96" width="16" height="248" />
            <rect x="174" y="96" width="16" height="248" />
          </g>
          <g fill={GOLD} fillOpacity="0.7" stroke="none">
            <rect x="232" y="548" width="50" height="6" />
            <rect x="232" y="590" width="50" height="6" />
          </g>
          <g fill={GOLD} fillOpacity="0.5" stroke="none">
            {grid({ x: 50, y: 698, cols: 20, rows: 2, pitch: 7.4, r: 1.8, key: 'h' })}
          </g>
        </>
      )}
    </svg>
  )
}

// The soft-edged band that sits over the readable column.
//
// The stops are PERCENTAGES rather than `calc(100% - 100px)`, which is what
// this originally used. The element's width is known here, so the two are
// exactly equivalent — but jsdom's CSS parser rejects a gradient containing
// calc() outright and drops the whole declaration to `background-image: none`.
// A value no test environment can read is a value no test can ever guard.
function Scrim({ column }) {
  const width = column + SCRIM_FADE * 2
  const fade = (SCRIM_FADE / width) * 100
  const opaque = `rgba(${GROUND_RGB},${SCRIM_ALPHA})`
  const clear = `rgba(${GROUND_RGB},0)`
  const stop = (pct) => `${pct.toFixed(3)}%`

  return (
    <div
      data-scrim
      className="absolute inset-y-0 left-1/2 -translate-x-1/2"
      style={{
        width,
        background: `linear-gradient(90deg,${clear} 0%,${opaque} ${stop(fade)},${opaque} ${stop(100 - fade)},${clear} 100%)`,
      }}
    />
  )
}

// `column` is the pixel width of the page's readable column — 672 for
// `max-w-2xl`, 768 for `max-w-3xl`. Pass 0 (the default) for a screen whose
// viewport is already covered in opaque panels, where a scrim would dim the
// board for nothing.
export default function BoardBackground({ column = 0 }) {
  return (
    <div aria-hidden="true" data-board className="pointer-events-none fixed inset-0 -z-10 bg-ground">
      <Lines />
      <Hardware side="left" column={column} />
      <Hardware side="right" column={column} />

      {column > 0 && <Scrim column={column} />}

      {/* Inherited from Backdrop, and deliberately gentler than it was: the
          board now lives at the edges, so the old vignette would have snuffed
          out the most interesting part of the drawing. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 130% 115% at 50% 50%,rgba(9,11,14,0) 62%,rgba(9,11,14,0.55) 100%)`,
        }}
      />
    </div>
  )
}
