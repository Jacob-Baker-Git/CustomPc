import { X } from 'lucide-react'
import useBuilderStore from '../store/useBuilderStore'
import { PANEL_STRONG } from '../lib/uiTokens'

// Shown after a share link replaces the build: what happened, and where the
// visitor's own build went. The setup wizard's "generated build" notices went
// with the wizard (spec 2026-10-13).
export default function GeneratedBanner() {
  const info  = useBuilderStore((s) => s.lastGenerated)
  const clear = useBuilderStore((s) => s.clearLastGenerated)

  if (!info?.shared) return null

  return (
    <div role="status" className={`${PANEL_STRONG} flex items-center gap-4 px-4 py-2.5`}>
      <p className="text-xs text-muted">
        Opened a shared build.
        {info.savedPrevious && <> Your previous build is in <span className="text-ink">Saved builds</span>.</>}
      </p>
      <button
        onClick={clear}
        aria-label="Dismiss"
        className="ml-auto w-6 h-6 flex items-center justify-center rounded-lg text-muted hover:text-ink transition-colors"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
