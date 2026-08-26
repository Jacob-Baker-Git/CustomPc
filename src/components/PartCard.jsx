import { useState } from 'react'
import { Lock } from 'lucide-react'
import { valuePerPound } from '../lib/valueScore'
import { TELEMETRY } from '../lib/uiTokens'
import SpecSheet from './SpecSheet'
import PartThumb from './art/PartThumb'

// The specs a shopper actually compares, as chips rather than a stacked list.
//
// The list this replaces printed one short line per fact — "105W TDP",
// "Socket: AM5", "DDR5" — down the left edge under the price. Four such lines
// is four ragged rows of two words, which is the shape that made the browser
// feel like a spreadsheet: nothing is grouped, nothing leads, and every fact
// gets the same weight as every other. Chips put them on one flowing line,
// so the card reads name, price, then a strip of detail.
function specChips(part) {
  const chips = []
  if (part.socket) chips.push(part.socket)
  if (part.ramType) chips.push(part.ramType)
  if (part.capacityGb) {
    chips.push(part.capacityGb >= 1000 ? `${part.capacityGb / 1000}TB` : `${part.capacityGb}GB`)
  }
  if (part.wattage) chips.push(`${part.wattage}W`)
  if (part.tdp > 0) chips.push(`${part.tdp}W TDP`)
  return chips
}

export default function PartCard({ part, locked, lockReason, selected = false, onSelect }) {
  const [showInfo, setShowInfo] = useState(false)
  const chips = specChips(part)

  return (
    <div
      className={`relative rounded-xl border p-4 flex flex-col gap-2 transition-all
        ${locked
          ? 'border-line bg-surface-2 opacity-60'
          : selected
            ? 'border-gold bg-gold-soft ring-1 ring-gold'
            : 'border-line bg-surface hover:border-brass hover:-translate-y-0.5'
        }`}
    >
      <button
        type="button"
        title={locked ? lockReason : undefined}
        aria-disabled={locked || undefined}
        onClick={() => !locked && onSelect(part)}
        className={`text-left flex gap-3 focus-visible:outline-brass ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {/* The picture is the first thing in the row, because it is the first
            thing anyone looks at when choosing a component. Seeded on the part
            id so the same part draws the same way everywhere it appears. */}
        <PartThumb category={part.category} seed={part.id} size="lg" />

        <span className="min-w-0 flex-1 flex flex-col gap-1">
          {/* pr-6 keeps the name clear of the Locked / Selected badge pinned to
              the card's top-right corner. */}
          <span className="text-sm font-semibold text-ink leading-tight pr-6">{part.name}</span>
          <span className={`${TELEMETRY} font-bold text-tech`}>£{part.price.toFixed(2)}</span>
          {part.perfScore > 0 && (
            <span className="text-[11px] text-muted">
              <span className={`${TELEMETRY} text-ink`}>{valuePerPound(part).toFixed(1)}</span> perf/£100
            </span>
          )}
        </span>
      </button>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <span key={c} className="text-[10px] text-muted border border-line rounded-md px-1.5 py-0.5 whitespace-nowrap">
              {c}
            </span>
          ))}
        </div>
      )}

      {locked && lockReason && (
        <div className="text-[11px] text-bad leading-snug">{lockReason}</div>
      )}
      <button
        type="button"
        aria-label={`More info about ${part.name}`}
        aria-expanded={showInfo}
        onClick={() => setShowInfo((v) => !v)}
        className="self-start text-[11px] text-muted hover:text-brass border border-line hover:border-brass rounded-lg px-2 py-0.5 transition-colors"
      >
        {showInfo ? 'Hide info' : 'Info'}
      </button>
      {showInfo && <SpecSheet part={part} />}
      {locked && (
        <div role="img" aria-label="Locked" className="absolute top-2 right-2 text-bad">
          <Lock size={12} aria-hidden="true" />
        </div>
      )}
      {selected && !locked && (
        <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-gold border border-gold rounded-md px-1.5 py-0.5">
          Selected
        </div>
      )}
    </div>
  )
}
