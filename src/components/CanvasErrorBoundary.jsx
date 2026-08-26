import { Component } from 'react'

// Catches WebGL/three crashes so a GPU hiccup shows a friendly retry message
// instead of a dead white canvas taking the whole build view down.
export default class CanvasErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-muted">3D view unavailable on this device right now.</p>
          <button
            onClick={() => this.setState({ failed: false })}
            className="text-xs px-4 py-2 rounded-lg border border-line text-ink hover:border-brass hover:text-brass transition-colors"
          >
            Retry 3D view
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
