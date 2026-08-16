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

// The contact strip's base colour, behind the fingers and behind the keying
// notch cutout. Named once so a retune can't leave one occurrence behind.
const CONTACT_BASE = '#13161b'

// 3.2px pitch: pad, shadow, gap. At real size this reads as a strip of many
// fine fingers rather than a dozen tiles, which is what a DIMM edge looks like.
const LIVE = `repeating-linear-gradient(90deg,#D9BE8A 0 1.7px,#8a6f3f 1.7px 2.1px,${CONTACT_BASE} 2.1px 3.2px)`
const COLD = `repeating-linear-gradient(90deg,#5c5340 0 1.7px,#3b3527 1.7px 2.1px,${CONTACT_BASE} 2.1px 3.2px)`

// The socket the part came out of. It renders as a SIBLING below the box, not
// inside it — a slot is not part of the part. Its gold is the same gold that
// left the contacts: the eye follows the part out of its seat.
function Socket() {
  return (
    <div
      aria-hidden="true"
      data-socket
      className="relative mx-1 h-[15px] rounded-b-sm border border-t-0 border-[#4a4335] bg-[linear-gradient(180deg,#1a1d23,#101318)] shadow-[inset_0_3px_7px_-2px_rgba(201,168,107,.5)]"
    >
      <i className="absolute inset-y-0.5 left-[34%] w-[5px] rounded-sm bg-ground shadow-[inset_1px_0_0_var(--line),inset_-1px_0_0_var(--line)]" />
    </div>
  )
}

// 9x22px bars at the outer edges. Shut they stand upright gripping the caps;
// open they rock out, which is the physical tell that the part is free.
function Clip({ side, open }) {
  const deg = open ? (side === 'left' ? -26 : 26) : 0
  return (
    <span
      aria-hidden="true"
      data-clip={side}
      className="absolute bottom-0 z-20 h-[22px] w-[9px] rounded-sm bg-[linear-gradient(180deg,#454c57,#262b33)] transition-transform duration-200"
      style={{ [side]: '-3px', transform: `rotate(${deg}deg)`, transformOrigin: 'bottom center' }}
    />
  )
}

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
      className="relative mx-3 flex items-end border border-t-0 border-line-strong"
      style={{ height: CONTACT_HEIGHT, backgroundColor: CONTACT_BASE }}
    >
      <span className="h-2 flex-1" style={{ backgroundImage: live ? LIVE : COLD }} />
      <i className="w-1.5 self-stretch bg-ground shadow-[inset_1px_0_0_var(--line-strong),inset_-1px_0_0_var(--line-strong)]" />
      <span className="h-2 flex-[2.4]" style={{ backgroundImage: live ? LIVE : COLD }} />
    </div>
  )
}

export default function RamBox({ designator, seated = false, open = false, className = '', children }) {
  // Contacts are cold whenever the part is not electrically home — either
  // because nothing is seated, or because opening lifted it clear.
  const connected = seated && !open

  return (
    <div data-ram-box data-seated={String(seated)} data-open={String(open)} className={`relative ${className}`}>
      <div className="relative">
        <div className={`flex flex-col transition-transform duration-200 ${open ? '-translate-y-2' : ''}`}>
          <Blades />
          <div className="relative flex flex-1 px-3">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-2.5 rounded-t-sm" style={{ backgroundImage: CAP_L }} />
            <span aria-hidden="true" className="absolute inset-y-0 right-0 z-10 w-2.5 rounded-t-sm" style={{ backgroundImage: CAP_R }} />
            <div className="relative flex-1 border border-b-0 border-line-strong" style={{ backgroundImage: BODY }}>
              <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.55 }} />
              <span
                aria-hidden="true"
                data-bar={seated ? 'lit' : 'dead'}
                className="absolute left-0 top-2 z-[4] h-[9px] w-2/5 rounded-r-sm"
                style={{
                  background: seated ? BAR_LIT : BAR_DEAD,
                  boxShadow: seated ? '0 0 10px 1px rgba(201,168,107,.28)' : 'none',
                }}
              />
              {/* The lit bar is absolutely positioned at top-2 and is 9px tall,
                  so it occupies 8–17px down the body. Content has to clear 17px
                  or the bar paints straight through it — it sits at z-[4] and
                  this at z-[2]. pt-3 did exactly that: measured 5px of overlap
                  across the "Your parts" heading. pt-5 (20px) clears it.
                  Do not reduce this without measuring in a browser; jsdom
                  computes no layout and every unit test stayed green. */}
              <div className={`relative z-[2] px-4 pb-3 ${designator ? 'pt-8' : 'pt-5'}`}>
                {designator && (
                  <span data-designator className="font-mono text-[9px] uppercase tracking-[0.12em] text-tech">{designator}</span>
                )}
                {children}
              </div>
            </div>
          </div>
          <Contacts live={connected} />
        </div>
        <Clip side="left" open={open} />
        <Clip side="right" open={open} />
      </div>
      {open && <Socket />}
    </div>
  )
}
