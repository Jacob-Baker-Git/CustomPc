import { useEffect, useState } from 'react'
import { PANEL_STRONG } from '../lib/uiTokens'
import { specLabel, EMPTY_FILTERS } from '../lib/peripheralFilter'

// The peripherals tab's filter drawer.
//
// Filters are staged here and only take effect on Apply, rather than filtering
// the list under you as you tick. With four categories on one page a live
// filter means the grid reflows on every click, and you lose your place while
// still deciding — the whole reason for a panel instead of more inline chips.
//
// Price and brand are GLOBAL because the tab shows all four categories at once;
// the spec groups below them are per category, since a resolution means nothing
// to a headset.

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function Chip({ on, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-95
        ${on
          ? 'border-accent bg-accent text-accent-ink'
          : 'border-line bg-surface text-muted hover:text-ink hover:border-line-strong'}`}
    >
      {children}
    </button>
  )
}

function Group({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-faint mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

export default function PeripheralFilterPanel({ initial, options, onApply, onCancel }) {
  const [draft, setDraft] = useState(initial)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }))
  const chips = (key, values) =>
    values.map((v) => (
      <Chip key={v} on={draft[key].includes(v)} onClick={() => set(key, toggle(draft[key], v))}>{v}</Chip>
    ))

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter peripherals"
        className={`${PANEL_STRONG} w-full max-w-lg p-5 my-auto`}
      >
        <h3 className="text-ink text-sm font-semibold mb-4">Filters</h3>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-faint mb-1.5">Price</div>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" inputMode="numeric" placeholder="Min"
                aria-label="Minimum price"
                value={draft.priceMin}
                onChange={(e) => set('priceMin', e.target.value)}
                className="w-24 bg-surface-2 border border-line rounded-lg px-2.5 py-1.5 text-sm text-ink font-mono tabular-nums focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-faint">to</span>
              <input
                type="number" min="0" inputMode="numeric" placeholder="Max"
                aria-label="Maximum price"
                value={draft.priceMax}
                onChange={(e) => set('priceMax', e.target.value)}
                className="w-24 bg-surface-2 border border-line rounded-lg px-2.5 py-1.5 text-sm text-ink font-mono tabular-nums focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {options.brands.length > 0 && <Group label="Brand">{chips('brands', options.brands)}</Group>}

          {options.resolution.length > 0 && (
            <Group label={`Monitor · ${specLabel('monitor')}`}>{chips('resolution', options.resolution)}</Group>
          )}

          {options.refreshBands.length > 0 && (
            <Group label="Monitor · Refresh rate">
              {options.refreshBands.map((b) => (
                <Chip
                  key={b.id}
                  on={draft.refresh.includes(b.id)}
                  onClick={() => set('refresh', toggle(draft.refresh, b.id))}
                >
                  {b.label}
                </Chip>
              ))}
            </Group>
          )}

          {options.switch.length > 0 && (
            <Group label={`Keyboard · ${specLabel('keyboard')}`}>{chips('switch', options.switch)}</Group>
          )}

          {options.type.length > 0 && (
            <Group label={`Headset · ${specLabel('headset')}`}>{chips('type', options.type)}</Group>
          )}
        </div>

        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-line">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            className="text-xs px-3 py-2 rounded-lg border border-line text-muted hover:text-ink hover:border-line-strong transition-colors"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto text-xs px-3.5 py-2 rounded-lg border border-line text-muted hover:border-line-strong transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="text-xs px-4 py-2 rounded-lg bg-accent hover:brightness-110 text-accent-ink font-semibold transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
