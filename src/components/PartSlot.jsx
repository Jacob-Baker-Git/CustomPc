import { ELEV_GROUP, RAIL_ACTIVE, TELEMETRY } from '../lib/uiTokens'

// A part slot drawn as the connector the part actually plugs into.
//
// An empty slot reads as a hole in the build rather than as another grey row,
// and the designator teaches WHERE the part goes — which is information a
// beginner genuinely needs, so the label is structure rather than decoration.
//
// ⚠️ No `/NN` opacity modifiers on these tokens. `bg-gold/60` emits no CSS at
// all on this palette; tokenOpacity.test.js fails the build for it.
const CONNECTOR = {
  cpu: { designator: 'CPU_1', notch: 'square' },
  cooler: { designator: 'CPU_FAN', notch: 'square' },
  ram: { designator: 'DIMM_A2', notch: 'edge' },
  gpu: { designator: 'PCIEX16_1', notch: 'edge' },
  storage: { designator: 'M2_1', notch: 'edge' },
  psu: { designator: 'ATX_PWR', notch: 'pins' },
  motherboard: { designator: 'BOARD', notch: 'square' },
}

// `tone` is decided by the caller. A slot knows how to draw itself; it does not
// know whether the build needs it next.
//
// The two solid-tone branches use brightness rather than a colour swap, because
// their border already carries the meaning (bad / next) and changing it would
// change what the row says.
const TONE = {
  seated: 'text-ink hover:brightness-110',
  flagged: 'border border-dashed border-bad text-ink hover:brightness-110',
  next: 'border border-dashed border-brass text-brass hover:brightness-110',
  optional: 'border border-dashed border-line-strong text-muted hover:border-brass hover:text-brass',
  empty: 'border border-dashed border-line-strong text-muted hover:border-brass hover:text-brass',
}

// The contact pad. `edge` cuts the keying notch that stops a DIMM or a PCIe card
// going in backwards — the one detail that makes the shape read as a socket
// rather than a progress bar.
function Pad({ seated, notch }) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-3 w-12 shrink-0 rounded-sm ${seated ? 'bg-gold' : 'bg-surface-2'}`}
    >
      {notch === 'edge' && <i className="absolute inset-y-0 left-[34%] w-[3px] bg-ground" />}
      {notch === 'pins' && <i className="absolute inset-y-0 left-1/2 w-px bg-ground" />}
    </span>
  )
}

export default function PartSlot({
  category,
  label,
  part,
  tone,
  index,
  icon,
  note,
  tag,
  onClick,
  onRemove,
}) {
  const connector = CONNECTOR[category]
  const seated = Boolean(part)

  return (
    <div className={`rounded-lg ${ELEV_GROUP} ${seated ? RAIL_ACTIVE : ''}`}>
      {/* Two spans, not one string. Testing Library's getByText matches the
          whole normalised text of an element, so "PCIEX16_1" and "— empty"
          concatenated into one span makes BOTH assertions unfindable. */}
      {connector && (
        <span className="block px-3 pt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-tech">
          <span>{connector.designator}</span>
          {!seated && <span className="text-faint"> empty</span>}
        </span>
      )}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onClick}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors
            ${TONE[seated ? 'seated' : (tone ?? 'empty')]}`}
        >
          {index != null && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface-2 font-mono text-[10px] text-muted">
              {index}
            </span>
          )}
          {icon}
          {/* Only where there IS a connector. A case does not plug into
              anything, so drawing it a contact pad would be decoration
              pretending to be structure — the one thing the designators are
              here to avoid. Seatedness is already carried by the rail. */}
          {connector && <Pad seated={seated} notch={connector.notch} />}
          <span className="min-w-0 flex-1">
            {seated && label && (
              <span className="block text-[10px] uppercase leading-none tracking-wide text-faint">{label}</span>
            )}
            <span className={`block truncate ${seated ? 'mt-0.5 leading-tight' : ''}`}>
              {seated ? part.name : (label ?? `Choose a ${category}`)}
            </span>
          </span>
          {note}
          {tag}
          {seated && part.price != null && (
            <span className={`${TELEMETRY} shrink-0 text-sm text-tech`}>£{part.price.toFixed(0)}</span>
          )}
        </button>
        {seated && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label ?? category}`}
            className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm text-muted transition-colors hover:bg-bad hover:text-ink"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  )
}
