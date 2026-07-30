import { Component } from 'react'
import { BUILDER_STORAGE_KEY } from '../lib/storageKey'

// The app's last line of defence. Deliberately imports NOTHING but the storage
// key: no store, no catalogue, no icons. A crash caused by one of those must
// not also break the page that reports it.
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null, showDetail: false, confirmingReset: false }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  reload = () => { window.location.reload() }

  // Rewrites the persisted flow directly rather than going through the store,
  // for the same reason the module has no store import.
  backToMenu = () => {
    try {
      const raw = localStorage.getItem(BUILDER_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 2 }
      parsed.state = { ...parsed.state, flow: 'hub' }
      localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(parsed))
    } catch {
      // Unparseable state is exactly what Reset is for; fall through and reload.
    }
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  reset = () => {
    try { localStorage.removeItem(BUILDER_STORAGE_KEY) } catch { /* nothing else to try */ }
    this.setState({ hasError: false, error: null, confirmingReset: false })
    window.location.reload()
  }

  render() {
    const { hasError, error, showDetail, confirmingReset } = this.state
    if (!hasError) return this.props.children

    return (
      <div className="min-h-screen bg-ground text-ink flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-surface border border-line rounded-xl p-6 sm:p-8">
          <span className="font-display font-extrabold text-lg tracking-tight">
            PC <span className="text-accent">Builder</span>
          </span>

          <h1 className="font-display text-2xl font-bold mt-4 mb-2">Something went wrong</h1>
          <p className="text-sm text-muted">
            The builder hit an error and had to stop. Your saved build is still on this device.
            Reloading fixes most cases.
          </p>

          <div className="flex flex-wrap gap-2 mt-6">
            <button
              onClick={this.reload}
              className="bg-accent hover:brightness-110 text-accent-ink font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Reload the page
            </button>
            <button
              onClick={this.backToMenu}
              className="border border-line hover:border-line-strong text-ink px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              Back to the menu
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-line">
            {confirmingReset ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-bad w-full">
                  This erases your saved build, budget and peripherals. It cannot be undone.
                </p>
                <button
                  onClick={this.reset}
                  className="bg-bad text-ground font-semibold px-4 py-2 rounded-lg text-xs transition-colors hover:brightness-110"
                >
                  Yes, erase my build
                </button>
                <button
                  onClick={() => this.setState({ confirmingReset: false })}
                  className="border border-line text-muted hover:text-ink px-4 py-2 rounded-lg text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => this.setState({ confirmingReset: true })}
                className="text-xs text-muted hover:text-bad underline decoration-dashed underline-offset-4 transition-colors"
              >
                Still broken after reloading? Reset the app
              </button>
            )}
          </div>

          <div className="mt-5">
            <button
              onClick={() => this.setState({ showDetail: !showDetail })}
              aria-expanded={showDetail}
              className="text-xs text-faint hover:text-muted transition-colors"
            >
              {showDetail ? 'Hide technical detail' : 'Show technical detail'}
            </button>
            {showDetail && (
              <pre className="mt-2 p-3 bg-ground border border-line rounded-lg text-[11px] text-muted whitespace-pre-wrap break-words max-h-48 overflow-auto">
                {String(error?.message ?? error)}
              </pre>
            )}
          </div>

          <p className="text-xs text-faint mt-5">
            Seeing this a lot?{' '}
            <a href="#/feedback" className="text-accent hover:underline">Tell us what you were doing</a>.
          </p>
        </div>
      </div>
    )
  }
}
