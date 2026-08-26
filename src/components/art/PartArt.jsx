import { artVariant } from '../../lib/artVariant'

// Drawn artwork for a part, one SVG per category.
//
// WHY THIS RATHER THAN PHOTOGRAPHY. People shop with their eyes, and a list of
// 559 names with no pictures is a spreadsheet. Real product photography would
// be better still, but there is no free, licence-clean source that covers 559
// specific SKUs: Wikimedia has almost nothing at SKU level, manufacturer press
// images carry no blanket licence, and hotlinking a retailer would need the CSP
// opened to third-party hosts and would send every visitor's IP to them, which
// the privacy page promises does not happen. See docs for the sourcing note.
//
// So these are drawn. They are honest about being drawings, they cost nothing
// to serve, they cannot 404, and they work offline. Every one is a small
// number of vector shapes inheriting the page palette, so they retheme for
// free and stay sharp at any size.
//
// DETERMINISTIC VARIATION. A grid of 80 identical CPU tiles reads as a loading
// state, so a couple of details on each drawing come from a hash of the part
// id: how many fans a card has, which way a stripe runs. Same part, same
// drawing, every time — see artVariant.
//
// Colours come from the palette vars rather than literals so the artwork
// follows the site. `--tech` (straw) is the data metal and does the line work;
// `--brass` picks out the one feature that identifies the part.

const S = {
  body: '#22262D',
  bodyDark: '#1b1f26',
  edge: '#3A404B',
  line: 'var(--tech)',
  hot: 'var(--brass)',
  gold: 'var(--gold)',
}

// Each drawing is authored in a 64x40 box and scaled by the caller.
const VB = '0 0 64 40'

function Cpu({ v }) {
  return (
    <>
      <rect x="14" y="6" width="36" height="28" rx="2" fill={S.body} stroke={S.edge} />
      <rect x="20" y="12" width="24" height="16" rx="1" fill={S.bodyDark} stroke={S.line} strokeWidth="0.6" />
      <path d="M20 12 h5 l-5 5 z" fill={S.hot} />
      {/* Pin rows on two edges, count varied so the grid is not a stamp. */}
      {Array.from({ length: 6 + (v % 3) }, (_, i) => (
        <rect key={i} x={17 + i * 4.6} y="34" width="2" height="3" fill={S.gold} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={`l${i}`} x="11" y={9 + i * 5} width="3" height="2" fill={S.gold} />
      ))}
    </>
  )
}

function Gpu({ v }) {
  const fans = 2 + (v % 2)
  const gap = fans === 3 ? 15 : 20
  const first = fans === 3 ? 16 : 20
  return (
    <>
      {/* Bracket, then shroud, then the fans that make it read as a card. */}
      <rect x="4" y="8" width="3" height="26" fill={S.edge} />
      <rect x="7" y="11" width="53" height="20" rx="1.5" fill={S.body} stroke={S.edge} />
      <rect x="7" y="11" width="53" height="3" fill={S.bodyDark} />
      {Array.from({ length: fans }, (_, i) => (
        <g key={i}>
          <circle cx={first + i * gap} cy="21" r="7" fill={S.bodyDark} stroke={S.line} strokeWidth="0.6" />
          <circle cx={first + i * gap} cy="21" r="2" fill={S.hot} />
        </g>
      ))}
      <rect x="7" y="31" width="53" height="2" fill={S.edge} />
    </>
  )
}

function Motherboard({ v }) {
  return (
    <>
      <rect x="8" y="4" width="48" height="32" rx="1.5" fill={S.body} stroke={S.edge} />
      {/* Socket, the thing that decides what fits. */}
      <rect x="13" y="9" width="13" height="13" rx="1" fill={S.bodyDark} stroke={S.hot} strokeWidth="0.8" />
      {/* DIMM slots. */}
      {Array.from({ length: 2 + (v % 3) }, (_, i) => (
        <rect key={i} x={31 + i * 3.5} y="8" width="1.8" height="15" rx="0.6" fill={S.gold} />
      ))}
      {/* PCIe slot and chipset heatsink. */}
      <rect x="13" y="27" width="30" height="2.5" rx="0.8" fill={S.line} />
      <rect x="45" y="25" width="8" height="8" rx="1" fill={S.bodyDark} stroke={S.edge} />
      <circle cx="49" cy="29" r="1.2" fill={S.line} />
    </>
  )
}

function Ram({ v }) {
  return (
    <>
      {/* The same silhouette as the RamBox panels, so the drawing and the
          chrome around it are recognisably the same object. */}
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={i} x={9 + i * 9.5} y="6" width="6" height="5" rx="1" fill={S.edge} />
      ))}
      <rect x="6" y="10" width="52" height="19" rx="1" fill={S.body} stroke={S.edge} />
      <rect x="9" y="14" width={16 + (v % 3) * 6} height="3" rx="1.5" fill={S.gold} />
      <rect x="6" y="29" width="52" height="4" fill={S.bodyDark} />
      {Array.from({ length: 18 }, (_, i) => (
        <rect key={`p${i}`} x={8 + i * 2.7} y="29" width="1.5" height="4" fill={S.gold} />
      ))}
      <rect x="27" y="29" width="2" height="4" fill={S.bodyDark} />
    </>
  )
}

