import { BLADES, FIN_ROW_HEIGHT, CONTACT_HEIGHT, bladeStyle } from '../lib/ramBoxGeometry'

// A panel drawn as the DIMM it stands for.
//
// This owns CHROME ONLY — fins, end caps, heatspreader, lit bar, contacts,
// socket. It knows nothing about builds, parts or prices; callers put whatever
// they like in `children`. That boundary is what lets the same component be a
// build list, a summary card and a filter rail.
//
// ⚠️ The gradients below are inline rather than Tailwind classes, deliberately.
// Every palette token is a bare `var()` holding a hex, so Tailwind cannot
// compose an opacity modifier onto one — `bg-gold/60` emits no CSS at all and
// tokenOpacity.test.js fails the build for it. Naming the var inside a gradient
// sidesteps the whole trap.
const BODY = 'linear-gradient(180deg,#2c323b 0 2px,#252a33 2px 26px,#1d2128 26px,#191c22)'
const GRAIN = 'repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px)'
const BLADE = 'linear-gradient(180deg,#333a44 0 1px,#272d36 1px 40%,#1f242b)'
const BLADE_EDGE = 'linear-gradient(90deg,#6d7683,#8992a0 40%,#4d545f)'
const CAP_L = 'linear-gradient(90deg,#4a515c,#2b3038 40%,#22262D)'
const CAP_R = 'linear-gradient(270deg,#4a515c,#2b3038 40%,#22262D)'

// Gold means SEATED. An empty slot is the same hardware, cold — the shape never
// changes, only the light.
const BAR_LIT = 'linear-gradient(90deg,#6b5730,var(--gold) 22%,#E9D0A0 48%,var(--gold) 74%,#6b5730)'
const BAR_DEAD = '#262a31'

// 3.2px pitch: pad, shadow, gap. At real size this reads as a strip of many
// fine fingers rather than a dozen tiles, which is what a DIMM edge looks like.
const LIVE = 'repeating-linear-gradient(90deg,#D9BE8A 0 1.7px,#8a6f3f 1.7px 2.1px,#13161b 2.1px 3.2px)'
const COLD = 'repeating-linear-gradient(90deg,#5c5340 0 1.7px,#3b3527 1.7px 2.1px,#13161b 2.1px 3.2px)'

function Blades() {
  return (
    <div aria-hidden="true" className="relative mx-3 -mb-px" style={{ height: FIN_ROW_HEIGHT }}>
      {BLADES.map((b, i) => (
        <span
          key={i}
          data-blade={b.rake}
          className="absolute bottom-0 rounded-t-sm"
          style={{ ...bladeStyle(b), backgroundImage: BLADE }}
        >
          <span className="absolute inset-x-0 top-0 h-px rounded-t-sm" style={{ backgroundImage: BLADE_EDGE }} />
        </span>
      ))}
    </div>
  )
}

// The contact edge runs corner to corner. The only break is the keying notch —
// the detail that actually says "this goes in one way round". The corner
// mounting notches a DIMM also has were built and removed: stamped over
// finished gold they slice live pads and read as damage rather than as outline.
//
// `live` rather than `seated` on purpose: by Task 3 these come apart. A box can
// be seated and still have cold contacts, because opening lifts it clear.
function Contacts({ live }) {
  return (
    <div
      aria-hidden="true"
      data-contacts={live ? 'live' : 'cold'}
      className="relative mx-3 flex items-end border border-t-0 border-line-strong bg-[#13161b]"
      style={{ height: CONTACT_HEIGHT }}
    >
      <span className="h-2 flex-1" style={{ backgroundImage: live ? LIVE : COLD }} />
      <i className="w-1.5 self-stretch bg-ground shadow-[inset_1px_0_0_var(--line-strong),inset_-1px_0_0_var(--line-strong)]" />
      <span className="h-2 flex-[2.4]" style={{ backgroundImage: live ? LIVE : COLD }} />
    </div>
  )
}

export default function RamBox({ designator, seated = false, open = false, className = '', children }) {
  return (
    <div data-ram-box data-seated={String(seated)} data-open={String(open)} className={className}>
      <div className="flex flex-col">
        <Blades />
        <div className="relative flex flex-1 px-3">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-2.5 rounded-t-sm" style={{ backgroundImage: CAP_L }} />
          <span aria-hidden="true" className="absolute inset-y-0 right-0 z-10 w-2.5 rounded-t-sm" style={{ backgroundImage: CAP_R }} />
          <div className="relative flex-1 border border-b-0 border-line-strong" style={{ backgroundImage: BODY }}>
            <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.55 }} />
            <span
              aria-hidden="true"
              className="absolute left-0 top-2 z-[4] h-[9px] w-2/5 rounded-r-sm"
              style={{
                background: seated ? BAR_LIT : BAR_DEAD,
                boxShadow: seated ? '0 0 10px 1px rgba(201,168,107,.28)' : 'none',
              }}
            />
            <div className="relative z-[2] px-4 pb-3 pt-8">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-tech">{designator}</span>
              {children}
            </div>
          </div>
        </div>
        <Contacts live={seated} />
      </div>
    </div>
  )
}
