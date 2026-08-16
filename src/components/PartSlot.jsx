import { ELEV_GROUP, RAIL_ACTIVE } from '../lib/uiTokens'

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

export default function PartSlot({ category, part, onClick }) {
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
          {!seated && <span className="text-faint"> — empty</span>}
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors
          ${seated
            ? 'text-ink hover:brightness-110'
            : 'border border-dashed border-line-strong text-muted hover:border-copper hover:text-copper'}`}
      >
        <span
          aria-hidden="true"
          className={`relative h-3 w-12 shrink-0 rounded-sm ${seated ? 'bg-gold' : 'bg-surface-2'}`}
        >
          {connector?.notch === 'edge' && (
            <i className="absolute inset-y-0 left-[34%] w-[3px] bg-ground" />
          )}
        </span>
        {seated ? part.name : `Choose a ${category}`}
      </button>
    </div>
  )
}
