import { useEffect, useRef, useState } from 'react'
import { BLADES, FIN_ROW_HEIGHT, CONTACT_HEIGHT, BODY_LIP_END, bladeStyle } from '../lib/ramBoxGeometry'

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
//
// The face is a SOLID field under a thin top lip, and both halves of that are
// deliberate.
//
// The lip stops at BODY_LIP_END (18px) rather than the 26px it used to, because
// content starts at 20px and text must sit on one colour — see the note in
// ramBoxGeometry.js for the measurement that forced it.
//
// Below the lip is one flat colour where a #1d2128→#191c22 ramp used to be, and
// the brushed GRAIN that ran over the whole face is gone. That grain was a
// repeating-linear-gradient painting a hairline every 3px, which at real size
// stopped reading as anodising and started reading as a box drawn out of
// stripes. The fine-line texture on this component now appears in exactly one
// place, the contact fingers below, where the lines ARE the thing being drawn.
const BODY = `linear-gradient(180deg,#2c323b 0 2px,#252a33 2px ${BODY_LIP_END}px,#1b1f26 ${BODY_LIP_END}px)`
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

// The socket the part came out of. Its gold is the same gold that left the
// contacts: the eye follows the part out of its seat.
//
// Two placements, and the difference is layout, not looks:
//
// `floating` sits BEHIND the stick, absolutely positioned, so it costs no
// height. That is what hover needs — a socket that adds 15px to the flow would
// shove the page around every time the pointer crossed a card, which reads as a
// glitch rather than as a mechanism. At rest the stick's own opaque contacts
// cover it completely; lifting uncovers it.
//
// In flow (the `open` case) it is a SIBLING below the box rather than a child —
// a slot is not part of the part — and the height it adds is wanted, because
// the panel it belongs to is expanding anyway.
function Socket({ floating = false, revealed = false }) {
  return (
    <div
      aria-hidden="true"
      data-socket
      className={`h-[15px] rounded-b-sm border border-t-0 border-[#4a4335] bg-[linear-gradient(180deg,#1a1d23,#101318)] shadow-[inset_0_3px_7px_-2px_rgba(201,168,107,.5)] ${
        floating
          ? `absolute inset-x-1 bottom-0 transition-opacity duration-200 ${revealed ? 'opacity-100' : 'opacity-0'}`
          : 'relative mx-1'
      }`}
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

export default function RamBox({
  designator,
  seated = false,
  open = false,
  liftOnHover = false,
  className = '',
  children,
}) {
  // Pointer and keyboard tracked SEPARATELY, not as one `lifted` flag.
  //
  // One flag looks equivalent and is not: tab to a card, then sweep the mouse
  // across it and away, and mouseleave clears the flag while the card is still
  // focused — it drops back into its slot with a focus ring floating over it.
  // Either input holding is enough to keep it out.
  const rootRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const lifted = hovered || focused

  // Driven through the same path as `open` rather than a parallel one, so the
  // whole mechanism — clips rocking out, contacts going cold, the stick rising
  // — stays defined in exactly one place.
  const unseated = open || (liftOnHover && lifted)

  // Contacts are cold whenever the part is not electrically home — either
  // because nothing is seated, or because it has been lifted clear.
  const connected = seated && !unseated

  // ⚠️ Focus is bound to an ANCESTOR, not to this component, and it has to be.
  //
  // The interactive element belongs to the caller and WRAPS this one —
  // MainMenu renders <button><RamBox/></button>. Focus therefore lands above
  // us, and focus events do not travel downward, so an onFocus prop on our own
  // root can never fire. It looked correct and did nothing: the box lifted for
  // a mouse and stayed dead for the keyboard.
  useEffect(() => {
    if (!liftOnHover) return undefined
    const target = rootRef.current?.closest('button, a, [tabindex]') ?? rootRef.current
    if (!target) return undefined

    const on = () => setFocused(true)
    const off = () => setFocused(false)
    target.addEventListener('focus', on)
    target.addEventListener('blur', off)
    return () => {
      target.removeEventListener('focus', on)
      target.removeEventListener('blur', off)
    }
  }, [liftOnHover])

  // The pointer, by contrast, is genuinely over this element, so these stay put.
  const lift = liftOnHover
    ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
    : null

  return (
    <div
      ref={rootRef}
      data-ram-box
      data-seated={String(seated)}
      data-open={String(open)}
      data-lifted={String(unseated)}
      className={`relative ${className}`}
      {...lift}
    >
      <div className="relative">
        {/* Behind the stick, so lifting uncovers it. Skipped when `open` already
            renders one in the flow — two sockets for one slot. */}
        {liftOnHover && !open && <Socket floating revealed={unseated} />}
        <div className={`relative flex flex-col transition-transform duration-200 ${unseated ? '-translate-y-2' : ''}`}>
          <Blades />
          <div className="relative flex flex-1 px-3">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-2.5 rounded-t-sm" style={{ backgroundImage: CAP_L }} />
            <span aria-hidden="true" className="absolute inset-y-0 right-0 z-10 w-2.5 rounded-t-sm" style={{ backgroundImage: CAP_R }} />
            {/* ⚠️ min-w-0 is load-bearing, not tidying. As a flex item this
                inherits `min-width: auto`, which refuses to shrink below the
                content's min-content width — and that width is set by the
                upgrade <select>s, since a select is sized by its widest
                <option> and options neither wrap nor truncate. One 395px part
                name was therefore holding the whole body open. The build grid
                asks for minmax(0, 1fr), so the column narrowed while the body
                did not: at 1280px it rendered 69px wider than its own fins and
                contact edge and lapped over the 3D viewport. Guarded by
                "the body never outgrows the stick" in e2e/ramBox.spec.js;
                jsdom computes no layout and cannot see this. */}
            <div className="relative min-w-0 flex-1 border border-b-0 border-line-strong" style={{ backgroundImage: BODY }}>
              <span
                aria-hidden="true"
                data-bar={seated ? 'lit' : 'dead'}
                className="absolute left-0 top-2 z-[4] h-[9px] w-2/5 rounded-r-sm"
                style={{
                  background: seated ? BAR_LIT : BAR_DEAD,
                  boxShadow: seated ? '0 0 10px 1px rgba(201,168,107,.28)' : 'none',
                }}
              />
              {/* pt-5 = CONTENT_TOP (20px), pt-8 = CONTENT_TOP_DESIGNATOR (32px),
                  and both figures are pinned in ramBoxGeometry.js because two
                  separate things depend on them.

                  The lit bar is absolutely positioned at top-2 and is 9px tall,
                  so it occupies 8–17px down the body. Content has to clear 17px
                  or the bar paints straight through it — it sits at z-[4] and
                  this at z-[2]. pt-3 did exactly that: measured 5px of overlap
                  across the "Your parts" heading. pt-5 clears it.

                  Content must ALSO start below BODY_LIP_END (18px), or headings
                  straddle the lip boundary and sit on two colours at once.
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
        <Clip side="left" open={unseated} />
        <Clip side="right" open={unseated} />
      </div>
      {open && <Socket />}
    </div>
  )
}
