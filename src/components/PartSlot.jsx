import { TELEMETRY } from '../lib/uiTokens'
import { gbp } from '../lib/money'

// One part slot: a hairline-divided row (configurator look, spec 2026-10-16).
// An empty slot keeps its dashed outline so it still reads as a gap in the
// build rather than as another row.
//
// ⚠️ No `/NN` opacity modifiers on these tokens. `bg-gold/60` emits no CSS at
// all on this palette; tokenOpacity.test.js fails the build for it.

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
  hot,
  onHot,
}) {
  const seated = Boolean(part)
  // A seated row lights its label on the showroom still (spec 2026-10-20).
  const link = seated && onHot
  const price = seated && part.price != null ? gbp(part.price) : null

  return (
    <div
      data-part-row={seated ? category : undefined}
      onMouseEnter={link ? () => onHot(category) : undefined}
      onMouseLeave={link ? () => onHot(null) : undefined}
      onFocus={link ? () => onHot(category) : undefined}
      onBlur={link ? () => onHot(null) : undefined}
      className={`border-t border-line transition-colors ${seated && hot === category ? 'bg-surface-2' : ''}`}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={onClick}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors
            ${TONE[seated ? 'seated' : (tone ?? 'empty')]}`}
        >
          {index != null && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface-2 font-mono text-[12px] text-muted">
              {index}
            </span>
          )}
          {icon}
          <span className="min-w-0 flex-1">
            {seated && label && (
              <span className={`flex gap-2 text-[12px] uppercase leading-none tracking-wide ${hot === category ? 'text-brass' : 'text-faint'}`}>
                {label}
                {/* On a phone the price sits with the type, leaving the name
                    the row's full width (spec 2026-10-20). */}
                {price && <span className={`${TELEMETRY} text-tech sm:hidden`}>{price}</span>}
              </span>
            )}
            {/* The name wraps, never truncates: "i7-14700KF" keeps its KF and
                the RAM its 32GB (showroom spec: names wrap). */}
            <span className={`block break-words ${seated ? 'mt-0.5 leading-tight' : ''}`}>
              {seated ? part.name : (label ?? `Choose a ${category}`)}
            </span>
          </span>
          {note}
          {tag}
          {price && <span className={`${TELEMETRY} hidden shrink-0 text-sm text-tech sm:inline`}>{price}</span>}
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