function Storage({ v }) {
  // Two real form factors, chosen by variant: an M.2 stick and a 2.5" drive.
  if (v % 2 === 0) {
    return (
      <>
        <rect x="6" y="15" width="52" height="11" rx="1" fill={S.body} stroke={S.edge} />
        <rect x="12" y="17" width="30" height="7" rx="0.8" fill={S.bodyDark} stroke={S.line} strokeWidth="0.5" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={7 + i * 1.8} y="21" width="1" height="5" fill={S.gold} />
        ))}
        <circle cx="53" cy="20.5" r="1.6" fill="none" stroke={S.edge} />
      </>
    )
  }
  return (
    <>
      <rect x="10" y="7" width="44" height="26" rx="2" fill={S.body} stroke={S.edge} />
      <rect x="15" y="12" width="26" height="12" rx="1" fill={S.bodyDark} stroke={S.line} strokeWidth="0.5" />
      <rect x="15" y="12" width="26" height="3" fill={S.hot} />
      <circle cx="48" cy="11" r="1.2" fill={S.edge} />
      <circle cx="48" cy="29" r="1.2" fill={S.edge} />
    </>
  )
}

function Psu() {
  return (
    <>
      <rect x="8" y="8" width="48" height="26" rx="2" fill={S.body} stroke={S.edge} />
      <circle cx="26" cy="21" r="10" fill={S.bodyDark} stroke={S.line} strokeWidth="0.6" />
      {/* Blades, as spokes rather than an outline, so it reads at 24px. */}
      {Array.from({ length: 7 }, (_, i) => (
        <line
          key={i}
          x1="26" y1="21"
          x2={26 + 9 * Math.cos((i * 2 * Math.PI) / 7)}
          y2={21 + 9 * Math.sin((i * 2 * Math.PI) / 7)}
          stroke={S.edge} strokeWidth="1.4"
        />
      ))}
      <circle cx="26" cy="21" r="2.4" fill={S.hot} />
      {Array.from({ length: 3 }, (_, i) => (
        <rect key={i} x="42" y={13 + i * 6} width="10" height="3.5" rx="1.2" fill={S.bodyDark} stroke={S.edge} strokeWidth="0.5" />
      ))}
    </>
  )
}

function Case({ v }) {
  return (
    <>
      <rect x="16" y="2" width="32" height="36" rx="2" fill={S.body} stroke={S.edge} />
      {/* Side window, the thing people actually choose a case for. */}
      <rect x="21" y="7" width="22" height="26" rx="1" fill={S.bodyDark} stroke={S.line} strokeWidth="0.6" />
      <rect x="24" y="11" width="10" height="14" rx="0.8" fill={S.body} stroke={S.edge} strokeWidth="0.5" />
      {Array.from({ length: 2 + (v % 2) }, (_, i) => (
        <circle key={i} cx="39" cy={12 + i * 8} r="2.6" fill="none" stroke={S.hot} strokeWidth="0.8" />
      ))}
      <circle cx="18.5" cy="5" r="0.9" fill={S.gold} />
    </>
  )
}

function Cooler({ v }) {
  // Tower or AIO, the two shapes that change what fits in a case.
  if (v % 2 === 0) {
    return (
      <>
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x="18" y={5 + i * 3} width="28" height="1.6" fill={S.edge} />
        ))}
        <rect x="30" y="5" width="4" height="27" fill={S.bodyDark} />
        <circle cx="14" cy="19" r="9" fill={S.bodyDark} stroke={S.line} strokeWidth="0.6" />
        <circle cx="14" cy="19" r="2.2" fill={S.hot} />
        <rect x="24" y="32" width="16" height="4" rx="1" fill={S.body} stroke={S.edge} />
      </>
    )
  }
  return (
    <>
      <rect x="6" y="9" width="24" height="22" rx="2" fill={S.body} stroke={S.edge} />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1={8 + i * 3.2} y1="11" x2={8 + i * 3.2} y2="29" stroke={S.edge} strokeWidth="1" />
      ))}
      <path d="M30 15 q10 -6 16 2" fill="none" stroke={S.line} strokeWidth="1.2" />
      <path d="M30 25 q10 6 16 -2" fill="none" stroke={S.line} strokeWidth="1.2" />
      <circle cx="52" cy="20" r="8" fill={S.bodyDark} stroke={S.edge} />
      <circle cx="52" cy="20" r="3" fill={S.hot} />
    </>
  )
}

