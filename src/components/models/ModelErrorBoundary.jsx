import { Component } from 'react'

// Local error boundary for a single 3D part. If a GLTF fails to load (missing
// file, bad parse, unsupported feature) it renders the `fallback` — the part's
// procedural primitive model — instead of tripping the whole-canvas boundary.
export default class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    // Swallowed on purpose: a missing/broken part model degrades to the
    // primitive, it isn't an app error worth surfacing.
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}
