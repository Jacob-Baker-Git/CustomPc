import { RESOLUTIONS } from '../../lib/perfEngine/gameRows'

const LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

// The build's target resolution.
//
// This used to be the column headers themselves — they wrote setResolution on
// click, which was the answer to "you can't select the resolution". The headers
// sort now, so the target needs a control of its own: two jobs on one hit area
// meant neither could be discovered from the other.
//
// It is a real radiogroup rather than three buttons because the choice is
// exclusive and arrow keys should move between the options.
export default function ResolutionPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <span id="res-picker-label" className="text-[10px] uppercase tracking-wider text-muted">
        Building for
      </span>
      <div role="radiogroup" aria-labelledby="res-picker-label" className="flex rounded-lg border border-line">
        {RESOLUTIONS.map((res) => {
          const active = res === value
          return (
            <button
              key={res}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange?.(res)}
              className={`px-2.5 py-1 text-[11px] first:rounded-l-lg last:rounded-r-lg ${
                active ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}
            >
              {LABEL[res]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
