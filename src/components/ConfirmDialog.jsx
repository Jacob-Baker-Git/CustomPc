import { useEffect } from 'react'
import { PANEL_STRONG } from '../lib/uiTokens'

// The app's one destructive-action confirm. Extracted when the Build tab grew
// its own "Clear all" next to Your parts: two hand-maintained copies of a modal
// drift, and the copy that drifts is always the one nobody is looking at.
//
// `ariaLabel` is separate from `title` on purpose — the heading is a question
// ("Clear the whole build?") while the accessible name wants to be the action.
export default function ConfirmDialog({ title, ariaLabel, body, confirmLabel, onConfirm, onCancel }) {
  // Escape closes it. A destructive dialog you cannot dismiss by reflex is a
  // dialog people dismiss by hitting the red button instead.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div role="dialog" aria-modal="true" aria-label={ariaLabel ?? title} className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
        <h3 className="text-ink text-sm font-semibold mb-2">{title}</h3>
        <p className="text-xs text-muted">{body}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="text-xs px-3.5 py-2 rounded-lg border border-line text-muted hover:border-line-strong transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-xs px-3.5 py-2 rounded-lg border border-bad text-bad hover:brightness-110 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