function Fans({ v }) {
  const n = 1 + (v % 3)
  const r = n === 1 ? 14 : n === 2 ? 10 : 7.5
  const step = n === 1 ? 0 : n === 2 ? 22 : 16
  const start = 32 - ((n - 1) * step) / 2
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const cx = start + i * step
        return (
          <g key={i}>
            <rect x={cx - r - 1} y={20 - r - 1} width={r * 2 + 2} height={r * 2 + 2} rx="2" fill={S.body} stroke={S.edge} />
            <circle cx={cx} cy="20" r={r * 0.85} fill={S.bodyDark} />
            {Array.from({ length: 7 }, (_, k) => (
              <path
                key={k}
                d={`M${cx} 20 L${cx + r * 0.8 * Math.cos((k * 2 * Math.PI) / 7)} ${20 + r * 0.8 * Math.sin((k * 2 * Math.PI) / 7)}`}
                stroke={S.edge} strokeWidth={r * 0.22} strokeLinecap="round"
              />
            ))}
            <circle cx={cx} cy="20" r={r * 0.28} fill={S.hot} />
          </g>
        )
      })}
    </>
  )
}

function Paste() {
  return (
    <>
      <rect x="14" y="14" width="30" height="10" rx="5" fill={S.body} stroke={S.edge} />
      <rect x="42" y="17" width="6" height="4" rx="1" fill={S.edge} />
      <path d="M48 19 h4" stroke={S.edge} strokeWidth="2" strokeLinecap="round" />
      <circle cx="55" cy="19" r="3" fill={S.gold} />
      <rect x="18" y="17" width="14" height="4" rx="2" fill={S.bodyDark} />
    </>
  )
}

function MonitorArt() {
  return (
    <>
      <rect x="6" y="4" width="52" height="26" rx="2" fill={S.body} stroke={S.edge} />
      <rect x="9" y="7" width="46" height="19" rx="1" fill={S.bodyDark} stroke={S.line} strokeWidth="0.6" />
      <path d="M14 22 l8 -8 l6 6 l7 -10 l11 12 z" fill={S.edge} />
      <rect x="27" y="30" width="10" height="5" fill={S.edge} />
      <rect x="20" y="35" width="24" height="2.5" rx="1.2" fill={S.body} stroke={S.edge} strokeWidth="0.5" />
    </>
  )
}

function Keyboard() {
  return (
    <>
      <rect x="4" y="11" width="56" height="20" rx="2.5" fill={S.body} stroke={S.edge} />
      {Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 12 }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={7 + c * 4.3} y={14 + r * 5}
            width="3.2" height="3.6" rx="0.7"
            fill={r === 2 && c === 5 ? S.hot : S.bodyDark}
          />
        )),
      )}
      <rect x="20" y="26.5" width="24" height="3" rx="0.8" fill={S.bodyDark} />
    </>
  )
}

function Mouse() {
  return (
    <>
      <path d="M32 4 c9 0 14 7 14 15 v6 c0 8 -6 12 -14 12 s-14 -4 -14 -12 v-6 c0 -8 5 -15 14 -15 z"
            fill={S.body} stroke={S.edge} />
      <path d="M32 4 v14" stroke={S.edge} strokeWidth="0.8" />
      <rect x="30.5" y="9" width="3" height="7" rx="1.5" fill={S.hot} />
      <ellipse cx="32" cy="31" rx="6" ry="3" fill={S.bodyDark} />
    </>
  )
}

function Headset() {
  return (
    <>
      <path d="M14 24 v-4 a18 18 0 0 1 36 0 v4" fill="none" stroke={S.edge} strokeWidth="2.5" />
      <rect x="8" y="20" width="10" height="15" rx="3.5" fill={S.body} stroke={S.edge} />
      <rect x="46" y="20" width="10" height="15" rx="3.5" fill={S.body} stroke={S.edge} />
      <rect x="10.5" y="23" width="5" height="9" rx="2" fill={S.bodyDark} />
      <rect x="48.5" y="23" width="5" height="9" rx="2" fill={S.bodyDark} />
      <path d="M13 35 q0 5 6 5" fill="none" stroke={S.hot} strokeWidth="1.6" />
    </>
  )
}

const ART = {
  cpu: Cpu,
  gpu: Gpu,
  motherboard: Motherboard,
  ram: Ram,
  storage: Storage,
  psu: Psu,
  case: Case,
  cooler: Cooler,
  fans: Fans,
  paste: Paste,
  monitor: MonitorArt,
  keyboard: Keyboard,
  mouse: Mouse,
  headset: Headset,
}

export const HAS_ART = (category) => Object.hasOwn(ART, category)

export default function PartArt({ category, seed = '', className = '', title }) {
  const Shape = ART[category]
  if (!Shape) return null

  return (
    <svg
      viewBox={VB}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      <Shape v={artVariant(seed)} />
    </svg>
  )
}
